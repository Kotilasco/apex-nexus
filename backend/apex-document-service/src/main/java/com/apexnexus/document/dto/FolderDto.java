package com.apexnexus.document.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FolderDto {
    private UUID id;
    private String name;
    private UUID parentId;
    private UUID ownerId;
    private UUID projectId;
    private String description;
    private String path;
    private Integer depth;
    private Boolean isSystem;
    private Instant createdAt;
    private Instant updatedAt;
}
