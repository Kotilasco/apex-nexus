package com.apexnexus.workflow.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class ForwardDocumentRequest {

    @NotNull
    private UUID documentId;

    @NotNull
    private UUID forwardedTo;

    private UUID workflowInstanceId;   // optional — link to existing workflow

    private String message;

    private String actionRequired;     // REVIEW, APPROVE, SIGN, COMMENT, FYI
}
