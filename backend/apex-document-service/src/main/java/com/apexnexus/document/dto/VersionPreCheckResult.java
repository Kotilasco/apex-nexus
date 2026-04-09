package com.apexnexus.document.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VersionPreCheckResult {
    private boolean duplicateFound;
    private UUID duplicateDocumentId;
    private String duplicateDocumentTitle;
    private Integer duplicateVersionNumber;

    private boolean formatMismatch;
    private String previousFormat;
    private String newFormat;

    private Double similarityScore;
    private boolean highRisk;

    private List<String> warnings;
}
