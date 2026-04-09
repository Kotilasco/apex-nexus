package com.apexnexus.workflow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApprovalRequest {
    @NotBlank(message = "Decision is required (APPROVED, REJECTED, ABSTAINED)")
    private String decision;
    private String comments;
}
