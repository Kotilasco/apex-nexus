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

                    // Build EWS email metadata
                    Map<String, Object> ewsMeta = new LinkedHashMap<>();
                    ewsMeta.put("source", "email");
                    ewsMeta.put("emailFrom", msg.from());
                    ewsMeta.put("emailSubject", msg.subject());
                    ewsMeta.put("emailRule", matchedRule.getRuleName());
                    ewsMeta.put("emailConfig", config.getName());
                    ewsMeta.put("ingestedAt", Instant.now().toString());
                    ewsMeta.put("emailProtocol", "EWS");

                    UUID targetFolder = matchedRule.getTargetFolderId() != null
                            ? matchedRule.getTargetFolderId()
                            : config.getTargetFolderId();

                    // Create parent email document
                    String emailBody = "[EWS Email] From: " + msg.from() + "\nSubject: " + msg.subject();
                    Document parentDoc = saveEmailParentDocument(
                            emailBody.getBytes("UTF-8"),
                            msg.subject() + ".txt", "text/plain",
                            config, matchedRule, msg.from(), msg.subject(),
                            ewsMeta, null, targetFolder);
                    ingested++;

                    // Get attachment info and save as children
                    List<EwsAttachmentInfo> attachments = ewsClient.getAttachmentInfo(
                            httpClient, config.getEwsUrl(), msg.itemId(), msg.changeKey());

                    for (EwsAttachmentInfo att : attachments) {
                        try {
                            EwsAttachmentContent content = ewsClient.downloadAttachment(
                                    httpClient, config.getEwsUrl(), att.id());
                            Map<String, Object> attMeta = new LinkedHashMap<>(ewsMeta);
                            attMeta.put("attachmentFileName", content.name());
                            saveAttachmentDocument(content.data(), content.name(), content.contentType(),
                                    config, matchedRule, msg.from(), msg.subject(),
                                    parentDoc.getId(), attMeta, targetFolder);
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
        // Trust all SSL certificates (needed for Gmail and other public IMAP servers in
        // Docker)
        if (ssl) {
            props.put("mail." + protocol + ".ssl.trust", "*");
            props.put("mail." + protocol + ".ssl.checkserveridentity", "false");
        }

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

                    // Extract rich email metadata
                    Map<String, Object> emailMeta = extractEmailMetadata(message, from, subject, config, matchedRule);
                    String messageId = extractMessageId(message);

                    // Skip if this email was already ingested (by Message-ID)
                    if (messageId != null && documentRepository.findByEmailMessageId(messageId).isPresent()) {
                        log.info("Email already ingested (Message-ID={}), skipping", messageId);
                        message.setFlag(Flags.Flag.FLAGGED, true);
                        continue;
                    }

                    // --- Create parent email document (the email itself as .eml-like text) ---
                    String body = extractTextBody(message);
                    String emailContent = buildEmailSummary(from, subject, message, body);
                    UUID targetFolder = matchedRule.getTargetFolderId() != null
                            ? matchedRule.getTargetFolderId()
                            : config.getTargetFolderId();

                    Document parentDoc = saveEmailParentDocument(
                            emailContent.getBytes("UTF-8"),
                            subject + ".txt", "text/plain",
                            config, matchedRule, from, subject,
                            emailMeta, messageId, targetFolder);
                    ingested++;

                    // --- Extract and ingest attachments as children ---
                    int attachments = processAttachmentsLinked(message, config, matchedRule,
                            from, subject, parentDoc.getId(), emailMeta, targetFolder);
                    ingested += attachments;

                    log.info("Ingested email '{}' with {} attachment(s), parentId={}",
                            subject, attachments, parentDoc.getId());

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
        boolean hasAtt = hasRealAttachments(msg);
        return matchRulesSimple(rules, from, subject, hasAtt);
    }

    /**
     * Check if a message has real file attachments (not just inline HTML parts).
     */
    private boolean hasRealAttachments(Message msg) {
        try {
            Object content = msg.getContent();
            if (content instanceof MimeMultipart multipart) {
                for (int i = 0; i < multipart.getCount(); i++) {
                    BodyPart part = multipart.getBodyPart(i);
                    if (Part.ATTACHMENT.equalsIgnoreCase(part.getDisposition()) ||
                            (part.getFileName() != null && !part.getFileName().isBlank())) {
                        return true;
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not check attachments: {}", e.getMessage());
        }
        return false;
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

    private int processAttachmentsLinked(Message message, EmailIngestionConfig config, EmailIngestionRule rule,
            String from, String subject, UUID parentDocId, Map<String, Object> emailMeta,
            UUID targetFolder) throws Exception {
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

                    // Build attachment-specific metadata
                    Map<String, Object> attMeta = new LinkedHashMap<>(emailMeta);
                    attMeta.put("attachmentFileName", fileName);
                    attMeta.put("attachmentIndex", i);
                    attMeta.put("attachmentSize", data.length);

                    saveAttachmentDocument(data, fileName, mimeType, config, rule, from, subject,
                            parentDocId, attMeta, targetFolder);
                    count++;
                }
            }
        }
        return count;
    }

    /** Save the parent email document (email body as text). */
    private Document saveEmailParentDocument(byte[] data, String fileName, String mimeType,
            EmailIngestionConfig config, EmailIngestionRule rule,
            String from, String subject,
            Map<String, Object> emailMeta, String messageId,
            UUID targetFolder) throws Exception {
        String sha256 = storageService.calculateSha256(data);
        String objectGuid = UUID.randomUUID().toString().replace("-", "");
        String storageKey = String.format("documents/%s/v1/%s", objectGuid, fileName);

        storageService.storeFile(data, storageKey, mimeType);

        Document doc = Document.builder()
                .objectGuid(objectGuid)
                .folderId(targetFolder)
                .projectId(config.getProjectId())
                .title("[Email] " + subject)
                .description("Email from: " + from + " | Ingested via rule '" + rule.getRuleName() + "'")
                .mimeType(mimeType)
                .fileExtension(getExtension(fileName))
                .sha256Hash(sha256)
                .fileSizeBytes((long) data.length)
                .storageKey(storageKey)
                .authorId(config.getCreatedBy())
                .emailMessageId(messageId)
                .tags(new String[] { "email-ingested", "email-parent",
                        rule.getRuleName().toLowerCase().replace(" ", "-") })
                .metadataJson(emailMeta)
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
                .changeSummary("Email ingested from " + from)
                .build();
        versionRepository.save(version);

        searchIndexPublisher.publishIndex(doc, data);
        log.info("Saved parent email document: {} ({} bytes)", doc.getTitle(), data.length);
        return doc;
    }

    /** Save an attachment document linked to its parent email. */
    private void saveAttachmentDocument(byte[] data, String fileName, String mimeType,
            EmailIngestionConfig config, EmailIngestionRule rule,
            String from, String subject,
            UUID parentDocId, Map<String, Object> attMeta,
            UUID targetFolder) throws Exception {
        String sha256 = storageService.calculateSha256(data);
        String objectGuid = UUID.randomUUID().toString().replace("-", "");
        String storageKey = String.format("documents/%s/v1/%s", objectGuid, fileName);

        storageService.storeFile(data, storageKey, mimeType);

        Document doc = Document.builder()
                .objectGuid(objectGuid)
                .folderId(targetFolder)
                .projectId(config.getProjectId())
                .title("[Attachment] " + fileName + " — from: " + subject)
                .description("Email attachment from: " + from + " | Subject: " + subject)
                .mimeType(mimeType)
                .fileExtension(getExtension(fileName))
                .sha256Hash(sha256)
                .fileSizeBytes((long) data.length)
                .storageKey(storageKey)
                .authorId(config.getCreatedBy())
                .parentDocumentId(parentDocId)
                .tags(new String[] { "email-ingested", "email-attachment",
                        rule.getRuleName().toLowerCase().replace(" ", "-") })
                .metadataJson(attMeta)
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
                .changeSummary("Email attachment from " + from + " — " + subject)
                .build();
        versionRepository.save(version);

        searchIndexPublisher.publishIndex(doc, data);
        log.info("Saved attachment document: {} ({} bytes) -> parent={}", doc.getTitle(), data.length, parentDocId);
    }

    /* ─── Metadata extraction helpers ─── */

    /** Extract rich metadata from an email message. */
    private Map<String, Object> extractEmailMetadata(Message message, String from, String subject,
            EmailIngestionConfig config, EmailIngestionRule rule) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("source", "email");
        meta.put("emailFrom", from);
        meta.put("emailSubject", subject);
        meta.put("emailRule", rule.getRuleName());
        meta.put("emailConfig", config.getName());
        meta.put("ingestedAt", Instant.now().toString());

        try {
            // Date sent
            if (message.getSentDate() != null) {
                meta.put("emailDate", message.getSentDate().toInstant().toString());
            }
            // Date received
            if (message.getReceivedDate() != null) {
                meta.put("emailReceivedDate", message.getReceivedDate().toInstant().toString());
            }
            // Message-ID
            String messageId = extractMessageId(message);
            if (messageId != null) {
                meta.put("emailMessageId", messageId);
            }
            // To recipients
            Address[] toAddrs = message.getRecipients(Message.RecipientType.TO);
            if (toAddrs != null && toAddrs.length > 0) {
                StringBuilder toList = new StringBuilder();
                for (Address addr : toAddrs) {
                    if (toList.length() > 0)
                        toList.append(", ");
                    if (addr instanceof InternetAddress ia) {
                        toList.append(ia.getAddress());
                    } else {
                        toList.append(addr.toString());
                    }
                }
                meta.put("emailTo", toList.toString());
            }
            // CC recipients
            Address[] ccAddrs = message.getRecipients(Message.RecipientType.CC);
            if (ccAddrs != null && ccAddrs.length > 0) {
                StringBuilder ccList = new StringBuilder();
                for (Address addr : ccAddrs) {
                    if (ccList.length() > 0)
                        ccList.append(", ");
                    if (addr instanceof InternetAddress ia) {
                        ccList.append(ia.getAddress());
                    } else {
                        ccList.append(addr.toString());
                    }
                }
                meta.put("emailCc", ccList.toString());
            }
            // Reply-To
            Address[] replyTo = message.getReplyTo();
            if (replyTo != null && replyTo.length > 0 && replyTo[0] instanceof InternetAddress ia) {
                meta.put("emailReplyTo", ia.getAddress());
            }
            // Content type
            meta.put("emailContentType", message.getContentType());
            // Attachment count
            int attCount = countRealAttachments(message);
            meta.put("emailAttachmentCount", attCount);
            meta.put("emailHasAttachments", attCount > 0);
        } catch (Exception e) {
            log.debug("Could not extract some email metadata: {}", e.getMessage());
        }
        return meta;
    }

    /** Extract the Message-ID header from an email. */
    private String extractMessageId(Message message) {
        try {
            String[] headers = message.getHeader("Message-ID");
            if (headers != null && headers.length > 0) {
                return headers[0].trim();
            }
        } catch (Exception e) {
            log.debug("Could not extract Message-ID: {}", e.getMessage());
        }
        return null;
    }

    /** Count the number of real file attachments in a message. */
    private int countRealAttachments(Message message) {
        int count = 0;
        try {
            Object content = message.getContent();
            if (content instanceof MimeMultipart multipart) {
                for (int i = 0; i < multipart.getCount(); i++) {
                    BodyPart part = multipart.getBodyPart(i);
                    if (Part.ATTACHMENT.equalsIgnoreCase(part.getDisposition()) ||
                            (part.getFileName() != null && !part.getFileName().isBlank())) {
                        count++;
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return count;
    }

    /** Build a human-readable email summary for the parent document content. */
    private String buildEmailSummary(String from, String subject, Message message, String body) {
        StringBuilder sb = new StringBuilder();
        sb.append("═══════════════════════════════════════════\n");
        sb.append("  EMAIL DOCUMENT\n");
        sb.append("═══════════════════════════════════════════\n\n");
        sb.append("From:    ").append(from).append("\n");
        try {
            Address[] toAddrs = message.getRecipients(Message.RecipientType.TO);
            if (toAddrs != null) {
                sb.append("To:      ");
                for (int i = 0; i < toAddrs.length; i++) {
                    if (i > 0)
                        sb.append(", ");
                    sb.append(toAddrs[i].toString());
                }
                sb.append("\n");
            }
            Address[] ccAddrs = message.getRecipients(Message.RecipientType.CC);
            if (ccAddrs != null && ccAddrs.length > 0) {
                sb.append("CC:      ");
                for (int i = 0; i < ccAddrs.length; i++) {
                    if (i > 0)
                        sb.append(", ");
                    sb.append(ccAddrs[i].toString());
                }
                sb.append("\n");
            }
            if (message.getSentDate() != null) {
                sb.append("Date:    ").append(message.getSentDate().toString()).append("\n");
            }
            String msgId = extractMessageId(message);
            if (msgId != null) {
                sb.append("Msg-ID:  ").append(msgId).append("\n");
            }
        } catch (Exception ignored) {
        }
        sb.append("Subject: ").append(subject).append("\n");
        int attCount = countRealAttachments(message);
        if (attCount > 0) {
            sb.append("Attachments: ").append(attCount).append(" file(s)\n");
        }
        sb.append("\n───────────────────────────────────────────\n\n");
        if (body != null && !body.isBlank()) {
            sb.append(body);
        } else {
            sb.append("[No text content available]");
        }
        sb.append("\n\n═══════════════════════════════════════════\n");
        return sb.toString();
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
