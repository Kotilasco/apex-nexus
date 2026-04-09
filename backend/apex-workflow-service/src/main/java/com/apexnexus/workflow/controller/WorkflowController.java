package com.apexnexus.workflow.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.common.dto.PagedResponse;
import com.apexnexus.workflow.dto.*;
import com.apexnexus.workflow.model.WorkflowStatus;
import com.apexnexus.workflow.service.WorkflowService;
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
@RequestMapping("/workflow")
@RequiredArgsConstructor
public class WorkflowController {

    private final WorkflowService workflowService;

    // ==================== Definitions ====================

    @GetMapping("/definitions")
    public ResponseEntity<ApiResponse<List<WorkflowDefinitionDto>>> getActiveDefinitions() {
        return ResponseEntity.ok(ApiResponse.success(workflowService.getActiveDefinitions()));
    }

    @GetMapping("/definitions/{id}")
    public ResponseEntity<ApiResponse<WorkflowDefinitionDto>> getDefinition(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(workflowService.getDefinition(id)));
    }

    @PostMapping("/definitions")
    public ResponseEntity<ApiResponse<WorkflowDefinitionDto>> createDefinition(
            @Valid @RequestBody CreateDefinitionRequest request,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        WorkflowDefinitionDto definition = workflowService.createDefinition(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(definition));
    }

    @PutMapping("/definitions/{id}")
    public ResponseEntity<ApiResponse<WorkflowDefinitionDto>> updateDefinition(
            @PathVariable UUID id,
            @Valid @RequestBody CreateDefinitionRequest request,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(workflowService.updateDefinition(id, request, userId)));
    }

    @DeleteMapping("/definitions/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteDefinition(
            @PathVariable UUID id,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        workflowService.deactivateDefinition(id, userId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ==================== Workflow Instances ====================

    @PostMapping("/instances")
    public ResponseEntity<ApiResponse<WorkflowInstanceDto>> startWorkflow(
            @Valid @RequestBody StartWorkflowRequest request,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        WorkflowInstanceDto instance = workflowService.startWorkflow(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(instance));
    }

    @GetMapping("/instances/{id}")
    public ResponseEntity<ApiResponse<WorkflowInstanceDto>> getInstance(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(workflowService.getInstance(id)));
    }

    @PostMapping("/instances/{id}/transition")
    public ResponseEntity<ApiResponse<WorkflowInstanceDto>> transition(
            @PathVariable UUID id,
            @Valid @RequestBody TransitionRequest request,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(workflowService.transition(id, request, userId)));
    }

    @PostMapping("/instances/{id}/approve")
    public ResponseEntity<ApiResponse<WorkflowInstanceDto>> submitApproval(
            @PathVariable UUID id,
            @Valid @RequestBody ApprovalRequest request,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(workflowService.submitApproval(id, request, userId)));
    }

    @PostMapping("/instances/{id}/cancel")
    public ResponseEntity<ApiResponse<WorkflowInstanceDto>> cancelWorkflow(
            @PathVariable UUID id,
            @RequestParam(required = false) String comments,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(workflowService.cancelWorkflow(id, comments, userId)));
    }

    // ==================== Queries ====================

    @GetMapping("/instances/my")
    public ResponseEntity<ApiResponse<PagedResponse<WorkflowInstanceDto>>> getMyWorkflows(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        Page<WorkflowInstanceDto> result = workflowService.getMyWorkflows(userId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.of(result)));
    }

    @GetMapping("/instances/pending-approvals")
    public ResponseEntity<ApiResponse<PagedResponse<WorkflowInstanceDto>>> getPendingApprovals(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        Page<WorkflowInstanceDto> result = workflowService.getPendingApprovals(userId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.of(result)));
    }

    @GetMapping("/instances/pending-approvals/count")
    public ResponseEntity<ApiResponse<Long>> countPendingApprovals(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(workflowService.countPendingApprovals(userId)));
    }

    @GetMapping("/instances/by-status/{status}")
    public ResponseEntity<ApiResponse<PagedResponse<WorkflowInstanceDto>>> getByStatus(
            @PathVariable String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        WorkflowStatus workflowStatus = WorkflowStatus.valueOf(status.toUpperCase());
        Page<WorkflowInstanceDto> result = workflowService.getByStatus(workflowStatus,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.of(result)));
    }

    @GetMapping("/instances/by-document/{documentId}")
    public ResponseEntity<ApiResponse<List<WorkflowInstanceDto>>> getByDocument(@PathVariable UUID documentId) {
        return ResponseEntity.ok(ApiResponse.success(workflowService.getByDocument(documentId)));
    }

    @GetMapping("/instances/{id}/history")
    public ResponseEntity<ApiResponse<List<WorkflowInstanceDto.TransitionDto>>> getHistory(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(workflowService.getTransitionHistory(id)));
    }

    @GetMapping("/instances/overdue")
    public ResponseEntity<ApiResponse<List<WorkflowInstanceDto>>> getOverdueInstances() {
        return ResponseEntity.ok(ApiResponse.success(workflowService.getOverdueInstances()));
    }
}
