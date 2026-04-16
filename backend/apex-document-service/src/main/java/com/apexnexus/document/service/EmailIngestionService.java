package com.apexnexus.document.service;

import com.apexnexus.document.model.Document;
import com.apexnexus.document.model.DocumentVersion;
import com.apexnexus.document.model.EmailIngestionConfig;
import com.apexnexus.document.model.EmailIngestionRule;
import com.apexnexus.document.repository.DocumentRepository;
import com.apexnexus.document.repository.DocumentVersionRepository;
import com.apexnexus.document.repository.EmailIngestionConfigRepository;
import com.apexnexus.document.service.EwsClient.EwsAttachmentContent;
import com.apexnexus.document.service.EwsClient.EwsAttachmentInfo;
import com.apexnexus.document.service.EwsClient.EwsMessage;
import jakarta.mail.*;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMultipart;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailIngestionService {

    private final EmailIngestionConfigRepository configRepository;
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final StorageService storageService;
    private final SearchIndexPublisher searchIndexPublisher;
    private final EwsClient ewsClient;

    // Track last poll time per config to avoid re-processing
    private final Map<UUID, Instant> lastPollTimes = new ConcurrentHashMap<>();

    /**
     * Poll all enabled IMAP configurations every 2 minutes.
     * Each config's own pollInterval is respected — we skip if not enough time has
     * elapsed.
     */
    @Scheduled(fixedDelay = 120_000, initialDelay = 30_000)
    public void pollAllMailboxes() {
        List<EmailIngestionConfig> configs = configRepository.findByEnabledTrue();
        if (configs.isEmpty())
            return;

        for (EmailIngestionConfig config : configs) {
            try {
                Instant lastPoll = lastPollTimes.getOrDefault(config.getId(), Instant.EPOCH);
                if (Instant.now().isBefore(lastPoll.plusSeconds(config.getPollInterval() * 60L))) {
                    continue; // not time yet
                }
                pollMailbox(config);
                lastPollTimes.put(config.getId(), Instant.now());
            } catch (Exception e) {
                log.error("Email ingestion failed for config '{}': {}", config.getName(), e.getMessage(), e);
            }
        }
    }

    /**
     * Poll a single mailbox on demand (for testing / manual trigger).
     */
    public int pollMailbox(EmailIngestionConfig config) {
        if ("EWS".equalsIgnoreCase(config.getProtocol())) {
            return pollEws(config);
        }
        return pollImap(config);
    }

    /* ─── EWS polling ─── */

    private int pollEws(EmailIngestionConfig config) {
        log.info("Polling EWS mailbox '{}' at {}", config.getName(), config.getEwsUrl());
        int ingested = 0;

        try {
            var httpClient = ewsClient.buildHttpClient(config.getEwsUrl(), config.getUsername(), config.getPassword());
            List<EwsMessage> messages = ewsClient.findUnreadWithAttachments(httpClient, config.getEwsUrl());
            log.info("EWS found {} unread messages with attachments", messages.size());

            boolean hasRules = config.getRules() != null &&
                    config.getRules().stream().anyMatch(r -> Boolean.TRUE.equals(r.getEnabled()));

            for (EwsMessage msg : messages) {
                try {
                    // Rule matching (if rules exist, apply them; otherwise take all)
                    EmailIngestionRule matchedRule;
                    if (hasRules) {
                        matchedRule = matchRulesSimple(config.getRules(), msg.from(), msg.subject(),
                                msg.hasAttachments());
                        if (matchedRule == null)
                            continue;
                    } else {
                        matchedRule = defaultRule(config);
                    }

                    // Get attachment info
                    List<EwsAttachmentInfo> attachments = ewsClient.getAttachmentInfo(
                            httpClient, config.getEwsUrl(), msg.itemId(), msg.changeKey());

                    for (EwsAttachmentInfo att : attachments) {
                        try {
                            EwsAttachmentContent content = ewsClient.downloadAttachment(
                                    httpClient, config.getEwsUrl(), att.id());
                            saveEmailAsDocument(content.data(), content.name(), content.contentType(),
                                    config, matchedRule, msg.from(), msg.subject());
                            ingested++;
                        } catch (Exception e) {
                            log.warn("Failed to download EWS attachment '{}': {}", att.name(), e.getMessage());
                        }
                    }

                    // Mark as read so we don't process again
                    ewsClient.markAsRead(httpClient, config.getEwsUrl(), msg.itemId(), msg.changeKey());

                } catch (Exception e) {
                    log.warn("Error processing EWS message '{}': {}", msg.subject(), e.getMessage());
                }
            }

        } catch (Exception e) {
            log.error("EWS connection error for '{}': {}", config.getName(), e.getMessage(), e);
        }

        log.info("EWS ingestion for '{}' complete — {} documents ingested", config.getName(), ingested);
        return ingested;
    }

    /* ─── IMAP polling ─── */

    private int pollImap(EmailIngestionConfig config) {
        log.info("Polling mailbox '{}' at {}:{}", config.getName(), config.getImapHost(), config.getImapPort());
        int ingested = 0;

        boolean ssl = Boolean.TRUE.equals(config.getUseSsl());
        String protocol = ssl ? "imaps" : "imap";

        Properties props = new Properties();
        props.put("mail.store.protocol", protocol);
        props.put("mail." + protocol + ".host", config.getImapHost());
        props.put("mail." + protocol + ".port", String.valueOf(config.getImapPort()));
        props.put("mail." + protocol + ".ssl.enable", String.valueOf(ssl));
        props.put("mail." + protocol + ".timeout", "15000");
        props.put("mail." + protocol + ".connectiontimeout", "15000");

        Store store = null;
        jakarta.mail.Folder folder = null;
        try {
            Session session = Session.getInstance(props);
            store = session.getStore(protocol);
            store.connect(config.getImapHost(), config.getImapPort(), config.getUsername(), config.getPassword());

            folder = store.getFolder(config.getFolderName());
            folder.open(jakarta.mail.Folder.READ_WRITE);

            Message[] messages = folder.getMessages();
            log.info("Found {} messages in folder '{}'", messages.length, config.getFolderName());

            for (Message message : messages) {
                try {
                    // Skip already-processed (flagged) messages
                    if (message.isSet(Flags.Flag.FLAGGED))
                        continue;

                    String from = extractSender(message);
                    String subject = message.getSubject() != null ? message.getSubject() : "(no subject)";

                    // Check if any enabled rule matches this message
                    EmailIngestionRule matchedRule = matchRules(config.getRules(), from, subject, message);
                    if (matchedRule == null)
                        continue;

                    log.info("Rule '{}' matched email from='{}' subject='{}'", matchedRule.getRuleName(), from,
                            subject);

                    // Extract and ingest attachments
                    int attachments = processAttachments(message, config, matchedRule, from, subject);
                    ingested += attachments;

                    // If no attachments but rule matched, save the email body as a text document
                    if (attachments == 0) {
                        String body = extractTextBody(message);
                        if (body != null && !body.isBlank()) {
                            saveEmailAsDocument(body.getBytes("UTF-8"), subject + ".txt", "text/plain",
                                    config, matchedRule, from, subject);
                            ingested++;
                        }
                    }

                    // Mark as processed
                    message.setFlag(Flags.Flag.FLAGGED, true);

                } catch (Exception e) {
                    log.warn("Error processing email: {}", e.getMessage());
                }
            }

        } catch (Exception e) {
            log.error("IMAP connection error for '{}': {}", config.getName(), e.getMessage(), e);
        } finally {
            closeQuietly(folder, store);
        }

        log.info("Email ingestion for '{}' complete — {} documents ingested", config.getName(), ingested);
        return ingested;
    }

    private EmailIngestionRule matchRules(List<EmailIngestionRule> rules, String from, String subject, Message msg) {
        boolean hasAtt = false;
        try {
            hasAtt = msg.getContentType() != null && msg.getContentType().toLowerCase().contains("multipart");
        } catch (Exception ignored) {
        }
        return matchRulesSimple(rules, from, subject, hasAtt);
    }

    private EmailIngestionRule matchRulesSimple(List<EmailIngestionRule> rules, String from, String subject,
            boolean hasAttachments) {
        if (rules == null || rules.isEmpty())
            return null;
        for (EmailIngestionRule rule : rules) {
            if (!Boolean.TRUE.equals(rule.getEnabled()))
                continue;
            switch (rule.getRuleType()) {
                case FROM_CONTAINS:
                    if (from != null && from.toLowerCase().contains(rule.getRuleValue().toLowerCase()))
                        return rule;
                    break;
                case FROM_EQUALS:
                    if (from != null && from.equalsIgnoreCase(rule.getRuleValue()))
                        return rule;
                    break;
                case SUBJECT_CONTAINS:
                    if (subject != null && subject.toLowerCase().contains(rule.getRuleValue().toLowerCase()))
                        return rule;
                    break;
                case SUBJECT_EQUALS:
                    if (subject != null && subject.equalsIgnoreCase(rule.getRuleValue()))
                        return rule;
                    break;
                case HAS_ATTACHMENT:
                    if (hasAttachments)
                        return rule;
                    break;
            }
        }
        return null;
    }

    private EmailIngestionRule defaultRule(EmailIngestionConfig config) {
        EmailIngestionRule rule = new EmailIngestionRule();
        rule.setRuleName("All Emails");
        rule.setRuleType(EmailIngestionRule.RuleType.HAS_ATTACHMENT);
        rule.setTargetFolderId(config.getTargetFolderId());
        rule.setEnabled(true);
        return rule;
    }

    private int processAttachments(Message message, EmailIngestionConfig config, EmailIngestionRule rule,
            String from, String subject) throws Exception {
        int count = 0;
        Object content = message.getContent();
        if (content instanceof MimeMultipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                BodyPart part = multipart.getBodyPart(i);
                if (Part.ATTACHMENT.equalsIgnoreCase(part.getDisposition()) ||
                        (part.getFileName() != null && !part.getFileName().isBlank())) {

                    String fileName = part.getFileName();
                    if (fileName == null || fileName.isBlank())
                        fileName = "attachment_" + i;
                    String mimeType = part.getContentType();
                    if (mimeType != null && mimeType.contains(";"))
                        mimeType = mimeType.split(";")[0].trim();

                    byte[] data = readBytes(part.getInputStream());
                    saveEmailAsDocument(data, fileName, mimeType, config, rule, from, subject);
                    count++;
                }
            }
        }
        return count;
    }

    private void saveEmailAsDocument(byte[] data, String fileName, String mimeType,
            EmailIngestionConfig config, EmailIngestionRule rule,
            String from, String subject) throws Exception {
        String sha256 = storageService.calculateSha256(data);
        String objectGuid = UUID.randomUUID().toString().replace("-", "");
        String extension = getExtension(fileName);
        String storageKey = String.format("documents/%s/v1/%s", objectGuid, fileName);

        storageService.storeFile(data, storageKey, mimeType);

        // Determine target folder: rule override > config default > null
        UUID targetFolder = rule.getTargetFolderId() != null ? rule.getTargetFolderId() : config.getTargetFolderId();

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("source", "email");
        metadata.put("emailFrom", from);
        metadata.put("emailSubject", subject);
        metadata.put("emailRule", rule.getRuleName());
        metadata.put("emailConfig", config.getName());
        metadata.put("ingestedAt", Instant.now().toString());

        Document doc = Document.builder()
                .objectGuid(objectGuid)
                .folderId(targetFolder)
                .projectId(config.getProjectId())
                .title("[Email] " + subject + " — " + fileName)
                .description("Ingested from email via rule '" + rule.getRuleName() + "'. From: " + from)
                .mimeType(mimeType)
                .fileExtension(extension)
                .sha256Hash(sha256)
                .fileSizeBytes((long) data.length)
                .storageKey(storageKey)
                .authorId(config.getCreatedBy())
                .tags(new String[] { "email-ingested", rule.getRuleName().toLowerCase().replace(" ", "-") })
                .metadataJson(metadata)
                .retentionPeriodYears(20)
                .retentionStartDate(Instant.now())
                .build();

        doc = documentRepository.save(doc);

        DocumentVersion version = DocumentVersion.builder()
                .document(doc)
                .versionNumber(1)
                .sha256Hash(sha256)
                .fileSizeBytes((long) data.length)
                .storageKey(storageKey)
                .authorId(config.getCreatedBy())
                .changeSummary("Ingested from email — " + from)
                .build();
        versionRepository.save(version);

        // Queue for search indexing (which also triggers PII scan)
        searchIndexPublisher.publishIndex(doc, data);

        log.info("Saved email document: {} ({} bytes)", doc.getTitle(), data.length);
    }

    private String extractSender(Message message) throws MessagingException {
        Address[] froms = message.getFrom();
        if (froms != null && froms.length > 0) {
            if (froms[0] instanceof InternetAddress ia) {
                return ia.getAddress();
            }
            return froms[0].toString();
        }
        return "unknown";
    }

    private String extractTextBody(Message message) {
        try {
            Object content = message.getContent();
            if (content instanceof String s)
                return s;
            if (content instanceof MimeMultipart mp) {
                for (int i = 0; i < mp.getCount(); i++) {
                    BodyPart bp = mp.getBodyPart(i);
                    if (bp.getContentType().toLowerCase().startsWith("text/plain")) {
                        return bp.getContent().toString();
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not extract email body: {}", e.getMessage());
        }
        return null;
    }

    private byte[] readBytes(InputStream is) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) != -1)
            bos.write(buf, 0, n);
        return bos.toByteArray();
    }

    private String getExtension(String fileName) {
        if (fileName == null)
            return "";
        int dot = fileName.lastIndexOf('.');
        return dot > 0 ? fileName.substring(dot + 1).toLowerCase() : "";
    }

    private void closeQuietly(jakarta.mail.Folder folder, Store store) {
        try {
            if (folder != null && folder.isOpen())
                folder.close(false);
        } catch (Exception ignored) {
        }
        try {
            if (store != null)
                store.close();
        } catch (Exception ignored) {
        }
    }
}
