package com.apexnexus.retention.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class RetentionPolicyDto {
    private UUID id;
    private String name;
    private String description;
    private Integer retentionYears;
    private Boolean autoDispose;
    private Boolean requiresApproval;
    private Boolean isActive;
    private LocalDateTime createdAt;
}
