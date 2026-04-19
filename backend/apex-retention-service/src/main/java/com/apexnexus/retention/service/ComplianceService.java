package com.apexnexus.retention.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Zimbabwe POTRAZ / Cyber &amp; Data Protection Act compliance service.
 * <p>Covers:
 * <ul>
 *   <li>Consent records</li>
 *   <li>Data Subject Requests (access, erasure, portability, rectification)</li>
 *   <li>Data breach register (24h POTRAZ notification)</li>
 *   <li>Cross-border transfers</li>
 *   <li>Digital Services Tax (15%) ledger</li>
 *   <li>PII inventory and access log</li>
 *   <li>Point-in-time compliance snapshots</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class ComplianceService {

    private final JdbcTemplate jdbc;

    // ─────────────────────────── Consent ───────────────────────────

    public Map<String, Object> createConsent(Map<String, Object> body, UUID userId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO consent_records
              (id, data_subject_id, data_subject_name, purpose, lawful_basis,
               status, expires_at, source, jurisdiction_code, created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """,
            id,
            body.get("dataSubjectId"),
            body.get("dataSubjectName"),
            body.get("purpose"),
            body.getOrDefault("lawfulBasis", "CONSENT"),
            body.getOrDefault("status", "GRANTED"),
            body.get("expiresAt"),
            body.get("source"),
            body.getOrDefault("jurisdictionCode", "ZW"),
            userId
        );
        return getConsent(id);
    }

    public Map<String, Object> getConsent(UUID id) {
        return jdbc.queryForMap("SELECT * FROM consent_records WHERE id = ?", id);
    }

    public List<Map<String, Object>> listConsents(String dataSubjectId, String status) {
        StringBuilder sql = new StringBuilder("SELECT * FROM consent_records WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (dataSubjectId != null && !dataSubjectId.isBlank()) {
            sql.append(" AND data_subject_id = ?"); args.add(dataSubjectId);
        }
        if (status != null && !status.isBlank()) {
            sql.append(" AND status = ?"); args.add(status);
        }
        sql.append(" ORDER BY created_at DESC LIMIT 500");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    public Map<String, Object> withdrawConsent(UUID id) {
        jdbc.update("""
            UPDATE consent_records
               SET status = 'WITHDRAWN',
                   withdrawn_at = now(),
                   updated_at = now()
             WHERE id = ?
        """, id);
        return getConsent(id);
    }

    // ─────────────────────────── DSR (Data Subject Requests) ────────────────────────

    @Transactional
    public Map<String, Object> createDsr(Map<String, Object> body, UUID userId) {
        UUID id = UUID.randomUUID();
        String reqNo = "DSR-" + OffsetDateTime.now().getYear() + "-" +
                       String.format("%06d", (int)(Math.random() * 1_000_000));
        OffsetDateTime due = OffsetDateTime.now().plusDays(30); // ZW DPA = 30 days
        jdbc.update("""
            INSERT INTO data_subject_requests
              (id, request_number, data_subject_id, data_subject_name, data_subject_email,
               request_type, status, priority, description, due_at, jurisdiction_code, created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """,
            id, reqNo,
            body.get("dataSubjectId"),
            body.get("dataSubjectName"),
            body.get("dataSubjectEmail"),
            body.get("requestType"),
            body.getOrDefault("status", "PENDING"),
            body.getOrDefault("priority", "NORMAL"),
            body.get("description"),
            due,
            body.getOrDefault("jurisdictionCode", "ZW"),
            userId
        );
        return getDsr(id);
    }

    public Map<String, Object> getDsr(UUID id) {
        return jdbc.queryForMap("SELECT * FROM data_subject_requests WHERE id = ?", id);
    }

    public List<Map<String, Object>> listDsrs(String status) {
        if (status != null && !status.isBlank()) {
            return jdbc.queryForList(
                "SELECT * FROM data_subject_requests WHERE status = ? ORDER BY received_at DESC LIMIT 500",
                status);
        }
        return jdbc.queryForList(
            "SELECT * FROM data_subject_requests ORDER BY received_at DESC LIMIT 500");
    }

    public Map<String, Object> updateDsrStatus(UUID id, String status, String notes, UUID userId) {
        boolean completed = "COMPLETED".equalsIgnoreCase(status) || "REJECTED".equalsIgnoreCase(status);
        jdbc.update("""
            UPDATE data_subject_requests
               SET status = ?,
                   response_notes = COALESCE(?, response_notes),
                   assigned_to = COALESCE(assigned_to, ?),
                   completed_at = CASE WHEN ? THEN now() ELSE completed_at END,
                   updated_at = now()
             WHERE id = ?
        """, status, notes, userId, completed, id);
        return getDsr(id);
    }

    /**
     * Execute the DSR: for ACCESS/PORTABILITY, gather all PII documents linked to the subject
     * (by author email, or tags). For ERASURE, mark documents for deletion.
     */
    public Map<String, Object> executeDsr(UUID id, UUID userId) {
        Map<String, Object> dsr = getDsr(id);
        String subjectId = (String) dsr.get("data_subject_id");
        String type = (String) dsr.get("request_type");

        // Find documents with PII where the subject's email/id appears as extracted entity
        List<Map<String, Object>> docs = jdbc.queryForList("""
            SELECT id, title, mime_type, pii_types, pii_severity, created_at
              FROM documents
             WHERE pii_detected = true
               AND (
                    COALESCE(pii_types, '') ILIKE '%' || ? || '%'
                 OR EXISTS (
                        SELECT 1 FROM extracted_entities e
                         WHERE e.document_id = documents.id
                           AND (e.value ILIKE ? OR e.value ILIKE '%' || ? || '%')
                    )
               )
             LIMIT 200
        """, subjectId, subjectId, subjectId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("requestType", type);
        result.put("matchedDocuments", docs.size());
        result.put("documents", docs);

        if ("ERASURE".equalsIgnoreCase(type)) {
            // Soft-flag with metadata for review
            int affected = 0;
            for (Map<String, Object> d : docs) {
                jdbc.update("UPDATE documents SET status = 'PENDING_ERASURE' WHERE id = ?", d.get("id"));
                affected++;
            }
            result.put("erasureMarked", affected);
        }

        updateDsrStatus(id, "IN_PROGRESS", "Automated discovery completed", userId);
        return result;
    }

    // ─────────────────────────── Breach Register ───────────────────────

    public Map<String, Object> createBreach(Map<String, Object> body, UUID userId) {
        UUID id = UUID.randomUUID();
        String no = "BR-" + OffsetDateTime.now().getYear() + "-" +
                    String.format("%05d", (int)(Math.random() * 100_000));
        Object occurredAt = body.getOrDefault("occurredAt", OffsetDateTime.now());
        Object discoveredAt = body.getOrDefault("discoveredAt", OffsetDateTime.now());
        jdbc.update("""
            INSERT INTO data_breaches
              (id, breach_number, title, description, severity, status, breach_type,
               discovered_at, occurred_at, records_affected, data_categories,
               jurisdiction_code, created_by)
            VALUES (?,?,?,?,?,?,?,?::timestamptz,?::timestamptz,?, ?::text[], ?,?)
        """,
            id, no,
            body.get("title"),
            body.get("description"),
            body.getOrDefault("severity", "MEDIUM"),
            body.getOrDefault("status", "OPEN"),
            body.get("breachType"),
            discoveredAt.toString(),
            occurredAt.toString(),
            ((Number) body.getOrDefault("recordsAffected", 0)).intValue(),
            toPgArray(body.get("dataCategories")),
            body.getOrDefault("jurisdictionCode", "ZW"),
            userId
        );
        return getBreach(id);
    }

    public Map<String, Object> getBreach(UUID id) {
        return jdbc.queryForMap("SELECT * FROM data_breaches WHERE id = ?", id);
    }

    public List<Map<String, Object>> listBreaches(String status) {
        if (status != null && !status.isBlank()) {
            return jdbc.queryForList(
                "SELECT * FROM data_breaches WHERE status = ? ORDER BY discovered_at DESC LIMIT 500", status);
        }
        return jdbc.queryForList(
            "SELECT * FROM data_breaches ORDER BY discovered_at DESC LIMIT 500");
    }

    public Map<String, Object> notifyPotraz(UUID id, String reference) {
        jdbc.update("""
            UPDATE data_breaches
               SET potraz_notified = true,
                   potraz_notified_at = now(),
                   potraz_reference = ?,
                   status = 'REPORTED',
                   updated_at = now()
             WHERE id = ?
        """, reference, id);
        return getBreach(id);
    }

    // ─────────────────────────── Cross-Border Transfers ───────────────────

    public Map<String, Object> createTransfer(Map<String, Object> body, UUID userId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO cross_border_transfers
              (id, source_jurisdiction, target_jurisdiction, target_country,
               target_organization, transfer_mechanism, lawful_basis,
               data_categories, records_transferred, purpose, safeguards, created_by)
            VALUES (?,?,?,?,?,?,?,?::text[],?,?,?,?)
        """,
            id,
            body.getOrDefault("sourceJurisdiction", "ZW"),
            body.get("targetJurisdiction"),
            body.get("targetCountry"),
            body.get("targetOrganization"),
            body.get("transferMechanism"),
            body.get("lawfulBasis"),
            toPgArray(body.get("dataCategories")),
            ((Number) body.getOrDefault("recordsTransferred", 0)).intValue(),
            body.get("purpose"),
            body.get("safeguards"),
            userId
        );
        return jdbc.queryForMap("SELECT * FROM cross_border_transfers WHERE id = ?", id);
    }

    public List<Map<String, Object>> listTransfers() {
        return jdbc.queryForList("SELECT * FROM cross_border_transfers ORDER BY transfer_date DESC LIMIT 500");
    }

    // ─────────────────────────── Digital Services Tax ─────────────────────

    public Map<String, Object> createDst(Map<String, Object> body, UUID userId) {
        UUID id = UUID.randomUUID();
        double gross = ((Number) body.get("grossAmountUsd")).doubleValue();
        double rate = body.get("dstRate") != null
                    ? ((Number) body.get("dstRate")).doubleValue() : 15.0;
        double dst = Math.round(gross * rate) / 100.0;
        double net = gross - dst;
        LocalDate invDate = LocalDate.parse((String) body.get("invoiceDate"));
        jdbc.update("""
            INSERT INTO digital_services_tax
              (id, invoice_number, supplier_name, supplier_country, service_description,
               service_category, gross_amount_usd, dst_rate, dst_amount_usd, net_amount_usd,
               invoice_date, period_year, period_month, created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
            id,
            body.get("invoiceNumber"),
            body.get("supplierName"),
            body.get("supplierCountry"),
            body.get("serviceDescription"),
            body.get("serviceCategory"),
            gross, rate, dst, net,
            invDate, invDate.getYear(), invDate.getMonthValue(),
            userId
        );
        return jdbc.queryForMap("SELECT * FROM digital_services_tax WHERE id = ?", id);
    }

    public List<Map<String, Object>> listDst(Integer year, Integer month) {
        if (year != null && month != null) {
            return jdbc.queryForList("""
                SELECT * FROM digital_services_tax
                 WHERE period_year = ? AND period_month = ?
                 ORDER BY invoice_date DESC
            """, year, month);
        }
        return jdbc.queryForList("SELECT * FROM digital_services_tax ORDER BY invoice_date DESC LIMIT 500");
    }

    public Map<String, Object> dstSummary(int year) {
        Map<String, Object> totals = jdbc.queryForMap("""
            SELECT COUNT(*) AS invoice_count,
                   COALESCE(SUM(gross_amount_usd),0)::text AS gross_total,
                   COALESCE(SUM(dst_amount_usd),0)::text   AS dst_total,
                   COALESCE(SUM(net_amount_usd),0)::text   AS net_total,
                   COUNT(*) FILTER (WHERE remitted) AS remitted_count
              FROM digital_services_tax
             WHERE period_year = ?
        """, year);
        List<Map<String, Object>> monthly = jdbc.queryForList("""
            SELECT period_month,
                   COUNT(*) AS invoice_count,
                   COALESCE(SUM(gross_amount_usd),0)::text AS gross_total,
                   COALESCE(SUM(dst_amount_usd),0)::text   AS dst_total
              FROM digital_services_tax
             WHERE period_year = ?
             GROUP BY period_month
             ORDER BY period_month
        """, year);
        Map<String, Object> out = new LinkedHashMap<>(totals);
        out.put("year", year);
        out.put("monthly", monthly);
        return out;
    }

    // ─────────────────────────── PII Inventory ─────────────────────────

    public Map<String, Object> piiInventory() {
        Map<String, Object> summary = jdbc.queryForMap("""
            SELECT COUNT(*) FILTER (WHERE pii_detected) AS pii_documents,
                   COUNT(*) FILTER (WHERE pii_severity = 'CRITICAL') AS critical,
                   COUNT(*) FILTER (WHERE pii_severity = 'HIGH') AS high,
                   COUNT(*) FILTER (WHERE pii_severity = 'MEDIUM') AS medium,
                   COUNT(*) FILTER (WHERE pii_severity = 'LOW') AS low,
                   COUNT(*)                                    AS total_documents
              FROM documents
        """);
        List<Map<String, Object>> byType = jdbc.queryForList("""
            SELECT pii_severity AS severity, COUNT(*) AS count
              FROM documents
             WHERE pii_detected = true
             GROUP BY pii_severity
             ORDER BY count DESC
        """);
        List<Map<String, Object>> recent = jdbc.queryForList("""
            SELECT id, title, mime_type, pii_types, pii_severity, pii_scan_date
              FROM documents
             WHERE pii_detected = true
             ORDER BY pii_scan_date DESC NULLS LAST
             LIMIT 50
        """);
        Map<String, Object> out = new LinkedHashMap<>(summary);
        out.put("bySeverity", byType);
        out.put("recentDetections", recent);
        return out;
    }

    public List<Map<String, Object>> piiAccessLog(UUID documentId, int limit) {
        if (documentId != null) {
            return jdbc.queryForList("""
                SELECT id, action, username, user_id, resource_id, details, created_at
                  FROM audit_log
                 WHERE resource_id = ? 
                 ORDER BY created_at DESC
                 LIMIT ?
            """, documentId.toString(), limit);
        }
        return jdbc.queryForList("""
            SELECT a.id, a.action, a.username, a.user_id, a.resource_id, a.details, a.created_at,
                   d.title AS document_title, d.pii_severity
              FROM audit_log a
              JOIN documents d ON a.resource_id = d.id::text
             WHERE d.pii_detected = true
             ORDER BY a.created_at DESC
             LIMIT ?
        """, limit);
    }

    // ─────────────────────────── POTRAZ Compliance Dashboard ──────────────

    public Map<String, Object> potrazDashboard() {
        Map<String, Object> dashboard = new LinkedHashMap<>();

        Map<String, Object> pii = piiInventory();
        dashboard.put("pii", pii);

        Map<String, Object> dsr = jdbc.queryForMap("""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE status = 'PENDING')     AS pending,
                   COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress,
                   COUNT(*) FILTER (WHERE status = 'COMPLETED')   AS completed,
                   COUNT(*) FILTER (WHERE status = 'REJECTED')    AS rejected,
                   COUNT(*) FILTER (WHERE due_at < now() AND status NOT IN ('COMPLETED','REJECTED')) AS overdue
              FROM data_subject_requests
        """);
        dashboard.put("dsr", dsr);

        Map<String, Object> breaches = jdbc.queryForMap("""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE status = 'OPEN')         AS open,
                   COUNT(*) FILTER (WHERE status = 'INVESTIGATING') AS investigating,
                   COUNT(*) FILTER (WHERE status = 'REPORTED')     AS reported,
                   COUNT(*) FILTER (WHERE severity = 'CRITICAL')   AS critical,
                   COUNT(*) FILTER (WHERE potraz_notified = false AND severity IN ('HIGH','CRITICAL')) AS notification_overdue
              FROM data_breaches
        """);
        dashboard.put("breaches", breaches);

        Map<String, Object> consent = jdbc.queryForMap("""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE status = 'GRANTED')   AS granted,
                   COUNT(*) FILTER (WHERE status = 'WITHDRAWN') AS withdrawn,
                   COUNT(*) FILTER (WHERE status = 'EXPIRED')   AS expired
              FROM consent_records
        """);
        dashboard.put("consent", consent);

        Map<String, Object> transfers = jdbc.queryForMap("""
            SELECT COUNT(*)                                 AS total,
                   COUNT(*) FILTER (WHERE approved = true)  AS approved,
                   COUNT(*) FILTER (WHERE approved = false) AS pending
              FROM cross_border_transfers
        """);
        dashboard.put("transfers", transfers);

        int year = OffsetDateTime.now().getYear();
        Map<String, Object> dst = dstSummary(year);
        dashboard.put("dst", dst);

        // Compliance score: weighted
        double score = 100.0;
        long overdueDsr   = ((Number) dsr.getOrDefault("overdue", 0L)).longValue();
        long notifOverdue = ((Number) breaches.getOrDefault("notification_overdue", 0L)).longValue();
        long criticalPii  = ((Number) pii.getOrDefault("critical", 0L)).longValue();
        score -= Math.min(30, overdueDsr * 10);
        score -= Math.min(40, notifOverdue * 20);
        score -= Math.min(20, criticalPii);
        if (score < 0) score = 0;
        dashboard.put("complianceScore", Math.round(score * 10) / 10.0);

        List<Map<String, Object>> rules = jdbc.queryForList("""
            SELECT document_category, min_retention_years, legal_citation, description
              FROM jurisdiction_retention_rules
             WHERE jurisdiction_id = (SELECT id FROM jurisdictions WHERE code = 'ZW')
             ORDER BY document_category
        """);
        dashboard.put("zwRetentionRules", rules);

        dashboard.put("jurisdiction", "ZW");
        dashboard.put("jurisdictionName", "Zimbabwe");
        dashboard.put("generatedAt", OffsetDateTime.now().toString());
        return dashboard;
    }

    // ─────────────────────────── Snapshots ─────────────────────────────

    @Transactional
    public Map<String, Object> createSnapshot(String reportType, UUID userId) {
        UUID id = UUID.randomUUID();
        Map<String, Object> dashboard = potrazDashboard();
        double score = ((Number) dashboard.getOrDefault("complianceScore", 0)).doubleValue();
        String title = "POTRAZ Compliance Report — " + LocalDate.now();
        if ("DST_QUARTERLY".equals(reportType)) {
            title = "Digital Services Tax — Q" + ((LocalDate.now().getMonthValue() - 1) / 3 + 1)
                  + " " + LocalDate.now().getYear();
        } else if ("PII_INVENTORY".equals(reportType)) {
            title = "PII Inventory — " + LocalDate.now();
        }

        // Serialize map to JSON string for JSONB column — use pg_typecast via ::jsonb
        String metricsJson = toJson(dashboard);

        jdbc.update("""
            INSERT INTO compliance_snapshots
              (id, report_type, jurisdiction_code, period_start, period_end,
               title, summary, metrics, score, status, generated_by)
            VALUES (?,?,?,?,?,?,?, ?::jsonb, ?, 'DRAFT', ?)
        """,
            id,
            reportType,
            "ZW",
            LocalDate.now().minusMonths(1),
            LocalDate.now(),
            title,
            "Point-in-time compliance snapshot generated by ApexNexus.",
            metricsJson,
            score,
            userId
        );
        return jdbc.queryForMap("SELECT * FROM compliance_snapshots WHERE id = ?", id);
    }

    public List<Map<String, Object>> listSnapshots() {
        return jdbc.queryForList("""
            SELECT id, report_type, jurisdiction_code, title, score, status,
                   generated_at, submitted_at, submitted_to, submitted_reference
              FROM compliance_snapshots
             ORDER BY generated_at DESC
             LIMIT 200
        """);
    }

    public Map<String, Object> getSnapshot(UUID id) {
        return jdbc.queryForMap("SELECT * FROM compliance_snapshots WHERE id = ?", id);
    }

    // ─────────────────────────── Helpers ───────────────────────────────

    @SuppressWarnings("unchecked")
    private String toPgArray(Object value) {
        if (value == null) return "{}";
        if (value instanceof List) {
            List<Object> l = (List<Object>) value;
            StringBuilder sb = new StringBuilder("{");
            for (int i = 0; i < l.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append(String.valueOf(l.get(i)).replace(",", " "));
            }
            sb.append("}");
            return sb.toString();
        }
        return "{" + value + "}";
    }

    @SuppressWarnings("unchecked")
    private String toJson(Object o) {
        // lightweight JSON serializer (no Jackson dep needed here since Spring has it
        // transitively, but using it requires an import; for simplicity wrap Map/List manually)
        if (o == null) return "null";
        if (o instanceof Number || o instanceof Boolean) return o.toString();
        if (o instanceof Map) {
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<String, Object> e : ((Map<String, Object>) o).entrySet()) {
                if (!first) sb.append(",");
                first = false;
                sb.append("\"").append(e.getKey().replace("\"", "\\\"")).append("\":").append(toJson(e.getValue()));
            }
            return sb.append("}").toString();
        }
        if (o instanceof List) {
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (Object v : (List<Object>) o) {
                if (!first) sb.append(",");
                first = false;
                sb.append(toJson(v));
            }
            return sb.append("]").toString();
        }
        return "\"" + o.toString().replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
