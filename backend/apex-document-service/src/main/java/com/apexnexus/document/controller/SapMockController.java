package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

/**
 * Mock SAP Service.
 *
 * Pretends to be an SAP S/4HANA system exposing a handful of enterprise APIs
 * we need for the Procure-to-Pay and Meter-to-Cash demos:
 *
 *   GET  /sap-mock/purchase-orders              list open POs
 *   GET  /sap-mock/purchase-orders/{po}         get one PO
 *   POST /sap-mock/invoices/match               3-way match (PO + Goods Receipt + Invoice)
 *   POST /sap-mock/invoices/park                park an invoice against a PO (auto-post if OK)
 *   GET  /sap-mock/invoices                     list invoices SAP has seen
 *
 *   GET  /sap-mock/assets                       list equipment / functional locations
 *   GET  /sap-mock/assets/{equipmentId}         equipment detail
 *
 *   POST /sap-mock/archivelink/put              SAP calls this to register a doc link
 *   GET  /sap-mock/archivelink/get              SAP calls this to list attachments for an object
 *
 * In production these endpoints are replaced by real SAP OData/RFC calls.
 * The contract (request/response JSON) stays the same so the switchover is trivial.
 */
@RestController
@RequestMapping("/sap-mock")
@RequiredArgsConstructor
@Slf4j
public class SapMockController {

    private final JdbcTemplate jdbc;

    // ─── Purchase Orders ────────────────────────────────────────────────
    @GetMapping("/purchase-orders")
    public ResponseEntity<ApiResponse<List<Map<String,Object>>>> listPOs() {
        return ResponseEntity.ok(ApiResponse.ok(jdbc.queryForList(
                "SELECT * FROM sap_purchase_orders ORDER BY created_at DESC LIMIT 50")));
    }

    @GetMapping("/purchase-orders/{po}")
    public ResponseEntity<ApiResponse<Map<String,Object>>> getPO(@PathVariable String po) {
        List<Map<String,Object>> rs = jdbc.queryForList(
                "SELECT * FROM sap_purchase_orders WHERE po_number=?", po);
        if (rs.isEmpty()) return ResponseEntity.status(404).body(ApiResponse.error("PO not found"));
        return ResponseEntity.ok(ApiResponse.ok(rs.get(0)));
    }

    // ─── Invoice Matching (3-way match) ────────────────────────────────
    @PostMapping("/invoices/match")
    public ResponseEntity<ApiResponse<Map<String,Object>>> match(@RequestBody Map<String,Object> body) {
        String po = String.valueOf(body.get("poNumber"));
        BigDecimal amount = new BigDecimal(String.valueOf(body.getOrDefault("amount", "0")));
        String vendor = String.valueOf(body.getOrDefault("vendor", ""));

        List<Map<String,Object>> rs = jdbc.queryForList(
                "SELECT * FROM sap_purchase_orders WHERE po_number=?", po);
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("poNumber", po);
        result.put("invoiceAmount", amount);
        result.put("invoiceVendor", vendor);

        if (rs.isEmpty()) {
            result.put("matched", false);
            result.put("reason", "PO_NOT_FOUND");
            result.put("action", "DISPUTE");
            return ResponseEntity.ok(ApiResponse.ok(result));
        }
        Map<String,Object> poRow = rs.get(0);
        BigDecimal poAmount = (BigDecimal) poRow.get("amount");
        String poVendor = (String) poRow.get("vendor_name");
        String poStatus = (String) poRow.get("status");
        result.put("poAmount", poAmount);
        result.put("poVendor", poVendor);
        result.put("poStatus", poStatus);

        if (!"OPEN".equals(poStatus)) {
            result.put("matched", false);
            result.put("reason", "PO_NOT_OPEN");
            result.put("action", "DISPUTE");
            return ResponseEntity.ok(ApiResponse.ok(result));
        }

        // 2% tolerance like most SAP MIRO configurations
        BigDecimal delta = poAmount.subtract(amount).abs();
        BigDecimal tol = poAmount.multiply(new BigDecimal("0.02"));
        boolean amountOk = delta.compareTo(tol) <= 0;
        boolean vendorOk = vendor != null && !vendor.isBlank()
                && poVendor.toLowerCase().contains(normalize(vendor).split(" ")[0]);

        result.put("amountTolerance", tol);
        result.put("amountOk", amountOk);
        result.put("vendorOk", vendorOk);
        boolean matched = amountOk && vendorOk;
        result.put("matched", matched);
        result.put("action", matched ? "AUTO_PARK" : "DISPUTE");
        if (!matched) {
            List<String> reasons = new ArrayList<>();
            if (!amountOk) reasons.add("AMOUNT_MISMATCH");
            if (!vendorOk) reasons.add("VENDOR_MISMATCH");
            result.put("reason", String.join(",", reasons));
        }
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    private String normalize(String s) {
        return s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9 ]", " ").trim();
    }

