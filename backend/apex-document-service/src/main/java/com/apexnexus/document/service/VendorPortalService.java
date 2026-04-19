package com.apexnexus.document.service;

import com.apexnexus.common.security.SecurityContextUtil;
import com.apexnexus.document.dto.CreateDocumentRequest;
import com.apexnexus.document.dto.DocumentDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Vendor Portal — Secured Data Room for external participants.
 *
 * A finance / procurement user creates a portal for a specific vendor. The
 * portal produces a unique access token ("data-room link"). The vendor loads
 * the link, uploads contracts / compliance documents, and Apex Nexus scans
 * them for PII and compliance BEFORE they ever land in the internal
 * document corpus.
 *
 * Pitch line: "We extend your compliance perimeter to your vendors."
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VendorPortalService {

    private final JdbcTemplate jdbc;
    private final DocumentService documentService;
    private final AgenticIntentService agenticIntent;
    private final ObjectMapper om;

    // demo account that owns vendor-uploaded docs before a human approves
    private static final UUID SYSTEM_USER = UUID.fromString("b0000000-0000-0000-0000-000000000001");

    private static final SecureRandom RNG = new SecureRandom();

    // ---------- Portal CRUD ----------

    public Map<String, Object> create(String vendorCode, String vendorName,
                                      String contactEmail, UUID projectId,
                                      List<String> requiredDocs, int expiryDays) {
        UUID id = UUID.randomUUID();
        String token = randomToken(32);
        OffsetDateTime expires = OffsetDateTime.now().plusDays(Math.max(1, expiryDays));
        jdbc.update("""
                INSERT INTO vendor_portals
                  (id, vendor_code, vendor_name, contact_email, project_id, access_token,
                   required_docs, expires_at, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, vendorCode, vendorName, contactEmail, projectId, token,
            (requiredDocs == null ? new String[0] : requiredDocs.toArray(new String[0])),
            expires, SecurityContextUtil.currentUserId());
        return Map.of(
            "id", id,
            "vendorCode", vendorCode,
            "vendorName", vendorName,
            "accessToken", token,
            "portalUrl", "/v/" + token,
            "expiresAt", expires
        );
    }

    public List<Map<String, Object>> list() {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT vp.*, p.name AS project_name,
                       (SELECT COUNT(*) FROM vendor_portal_uploads vu WHERE vu.portal_id=vp.id) AS upload_count,
                       (SELECT COUNT(*) FROM vendor_portal_uploads vu WHERE vu.portal_id=vp.id AND vu.status='QUARANTINED') AS quarantine_count
                FROM vendor_portals vp
                LEFT JOIN projects p ON p.id=vp.project_id
                ORDER BY vp.created_at DESC
                """);
        for (Map<String, Object> r : rows) unwrapArray(r, "required_docs");
        return rows;
    }

    @SuppressWarnings("unchecked")
    private static void unwrapArray(Map<String, Object> row, String key) {
        Object v = row.get(key);
        if (v instanceof java.sql.Array arr) {
            try { row.put(key, java.util.Arrays.asList((Object[]) arr.getArray())); }
            catch (Exception ignore) { row.put(key, java.util.List.of()); }
        }
    }

    public Map<String, Object> get(UUID id) {
        Map<String, Object> p = jdbc.queryForMap("""
                SELECT vp.*, pr.name AS project_name
                FROM vendor_portals vp
                LEFT JOIN projects pr ON pr.id=vp.project_id
                WHERE vp.id=?
                """, id);
        unwrapArray(p, "required_docs");
        p.put("uploads", jdbc.queryForList("""
                SELECT vu.*, d.title AS document_title
                FROM vendor_portal_uploads vu
                LEFT JOIN documents d ON d.id=vu.document_id
                WHERE vu.portal_id=?
                ORDER BY vu.uploaded_at DESC
                """, id));
        p.put("complianceDocs", jdbc.queryForList("""
                SELECT id, doc_type, label, expires_on, status, valid_from, last_checked_at
                FROM vendor_compliance_docs
                WHERE portal_id=?
                ORDER BY expires_on ASC
                """, id));
        p.put("accessLog", jdbc.queryForList("""
                SELECT action, remote_ip, watermark, created_at
                FROM vendor_portal_access_log
                WHERE portal_id=?
                ORDER BY created_at DESC
                LIMIT 20
                """, id));
        return p;
    }

    public Map<String, Object> revoke(UUID id) {
        jdbc.update("UPDATE vendor_portals SET status='REVOKED' WHERE id=?", id);
        return Map.of("id", id, "status", "REVOKED");
    }

    public Map<String, Object> summary() {
        return jdbc.queryForMap("""
                SELECT
                  (SELECT COUNT(*) FROM vendor_portals WHERE status='ACTIVE') AS active_portals,
                  (SELECT COUNT(*) FROM vendor_portal_uploads)                AS total_uploads,
                  (SELECT COUNT(*) FROM vendor_portal_uploads WHERE status='QUARANTINED') AS quarantined,
                  (SELECT COUNT(*) FROM vendor_portal_uploads WHERE status='APPROVED')    AS approved,
                  (SELECT COUNT(DISTINCT vendor_code) FROM vendor_portals)    AS distinct_vendors
                """);
    }

    // ---------- Public (vendor-facing, no JWT) ----------

    public Map<String, Object> verifyToken(String token) {
        try {
            Map<String, Object> vp = jdbc.queryForMap("""
                    SELECT vp.id, vp.vendor_code, vp.vendor_name, vp.status, vp.required_docs,
                           vp.expires_at, vp.project_id, pr.name AS project_name
                    FROM vendor_portals vp
                    LEFT JOIN projects pr ON pr.id=vp.project_id
                    WHERE vp.access_token=?
                    """, token);
            Object expObj = vp.get("expires_at");
            OffsetDateTime exp;
            if (expObj instanceof OffsetDateTime o) exp = o;
            else if (expObj instanceof java.sql.Timestamp ts) exp = ts.toInstant().atOffset(OffsetDateTime.now().getOffset());
            else if (expObj instanceof java.time.Instant ins) exp = ins.atOffset(OffsetDateTime.now().getOffset());
            else exp = OffsetDateTime.now().plusDays(1);
            if (!"ACTIVE".equals(vp.get("status")) || exp.isBefore(OffsetDateTime.now())) {
                throw new IllegalStateException("PORTAL_EXPIRED_OR_REVOKED");
            }
            jdbc.update("UPDATE vendor_portals SET last_accessed_at=now() WHERE id=?", vp.get("id"));
            // Strip the id from the vendor-facing response
            Map<String, Object> safe = new LinkedHashMap<>(vp);
            UUID portalId = (UUID) safe.remove("id");
            Object rd = safe.get("required_docs");
            if (rd instanceof java.sql.Array arr) {
                try { safe.put("required_docs", java.util.Arrays.asList((Object[]) arr.getArray())); }
                catch (Exception ignore) { safe.put("required_docs", java.util.List.of()); }
            }
            // Refresh + expose compliance state so the vendor sees what they owe
            refreshComplianceStatus(portalId);
            Map<String, Object> refreshed = jdbc.queryForMap(
                "SELECT compliance_status, blocked_reason FROM vendor_portals WHERE id=?", portalId);
            safe.put("compliance_status", refreshed.get("compliance_status"));
            safe.put("blocked_reason", refreshed.get("blocked_reason"));
            safe.put("compliance_docs", jdbc.queryForList("""
                    SELECT doc_type, label, expires_on, status
                    FROM vendor_compliance_docs
                    WHERE portal_id=?
                    ORDER BY expires_on ASC
                    """, portalId));
            return safe;
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new IllegalStateException("INVALID_TOKEN");
        }
    }

    public Map<String, Object> acceptUpload(String token, MultipartFile file) throws Exception {
        return acceptUpload(token, file, null, null);
    }

    public Map<String, Object> acceptUpload(String token, MultipartFile file,
                                            String remoteIp, String userAgent) throws Exception {
        // 1) validate token
        Map<String, Object> vp = jdbc.queryForMap(
            "SELECT id, project_id, vendor_name, compliance_status, blocked_reason FROM vendor_portals WHERE access_token=? AND status='ACTIVE' AND expires_at>now()", token);
        UUID portalId = (UUID) vp.get("id");
        UUID projectId = (UUID) vp.get("project_id");
        String vendorName = (String) vp.get("vendor_name");

        // 1b) compliance gate — auto-block submissions if any eligibility doc is expired
        refreshComplianceStatus(portalId);
        String complianceStatus = (String) jdbc.queryForMap(
            "SELECT compliance_status, blocked_reason FROM vendor_portals WHERE id=?", portalId)
            .getOrDefault("compliance_status", "UNKNOWN");
        if ("NON_COMPLIANT".equals(complianceStatus)) {
            String reason = (String) jdbc.queryForObject(
                "SELECT blocked_reason FROM vendor_portals WHERE id=?", String.class, portalId);
            audit(portalId, null, "BLOCKED", remoteIp, userAgent, null,
                Map.of("reason", reason == null ? "Non-compliant vendor" : reason));
            return Map.of(
                "status", "BLOCKED",
                "message", "Submission blocked: " + (reason == null ? "your eligibility documents are out of date. Please refresh them before uploading invoices." : reason),
                "complianceStatus", complianceStatus
            );
        }

        // 2) scan for PII + compliance BEFORE creating the document
        String text = safeUtf8(file.getBytes(), file.getContentType());
        Map<String, Integer> pii = scanPii(text);
        List<String> compliance = scanCompliance(text);
        String classification = heuristicClass(file.getOriginalFilename(), text);

        // HARD REJECT: unencrypted sensitive PII must never enter the corpus.
        boolean hardPii = pii.containsKey("CREDIT_CARD") || pii.containsKey("NATIONAL_ID");
        if (hardPii) {
            String detail = pii.entrySet().stream()
                .map(e -> e.getKey() + " x" + e.getValue())
                .reduce((a, b) -> a + ", " + b).orElse("");
            audit(portalId, null, "REJECTED", remoteIp, userAgent, null,
                Map.of("reason", "PII detected: " + detail, "filename", file.getOriginalFilename()));
            return Map.of(
                "status", "REJECTED",
                "message", "Upload rejected. Sensitive personal data was detected in this file ("
                    + detail + "). Please redact it and resubmit.",
                "piiFindings", pii
            );
        }

        String status = (pii.isEmpty() && compliance.isEmpty()) ? "RECEIVED" : "QUARANTINED";

        // 3) create document in vendor's project with classification
        CreateDocumentRequest req = new CreateDocumentRequest();
        req.setTitle((file.getOriginalFilename() != null ? file.getOriginalFilename() : "Vendor upload"));
        req.setDescription("Uploaded by vendor '" + vendorName + "' via portal on " + OffsetDateTime.now());
        if (projectId != null) req.setProjectId(projectId);
        DocumentDto doc = documentService.createDocument(req, file, SYSTEM_USER);
        jdbc.update("UPDATE documents SET classification_label=? WHERE id=?", classification, doc.getId());

        // 4) record upload + findings
        UUID upId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO vendor_portal_uploads
                  (id, portal_id, filename, mime_type, file_size, document_id,
                   pii_findings, compliance_findings, classification, status)
                VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?)
                """, upId, portalId, file.getOriginalFilename(), file.getContentType(),
            file.getSize(), doc.getId(),
            om.writeValueAsString(pii), om.writeValueAsString(compliance),
            classification, status);

        // 5) watermark + audit every upload
        String watermark = vendorName + " | " + OffsetDateTime.now() + " | " + (remoteIp == null ? "unknown-ip" : remoteIp);
        audit(portalId, upId, "UPLOAD", remoteIp, userAgent, watermark,
            Map.of("filename", file.getOriginalFilename(),
                   "classification", classification,
                   "status", status));

        // 6) if quarantined, we don't start workflow automatically — internal reviewer must approve
        if ("RECEIVED".equals(status)) {
            try { agenticIntent.detectForDocument(doc.getId()); } catch (Exception ignore) {}
        }

        return Map.of(
            "uploadId", upId,
            "documentId", doc.getId(),
            "status", status,
            "classification", classification,
            "piiFindings", pii,
            "complianceFindings", compliance,
            "watermark", watermark,
            "message", "RECEIVED".equals(status)
                ? "Thank you. Your submission was accepted and classified as " + classification + "."
                : "Your upload was received but flagged for review (" +
                  (pii.isEmpty() ? "" : "PII: " + pii.keySet()) +
                  (compliance.isEmpty() ? "" : " compliance: " + compliance) +
                  "). A compliance officer will approve it shortly."
        );
    }

    // ---------- Compliance documents ----------

    public Map<String, Object> addComplianceDoc(UUID portalId, String docType, String label,
                                                 java.time.LocalDate expiresOn,
                                                 java.time.LocalDate validFrom,
                                                 UUID uploadId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO vendor_compliance_docs
                  (id, portal_id, doc_type, label, upload_id, valid_from, expires_on, status)
                VALUES (?,?,?,?,?,?,?,?)
                """, id, portalId, docType, label, uploadId, validFrom, expiresOn,
                complianceStatusForDate(expiresOn));
        refreshComplianceStatus(portalId);
        return jdbc.queryForMap("SELECT * FROM vendor_compliance_docs WHERE id=?", id);
    }

    public void removeComplianceDoc(UUID id) {
        UUID portalId = (UUID) jdbc.queryForMap(
            "SELECT portal_id FROM vendor_compliance_docs WHERE id=?", id).get("portal_id");
        jdbc.update("DELETE FROM vendor_compliance_docs WHERE id=?", id);
        if (portalId != null) refreshComplianceStatus(portalId);
    }

    public void refreshComplianceStatus(UUID portalId) {
        // Re-stamp each doc's status based on today's date
        jdbc.update("""
                UPDATE vendor_compliance_docs
                   SET status = CASE
                       WHEN expires_on < CURRENT_DATE THEN 'EXPIRED'
                       WHEN expires_on < CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
                       ELSE 'VALID'
                   END,
                   last_checked_at = now()
                 WHERE portal_id=?
                """, portalId);

        List<Map<String, Object>> docs = jdbc.queryForList(
            "SELECT doc_type, status, expires_on FROM vendor_compliance_docs WHERE portal_id=?", portalId);
        List<String> expired = new ArrayList<>();
        List<String> expiring = new ArrayList<>();
        for (Map<String, Object> d : docs) {
            if ("EXPIRED".equals(d.get("status"))) expired.add(String.valueOf(d.get("doc_type")));
            else if ("EXPIRING_SOON".equals(d.get("status"))) expiring.add(String.valueOf(d.get("doc_type")));
        }

        String overall; String reason = null;
        if (!expired.isEmpty())      { overall = "NON_COMPLIANT"; reason = "Expired: " + String.join(", ", expired); }
        else if (!expiring.isEmpty()) { overall = "EXPIRING";       reason = "Expiring: " + String.join(", ", expiring); }
        else if (!docs.isEmpty())     { overall = "COMPLIANT"; }
        else                          { overall = "UNKNOWN"; }

        jdbc.update("UPDATE vendor_portals SET compliance_status=?, blocked_reason=? WHERE id=?",
                overall, reason, portalId);
    }

    private String complianceStatusForDate(java.time.LocalDate d) {
        if (d == null) return "VALID";
        java.time.LocalDate today = java.time.LocalDate.now();
        if (d.isBefore(today)) return "EXPIRED";
        if (d.isBefore(today.plusDays(30))) return "EXPIRING_SOON";
        return "VALID";
    }

    // ---------- Audit / watermark ----------

    public void logView(String token, UUID uploadId, String remoteIp, String userAgent) {
        Map<String, Object> vp;
        try {
            vp = jdbc.queryForMap(
                "SELECT id, vendor_name FROM vendor_portals WHERE access_token=? AND status='ACTIVE' AND expires_at>now()", token);
        } catch (Exception e) { return; }
        UUID portalId = (UUID) vp.get("id");
        String vendorName = (String) vp.get("vendor_name");
        String watermark = vendorName + " | " + OffsetDateTime.now() + " | " + (remoteIp == null ? "unknown-ip" : remoteIp);
        audit(portalId, uploadId, "VIEW", remoteIp, userAgent, watermark, Map.of());
    }

    private void audit(UUID portalId, UUID uploadId, String action,
                       String remoteIp, String userAgent, String watermark,
                       Map<String, Object> details) {
        try {
            jdbc.update("""
                    INSERT INTO vendor_portal_access_log
                      (portal_id, upload_id, action, remote_ip, user_agent, watermark, details)
                    VALUES (?, ?, ?, ?, ?, ?, ?::jsonb)
                    """, portalId, uploadId, action,
                remoteIp, userAgent, watermark,
                om.writeValueAsString(details == null ? Map.of() : details));
        } catch (Exception e) {
            log.warn("Could not write vendor portal audit: {}", e.getMessage());
        }
    }

    public Map<String, Object> approveUpload(UUID uploadId, String notes) {
        jdbc.update("""
                UPDATE vendor_portal_uploads
                   SET status='APPROVED', reviewer_notes=?, reviewed_at=now(), reviewed_by=?
                 WHERE id=?
                """, notes, SecurityContextUtil.currentUserId(), uploadId);
        return Map.of("id", uploadId, "status", "APPROVED");
    }

    public Map<String, Object> rejectUpload(UUID uploadId, String notes) {
        jdbc.update("""
                UPDATE vendor_portal_uploads
                   SET status='REJECTED', reviewer_notes=?, reviewed_at=now(), reviewed_by=?
                 WHERE id=?
                """, notes, SecurityContextUtil.currentUserId(), uploadId);
        return Map.of("id", uploadId, "status", "REJECTED");
    }

    // ---------- helpers ----------

    private static final Pattern EMAIL = Pattern.compile("[\\w.+-]+@[\\w-]+\\.[\\w.-]+");
    private static final Pattern PHONE = Pattern.compile("\\+?[0-9][0-9\\s\\-()]{7,}\\d");
    private static final Pattern ID_NO = Pattern.compile("\\b\\d{2}[-/]\\d{6,7}[-/][A-Z]\\d{2}\\b"); // ZW national ID pattern
    private static final Pattern CREDIT = Pattern.compile("\\b(?:4\\d{3}|5[1-5]\\d{2})[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{3,4}\\b");

    private Map<String, Integer> scanPii(String text) {
        if (text == null || text.isBlank()) return Map.of();
        Map<String, Integer> hits = new LinkedHashMap<>();
        count("EMAIL", EMAIL, text, hits);
        count("PHONE", PHONE, text, hits);
        count("NATIONAL_ID", ID_NO, text, hits);
        count("CREDIT_CARD", CREDIT, text, hits);
        return hits;
    }

    private void count(String k, Pattern p, String t, Map<String, Integer> h) {
        Matcher m = p.matcher(t);
        int c = 0;
        while (m.find()) c++;
        if (c > 0) h.put(k, c);
    }

    private List<String> scanCompliance(String text) {
        if (text == null || text.isBlank()) return List.of();
        List<String> out = new ArrayList<>();
        String lower = text.toLowerCase();
        if (lower.contains("confidential")) out.add("CONFIDENTIAL_MARKING");
        if (lower.contains("hazardous") || lower.contains("hazmat")) out.add("HAZMAT_KEYWORD");
        if (lower.contains("asbestos")) out.add("ASBESTOS_REFERENCE");
        if (lower.contains("child labor") || lower.contains("child labour")) out.add("LABOR_RISK");
        if (lower.contains("sanction")) out.add("SANCTIONS_REFERENCE");
        if (lower.contains("warranty") && lower.contains("void")) out.add("WARRANTY_VOID_CLAUSE");
        return out;
    }

    private String heuristicClass(String filename, String text) {
        String name = filename == null ? "" : filename.toLowerCase();
        String t = text == null ? "" : text.toLowerCase();
        if (name.contains("invoice") || t.contains("invoice")) return "INVOICE";
        if (name.contains("contract") || name.contains("agreement") || t.contains("agreement")) return "CONTRACT";
        if (name.contains("cert")    || t.contains("certificate")) return "COMPLIANCE_CERT";
        if (name.contains("quote")   || t.contains("quotation"))   return "QUOTE";
        return "GENERAL";
    }

    private String safeUtf8(byte[] bytes, String mime) {
        if (bytes == null || bytes.length == 0) return "";
        if (mime != null && (mime.startsWith("text") || mime.contains("json") || mime.contains("xml") || mime.contains("csv"))) {
            return new String(bytes, 0, Math.min(bytes.length, 50_000), StandardCharsets.UTF_8);
        }
        // For binary we just scan the first chunk as best-effort latin-1 to catch readable strings
        byte[] slice = Arrays.copyOf(bytes, Math.min(bytes.length, 30_000));
        return new String(slice, StandardCharsets.ISO_8859_1);
    }

    private static String randomToken(int len) {
        byte[] buf = new byte[len];
        RNG.nextBytes(buf);
        StringBuilder sb = new StringBuilder(len * 2);
        for (byte b : buf) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
