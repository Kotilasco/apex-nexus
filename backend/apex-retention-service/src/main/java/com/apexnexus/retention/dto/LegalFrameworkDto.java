package com.apexnexus.retention.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class LegalFrameworkDto {
    private UUID id;
    private String code;
    private String name;
    private String description;
    private String authority;
    private LocalDate effectiveDate;
    private String url;
    private String jurisdictionCode;
}
