package com.apexnexus.workflow.controller;

import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.common.dto.PagedResponse;
import com.apexnexus.common.exception.BusinessException;
import com.apexnexus.common.exception.ResourceNotFoundException;
import com.apexnexus.workflow.dto.ForwardDocumentRequest;
import com.apexnexus.workflow.dto.WorkflowForwardDto;
import com.apexnexus.workflow.model.WorkflowForward;
import com.apexnexus.workflow.repository.WorkflowForwardRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Ad-hoc document forwarding — send a document to another user for review/comment/action
 * outside the formal workflow process.
 */
@RestController
@RequestMapping("/workflows/forwards")
@RequiredArgsConstructor
@Slf4j
public class ForwardController {

    private final WorkflowForwardRepository forwardRepository;
    private final AuditPublisher auditPublisher;

    /**
     * Forward a document to another user.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<WorkflowForwardDto>> forwardDocument(
            @Valid @RequestBody ForwardDocumentRequest request,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());

        if (userId.equals(request.getForwardedTo())) {
            throw new BusinessException("Cannot forward a document to yourself");
        }

        WorkflowForward forward = WorkflowForward.builder()
                .documentId(request.getDocumentId())
                .workflowInstanceId(request.getWorkflowInstanceId())
                .forwardedBy(userId)
                .forwardedTo(request.getForwardedTo())
                .message(request.getMessage())
                .actionRequired(request.getActionRequired() != null ? request.getActionRequired() : "REVIEW")
                .build();

        forward = forwardRepository.save(forward);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("DOCUMENT_FORWARDED")
                .resourceType("DOCUMENT")
                .resourceId(request.getDocumentId())
                .details(Map.of(
                        "forwardedTo", request.getForwardedTo().toString(),
                        "actionRequired", forward.getActionRequired()
                ))
                .build());

        log.info("Document {} forwarded from {} to {} (action: {})",
                request.getDocumentId(), userId, request.getForwardedTo(), forward.getActionRequired());

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(toDto(forward)));
    }

    /**
     * Get pending forwards for the current user.
     */
    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<PagedResponse<WorkflowForwardDto>>> getPendingForwards(
            Authentication auth,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID userId = UUID.fromString(auth.getName());
        Page<WorkflowForward> result = forwardRepository
                .findByForwardedToAndIsCompletedFalseOrderByCreatedAtDesc(userId,
                        PageRequest.of(page, size, Sort.by("createdAt").descending()));

        PagedResponse<WorkflowForwardDto> response = PagedResponse.<WorkflowForwardDto>builder()
                .content(result.getContent().stream().map(this::toDto).toList())
                .page(page)
                .size(size)
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * Get pending forwards count for current user.
     */
    @GetMapping("/pending/count")
    public ResponseEntity<ApiResponse<Long>> getPendingCount(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(
                forwardRepository.countByForwardedToAndIsCompletedFalse(userId)));
    }

    /**
     * Get all forwards for a document.
     */
    @GetMapping("/document/{documentId}")
    public ResponseEntity<ApiResponse<List<WorkflowForwardDto>>> getForwardsByDocument(
            @PathVariable UUID documentId) {
        return ResponseEntity.ok(ApiResponse.success(
                forwardRepository.findByDocumentIdOrderByCreatedAtDesc(documentId).stream()
                        .map(this::toDto)
                        .toList()));
    }

    /**
     * Complete a forward (respond to the forwarded document).
     */
    @PostMapping("/{forwardId}/complete")
    public ResponseEntity<ApiResponse<WorkflowForwardDto>> completeForward(
            @PathVariable UUID forwardId,
            @RequestParam(required = false) String response,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());

        WorkflowForward forward = forwardRepository.findById(forwardId)
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowForward", "id", forwardId));

        if (!forward.getForwardedTo().equals(userId)) {
            throw new BusinessException("You are not the recipient of this forward");
        }

        if (Boolean.TRUE.equals(forward.getIsCompleted())) {
            throw new BusinessException("This forward has already been completed");
        }

        forward.setIsCompleted(true);
        forward.setCompletedAt(LocalDateTime.now());
        forward.setResponse(response);
        forwardRepository.save(forward);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("FORWARD_COMPLETED")
                .resourceType("DOCUMENT")
                .resourceId(forward.getDocumentId())
                .details(Map.of("forwardId", forwardId.toString()))
                .build());

        return ResponseEntity.ok(ApiResponse.success(toDto(forward)));
    }

    private WorkflowForwardDto toDto(WorkflowForward f) {
        return WorkflowForwardDto.builder()
                .id(f.getId())
                .documentId(f.getDocumentId())
                .workflowInstanceId(f.getWorkflowInstanceId())
                .forwardedBy(f.getForwardedBy())
                .forwardedTo(f.getForwardedTo())
                .message(f.getMessage())
                .actionRequired(f.getActionRequired())
                .isCompleted(f.getIsCompleted())
                .completedAt(f.getCompletedAt())
                .response(f.getResponse())
                .createdAt(f.getCreatedAt())
                .build();
    }
}
