package com.apexnexus.retention.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class DispositionItemDto {
    private UUID id;
    private UUID documentId;
    private String documentTitle;
    private String policyName;
    private String status;
    private LocalDateTime retentionExpiresAt;
    private LocalDateTime scheduledDestructionDate;
    private UUID approvedBy;
    private LocalDateTime approvedAt;
    private LocalDateTime destroyedAt;
    private String reason;
    private LocalDateTime createdAt;
}
