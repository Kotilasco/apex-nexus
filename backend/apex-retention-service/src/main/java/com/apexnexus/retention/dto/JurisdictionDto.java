package com.apexnexus.retention.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class JurisdictionDto {
    private UUID id;
    private String code;
    private String name;
    private String region;
    private Boolean isActive;
    private List<LegalFrameworkDto> frameworks;
}
