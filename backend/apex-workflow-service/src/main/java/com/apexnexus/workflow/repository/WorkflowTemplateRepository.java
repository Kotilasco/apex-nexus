package com.apexnexus.workflow.repository;

import com.apexnexus.workflow.model.WorkflowTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkflowTemplateRepository extends JpaRepository<WorkflowTemplate, UUID> {
    Optional<WorkflowTemplate> findByName(String name);
    List<WorkflowTemplate> findByIsActiveTrueOrderByDisplayNameAsc();
    List<WorkflowTemplate> findByCategoryAndIsActiveTrueOrderByDisplayNameAsc(String category);
    List<WorkflowTemplate> findByIndustryAndIsActiveTrueOrderByDisplayNameAsc(String industry);
}
