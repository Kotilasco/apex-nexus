package com.apexnexus.document.service;

import com.apexnexus.common.security.SecurityContextUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * SapIntegrationService — the real business flow that sits between Apex Nexus
 * and SAP. In the POC it talks to SapMockController; in production this class
 * is repointed at a real SAP S/4HANA OData endpoint (only the base URL changes).
 *
 * Procure-to-Pay flow:
 *   1. Document is captured by Intelligent Intake → classified as Invoice
 *   2. processInvoice() extracts PO number + amount from the Apex document
 *   3. Calls SAP /invoices/match (3-way match with tolerance)
 *   4. If matched: parks the invoice in SAP for payment. Links doc via ArchiveLink.
 *   5. If not: starts a DISPUTE workflow in Apex; SAP is left alone (clean core).
 *
 * Asset / Meter-to-Cash flow:
 *   1. Field technician uploads a photo tagged with Equipment ID
 *   2. linkToAsset() writes a sap_object_links row (ar_object=EQUI)
 *   3. SAP PM users opening EQ-xxxxx see the photos via ArchiveLink read API.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SapIntegrationService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    @Value("${sap.base.url:http://localhost:8082/sap-mock}")
    private String sapBase;

    private static final Pattern PO_PATTERN = Pattern.compile(
            "(?:P\\.?O\\.?|Purchase Order|PO\\s*(?:#|No\\.?|Number)?)[^A-Za-z0-9]*((?:45|47)\\d{8})",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
            "(?:Total(?:\\s+Due)?|Amount(?:\\s+Due)?|Grand\\s+Total)[^0-9]*(\\d{1,3}(?:[,\\s]\\d{3})*(?:\\.\\d{2})?)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern VENDOR_PATTERN = Pattern.compile(
            "(?:From|Vendor|Supplier|Bill(?:ed)?\\s+From)\\s*[:\\-]?\\s*([A-Z][A-Za-z0-9 &.,'\\-]{2,60})",
            Pattern.MULTILINE);

    private RestTemplate rest() {
        var f = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        f.setConnectTimeout(5000);
        f.setReadTimeout(30000);
        return new RestTemplate(f);
    }

    /** Run the full P2P integration for a single invoice document. */
    public Map<String,Object> processInvoice(UUID documentId) {
        Map<String,Object> doc = jdbc.queryForMap("""
                SELECT id, title, extracted_content, classification_label
                FROM documents WHERE id=?
                """, documentId);
        String text = Objects.toString(doc.get("extracted_content"), "");
        if (text.isBlank()) text = Objects.toString(doc.get("title"), "");

        Extracted ex = extract(text);

        Map<String,Object> result = new LinkedHashMap<>();
        result.put("documentId", documentId);
        result.put("title", doc.get("title"));
        result.put("extracted", Map.of(
                "poNumber", ex.poNumber == null ? "" : ex.poNumber,
                "amount",   ex.amount == null ? BigDecimal.ZERO : ex.amount,
                "vendor",   ex.vendor == null ? "" : ex.vendor));

        if (ex.poNumber == null) {
            result.put("status", "NO_PO_FOUND");
            result.put("action", "MANUAL_REVIEW");
            startDisputeWorkflow(documentId, "No PO number could be extracted from the invoice");
            return result;
        }

        // Call SAP /invoices/match
        Map<String,Object> matchBody = new HashMap<>();
        matchBody.put("poNumber", ex.poNumber);
        matchBody.put("amount",   ex.amount);
        matchBody.put("vendor",   ex.vendor);
        Map<?,?> matchResp = postJson(sapBase + "/invoices/match", matchBody);
        Map<?,?> match = (Map<?,?>) matchResp.get("data");
        result.put("sapMatch", match);

        boolean matched = Boolean.TRUE.equals(match.get("matched"));
        if (matched) {
            // Park invoice in SAP
            Map<String,Object> parkBody = new HashMap<>();
            parkBody.put("poNumber", ex.poNumber);
            parkBody.put("documentId", documentId.toString());
            parkBody.put("vendor", ex.vendor);
            parkBody.put("amount", ex.amount);
            parkBody.put("status", "PARKED");
            parkBody.put("matchDetails", match);
            Map<?,?> parked = (Map<?,?>) postJson(sapBase + "/invoices/park", parkBody).get("data");
            result.put("sapInvoice", parked);

            // Create ArchiveLink back-reference (SAP object BUS2081 = FI invoice)
            Map<String,Object> linkBody = new HashMap<>();
            linkBody.put("documentId", documentId.toString());
            linkBody.put("arObject", "BUS2081");
            linkBody.put("objectKey", parked.get("sapInvoiceId"));
            linkBody.put("linkType", "ORIGINAL");
            linkBody.put("documentClass", "PDF");
            postJson(sapBase + "/archivelink/put", linkBody);

            result.put("status", "PARKED_IN_SAP");
            result.put("action", "AUTO_PARKED");
        } else {
            result.put("status", "DISPUTE");
            result.put("action", "DISPUTE_WORKFLOW");
            startDisputeWorkflow(documentId,
                    "3-way match failed: " + Objects.toString(match.get("reason"), "unknown"));
        }
        return result;
    }

    /** Attach a field document/photo to a SAP Equipment record. */
    public Map<String,Object> linkToAsset(UUID documentId, String equipmentId, String linkType) {
        // Validate asset exists
        Integer found = jdbc.queryForObject(
                "SELECT COUNT(*) FROM sap_assets WHERE equipment_id=?", Integer.class, equipmentId);
        if (found == null || found == 0) {
            throw new IllegalArgumentException("Equipment not found in SAP: " + equipmentId);
        }
        Map<String,Object> body = new HashMap<>();
        body.put("documentId", documentId.toString());
        body.put("arObject", "EQUI");
        body.put("objectKey", equipmentId);
        body.put("linkType", linkType == null ? "ATTACHMENT" : linkType);
        body.put("documentClass", "JPG");
        Map<?,?> resp = (Map<?,?>) postJson(sapBase + "/archivelink/put", body).get("data");
        return Map.of("linkId", resp.get("linkId"), "equipmentId", equipmentId,
                "documentId", documentId, "status", "LINKED");
    }

    /** List Apex documents linked to any SAP object (ArchiveLink read). */
    public List<Map<String,Object>> getTransactionDocuments(String arObject, String objectKey) {
        return jdbc.queryForList("""
                SELECT l.id AS link_id, l.ar_object, l.object_key, l.link_type, l.document_class,
                       l.linked_at,
                       d.id AS document_id, d.title, d.sha256_hash, d.file_size_bytes AS file_size,
                       d.classification_label
                FROM sap_object_links l JOIN documents d ON d.id=l.document_id
                WHERE l.ar_object=? AND l.object_key=?
                ORDER BY l.linked_at DESC
                """, arObject, objectKey);
    }

    /** Dashboard summary (for the SAP tab of analytics). */
    public Map<String,Object> summary() {
        Map<String,Object> s = new LinkedHashMap<>();
        s.put("openPOs", jdbc.queryForObject(
                "SELECT COUNT(*) FROM sap_purchase_orders WHERE status='OPEN'", Integer.class));
        s.put("totalInvoices", jdbc.queryForObject(
                "SELECT COUNT(*) FROM sap_invoices", Integer.class));
        s.put("parkedInvoices", jdbc.queryForObject(
                "SELECT COUNT(*) FROM sap_invoices WHERE status IN ('PARKED','POSTED')", Integer.class));
        s.put("disputedInvoices", jdbc.queryForObject(
                "SELECT COUNT(*) FROM sap_invoices WHERE status='DISPUTED'", Integer.class));
        s.put("assetsTracked", jdbc.queryForObject(
                "SELECT COUNT(*) FROM sap_assets", Integer.class));
        s.put("linkedDocuments", jdbc.queryForObject(
                "SELECT COUNT(*) FROM sap_object_links", Integer.class));
        s.put("archivedTotalBytes", jdbc.queryForObject(
                "SELECT COALESCE(SUM(d.file_size_bytes),0) FROM sap_object_links l JOIN documents d ON d.id=l.document_id",
                Long.class));
        return s;
    }

    // ─── helpers ──────────────────────────────────────────────────────
    private void startDisputeWorkflow(UUID docId, String reason) {
        try {
            // Lightweight: record a workflow instance with state=DISPUTE
            jdbc.update("""
                    INSERT INTO workflow_instances
                    (id, document_id, current_state, initiated_by, actor_type, metadata)
                    VALUES (gen_random_uuid(), ?, 'DISPUTE', ?, 'SYSTEM', ?::jsonb)
                    """, docId,
                    SecurityContextUtil.currentUserId(),
                    "{\"reason\":\"" + reason.replace("\"","\\\"") + "\",\"source\":\"SAP_P2P\"}");
        } catch (Exception e) {
            log.warn("Could not start dispute workflow (table schema?): {}", e.getMessage());
        }
    }

    private Map<?,?> postJson(String url, Map<String,Object> body) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Map> resp = rest().exchange(url, HttpMethod.POST,
                new HttpEntity<>(body, h), Map.class);
        return resp.getBody() == null ? Map.of() : resp.getBody();
    }

    private Extracted extract(String text) {
        Extracted e = new Extracted();
        if (text == null) return e;
        Matcher m = PO_PATTERN.matcher(text);
        if (m.find()) e.poNumber = m.group(1).trim();
        Matcher a = AMOUNT_PATTERN.matcher(text);
        if (a.find()) {
            try { e.amount = new BigDecimal(a.group(1).replace(",", "").replace(" ", "")); }
            catch (Exception ex) { /* ignore */ }
        }
        Matcher v = VENDOR_PATTERN.matcher(text);
        if (v.find()) e.vendor = v.group(1).trim();
        return e;
    }

    private static class Extracted {
        String poNumber;
        BigDecimal amount;
        String vendor;
    }
}
