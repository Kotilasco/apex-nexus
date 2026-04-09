package com.apexnexus.workflow.service;

import com.apexnexus.workflow.dto.WorkflowTemplateDto;
import com.apexnexus.workflow.model.WorkflowTemplate;
import com.apexnexus.workflow.repository.WorkflowTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkflowTemplateService {

    private final WorkflowTemplateRepository templateRepository;

    @Transactional(readOnly = true)
    public List<WorkflowTemplateDto> getActiveTemplates() {
        return templateRepository.findByIsActiveTrueOrderByDisplayNameAsc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public WorkflowTemplateDto getTemplate(UUID id) {
        WorkflowTemplate t = templateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Workflow template not found: " + id));
        return toDto(t);
    }

    @Transactional(readOnly = true)
    public WorkflowTemplateDto getTemplateByName(String name) {
        WorkflowTemplate t = templateRepository.findByName(name)
                .orElseThrow(() -> new RuntimeException("Workflow template not found: " + name));
        return toDto(t);
    }

    @Transactional(readOnly = true)
    public List<WorkflowTemplateDto> getTemplatesByCategory(String category) {
        return templateRepository.findByCategoryAndIsActiveTrueOrderByDisplayNameAsc(category).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<WorkflowTemplateDto> getTemplatesByIndustry(String industry) {
        return templateRepository.findByIndustryAndIsActiveTrueOrderByDisplayNameAsc(industry).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    private WorkflowTemplateDto toDto(WorkflowTemplate t) {
        return WorkflowTemplateDto.builder()
                .id(t.getId())
                .name(t.getName())
                .displayName(t.getDisplayName())
                .description(t.getDescription())
                .category(t.getCategory())
                .industry(t.getIndustry())
                .states(t.getStates())
                .transitions(t.getTransitions())
                .initialState(t.getInitialState())
                .canvasLayout(t.getCanvasLayout())
                .icon(t.getIcon())
                .color(t.getColor())
                .estimatedDurationHours(t.getEstimatedDurationHours())
                .isActive(t.getIsActive())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
