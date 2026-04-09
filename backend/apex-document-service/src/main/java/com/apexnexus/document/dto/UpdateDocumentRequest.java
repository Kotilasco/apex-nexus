package com.apexnexus.document.dto;

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
public class UpdateDocumentRequest {
    private String title;
    private String description;
    private String status;
    private UUID folderId;
    private String[] tags;
    private Map<String, Object> metadata;
}
