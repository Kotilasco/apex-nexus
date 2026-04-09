package com.apexnexus.workflow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TransitionRequest {
    @NotBlank(message = "Action is required")
    private String action;
    private String comments;
    private String documentHash;
}
