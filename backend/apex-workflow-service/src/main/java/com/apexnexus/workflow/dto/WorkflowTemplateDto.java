package com.apexnexus.workflow.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class WorkflowTemplateDto {
    private UUID id;
    private String name;
    private String displayName;
    private String description;
    private String category;
    private String industry;
    private String states;
    private String transitions;
    private String initialState;
    private String canvasLayout;
    private String icon;
    private String color;
    private Integer estimatedDurationHours;
    private Boolean isActive;
    private LocalDateTime createdAt;
}
