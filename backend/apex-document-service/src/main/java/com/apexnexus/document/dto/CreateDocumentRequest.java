package com.apexnexus.document.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;
import java.util.UUID;

@Data
public class CreateDocumentRequest {
    @NotBlank(message = "Title is required")
    private String title;

    private String description;
    private UUID folderId;
    private UUID projectId;
    private String[] tags;
    private Map<String, Object> metadata;
    private Integer retentionPeriodYears;
    private Integer retentionPeriodMinutes;
}
