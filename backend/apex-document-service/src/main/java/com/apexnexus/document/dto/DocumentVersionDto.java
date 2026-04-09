package com.apexnexus.document.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentVersionDto {
    private UUID id;
    private UUID documentId;
    private Integer versionNumber;
    private String versionType;
    private String versionLabel;
    private String fileName;
    private String sha256Hash;
    private Long fileSizeBytes;
    private UUID authorId;
    private String authorName;
    private String changeSummary;
    private Instant createdAt;
    private Boolean anomalyFlagged;
    private BigDecimal anomalyScore;
    private BigDecimal similarityScore;
    private List<String> anomalyReasons;
}
