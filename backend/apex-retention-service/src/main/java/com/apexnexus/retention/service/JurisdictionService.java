package com.apexnexus.retention.service;

import com.apexnexus.common.exception.ResourceNotFoundException;
import com.apexnexus.retention.dto.JurisdictionDto;
import com.apexnexus.retention.dto.JurisdictionRetentionRuleDto;
import com.apexnexus.retention.dto.LegalFrameworkDto;
import com.apexnexus.retention.model.Jurisdiction;
import com.apexnexus.retention.model.JurisdictionRetentionRule;
import com.apexnexus.retention.model.LegalFramework;
import com.apexnexus.retention.repository.JurisdictionRepository;
import com.apexnexus.retention.repository.JurisdictionRetentionRuleRepository;
import com.apexnexus.retention.repository.LegalFrameworkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class JurisdictionService {

    private final JurisdictionRepository jurisdictionRepository;
    private final LegalFrameworkRepository frameworkRepository;
    private final JurisdictionRetentionRuleRepository ruleRepository;

    public List<JurisdictionDto> getActiveJurisdictions() {
        return jurisdictionRepository.findByIsActiveTrueOrderByNameAsc().stream()
                .map(this::toJurisdictionDto)
                .collect(Collectors.toList());
    }

    public JurisdictionDto getJurisdiction(String code) {
        Jurisdiction j = jurisdictionRepository.findByCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("Jurisdiction", "code", code));
        JurisdictionDto dto = toJurisdictionDto(j);
        dto.setFrameworks(frameworkRepository.findByJurisdictionIdAndIsActiveTrueOrderByCodeAsc(j.getId()).stream()
                .map(this::toFrameworkDto)
                .collect(Collectors.toList()));
        return dto;
    }

    public List<LegalFrameworkDto> getFrameworks(UUID jurisdictionId) {
        return frameworkRepository.findByJurisdictionIdAndIsActiveTrueOrderByCodeAsc(jurisdictionId).stream()
                .map(this::toFrameworkDto)
                .collect(Collectors.toList());
    }

    public List<LegalFrameworkDto> getAllFrameworks() {
        return frameworkRepository.findByIsActiveTrueOrderByCodeAsc().stream()
                .map(this::toFrameworkDto)
                .collect(Collectors.toList());
    }

    public List<JurisdictionRetentionRuleDto> getRulesByJurisdiction(UUID jurisdictionId) {
        return ruleRepository.findByJurisdictionIdAndIsActiveTrueOrderByDocumentCategoryAsc(jurisdictionId).stream()
                .map(this::toRuleDto)
                .collect(Collectors.toList());
    }

    public List<JurisdictionRetentionRuleDto> getRulesByCategory(String category) {
        return ruleRepository.findByDocumentCategoryAndIsActiveTrueOrderByMinRetentionYearsDesc(category).stream()
                .map(this::toRuleDto)
                .collect(Collectors.toList());
    }

    public List<JurisdictionRetentionRuleDto> getAllRules() {
        return ruleRepository.findByIsActiveTrueOrderByJurisdiction_CodeAscDocumentCategoryAsc().stream()
                .map(this::toRuleDto)
                .collect(Collectors.toList());
    }

    public List<JurisdictionRetentionRuleDto> checkCompliance(UUID jurisdictionId, String documentCategory) {
        return ruleRepository.findByJurisdictionIdAndDocumentCategoryAndIsActiveTrue(jurisdictionId, documentCategory).stream()
                .map(this::toRuleDto)
                .collect(Collectors.toList());
    }

    private JurisdictionDto toJurisdictionDto(Jurisdiction j) {
        return JurisdictionDto.builder()
                .id(j.getId())
                .code(j.getCode())
                .name(j.getName())
                .region(j.getRegion())
                .isActive(j.getIsActive())
                .build();
    }

    private LegalFrameworkDto toFrameworkDto(LegalFramework f) {
        return LegalFrameworkDto.builder()
                .id(f.getId())
                .code(f.getCode())
                .name(f.getName())
                .description(f.getDescription())
                .authority(f.getAuthority())
                .effectiveDate(f.getEffectiveDate())
                .url(f.getUrl())
                .jurisdictionCode(f.getJurisdiction() != null ? f.getJurisdiction().getCode() : null)
                .build();
    }

    private JurisdictionRetentionRuleDto toRuleDto(JurisdictionRetentionRule r) {
        return JurisdictionRetentionRuleDto.builder()
                .id(r.getId())
                .jurisdictionCode(r.getJurisdiction() != null ? r.getJurisdiction().getCode() : null)
                .jurisdictionName(r.getJurisdiction() != null ? r.getJurisdiction().getName() : null)
                .legalFrameworkCode(r.getLegalFramework() != null ? r.getLegalFramework().getCode() : null)
                .legalFrameworkName(r.getLegalFramework() != null ? r.getLegalFramework().getName() : null)
                .documentCategory(r.getDocumentCategory())
                .minRetentionYears(r.getMinRetentionYears())
                .maxRetentionYears(r.getMaxRetentionYears())
                .description(r.getDescription())
                .legalCitation(r.getLegalCitation())
                .penaltyInfo(r.getPenaltyInfo())
                .isMandatory(r.getIsMandatory())
                .build();
    }
}
