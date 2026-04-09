package com.apexnexus.auth.service;

import com.apexnexus.auth.dto.IndustryTemplateDto;
import com.apexnexus.auth.model.IndustryTemplate;
import com.apexnexus.auth.repository.IndustryTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IndustryTemplateService {

    private final IndustryTemplateRepository templateRepository;

    @Transactional(readOnly = true)
    public List<IndustryTemplateDto> getActiveTemplates() {
        return templateRepository.findByIsActiveTrueOrderByDisplayNameAsc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public IndustryTemplateDto getTemplate(UUID id) {
        IndustryTemplate t = templateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Industry template not found: " + id));
        return toDto(t);
    }

    @Transactional(readOnly = true)
    public IndustryTemplateDto getTemplateByName(String name) {
        IndustryTemplate t = templateRepository.findByName(name)
                .orElseThrow(() -> new RuntimeException("Industry template not found: " + name));
        return toDto(t);
    }

    @Transactional(readOnly = true)
    public List<IndustryTemplateDto> getTemplatesByIndustry(String industry) {
        return templateRepository.findByIndustryAndIsActiveTrueOrderByDisplayNameAsc(industry).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    private IndustryTemplateDto toDto(IndustryTemplate t) {
        return IndustryTemplateDto.builder()
                .id(t.getId())
                .name(t.getName())
                .displayName(t.getDisplayName())
                .description(t.getDescription())
                .industry(t.getIndustry())
                .includedPlugins(t.getIncludedPlugins())
                .defaultWorkflows(t.getDefaultWorkflows())
                .retentionRules(t.getRetentionRules())
                .complianceFrameworks(t.getComplianceFrameworks())
                .iconUrl(t.getIconUrl())
                .isActive(t.getIsActive())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
