package com.apexnexus.search.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class SearchResult {
    private UUID documentId;
    private String title;
    private String description;
    private String mimeType;
    private String status;
    private String authorName;
    private UUID authorId;
    private String folderPath;
    private List<String> tags;
    private Map<String, Object> metadata;
    private double score;
    private List<String> highlights;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
