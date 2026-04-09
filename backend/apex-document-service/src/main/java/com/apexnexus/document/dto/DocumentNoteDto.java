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
public class DocumentNoteDto {
    private UUID id;
    private UUID documentId;
    private UUID authorId;
    private String authorName;
    private String content;
    private String noteType;
    private Boolean isPinned;
    private String color;
    private UUID parentNoteId;
    private Instant createdAt;
    private Instant updatedAt;
}
