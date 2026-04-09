package com.apexnexus.retention.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreatePolicyRequest {
    @NotBlank(message = "Policy name is required")
    private String name;
    private String description;
    @NotNull(message = "Retention years is required")
    @Min(value = 1, message = "Retention years must be at least 1")
    private Integer retentionYears;
    private Boolean autoDispose;
    private Boolean requiresApproval;
}
