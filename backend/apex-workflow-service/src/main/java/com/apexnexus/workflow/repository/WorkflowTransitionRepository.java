package com.apexnexus.workflow.repository;

import com.apexnexus.workflow.model.WorkflowTransition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WorkflowTransitionRepository extends JpaRepository<WorkflowTransition, UUID> {
    List<WorkflowTransition> findByWorkflowInstanceIdOrderByCreatedAtDesc(UUID instanceId);
}
