package com.apexnexus.workflow.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class WorkflowInstanceDto {
    private UUID id;
    private UUID documentId;
    private String definitionName;
    private UUID definitionId;
    private String currentState;
    private UUID initiatedBy;
    private UUID assignedTo;
    private Integer priority;
    private LocalDateTime dueDate;
    private LocalDateTime completedAt;
    private Integer correctionCount;
    private String rejectedDocumentHash;
    private String rejectionComments;
    private String actorType;
    private UUID projectId;
    private Integer escalationLevel;
    private LocalDateTime escalatedAt;
    private LocalDateTime slaDeadline;
    private List<String> requiredRoles;
    private Boolean humanReviewRequired;
    private List<TransitionDto> transitions;
    private List<ApprovalDto> approvals;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    public static class TransitionDto {
        private UUID id;
        private String fromState;
        private String toState;
        private String action;
        private UUID performedBy;
        private String comments;
        private LocalDateTime createdAt;
    }

    @Data
    @Builder
    public static class ApprovalDto {
        private UUID id;
        private UUID approverId;
        private Integer approvalOrder;
        private Boolean isParallel;
        private UUID groupId;
        private String decision;
        private String comments;
        private LocalDateTime decidedAt;
        private LocalDateTime createdAt;
    }
}
