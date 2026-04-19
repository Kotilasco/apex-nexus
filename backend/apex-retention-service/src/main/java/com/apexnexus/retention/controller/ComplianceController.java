package com.apexnexus.retention.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.retention.service.ComplianceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * POTRAZ / Zimbabwe Cyber &amp; Data Protection Act compliance endpoints.
 *
 * Routes exposed at {@code /api/compliance/**} via gateway.
 */
@RestController
@RequestMapping("/compliance")
@RequiredArgsConstructor
public class ComplianceController {

    private final ComplianceService service;

    private UUID userId(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) return null;
        try { return UUID.fromString(auth.getPrincipal().toString()); }
        catch (Exception e) { return null; }
    }

    // ── POTRAZ dashboard ───────────────────────────────────────────────

    @GetMapping("/potraz/dashboard")
    public ResponseEntity<ApiResponse<Map<String, Object>>> potrazDashboard() {
        return ResponseEntity.ok(ApiResponse.success(service.potrazDashboard()));
    }

    // ── Consent ─────────────────────────────────────────────────────────

    @GetMapping("/consents")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listConsents(
            @RequestParam(required = false) String dataSubjectId,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(service.listConsents(dataSubjectId, status)));
    }

    @PostMapping("/consents")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createConsent(
            @RequestBody Map<String, Object> body, Authentication auth) {
        return ResponseEntity.ok(ApiResponse.success(service.createConsent(body, userId(auth))));
    }

    @PostMapping("/consents/{id}/withdraw")
    public ResponseEntity<ApiResponse<Map<String, Object>>> withdrawConsent(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(service.withdrawConsent(id)));
    }

    // ── Data Subject Requests ───────────────────────────────────────────

    @GetMapping("/dsr")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listDsrs(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(service.listDsrs(status)));
    }

    @GetMapping("/dsr/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDsr(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(service.getDsr(id)));
    }

    @PostMapping("/dsr")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createDsr(
            @RequestBody Map<String, Object> body, Authentication auth) {
        return ResponseEntity.ok(ApiResponse.success(service.createDsr(body, userId(auth))));
    }

    @PatchMapping("/dsr/{id}/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateDsrStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body, Authentication auth) {
        return ResponseEntity.ok(ApiResponse.success(
            service.updateDsrStatus(id, (String) body.get("status"),
                    (String) body.get("notes"), userId(auth))));
    }

    @PostMapping("/dsr/{id}/execute")
    public ResponseEntity<ApiResponse<Map<String, Object>>> executeDsr(
            @PathVariable UUID id, Authentication auth) {
        return ResponseEntity.ok(ApiResponse.success(service.executeDsr(id, userId(auth))));
    }

    // ── Breaches ────────────────────────────────────────────────────────

    @GetMapping("/breaches")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listBreaches(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(service.listBreaches(status)));
    }

    @GetMapping("/breaches/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getBreach(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(service.getBreach(id)));
    }

    @PostMapping("/breaches")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createBreach(
            @RequestBody Map<String, Object> body, Authentication auth) {
        return ResponseEntity.ok(ApiResponse.success(service.createBreach(body, userId(auth))));
    }

    @PostMapping("/breaches/{id}/notify-potraz")
    public ResponseEntity<ApiResponse<Map<String, Object>>> notifyPotraz(
            @PathVariable UUID id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(
            service.notifyPotraz(id, (String) body.getOrDefault("reference", "POTRAZ-" + OffsetDateTime.now().getYear()))));
    }

    // ── Cross-border transfers ──────────────────────────────────────────

    @GetMapping("/transfers")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listTransfers() {
        return ResponseEntity.ok(ApiResponse.success(service.listTransfers()));
    }

    @PostMapping("/transfers")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createTransfer(
            @RequestBody Map<String, Object> body, Authentication auth) {
        return ResponseEntity.ok(ApiResponse.success(service.createTransfer(body, userId(auth))));
    }

    // ── Digital Services Tax ────────────────────────────────────────────

    @GetMapping("/dst")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listDst(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {
        return ResponseEntity.ok(ApiResponse.success(service.listDst(year, month)));
    }

    @PostMapping("/dst")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createDst(
            @RequestBody Map<String, Object> body, Authentication auth) {
        return ResponseEntity.ok(ApiResponse.success(service.createDst(body, userId(auth))));
    }

    @GetMapping("/dst/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> dstSummary(
            @RequestParam(required = false) Integer year) {
        int y = year != null ? year : OffsetDateTime.now().getYear();
        return ResponseEntity.ok(ApiResponse.success(service.dstSummary(y)));
    }

    // ── PII inventory + access log ──────────────────────────────────────

    @GetMapping("/pii/inventory")
    public ResponseEntity<ApiResponse<Map<String, Object>>> piiInventory() {
        return ResponseEntity.ok(ApiResponse.success(service.piiInventory()));
    }

    @GetMapping("/pii/access-log")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> piiAccessLog(
            @RequestParam(required = false) UUID documentId,
            @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(ApiResponse.success(service.piiAccessLog(documentId, limit)));
    }

    // ── Snapshots / Reports ─────────────────────────────────────────────

    @GetMapping("/snapshots")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listSnapshots() {
        return ResponseEntity.ok(ApiResponse.success(service.listSnapshots()));
    }

    @GetMapping("/snapshots/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSnapshot(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(service.getSnapshot(id)));
    }

    @PostMapping("/snapshots")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createSnapshot(
            @RequestBody(required = false) Map<String, Object> body, Authentication auth) {
        String type = body != null && body.get("reportType") != null
                ? body.get("reportType").toString() : "POTRAZ_AUDIT";
        return ResponseEntity.ok(ApiResponse.success(service.createSnapshot(type, userId(auth))));
    }
}
