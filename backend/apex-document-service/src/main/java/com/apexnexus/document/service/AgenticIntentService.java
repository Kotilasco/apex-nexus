package com.apexnexus.document.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Agentic Intent Detection.
 *
 * Fires right after Intake has classified a document. Based on content patterns,
 * emits *proactive* suggestions ("I see a ZETDC tariff increase – shall I draft a
 * budget variance report?"). These live in agentic_suggestions until a human
 * accepts or dismisses them.
 *
 * Intent detectors are rule-based here for determinism; a real deployment can
 * layer an LLM call (already supplied via Ollama) to widen the rule net.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AgenticIntentService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper om;

    private static final Pattern PO_NUMBER = Pattern.compile(
        "(?i)(?:P\\.?O\\.?|Purchase Order|PO\\s*(?:#|No\\.?|Number)?)[^A-Za-z0-9]*((?:45|47)\\d{8})");
    private static final Pattern PERCENT_INCREASE = Pattern.compile(
        "(?i)(\\d{1,3}(?:\\.\\d+)?)\\s*%[^0-9]{0,40}(increase|uplift|adjustment|rise|rising|hike|higher)"
      + "|(?i)(increase|uplift|adjustment|rise|rising|hike|higher|increasing|tariff)[^0-9]{0,40}(\\d{1,3}(?:\\.\\d+)?)\\s*%");
    private static final Pattern EXPIRY_DATE = Pattern.compile(
        "(?i)(?:expires?|expiry|valid until|end date|terminates?)[^0-9]{0,30}(20[2-3]\\d[-/](0?\\d|1[0-2])[-/](0?\\d|[12]\\d|3[01]))");
    private static final Pattern METER_ANOMALY = Pattern.compile(
        "(?i)(meter|reading)[^\\n]{0,60}(abnormal|anomaly|bypass|tamper|spike|\\bzero\\b)");
    private static final Pattern COMPLIANCE_KW = Pattern.compile(
        "(?i)(GDPR|POPIA|HIPAA|POTRAZ|data protection|personal information|PII|sensitive data)");

    /**
     * Called from IntakeService after a document has been ingested.
     * Best-effort, never throws.
     */
    public void detectForDocument(UUID documentId) {
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT d.id, d.title, d.classification_label, d.project_id, d.extracted_content " +
                "FROM documents d WHERE d.id=?", documentId);
            String title = Objects.toString(row.get("title"), "");
            String content = Objects.toString(row.get("extracted_content"), "");
            String classification = Objects.toString(row.get("classification_label"), "");
            String blob = title + "\n" + content;

            // Intent 1: Invoice with PO — offer to run SAP P2P
            Matcher m = PO_NUMBER.matcher(blob);
            if (m.find()) {
                String po = m.group(1);
                emit(documentId, "INVOICE_AUTOMATCH", 0.92,
                    "Invoice with PO " + po + " detected",
                    "I found a purchase order number and recognized this as an invoice. "
                        + "Shall I run the 3-way match against SAP and auto-park it?",
                    Map.of("type", "RUN_SAP_P2P",
                           "documentId", documentId.toString(),
                           "poNumber", po,
                           "endpoint", "/api/sap/invoices/process/" + documentId));
            }

            // Intent 2: Price increase notice — draft variance report
            Matcher inc = PERCENT_INCREASE.matcher(blob);
            if (inc.find()) {
                String pct = inc.group(1) != null ? inc.group(1) : inc.group(4);
                emit(documentId, "BUDGET_VARIANCE", 0.85,
                    "Price / tariff increase of " + pct + "% detected",
                    "This document mentions a " + pct + "% increase. I can draft a budget "
                        + "variance memo pre-populated with the line items, route it to Finance, "
                        + "and notify the project controller. Proceed?",
                    Map.of("type", "DRAFT_VARIANCE_MEMO",
                           "sourceDocumentId", documentId.toString(),
                           "percent", pct,
                           "suggestedProjectCategory", "FINANCE"));
            }

            // Intent 3: Contract/agreement with expiry — schedule renewal workflow
            Matcher exp = EXPIRY_DATE.matcher(blob);
            if (exp.find()
                && (classification.toLowerCase().contains("contract") ||
                    title.toLowerCase().matches(".*(agreement|contract|msa|sla|nda).*"))) {
                String date = exp.group(1);
                emit(documentId, "CONTRACT_RENEWAL", 0.88,
                    "Contract expiring " + date,
                    "I detected an expiry date. I can schedule a renewal-review workflow "
                        + "60 days before expiry and notify the contract owner. Activate?",
                    Map.of("type", "SCHEDULE_RENEWAL",
                           "documentId", documentId.toString(),
                           "expiryDate", date,
                           "leadDays", 60));
            }

            // Intent 4: Meter / reading anomaly
            Matcher mtr = METER_ANOMALY.matcher(blob);
            if (mtr.find()) {
                emit(documentId, "METER_ANOMALY", 0.78,
                    "Possible meter anomaly detected",
                    "Wording suggests a meter irregularity. I can open a field investigation "
                        + "workflow, link the document to the affected Equipment Record, and "
                        + "page the local technician. Do it?",
                    Map.of("type", "OPEN_FIELD_INVESTIGATION",
                           "documentId", documentId.toString(),
                           "triggerKeyword", mtr.group(0)));
            }

            // Intent 5: PII / compliance flag
            Matcher c = COMPLIANCE_KW.matcher(blob);
            if (c.find()) {
                emit(documentId, "COMPLIANCE_REVIEW", 0.82,
                    "Compliance keyword detected: " + c.group(1),
                    "This document references " + c.group(1) + ". I can apply a legal hold, "
                        + "flag it for the DPO and attach the appropriate jurisdiction tag. Shall I?",
                    Map.of("type", "FLAG_FOR_DPO",
                           "documentId", documentId.toString(),
                           "keyword", c.group(1)));
            }
        } catch (Exception e) {
            log.warn("agentic detection failed for {}: {}", documentId, e.getMessage());
        }
    }

    private void emit(UUID docId, String intent, double confidence,
                      String title, String rationale, Map<String, Object> action) {
        emit(docId, intent, confidence, title, rationale, action, "Intake Agent");
    }

    /**
     * Emit with an explicit agent_name so the /agents UI can group suggestions
     * by which agent produced them (Auditor / Archivist / Bridge / Intake).
     */
    public void emit(UUID docId, String intent, double confidence,
                     String title, String rationale, Map<String, Object> action,
                     String agentName) {
        try {
            jdbc.update("""
                    INSERT INTO agentic_suggestions
                      (document_id, intent_type, title, rationale, proposed_action, confidence, status, agent_name)
                    VALUES (?, ?, ?, ?, ?::jsonb, ?, 'PROPOSED', ?)
                    """,
                docId, intent, title, rationale,
                om.writeValueAsString(action), confidence, agentName);
        } catch (Exception e) {
            log.warn("emit agentic suggestion failed: {}", e.getMessage());
        }
    }

    public List<Map<String, Object>> listPending(int limit) {
        return jdbc.queryForList("""
                SELECT s.id, s.document_id, s.intent_type, s.title, s.rationale,
                       s.proposed_action, s.confidence, s.status, s.created_at,
                       COALESCE(s.agent_name,'Intake Agent') AS agent_name,
                       d.title AS document_title, d.project_id,
                       p.name AS project_name
                FROM agentic_suggestions s
                LEFT JOIN documents d ON d.id=s.document_id
                LEFT JOIN projects p ON p.id=d.project_id
                WHERE s.status='PROPOSED'
                ORDER BY s.created_at DESC
                LIMIT ?
                """, limit);
    }

    public List<Map<String, Object>> listAll(int limit) {
        return jdbc.queryForList("""
                SELECT s.id, s.document_id, s.intent_type, s.title, s.rationale,
                       s.proposed_action, s.confidence, s.status, s.created_at,
                       s.acted_at, s.result,
                       COALESCE(s.agent_name,'Intake Agent') AS agent_name,
                       d.title AS document_title
                FROM agentic_suggestions s
                LEFT JOIN documents d ON d.id=s.document_id
                ORDER BY s.created_at DESC
                LIMIT ?
                """, limit);
    }

    public Map<String, Object> dismiss(UUID id, UUID userId) {
        jdbc.update("UPDATE agentic_suggestions SET status='DISMISSED', acted_at=now(), acted_by=? WHERE id=?",
            userId, id);
        return Map.of("id", id, "status", "DISMISSED");
    }

    public Map<String, Object> accept(UUID id, UUID userId) {
        // Minimal agent-executor. In production each action-type has a dedicated handler.
        Map<String, Object> s = jdbc.queryForMap("SELECT * FROM agentic_suggestions WHERE id=?", id);
        String intent = (String) s.get("intent_type");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("executedAt", new Date());
        result.put("intent", intent);
        try {
            switch (intent) {
                case "INVOICE_AUTOMATCH" -> result.put("next", "Invoke POST /api/sap/invoices/process/{documentId}");
                case "BUDGET_VARIANCE"   -> result.put("next", "Create draft memo + notify Finance PM");
                case "CONTRACT_RENEWAL"  -> result.put("next", "Schedule renewal workflow 60d before expiry");
                case "METER_ANOMALY"     -> result.put("next", "Open Field Investigation workflow");
                case "COMPLIANCE_REVIEW" -> result.put("next", "Apply legal hold + notify DPO");
                default                  -> result.put("next", "Recorded for human follow-up");
            }
            jdbc.update("""
                UPDATE agentic_suggestions
                   SET status='ACCEPTED', acted_at=now(), acted_by=?, result=?::jsonb
                 WHERE id=?
                """, userId, om.writeValueAsString(result), id);
            result.put("status", "ACCEPTED");
            return result;
        } catch (Exception e) {
            return Map.of("status", "FAILED", "error", e.getMessage());
        }
    }

    public Map<String, Object> summary() {
        Map<String, Object> s = jdbc.queryForMap("""
                SELECT
                  COUNT(*) FILTER (WHERE status='PROPOSED')   AS pending,
                  COUNT(*) FILTER (WHERE status='ACCEPTED')   AS accepted,
                  COUNT(*) FILTER (WHERE status='DISMISSED')  AS dismissed,
                  COUNT(*)                                    AS total
                FROM agentic_suggestions
                """);
        return s;
    }
}