    // ─── Invoice Park (POST to SAP) ─────────────────────────────────────
    @PostMapping("/invoices/park")
    public ResponseEntity<ApiResponse<Map<String,Object>>> park(@RequestBody Map<String,Object> body) {
        String po = String.valueOf(body.get("poNumber"));
        String docId = String.valueOf(body.get("documentId"));
        String vendor = String.valueOf(body.getOrDefault("vendor",""));
        BigDecimal amount = new BigDecimal(String.valueOf(body.getOrDefault("amount","0")));
        String status = String.valueOf(body.getOrDefault("status", "PARKED"));
        Object matchDetails = body.get("matchDetails");

        String invoiceId = "51056" + String.format("%05d", new Random().nextInt(99999));
        jdbc.update("""
                INSERT INTO sap_invoices
                (invoice_id, po_number, apex_document_id, vendor_name, amount, status, match_details,
                 posted_at, created_at)
                VALUES (?, ?, ?::uuid, ?, ?, ?, ?::jsonb, CASE WHEN ?='POSTED' THEN now() ELSE NULL END, now())
                """, invoiceId, po, docId.isBlank() || "null".equals(docId) ? null : docId,
                vendor, amount, status,
                matchDetails == null ? "{}" : toJson(matchDetails), status);

        if ("OPEN".equals(jdbc.queryForObject(
                "SELECT status FROM sap_purchase_orders WHERE po_number=?", String.class, po))
                && "POSTED".equals(status)) {
            jdbc.update("UPDATE sap_purchase_orders SET status='CLOSED' WHERE po_number=?", po);
        }
        return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "sapInvoiceId", invoiceId, "poNumber", po, "status", status)));
    }

    private String toJson(Object o) {
        try { return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(o); }
        catch (Exception e) { return "{}"; }
    }

    @GetMapping("/invoices")
    public ResponseEntity<ApiResponse<List<Map<String,Object>>>> invoices() {
        return ResponseEntity.ok(ApiResponse.ok(jdbc.queryForList(
                "SELECT * FROM sap_invoices ORDER BY created_at DESC LIMIT 100")));
    }

    // ─── Assets (EAM / PM) ──────────────────────────────────────────────
    @GetMapping("/assets")
    public ResponseEntity<ApiResponse<List<Map<String,Object>>>> assets() {
        return ResponseEntity.ok(ApiResponse.ok(jdbc.queryForList(
                "SELECT * FROM sap_assets ORDER BY functional_location, equipment_id")));
    }

    @GetMapping("/assets/{equipmentId}")
    public ResponseEntity<ApiResponse<Map<String,Object>>> asset(@PathVariable String equipmentId) {
        List<Map<String,Object>> rs = jdbc.queryForList(
                "SELECT * FROM sap_assets WHERE equipment_id=?", equipmentId);
        if (rs.isEmpty()) return ResponseEntity.status(404).body(ApiResponse.error("Asset not found"));
        Map<String,Object> row = new LinkedHashMap<>(rs.get(0));
        row.put("attachments", jdbc.queryForList("""
                SELECT l.id, l.document_id, l.link_type, l.document_class, l.linked_at,
                       d.title, d.sha256_hash, d.classification_label
                FROM sap_object_links l JOIN documents d ON d.id=l.document_id
                WHERE l.ar_object='EQUI' AND l.object_key=?
                ORDER BY l.linked_at DESC
                """, equipmentId));
        return ResponseEntity.ok(ApiResponse.ok(row));
    }

    // ─── ArchiveLink (generic link registry) ────────────────────────────
    @PostMapping("/archivelink/put")
    public ResponseEntity<ApiResponse<Map<String,Object>>> linkPut(@RequestBody Map<String,Object> body) {
        String docId = String.valueOf(body.get("documentId"));
        String arObject = String.valueOf(body.get("arObject"));
        String key = String.valueOf(body.get("objectKey"));
        String linkType = String.valueOf(body.getOrDefault("linkType", "ATTACHMENT"));
        String docClass = String.valueOf(body.getOrDefault("documentClass", "PDF"));
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO sap_object_links
                (id, document_id, ar_object, object_key, link_type, document_class)
                VALUES (?, ?::uuid, ?, ?, ?, ?)
                """, id, docId, arObject, key, linkType, docClass);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("linkId", id, "arObject", arObject,
                "objectKey", key, "status", "STORED")));
    }

    @GetMapping("/archivelink/get")
    public ResponseEntity<ApiResponse<List<Map<String,Object>>>> linkGet(
            @RequestParam String arObject, @RequestParam String objectKey) {
        return ResponseEntity.ok(ApiResponse.ok(jdbc.queryForList("""
                SELECT l.*, d.title, d.sha256_hash, d.classification_label, d.file_size_bytes AS file_size
                FROM sap_object_links l JOIN documents d ON d.id=l.document_id
                WHERE l.ar_object=? AND l.object_key=?
                ORDER BY l.linked_at DESC
                """, arObject, objectKey)));
    }
}
