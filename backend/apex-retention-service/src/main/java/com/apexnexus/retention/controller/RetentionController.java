package com.apexnexus.retention.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.common.dto.PagedResponse;
import com.apexnexus.retention.dto.*;
import com.apexnexus.retention.model.DispositionStatus;
import com.apexnexus.retention.service.RetentionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/retention")
@RequiredArgsConstructor
public class RetentionController {

    private final RetentionService retentionService;

    // ==================== Policies ====================

    @GetMapping("/policies")
    public ResponseEntity<ApiResponse<List<RetentionPolicyDto>>> getActivePolicies() {
        return ResponseEntity.ok(ApiResponse.success(retentionService.getActivePolicies()));
    }

    @GetMapping("/policies/{id}")
    public ResponseEntity<ApiResponse<RetentionPolicyDto>> getPolicy(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(retentionService.getPolicy(id)));
    }

    @PostMapping("/policies")
    public ResponseEntity<ApiResponse<RetentionPolicyDto>> createPolicy(
            @Valid @RequestBody CreatePolicyRequest request,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(retentionService.createPolicy(request, userId)));
    }

    // ==================== Dispositions ====================

    @GetMapping("/dispositions")
    public ResponseEntity<ApiResponse<PagedResponse<DispositionItemDto>>> getDispositions(
            @RequestParam(defaultValue = "PENDING") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        DispositionStatus dispositionStatus = DispositionStatus.valueOf(status);
        Page<DispositionItemDto> result = retentionService.getDispositionsByStatus(dispositionStatus,
                PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "scheduledDestructionDate")));
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.of(result)));
    }

    @GetMapping("/dispositions/pending")
    public ResponseEntity<ApiResponse<PagedResponse<DispositionItemDto>>> getPending(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<DispositionItemDto> result = retentionService.getPendingDispositions(
                PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "scheduledDestructionDate")));
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.of(result)));
    }

    @GetMapping("/dispositions/{id}")
    public ResponseEntity<ApiResponse<DispositionItemDto>> getDispositionItem(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(retentionService.getDispositionItem(id)));
    }

    @PostMapping("/dispositions/{id}/approve")
    public ResponseEntity<ApiResponse<DispositionItemDto>> approveDisposition(
            @PathVariable UUID id,
            @RequestParam(required = false) String reason,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(retentionService.approveDisposition(id, userId, reason)));
    }

    @PostMapping("/dispositions/{id}/reject")
    public ResponseEntity<ApiResponse<DispositionItemDto>> rejectDisposition(
            @PathVariable UUID id,
            @RequestParam(required = false) String reason,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(retentionService.rejectDisposition(id, userId, reason)));
    }

    @PostMapping("/dispositions/{id}/hold")
    public ResponseEntity<ApiResponse<DispositionItemDto>> holdDisposition(
            @PathVariable UUID id,
            @RequestParam(required = false) String reason,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(retentionService.holdDisposition(id, userId, reason)));
    }

    // ==================== Stats ====================

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<RetentionStatsDto>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(retentionService.getStats()));
    }

    // ==================== Manual Trigger ====================

    @PostMapping("/scan")
    public ResponseEntity<ApiResponse<String>> triggerScan() {
        retentionService.scanExpiredDocuments();
        return ResponseEntity.ok(ApiResponse.success("Retention scan triggered"));
    }
}
