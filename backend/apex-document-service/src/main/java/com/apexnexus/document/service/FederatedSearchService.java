package com.apexnexus.document.service;

import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.security.SecurityContextUtil;
import jakarta.mail.Folder;
import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.search.BodyTerm;
import jakarta.mail.search.FromStringTerm;
import jakarta.mail.search.OrTerm;
import jakarta.mail.search.SearchTerm;
import jakarta.mail.search.SubjectTerm;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

/**
 * Federated Search Service.
 *
 * Queries multiple external repositories *in parallel* and returns a unified,
 * ranked result list. The adapters below are demo-grade: they read from the
 * federated_index cache table (seeded to mimic Exchange, SharePoint, network
 * shares and a legacy ELO repository). Production would replace each adapter
 * with a live connector (EWS, Microsoft Graph, SMB, ELO REST).
 *
 * The point for the pitch: Apex Nexus is not a data lake — it is an
 * intelligence layer that SEES the whole organisation, even the bits that
 * were never migrated.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FederatedSearchService {

    private final JdbcTemplate jdbc;
    private final AuditPublisher auditPublisher;

    /** Bounded pool for live IMAP fan-out. Each live connector runs on this pool with a per-call timeout. */
    private final ExecutorService liveExecutor = Executors.newFixedThreadPool(4, r -> {
        Thread t = new Thread(r, "fed-live-mail");
        t.setDaemon(true);
        return t;
    });

    public List<Map<String, Object>> listSources() {
        return jdbc.queryForList("""
                SELECT id, name, source_type, endpoint_url, enabled,
                       last_indexed_at, doc_count_estimate
                FROM federated_sources
                ORDER BY name
                """);
    }

    public Map<String, Object> search(String query, Set<String> onlyTypes) {
        long t0 = System.currentTimeMillis();
        List<Map<String, Object>> federated = queryFederated(query, onlyTypes);
        List<Map<String, Object>> internal  = queryApexInternal(query);

        List<Map<String, Object>> all = new ArrayList<>();
        all.addAll(internal);
        all.addAll(federated);
        // Simple rank: internal first, then by modified_at desc
        all.sort((a, b) -> {
            int byInternal = Boolean.compare(
                "APEX".equals(b.get("source_type")),
                "APEX".equals(a.get("source_type")));
            if (byInternal != 0) return byInternal;
            Object da = a.get("modified_at"), db = b.get("modified_at");
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return db.toString().compareTo(da.toString());
        });

        Map<String, Long> byType = new LinkedHashMap<>();
        for (Map<String, Object> r : all) {
            String k = Objects.toString(r.get("source_type"), "UNKNOWN");
            byType.merge(k, 1L, Long::sum);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("query", query);
        out.put("total", all.size());
        out.put("breakdown", byType);
        out.put("results", all);
        out.put("tookMs", System.currentTimeMillis() - t0);

        try {
            UUID userId = SecurityContextUtil.currentUserId();
            auditPublisher.publish(AuditEvent.builder()
                    .userId(userId)
                    .action("FEDERATED_SEARCH")
                    .resourceType("FEDERATED")
                    .resourceName(query)
                    .details(Map.of(
                            "query", query,
                            "types", onlyTypes == null ? List.of() : new ArrayList<>(onlyTypes),
                            "total", all.size(),
                            "breakdown", byType))
                    .build());
        } catch (Exception ignored) { /* never block search on audit */ }

        return out;
    }

    private List<Map<String, Object>> queryFederated(String query, Set<String> onlyTypes) {
        String like = "%" + query.toLowerCase() + "%";
        StringBuilder sql = new StringBuilder("""
            SELECT fi.id, fi.title, fi.snippet, fi.author, fi.modified_at, fi.external_url,
                   fi.external_id,
                   fs.name AS source_name, fs.source_type
            FROM federated_index fi
            JOIN federated_sources fs ON fs.id=fi.source_id
            WHERE fs.enabled=true
              AND (lower(fi.title) LIKE ? OR lower(fi.snippet) LIKE ? OR lower(fi.author) LIKE ?)
            """);
        List<Object> args = new ArrayList<>(List.of(like, like, like));
        if (onlyTypes != null && !onlyTypes.isEmpty()) {
            sql.append(" AND fs.source_type = ANY(?)");
            args.add(onlyTypes.toArray(new String[0]));
        }
        sql.append(" ORDER BY fi.modified_at DESC NULLS LAST LIMIT 50");
        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        for (Map<String, Object> r : rows) { r.put("in_apex", false); r.put("live", false); }

        // Live results from email-ingested documents linked to a federated source.
        rows.addAll(queryEmailIngestedForFederated(query, onlyTypes));

        // TRUE federated search: live IMAP / Gmail query-time fan-out.
        rows.addAll(queryLiveMailboxes(query, onlyTypes));
        return rows;
    }

    /**
     * Surfaces real ingested emails (and their attachments) from the documents table
     * for any federated source whose config carries a linked_email_config_id, OR whose
     * endpoint_url ends in ":<email-ingestion username>". This makes a freshly-imported
     * (or manually created) Gmail/EWS mailbox actually searchable before the heavyweight
     * indexer has run.
     */
    private List<Map<String, Object>> queryEmailIngestedForFederated(String query, Set<String> onlyTypes) {
        String like = "%" + query.toLowerCase() + "%";
        StringBuilder sql = new StringBuilder("""
            SELECT d.id,
                   d.title,
                   coalesce(d.description, left(coalesce(d.extracted_content,''), 240)) AS snippet,
                   c.username AS author,
                   d.updated_at AS modified_at,
                   ('apex://documents/' || d.id) AS external_url,
                   d.id::text AS external_id,
                   fs.name AS source_name,
                   fs.source_type
            FROM federated_sources fs
            JOIN email_ingestion_config c
              ON c.id = nullif(fs.config->>'linked_email_config_id','')::uuid
              OR fs.endpoint_url LIKE '%:' || c.username
              OR fs.endpoint_url = c.username
            JOIN documents d
              ON d.folder_id = c.target_folder_id
             AND 'email-ingested' = ANY(d.tags)
            WHERE fs.enabled = true
              AND (lower(d.title) LIKE ?
                OR lower(coalesce(d.description,'')) LIKE ?
                OR lower(coalesce(d.extracted_content,'')) LIKE ?)
            """);
        List<Object> args = new ArrayList<>(List.of(like, like, like));
        if (onlyTypes != null && !onlyTypes.isEmpty()) {
            sql.append(" AND fs.source_type = ANY(?)");
            args.add(onlyTypes.toArray(new String[0]));
        }
        sql.append(" ORDER BY d.updated_at DESC NULLS LAST LIMIT 50");
        List<Map<String, Object>> rows;
        try {
            rows = jdbc.queryForList(sql.toString(), args.toArray());
        } catch (Exception e) {
            log.warn("Email-linked federated query failed: {}", e.getMessage());
            return List.of();
        }
        // These items live inside Apex (so clicking opens the doc) but are surfaced under their mailbox.
        for (Map<String, Object> r : rows) { r.put("in_apex", true); r.put("live", false); }
        return rows;
    }

    private List<Map<String, Object>> queryApexInternal(String query) {
        String like = "%" + query.toLowerCase() + "%";
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT d.id AS external_id, d.title, d.description AS snippet,
                       (u.first_name || ' ' || u.last_name) AS author, d.updated_at AS modified_at,
                       ('apex://documents/' || d.id) AS external_url,
                       'Apex Nexus' AS source_name, 'APEX' AS source_type
                FROM documents d
                LEFT JOIN users u ON u.id=d.author_id
                WHERE (lower(d.title) LIKE ?
                    OR lower(coalesce(d.description,'')) LIKE ?
                    OR lower(coalesce(d.extracted_content,'')) LIKE ?)
                ORDER BY d.updated_at DESC NULLS LAST
                LIMIT 50
                """, like, like, like);
        for (Map<String, Object> r : rows) { r.put("in_apex", true); r.put("live", false); }
        return rows;
    }

    // =====================================================================
    // TRUE federated (query-time) connectors
    // =====================================================================
    /**
     * Live IMAP / Gmail fan-out. For every enabled federated source of type
     * GMAIL or IMAP linked to an email-ingestion config, open an IMAP session,
     * run SEARCH over subject / body / from, and return lightweight hits.
     * Remote hits never touch disk — they are rendered under a "Remote Gmail"
     * banner in the UI. Clicking one can later trigger an on-demand ingest.
     */
    private List<Map<String, Object>> queryLiveMailboxes(String query, Set<String> onlyTypes) {
        if (query == null || query.isBlank()) return List.of();
        if (onlyTypes != null && !onlyTypes.isEmpty()
                && !onlyTypes.contains("GMAIL") && !onlyTypes.contains("IMAP")) {
            return List.of();
        }
        List<Map<String, Object>> targets;
        try {
            targets = jdbc.queryForList("""
                SELECT fs.id AS source_id, fs.name AS source_name, fs.source_type,
                       c.imap_host, c.imap_port, c.use_ssl, c.username, c.password,
                       c.folder_name
                FROM federated_sources fs
                JOIN email_ingestion_config c
                  ON c.id = nullif(fs.config->>'linked_email_config_id','')::uuid
                  OR fs.endpoint_url LIKE '%:' || c.username
                  OR fs.endpoint_url = c.username
                WHERE fs.enabled = true
                  AND fs.source_type IN ('GMAIL','IMAP')
                  AND c.protocol = 'IMAP'
                  AND c.imap_host IS NOT NULL
                """);
        } catch (Exception e) {
            log.warn("Live mailbox lookup failed: {}", e.getMessage());
            return List.of();
        }
        if (targets.isEmpty()) return List.of();

        List<CompletableFuture<List<Map<String, Object>>>> futures = new ArrayList<>();
        for (Map<String, Object> t : targets) {
            futures.add(CompletableFuture.supplyAsync(() -> searchOneMailbox(t, query), liveExecutor));
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (CompletableFuture<List<Map<String, Object>>> f : futures) {
            try {
                out.addAll(f.get(15, TimeUnit.SECONDS));
            } catch (Exception e) {
                log.warn("Live mailbox search skipped: {}", e.getMessage());
            }
        }
        return out;
    }

    private List<Map<String, Object>> searchOneMailbox(Map<String, Object> t, String query) {
        String host = String.valueOf(t.get("imap_host"));
        int port = t.get("imap_port") != null ? ((Number) t.get("imap_port")).intValue() : 993;
        boolean ssl = t.get("use_ssl") == null || Boolean.TRUE.equals(t.get("use_ssl"));
        String proto = "imaps";
        String user = String.valueOf(t.get("username"));
        String pass = String.valueOf(t.get("password"));
        String configuredFolder = t.get("folder_name") != null ? String.valueOf(t.get("folder_name")) : "INBOX";
        String sourceName = String.valueOf(t.get("source_name"));
        String sourceType = String.valueOf(t.get("source_type"));
        UUID sourceId = (UUID) t.get("source_id");

        Properties props = new Properties();
        props.put("mail.store.protocol", proto);
        props.put("mail." + proto + ".host", host);
        props.put("mail." + proto + ".port", String.valueOf(port));
        props.put("mail." + proto + ".ssl.enable", String.valueOf(ssl));
        props.put("mail." + proto + ".timeout", "10000");
        props.put("mail." + proto + ".connectiontimeout", "6000");
        props.put("mail." + proto + ".ssl.trust", "*");
        props.put("mail." + proto + ".ssl.checkserveridentity", "false");

        Store store = null;
        List<Map<String, Object>> hits = new ArrayList<>();
        try {
            Session session = Session.getInstance(props);
            store = session.getStore(proto);
            store.connect(host, port, user, pass);

            // Decide which folders to search.
            List<String> foldersToSearch = pickFoldersToSearch(store, sourceType, configuredFolder);
            log.info("Live IMAP search '{}' on '{}' across folders: {}", query, sourceName, foldersToSearch);

            SearchTerm term = new OrTerm(new SearchTerm[] {
                    new SubjectTerm(query),
                    new FromStringTerm(query),
                    new BodyTerm(query)
            });

            int totalTaken = 0;
            int perMailboxCap = 25;
            for (String folderName : foldersToSearch) {
                if (totalTaken >= perMailboxCap) break;
                Folder folder = null;
                try {
                    folder = store.getFolder(folderName);
                    if (folder == null || !folder.exists()) continue;
                    folder.open(Folder.READ_ONLY);
                    Message[] found = folder.search(term);
                    int take = Math.min(found.length, perMailboxCap - totalTaken);
                    // most recent first
                    for (int i = found.length - 1; i >= found.length - take && i >= 0; i--) {
                        Message m = found[i];
                        try {
                            String subject = m.getSubject() != null ? m.getSubject() : "(no subject)";
                            String from = m.getFrom() != null && m.getFrom().length > 0 ? m.getFrom()[0].toString() : "";
                            Instant modified = m.getSentDate() != null ? m.getSentDate().toInstant() : Instant.now();

                            Map<String, Object> row = new LinkedHashMap<>();
                            row.put("id", UUID.randomUUID());
                            row.put("title", subject);
                            row.put("snippet", "Live hit in " + folderName + " — from " + from);
                            row.put("author", from);
                            row.put("modified_at", modified);
                            row.put("external_url", "mailto:" + user);
                            row.put("external_id", "live:" + sourceId + ":" + folderName + ":" + m.getMessageNumber());
                            row.put("source_name", sourceName);
                            row.put("source_type", sourceType);
                            row.put("folder", folderName);
                            row.put("in_apex", false);
                            row.put("live", true);
                            row.put("message_number", m.getMessageNumber());
                            hits.add(row);
                            totalTaken++;
                        } catch (Exception per) {
                            log.debug("Skip message {} in {}: {}", m.getMessageNumber(), folderName, per.getMessage());
                        }
                    }
                } catch (Exception fe) {
                    log.debug("Folder {} search failed: {}", folderName, fe.getMessage());
                } finally {
                    try { if (folder != null && folder.isOpen()) folder.close(false); } catch (Exception ignored) {}
                }
            }
        } catch (Exception e) {
            log.warn("Live IMAP search failed for '{}' ({}:{}): {}", sourceName, host, port, e.getMessage());
        } finally {
            try { if (store != null && store.isConnected()) store.close(); } catch (Exception ignored) {}
        }
        return hits;
    }

    /**
     * Pick which IMAP folders to scan at query-time. For Gmail we prefer
     * "[Gmail]/All Mail" because it contains every message (Inbox, Sent, Archived,
     * and user labels). For generic IMAP we enumerate the server's folder tree.
     */
    private List<String> pickFoldersToSearch(Store store, String sourceType, String configuredFolder) {
        List<String> out = new ArrayList<>();
        if ("GMAIL".equalsIgnoreCase(sourceType)) {
            // Gmail's super-folder that contains every message the user has ever received or sent.
            for (String candidate : List.of("[Gmail]/All Mail", "[Google Mail]/All Mail")) {
                try {
                    Folder f = store.getFolder(candidate);
                    if (f != null && f.exists()) { out.add(candidate); break; }
                } catch (Exception ignored) { /* try next */ }
            }
            if (out.isEmpty()) out.add(configuredFolder == null || configuredFolder.isBlank() ? "INBOX" : configuredFolder);
            return out;
        }
        // Generic IMAP: scan the configured folder first, then enumerate top-level folders.
        if (configuredFolder != null && !configuredFolder.isBlank()) out.add(configuredFolder);
        try {
            Folder[] top = store.getDefaultFolder().list("*");
            for (Folder f : top) {
                try {
                    if ((f.getType() & Folder.HOLDS_MESSAGES) == 0) continue;
                    String name = f.getFullName();
                    if (!out.contains(name)) out.add(name);
                    if (out.size() >= 8) break; // cap fan-out
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            log.debug("IMAP folder enumeration failed: {}", e.getMessage());
        }
        if (out.isEmpty()) out.add("INBOX");
        return out;
    }

    public Map<String, Object> toggleSource(UUID id, boolean enabled) {
        jdbc.update("UPDATE federated_sources SET enabled=? WHERE id=?", enabled, id);
        return Map.of("id", id, "enabled", enabled);
    }

    public Map<String, Object> createSource(String name, String sourceType,
                                            String endpointUrl, String authConfigJson,
                                            Integer docCountEstimate) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO federated_sources
                    (id, name, source_type, endpoint_url, config, enabled, doc_count_estimate)
                VALUES (?, ?, ?, ?, ?::jsonb, true, ?)
                """, id, name, sourceType, endpointUrl,
                authConfigJson == null ? "{}" : authConfigJson,
                docCountEstimate == null ? 0 : docCountEstimate);
        log.info("Created federated source {} ({}) -> {}", name, sourceType, endpointUrl);
        return jdbc.queryForMap("SELECT * FROM federated_sources WHERE id=?", id);
    }

    public Map<String, Object> updateSource(UUID id, Map<String, Object> patch) {
        if (patch.containsKey("name"))
            jdbc.update("UPDATE federated_sources SET name=? WHERE id=?", patch.get("name"), id);
        if (patch.containsKey("endpointUrl"))
            jdbc.update("UPDATE federated_sources SET endpoint_url=? WHERE id=?", patch.get("endpointUrl"), id);
        if (patch.containsKey("authConfig"))
            jdbc.update("UPDATE federated_sources SET config=?::jsonb WHERE id=?",
                    String.valueOf(patch.get("authConfig")), id);
        if (patch.containsKey("enabled"))
            jdbc.update("UPDATE federated_sources SET enabled=? WHERE id=?", patch.get("enabled"), id);
        if (patch.containsKey("docCountEstimate"))
            jdbc.update("UPDATE federated_sources SET doc_count_estimate=? WHERE id=?",
                    ((Number) patch.get("docCountEstimate")).intValue(), id);
        return jdbc.queryForMap("SELECT * FROM federated_sources WHERE id=?", id);
    }

    public void deleteSource(UUID id) {
        jdbc.update("DELETE FROM federated_index WHERE source_id=?", id);
        jdbc.update("DELETE FROM federated_sources WHERE id=?", id);
    }

    /**
     * Pull the already-configured email-ingestion mailboxes and surface them as
     * federated sources. Mailboxes that are already wired are skipped so this is
     * safe to call repeatedly.
     */
    public List<Map<String, Object>> listImportableEmailMailboxes() {
        return jdbc.queryForList("""
                SELECT c.id, c.name, c.protocol, c.username, c.imap_host, c.ews_url,
                       c.folder_name, c.enabled,
                       EXISTS (
                           SELECT 1 FROM federated_sources fs
                           WHERE fs.endpoint_url = COALESCE(c.ews_url, c.imap_host) || ':' || c.username
                       ) AS already_imported
                FROM email_ingestion_config c
                ORDER BY c.created_at
                """);
    }

    public Map<String, Object> importFromEmailIngestion() {
        int added = 0, skipped = 0;
        List<Map<String, Object>> mailboxes = listImportableEmailMailboxes();
        for (Map<String, Object> m : mailboxes) {
            if (Boolean.TRUE.equals(m.get("already_imported"))) { skipped++; continue; }
            String protocol = String.valueOf(m.get("protocol"));
            String sourceType = "EWS".equalsIgnoreCase(protocol) ? "EXCHANGE"
                    : ("IMAP".equalsIgnoreCase(protocol) && String.valueOf(m.get("imap_host")).contains("gmail")) ? "GMAIL"
                    : "IMAP".equalsIgnoreCase(protocol) ? "IMAP" : protocol.toUpperCase();
            String host = m.get("ews_url") != null ? String.valueOf(m.get("ews_url"))
                    : String.valueOf(m.get("imap_host"));
            String endpoint = host + ":" + m.get("username");
            String name = m.get("name") + " (" + m.get("username") + ")";
            try {
                createSource(name, sourceType, endpoint, "{\"linked_email_config_id\":\"" + m.get("id") + "\"}", 0);
                added++;
            } catch (Exception e) {
                log.warn("Skipped importing mailbox {}: {}", m.get("name"), e.getMessage());
                skipped++;
            }
        }
        return Map.of("added", added, "skipped", skipped, "total", mailboxes.size());
    }

    public Map<String, Object> testSource(UUID id) {
        Map<String, Object> src = jdbc.queryForMap(
                "SELECT name, source_type, endpoint_url FROM federated_sources WHERE id=?", id);
        long indexed = jdbc.queryForObject(
                "SELECT count(*) FROM federated_index WHERE source_id=?", Long.class, id);

        // If this federated source is backed by a live email-ingestion mailbox, do a real
        // IMAP round-trip so the user knows whether their app-password still works.
        Map<String, Object> liveCfg = null;
        try {
            liveCfg = jdbc.queryForMap("""
                SELECT c.imap_host, c.imap_port, c.use_ssl, c.username, c.password, c.folder_name, c.protocol
                FROM federated_sources fs
                JOIN email_ingestion_config c
                  ON c.id = nullif(fs.config->>'linked_email_config_id','')::uuid
                  OR fs.endpoint_url LIKE '%:' || c.username
                  OR fs.endpoint_url = c.username
                WHERE fs.id = ?
                LIMIT 1
                """, id);
        } catch (Exception ignore) { /* no live mailbox bound */ }

        String status = "OK";
        String message = "Source configured. " + indexed + " documents in local index.";
        List<String> folders = List.of();

        if (liveCfg != null && "IMAP".equalsIgnoreCase(String.valueOf(liveCfg.get("protocol")))) {
            long t0 = System.currentTimeMillis();
            Properties props = new Properties();
            props.put("mail.store.protocol", "imaps");
            props.put("mail.imaps.host", liveCfg.get("imap_host"));
            props.put("mail.imaps.port", String.valueOf(liveCfg.get("imap_port")));
            props.put("mail.imaps.ssl.enable", "true");
            props.put("mail.imaps.timeout", "8000");
            props.put("mail.imaps.connectiontimeout", "6000");
            props.put("mail.imaps.ssl.trust", "*");
            props.put("mail.imaps.ssl.checkserveridentity", "false");
            Store store = null;
            try {
                Session session = Session.getInstance(props);
                store = session.getStore("imaps");
                store.connect(
                        String.valueOf(liveCfg.get("imap_host")),
                        ((Number) liveCfg.get("imap_port")).intValue(),
                        String.valueOf(liveCfg.get("username")),
                        String.valueOf(liveCfg.get("password")));
                List<String> fs = pickFoldersToSearch(store, String.valueOf(src.get("source_type")),
                        liveCfg.get("folder_name") != null ? String.valueOf(liveCfg.get("folder_name")) : "INBOX");
                folders = fs;
                long ms = System.currentTimeMillis() - t0;
                message = "Live IMAP login OK (" + ms + " ms). Will search " + fs.size()
                        + " folder(s): " + String.join(", ", fs) + ". " + indexed + " docs already cached.";
            } catch (Exception e) {
                status = "FAIL";
                message = "Live IMAP connect failed: " + e.getMessage();
                log.warn("testSource live IMAP failed for {}: {}", id, e.getMessage());
            } finally {
                try { if (store != null && store.isConnected()) store.close(); } catch (Exception ignored) {}
            }
        }

        jdbc.update("UPDATE federated_sources SET last_indexed_at=now() WHERE id=?", id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("name", src.get("name"));
        out.put("source_type", src.get("source_type"));
        out.put("endpoint_url", src.get("endpoint_url"));
        out.put("status", status);
        out.put("indexed_documents", indexed);
        out.put("folders", folders);
        out.put("message", message);
        return out;
    }
}
