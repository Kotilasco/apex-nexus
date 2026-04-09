package com.apexnexus.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PolicyAuditDto {
    private UUID id;
    private UUID policyId;
    private UUID changedBy;
    private String changedByName;
    private String changeType;
    private Map<String, Object> oldSettings;
    private Map<String, Object> newSettings;
    private String reason;
    private Instant createdAt;
}
