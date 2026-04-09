package com.apexnexus.workflow.repository;

import com.apexnexus.workflow.model.WorkflowDefinition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkflowDefinitionRepository extends JpaRepository<WorkflowDefinition, UUID> {
    Optional<WorkflowDefinition> findByName(String name);
    List<WorkflowDefinition> findByIsActiveTrue();
}
