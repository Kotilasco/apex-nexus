package com.apexnexus.workflow.repository;

import com.apexnexus.workflow.model.WorkflowInstance;
import com.apexnexus.workflow.model.WorkflowStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkflowInstanceRepository extends JpaRepository<WorkflowInstance, UUID> {

    @Query("SELECT wi FROM WorkflowInstance wi LEFT JOIN FETCH wi.definition WHERE wi.id = :id")
    Optional<WorkflowInstance> findByIdWithDefinition(@Param("id") UUID id);

    List<WorkflowInstance> findByDocumentId(UUID documentId);

    Page<WorkflowInstance> findByInitiatedBy(UUID initiatedBy, Pageable pageable);

    Page<WorkflowInstance> findByAssignedTo(UUID assignedTo, Pageable pageable);

    Page<WorkflowInstance> findByCurrentState(WorkflowStatus status, Pageable pageable);

    @Query("SELECT wi FROM WorkflowInstance wi WHERE wi.currentState IN :states")
    Page<WorkflowInstance> findByCurrentStateIn(@Param("states") List<WorkflowStatus> states, Pageable pageable);

    @Query("SELECT wi FROM WorkflowInstance wi JOIN wi.approvals a " +
           "WHERE a.approverId = :approverId AND a.decision = com.apexnexus.workflow.model.ApprovalDecision.PENDING")
    Page<WorkflowInstance> findPendingApprovalsByApprover(@Param("approverId") UUID approverId, Pageable pageable);

    @Query("SELECT COUNT(wi) FROM WorkflowInstance wi JOIN wi.approvals a " +
           "WHERE a.approverId = :approverId AND a.decision = com.apexnexus.workflow.model.ApprovalDecision.PENDING")
    long countPendingApprovalsByApprover(@Param("approverId") UUID approverId);

    Optional<WorkflowInstance> findByDocumentIdAndCurrentStateIn(UUID documentId, List<WorkflowStatus> states);

    @Query("SELECT wi FROM WorkflowInstance wi LEFT JOIN FETCH wi.definition " +
           "WHERE wi.slaDeadline IS NOT NULL AND wi.slaDeadline < :now " +
           "AND wi.currentState NOT IN (com.apexnexus.workflow.model.WorkflowStatus.APPROVED, " +
           "com.apexnexus.workflow.model.WorkflowStatus.ARCHIVED, " +
           "com.apexnexus.workflow.model.WorkflowStatus.CANCELLED)")
    List<WorkflowInstance> findOverdueInstances(@Param("now") LocalDateTime now);
}
