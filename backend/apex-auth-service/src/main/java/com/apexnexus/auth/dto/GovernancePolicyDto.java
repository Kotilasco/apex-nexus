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
public class GovernancePolicyDto {
    private UUID id;
    private String scope;           // GLOBAL, PROJECT, USER
    private UUID scopeId;
    private String scopeName;       // resolved name
    private String policyType;
    private Boolean isEnabled;
    private Map<String, Object> settings;
    private UUID createdBy;
    private String createdByName;
    private Instant createdAt;
    private Instant updatedAt;
}
