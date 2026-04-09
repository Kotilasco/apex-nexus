package com.apexnexus.retention.repository;

import com.apexnexus.retention.model.JurisdictionRetentionRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface JurisdictionRetentionRuleRepository extends JpaRepository<JurisdictionRetentionRule, UUID> {
    List<JurisdictionRetentionRule> findByJurisdictionIdAndIsActiveTrueOrderByDocumentCategoryAsc(UUID jurisdictionId);
    List<JurisdictionRetentionRule> findByDocumentCategoryAndIsActiveTrueOrderByMinRetentionYearsDesc(String documentCategory);
    List<JurisdictionRetentionRule> findByJurisdictionIdAndDocumentCategoryAndIsActiveTrue(UUID jurisdictionId, String documentCategory);
    List<JurisdictionRetentionRule> findByIsActiveTrueOrderByJurisdiction_CodeAscDocumentCategoryAsc();
}
