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
public class ProjectDto {
    private UUID id;
    private String name;
    private String description;
    private UUID ownerId;
    private String ownerName;
    private UUID parentProjectId;
    private String parentProjectName;
    private int subProjectCount;
    private Map<String, Object> metadataSchema;
    private Boolean aiEnabled;
    private Boolean isActive;
    private UUID defaultWorkflowDefinitionId;
    private Integer defaultRetentionPeriodYears;
    private String[] retentionDocumentTypes;
    private String jurisdictionCode;
    private Boolean privacyRedactionEnabled;
    private String complianceCategory;
    private int memberCount;
    private Instant createdAt;
    private Instant updatedAt;
}
