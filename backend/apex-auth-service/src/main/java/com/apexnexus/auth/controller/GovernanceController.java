package com.apexnexus.auth.controller;

import com.apexnexus.auth.dto.*;
import com.apexnexus.auth.service.GovernanceService;
import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.common.dto.PagedResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/governance")
@RequiredArgsConstructor
public class GovernanceController {

    private final GovernanceService governanceService;

    // ====================== Effective Policy Resolution ======================

    @GetMapping("/effective")
    public ResponseEntity<ApiResponse<List<GovernancePolicyDto>>> getEffectivePolicies(
            @RequestParam(required = false) UUID projectId,
            Authentication authentication) {
        UUID userId = (UUID) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(governanceService.getEffectivePolicies(projectId, userId)));
    }

    @GetMapping("/effective/{policyType}")
    public ResponseEntity<ApiResponse<GovernancePolicyDto>> resolvePolicy(
            @PathVariable String policyType,
            @RequestParam(required = false) UUID projectId,
            Authentication authentication) {
        UUID userId = (UUID) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(governanceService.resolveEffectivePolicy(policyType, projectId, userId)));
    }

    @GetMapping("/check/{policyType}")
    public ResponseEntity<ApiResponse<Boolean>> checkFeatureAllowed(
            @PathVariable String policyType,
            @RequestParam(required = false) UUID projectId,
            Authentication authentication) {
        UUID userId = (UUID) authentication.getPrincipal();
        boolean allowed = governanceService.isFeatureAllowed(policyType, projectId, userId);
        return ResponseEntity.ok(ApiResponse.ok(allowed));
    }

    // ====================== Policy CRUD ======================

    @PostMapping("/policies")
    public ResponseEntity<ApiResponse<GovernancePolicyDto>> createPolicy(
            @Valid @RequestBody CreatePolicyRequest request,
            Authentication authentication) {
        UUID userId = (UUID) authentication.getPrincipal();
        GovernancePolicyDto policy = governanceService.createPolicy(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Policy created", policy));
    }

    @PutMapping("/policies/{id}")
    public ResponseEntity<ApiResponse<GovernancePolicyDto>> updatePolicy(
            @PathVariable UUID id,
            @Valid @RequestBody UpdatePolicyRequest request,
            Authentication authentication) {
        UUID userId = (UUID) authentication.getPrincipal();
        GovernancePolicyDto updated = governanceService.updatePolicy(id, request, userId);
        return ResponseEntity.ok(ApiResponse.ok("Policy updated", updated));
    }

    @GetMapping("/policies/{id}")
    public ResponseEntity<ApiResponse<GovernancePolicyDto>> getPolicy(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(governanceService.getPolicy(id)));
    }

    @GetMapping("/policies/global")
    public ResponseEntity<ApiResponse<List<GovernancePolicyDto>>> getGlobalPolicies() {
        return ResponseEntity.ok(ApiResponse.ok(governanceService.getGlobalPolicies()));
    }

    @GetMapping("/policies/project/{projectId}")
    public ResponseEntity<ApiResponse<List<GovernancePolicyDto>>> getProjectPolicies(@PathVariable UUID projectId) {
        return ResponseEntity.ok(ApiResponse.ok(governanceService.getProjectPolicies(projectId)));
    }

    // ====================== Audit Trail ======================

    @GetMapping("/policies/{id}/audit")
    public ResponseEntity<ApiResponse<PagedResponse<PolicyAuditDto>>> getPolicyAudit(
            @PathVariable UUID id, Pageable pageable) {
        Page<PolicyAuditDto> page = governanceService.getPolicyAuditTrail(id, pageable);
        return ResponseEntity.ok(ApiResponse.ok(
                PagedResponse.<PolicyAuditDto>builder()
                        .content(page.getContent())
                        .page(page.getNumber())
                        .size(page.getSize())
                        .totalElements(page.getTotalElements())
                        .totalPages(page.getTotalPages())
                        .build()
        ));
    }
}
