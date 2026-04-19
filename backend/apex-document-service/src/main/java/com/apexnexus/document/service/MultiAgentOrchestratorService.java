package com.apexnexus.document.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Multi-Agent Orchestrator.
 *
 * Wraps the rule-based detectors into three named "digital workers" that the
 * user can see in the /agents UI:
 *
 *   Auditor Agent    — scans for PII / compliance risk (scheduled every 15m + on intake)
 *   Archivist Agent  — finds cold docs ready for long-term storage (every 30m)
 *   Bridge Agent     — drafts SAP entries from newly-classified Contracts (on intake)
 *
 * Each agent writes into agentic_suggestions with agent_name set, so the UI
 * can group them into a "team" view.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MultiAgentOrchestratorService {

    private final JdbcTemplate jdbc;
    private final AgenticIntentService agentic;

    private static final Pattern PII_PATTERNS = Pattern.compile(
        "(?i)(\\bSSN\\b|\\bNRIC\\b|\\bID\\s*number\\b|\\b\\d{3}-\\d{2}-\\d{4}\\b" +   // US SSN
        "|\\b\\d{2}-\\d{6,7}-[A-Z]-\\d{2}\\b" +                                        // Zimbabwe national ID
        "|credit\\s*card|passport|medical\\s*record|\\bdob\\b|date\\s*of\\s*birth)");

    private static final Pattern COMPLIANCE_PATTERNS = Pattern.compile(
        "(?i)(GDPR|POPIA|HIPAA|POTRAZ|PCI[- ]?DSS|confidential|classified|restricted)");

    // ---------------------------------------------------------------------
    // Auditor Agent
    // ---------------------------------------------------------------------

    /** Per-document audit, invoked alongside IntakeAgent.detectForDocument(). */
    public void runAuditorFor(UUID documentId) {
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT id, title, extracted_content FROM documents WHERE id=?", documentId);
            String blob = Objects.toString(row.get("title"), "") + "\n"
                        + Objects.toString(row.get("extracted_content"), "");

            List<String> piiHits = new ArrayList<>();
            Matcher m = PII_PATTERNS.matcher(blob);
            while (m.find() && piiHits.size() < 5) piiHits.add(m.group(1));

            List<String> complianceHits = new ArrayList<>();
            Matcher c = COMPLIANCE_PATTERNS.matcher(blob);
            while (c.find() && complianceHits.size() < 5) complianceHits.add(c.group(1));

            if (piiHits.isEmpty() && complianceHits.isEmpty()) return;

            String evidence = String.join(", ",
                piiHits.isEmpty() ? complianceHits : piiHits);
            double confidence = !piiHits.isEmpty() ? 0.94 : 0.82;

            agentic.emit(documentId, "COMPLIANCE_REVIEW", confidence,
                "Auditor Agent: sensitive content detected (" + evidence + ")",
                "I inspected this document and found content that likely requires review "
                    + "(" + evidence + "). I can apply a legal hold, notify the DPO, and "
                    + "attach the relevant jurisdiction tag. Proceed?",
                Map.of("type", "FLAG_FOR_DPO",
                       "documentId", documentId.toString(),
                       "piiHits", piiHits,
                       "complianceHits", complianceHits),
                "Auditor Agent");
        } catch (Exception e) {
            log.debug("Auditor run skipped for {}: {}", documentId, e.getMessage());
        }
    }

    /** Scheduled background sweep for docs that were ingested before this service existed. */
    @Scheduled(cron = "0 */15 * * * *") // every 15 min
    public void auditorSweep() {
        try {
            List<Map<String, Object>> candidates = jdbc.queryForList("""
                SELECT d.id
                FROM documents d
                WHERE d.created_at > now() - interval '7 days'
                  AND d.is_deleted = false
                  AND NOT EXISTS (
                      SELECT 1 FROM agentic_suggestions s
                      WHERE s.document_id = d.id
                        AND s.agent_name = 'Auditor Agent'
                  )
                ORDER BY d.created_at DESC
                LIMIT 25
                """);
            for (Map<String, Object> r : candidates) {
                runAuditorFor((UUID) r.get("id"));
            }
            if (!candidates.isEmpty()) log.info("Auditor sweep inspected {} docs", candidates.size());
        } catch (Exception e) {
            log.warn("Auditor sweep failed: {}", e.getMessage());
        }
    }

    // ---------------------------------------------------------------------
    // Archivist Agent
    // ---------------------------------------------------------------------

    /** Finds documents that haven't been touched in 180d and suggests archival. */
    @Scheduled(cron = "0 0 */2 * * *") // every 2 hours (demo-friendly)
    public void archivistSweep() {
        try {
            List<Map<String, Object>> candidates = jdbc.queryForList("""
                SELECT d.id, d.title, d.file_size, d.created_at, d.updated_at
                FROM documents d
                WHERE d.is_deleted = false
                  AND COALESCE(d.updated_at, d.created_at) < now() - interval '180 days'
                  AND NOT EXISTS (
                      SELECT 1 FROM agentic_suggestions s
                      WHERE s.document_id = d.id
                        AND s.agent_name = 'Archivist Agent'
                        AND s.status = 'PROPOSED'
                  )
                ORDER BY COALESCE(d.updated_at, d.created_at) ASC
                LIMIT 10
                """);
            for (Map<String, Object> r : candidates) {
                UUID id = (UUID) r.get("id");
                String title = Objects.toString(r.get("title"), "(untitled)");
                Object size = r.get("file_size");
                agentic.emit(id, "ARCHIVE_CANDIDATE", 0.80,
                    "Archivist Agent: " + title + " is cold (not accessed 180d+)",
                    "This document has not been accessed in 180+ days. Moving it to the "
                        + "long-term storage tier would free up hot storage and reduce energy "
                        + "consumption. Archive it?",
                    Map.of("type", "ARCHIVE_NOW",
                           "documentId", id.toString(),
                           "fileSize", size == null ? 0 : size,
                           "suggestedTier", "ARCHIVE"),
                    "Archivist Agent");
            }
            if (!candidates.isEmpty()) log.info("Archivist flagged {} cold docs", candidates.size());
        } catch (Exception e) {
            log.warn("Archivist sweep failed: {}", e.getMessage());
        }
    }

    public Map<String, Object> runArchivistNow() {
        archivistSweep();
        return Map.of("status", "OK", "agent", "Archivist Agent", "ranAt", new Date());
    }

    // ---------------------------------------------------------------------
    // Bridge Agent
    // ---------------------------------------------------------------------

    /** Invoked on intake: drafts a SAP-style renewal package for new Contracts. */
    public void runBridgeFor(UUID documentId) {
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT id, title, extracted_content, classification_label FROM documents WHERE id=?",
                documentId);
            String classification = Objects.toString(row.get("classification_label"), "");
            if (!classification.toLowerCase().contains("contract")) return;

            String title = Objects.toString(row.get("title"), "");
            String content = Objects.toString(row.get("extracted_content"), "");

            // Try to extract a vendor name — Capitalised run of 1-3 words, heuristic.
            Matcher vm = Pattern.compile("(?:vendor|supplier|counterparty|party)[:\\s-]+([A-Z][A-Za-z&]+(?:\\s+[A-Z][A-Za-z&]+){0,2})")
                                 .matcher(title + "\n" + content);
            String vendor = vm.find() ? vm.group(1).trim() : null;

            // Look up the vendor in mock SAP for a performance score
            Map<String, Object> vendorStats = null;
            if (vendor != null) {
                try {
                    vendorStats = jdbc.queryForMap("""
                        SELECT vendor_code, vendor_name,
                               COUNT(*) AS po_count,
                               SUM(amount) AS total_value,
                               MAX(delivery_date) AS last_delivery
                        FROM sap_purchase_orders
                        WHERE vendor_name ILIKE ?
                        GROUP BY vendor_code, vendor_name
                        LIMIT 1
                        """, "%" + vendor + "%");
                } catch (Exception ignore) { /* no hit */ }
            }

            // Extract expiry
            Matcher em = Pattern.compile("(?i)(?:expires?|expiry|end date|terminates?)[^0-9]{0,30}(20[2-3]\\d[-/](?:0?\\d|1[0-2])[-/](?:0?\\d|[12]\\d|3[01]))")
                                 .matcher(content);
            String expiry = em.find() ? em.group(1) : null;

            // Draft the email
            String emailSubject = "Renewal proposal — " + (vendor != null ? vendor : "contract")
                + (expiry != null ? " (expires " + expiry + ")" : "");
            StringBuilder body = new StringBuilder();
            body.append("Dear ").append(vendor != null ? vendor : "Partner").append(",\n\n");
            body.append("Our records show that our agreement (\"")
                .append(title).append("\") is due for review");
            if (expiry != null) body.append(" before its expiry on ").append(expiry);
            body.append(".\n\n");
            if (vendorStats != null) {
                body.append("Based on our purchase history (")
                    .append(vendorStats.get("po_count")).append(" POs, total USD ")
                    .append(vendorStats.get("total_value")).append("), ");
                body.append("we would like to discuss renewal terms.\n\n");
            } else {
                body.append("We would like to discuss renewal terms.\n\n");
            }
            body.append("Please confirm availability for a review call next week.\n\n");
            body.append("Regards,\nZETDC Procurement");

            Map<String, Object> pkg = new LinkedHashMap<>();
            pkg.put("type", "DRAFT_SAP_RENEWAL");
            pkg.put("documentId", documentId.toString());
            pkg.put("vendor", vendor);
            pkg.put("vendorStats", vendorStats);
            pkg.put("expiry", expiry);
            pkg.put("emailSubject", emailSubject);
            pkg.put("emailBody", body.toString());

            double confidence = (vendorStats != null && expiry != null) ? 0.90
                              : (vendorStats != null || expiry != null) ? 0.78 : 0.65;

            agentic.emit(documentId, "DRAFT_SAP_ENTRY", confidence,
                "Bridge Agent: renewal package ready for \""
                    + (vendor != null ? vendor : title) + "\"",
                "I classified this as a contract" + (vendor != null ? " with " + vendor : "")
                    + (vendorStats != null ? " (found " + vendorStats.get("po_count")
                        + " POs in SAP, total USD " + vendorStats.get("total_value") + ")"
                        : "")
                    + ". I drafted a renewal email and a SAP PO entry. Ready for your approval.",
                pkg,
                "Bridge Agent");
        } catch (Exception e) {
            log.debug("Bridge run skipped for {}: {}", documentId, e.getMessage());
        }
    }

    public Map<String, Object> runBridgeSweepNow() {
        // Re-run bridge against recent contracts that don't yet have a Bridge suggestion.
        List<Map<String, Object>> contracts = jdbc.queryForList("""
            SELECT d.id
            FROM documents d
            WHERE d.is_deleted = false
              AND COALESCE(d.classification_label,'') ILIKE '%contract%'
              AND d.created_at > now() - interval '30 days'
              AND NOT EXISTS (
                  SELECT 1 FROM agentic_suggestions s
                  WHERE s.document_id = d.id
                    AND s.agent_name = 'Bridge Agent'
              )
            LIMIT 20
            """);
        for (Map<String, Object> r : contracts) runBridgeFor((UUID) r.get("id"));
        return Map.of("status", "OK", "agent", "Bridge Agent",
                      "contractsProcessed", contracts.size(), "ranAt", new Date());
    }

    // ---------------------------------------------------------------------
    // Team summary for the UI
    // ---------------------------------------------------------------------

    public List<Map<String, Object>> teamSummary() {
        return jdbc.queryForList("""
            SELECT COALESCE(agent_name,'Intake Agent') AS agent,
                   COUNT(*) FILTER (WHERE status='PROPOSED') AS pending,
                   COUNT(*) FILTER (WHERE status='ACCEPTED') AS accepted,
                   COUNT(*) FILTER (WHERE status='DISMISSED') AS dismissed,
                   COUNT(*)                                   AS total,
                   MAX(created_at)                            AS last_emitted_at
            FROM agentic_suggestions
            GROUP BY COALESCE(agent_name,'Intake Agent')
            ORDER BY pending DESC
            """);
    }
}
