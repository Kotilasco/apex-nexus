package com.apexnexus.document.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateNoteRequest {
    @NotBlank(message = "Note content is required")
    private String content;

    private String noteType = "GENERAL";
    private Boolean isPinned = false;
    private String color = "#FFEB3B";
    private UUID parentNoteId;
}
