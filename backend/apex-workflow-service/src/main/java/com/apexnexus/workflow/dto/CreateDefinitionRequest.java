package com.apexnexus.workflow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class CreateDefinitionRequest {
    @NotBlank(message = "Name is required")
    private String name;
    private String description;
    @NotNull(message = "States are required")
    private List<String> states;
    @NotNull(message = "Transitions are required")
    private List<Map<String, Object>> transitions;
    private String initialState;
    private List<String> requiredRoles;
    private Boolean humanReviewRequired;
    private List<Map<String, Object>> escalationRules;
}
