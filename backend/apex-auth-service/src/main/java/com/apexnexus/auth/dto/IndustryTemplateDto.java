package com.apexnexus.auth.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class IndustryTemplateDto {
    private UUID id;
    private String name;
    private String displayName;
    private String description;
    private String industry;
    private String includedPlugins;
    private String defaultWorkflows;
    private String retentionRules;
    private String complianceFrameworks;
    private String iconUrl;
    private Boolean isActive;
    private LocalDateTime createdAt;
}
