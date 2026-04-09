package com.apexnexus.workflow.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class WorkflowForwardDto {
    private UUID id;
    private UUID documentId;
    private UUID workflowInstanceId;
    private UUID forwardedBy;
    private UUID forwardedTo;
    private String message;
    private String actionRequired;
    private Boolean isCompleted;
    private LocalDateTime completedAt;
    private String response;
    private LocalDateTime createdAt;
}
