package com.apexnexus.retention.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class JurisdictionRetentionRuleDto {
    private UUID id;
    private String jurisdictionCode;
    private String jurisdictionName;
    private String legalFrameworkCode;
    private String legalFrameworkName;
    private String documentCategory;
    private Integer minRetentionYears;
    private Integer maxRetentionYears;
    private String description;
    private String legalCitation;
    private String penaltyInfo;
    private Boolean isMandatory;
}
