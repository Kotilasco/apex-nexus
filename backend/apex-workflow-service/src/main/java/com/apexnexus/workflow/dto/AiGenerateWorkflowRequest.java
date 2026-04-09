package com.apexnexus.workflow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AiGenerateWorkflowRequest {
    @NotBlank(message = "Prompt is required")
    private String prompt;
}
