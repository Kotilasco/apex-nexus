package com.apexnexus.workflow.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class PeerReviewRequest {
    @NotNull(message = "Reviewer ID is required")
    private UUID reviewerId;
    private String comments;
}
