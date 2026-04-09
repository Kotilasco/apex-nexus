package com.apexnexus.auth.dto;

import jakarta.validation.constraints.NotBlank;
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
public class CreateProjectRequest {
    @NotBlank(message = "Project name is required")
    private String name;
    private String description;
    private Map<String, Object> metadataSchema;
    private Boolean aiEnabled;
    private UUID defaultWorkflowDefinitionId;
    private Integer defaultRetentionPeriodYears;
    private String[] retentionDocumentTypes;
    private String jurisdictionCode;
    private Boolean privacyRedactionEnabled;
    private String complianceCategory;
}
