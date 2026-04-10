package com.apexnexus.document.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CopyVersionToProjectRequest {
    @NotNull(message = "Target project ID is required")
    private UUID targetProjectId;

    private UUID targetFolderId;

    private String title;
}
