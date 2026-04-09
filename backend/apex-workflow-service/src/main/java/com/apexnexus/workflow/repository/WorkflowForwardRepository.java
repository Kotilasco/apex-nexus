package com.apexnexus.workflow.repository;

import com.apexnexus.workflow.model.WorkflowForward;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WorkflowForwardRepository extends JpaRepository<WorkflowForward, UUID> {

    Page<WorkflowForward> findByForwardedToAndIsCompletedFalseOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<WorkflowForward> findByDocumentIdOrderByCreatedAtDesc(UUID documentId);

    long countByForwardedToAndIsCompletedFalse(UUID userId);
}
