package com.apexnexus.workflow.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class StartWorkflowRequest {
    @NotNull(message = "Document ID is required")
    private UUID documentId;

    @NotNull(message = "Workflow definition ID is required")
    private UUID definitionId;

    private UUID assignedTo;
    private Integer priority;
    private LocalDateTime dueDate;
    private List<ApproverConfig> approvers;
    private String comments;
    private String actorType;
    private UUID projectId;
    private UUID projectDefaultWorkflowId;

    @Data
    public static class ApproverConfig {
        @NotNull
        private UUID approverId;
        private UUID groupId;
        private Integer approvalOrder;
        private Boolean isParallel;
    }
}
