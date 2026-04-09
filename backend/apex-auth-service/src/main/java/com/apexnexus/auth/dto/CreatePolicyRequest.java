package com.apexnexus.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreatePolicyRequest {
    @NotBlank(message = "Scope is required (GLOBAL, PROJECT, USER)")
    private String scope;
    private UUID scopeId;               // required for PROJECT and USER scopes
    @NotBlank(message = "Policy type is required")
    private String policyType;
    @NotNull(message = "isEnabled is required")
    private Boolean isEnabled;
    private Map<String, Object> settings;
    private String reason;              // for audit trail
}
