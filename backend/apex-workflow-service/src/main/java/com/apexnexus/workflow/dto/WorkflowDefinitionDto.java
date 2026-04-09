package com.apexnexus.workflow.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class WorkflowDefinitionDto {
    private UUID id;
    private String name;
    private String description;
    private List<String> states;
    private List<Map<String, Object>> transitions;
    private String initialState;
    private List<String> requiredRoles;
    private Boolean humanReviewRequired;
    private List<Map<String, Object>> escalationRules;
    private Boolean isActive;
    private UUID createdBy;
    private LocalDateTime createdAt;
}
