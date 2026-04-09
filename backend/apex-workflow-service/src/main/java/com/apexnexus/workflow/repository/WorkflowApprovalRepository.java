package com.apexnexus.workflow.repository;

import com.apexnexus.workflow.model.ApprovalDecision;
import com.apexnexus.workflow.model.WorkflowApproval;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkflowApprovalRepository extends JpaRepository<WorkflowApproval, UUID> {
    List<WorkflowApproval> findByWorkflowInstanceId(UUID instanceId);

    Optional<WorkflowApproval> findByWorkflowInstanceIdAndApproverId(UUID instanceId, UUID approverId);

    List<WorkflowApproval> findByWorkflowInstanceIdAndDecision(UUID instanceId, ApprovalDecision decision);

    long countByWorkflowInstanceIdAndDecision(UUID instanceId, ApprovalDecision decision);

    List<WorkflowApproval> findByWorkflowInstanceIdAndGroupId(UUID instanceId, UUID groupId);

    long countByWorkflowInstanceIdAndGroupIdAndDecision(UUID instanceId, UUID groupId, ApprovalDecision decision);
}
