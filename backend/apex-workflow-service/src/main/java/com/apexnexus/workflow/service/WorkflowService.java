package com.apexnexus.workflow.service;

import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.exception.BusinessException;
import com.apexnexus.common.exception.ConflictException;
import com.apexnexus.common.exception.ResourceNotFoundException;
import com.apexnexus.workflow.dto.*;
import com.apexnexus.workflow.model.*;
import com.apexnexus.workflow.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class WorkflowService {

    private final WorkflowDefinitionRepository definitionRepository;
    private final WorkflowInstanceRepository instanceRepository;
    private final WorkflowTransitionRepository transitionRepository;
    private final WorkflowApprovalRepository approvalRepository;
    private final ApprovalGroupRepository approvalGroupRepository;
    private final AuditPublisher auditPublisher;

    // === Allowed transitions (state machine) ===
    private static final Map<WorkflowStatus, Map<String, WorkflowStatus>> STATE_MACHINE = Map.of(
        WorkflowStatus.DRAFT, Map.of(
            "submit", WorkflowStatus.REVIEW,
            "cancel", WorkflowStatus.CANCELLED
        ),
        WorkflowStatus.REVIEW, Map.of(
            "approve", WorkflowStatus.PENDING_APPROVAL,
            "reject", WorkflowStatus.CORRECTION,
            "cancel", WorkflowStatus.CANCELLED
        ),
        WorkflowStatus.PENDING_APPROVAL, Map.of(
            "approve", WorkflowStatus.APPROVED,
            "reject", WorkflowStatus.CORRECTION,
            "cancel", WorkflowStatus.CANCELLED
        ),
        WorkflowStatus.CORRECTION, Map.of(
            "resubmit", WorkflowStatus.REVIEW,
            "cancel", WorkflowStatus.CANCELLED
        ),
        WorkflowStatus.APPROVED, Map.of(
            "archive", WorkflowStatus.ARCHIVED
        ),
        WorkflowStatus.REJECTED, Map.of(
            "resubmit", WorkflowStatus.REVIEW
        )
    );

    // ==================== Workflow Definitions ====================

    public List<WorkflowDefinitionDto> getActiveDefinitions() {
        return definitionRepository.findByIsActiveTrue().stream()
                .map(this::toDefinitionDto)
                .collect(Collectors.toList());
    }

    public WorkflowDefinitionDto getDefinition(UUID id) {
        return toDefinitionDto(definitionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowDefinition", "id", id)));
    }

    @Transactional
    public WorkflowDefinitionDto createDefinition(CreateDefinitionRequest request, UUID userId) {
        definitionRepository.findByName(request.getName()).ifPresent(existing -> {
            throw new ConflictException("A workflow definition with name '" + request.getName() + "' already exists");
        });

        // Validate that all states in transitions are in the states list
        validateTransitions(request.getStates(), request.getTransitions());

        WorkflowDefinition def = WorkflowDefinition.builder()
                .name(request.getName())
                .description(request.getDescription())
                .states(request.getStates())
                .transitions(request.getTransitions())
                .initialState(request.getInitialState() != null ? request.getInitialState() : "DRAFT")
                .requiredRoles(request.getRequiredRoles())
                .humanReviewRequired(request.getHumanReviewRequired() != null ? request.getHumanReviewRequired() : false)
                .escalationRules(request.getEscalationRules())
                .createdBy(userId)
                .build();

        def = definitionRepository.save(def);
        publishAudit(userId, "DEFINITION_CREATED", "WORKFLOW_DEFINITION", def.getId(),
                Map.of("name", def.getName()));
        log.info("Workflow definition created: {} by user {}", def.getName(), userId);
        return toDefinitionDto(def);
    }

    @Transactional
    public WorkflowDefinitionDto updateDefinition(UUID id, CreateDefinitionRequest request, UUID userId) {
        WorkflowDefinition def = definitionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowDefinition", "id", id));

        if (!def.getName().equals(request.getName())) {
            definitionRepository.findByName(request.getName()).ifPresent(existing -> {
                throw new ConflictException("A workflow definition with name '" + request.getName() + "' already exists");
            });
        }

        validateTransitions(request.getStates(), request.getTransitions());

        def.setName(request.getName());
        def.setDescription(request.getDescription());
        def.setStates(request.getStates());
        def.setTransitions(request.getTransitions());
        if (request.getInitialState() != null) def.setInitialState(request.getInitialState());
        if (request.getRequiredRoles() != null) def.setRequiredRoles(request.getRequiredRoles());
        if (request.getHumanReviewRequired() != null) def.setHumanReviewRequired(request.getHumanReviewRequired());
        if (request.getEscalationRules() != null) def.setEscalationRules(request.getEscalationRules());
        def.setUpdatedAt(LocalDateTime.now());

        def = definitionRepository.save(def);
        publishAudit(userId, "DEFINITION_UPDATED", "WORKFLOW_DEFINITION", def.getId(),
                Map.of("name", def.getName()));
        log.info("Workflow definition updated: {} by user {}", def.getName(), userId);
        return toDefinitionDto(def);
    }

    @Transactional
    public void deactivateDefinition(UUID id, UUID userId) {
        WorkflowDefinition def = definitionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowDefinition", "id", id));
        def.setIsActive(false);
        def.setUpdatedAt(LocalDateTime.now());
        definitionRepository.save(def);
        publishAudit(userId, "DEFINITION_DEACTIVATED", "WORKFLOW_DEFINITION", def.getId(),
                Map.of("name", def.getName()));
        log.info("Workflow definition deactivated: {} by user {}", def.getName(), userId);
    }

    private void validateTransitions(List<String> states, List<Map<String, Object>> transitions) {
        Set<String> stateSet = new HashSet<>(states);
        for (Map<String, Object> t : transitions) {
            String from = String.valueOf(t.get("from"));
            String to = String.valueOf(t.get("to"));
            if (!stateSet.contains(from)) {
                throw new BusinessException("Transition references unknown state: " + from);
            }
            if (!stateSet.contains(to)) {
                throw new BusinessException("Transition references unknown state: " + to);
            }
            // Validate states are valid enum values
            try { WorkflowStatus.valueOf(from); } catch (IllegalArgumentException e) {
                throw new BusinessException("Invalid state '" + from + "'. Valid states: " + Arrays.toString(WorkflowStatus.values()));
            }
            try { WorkflowStatus.valueOf(to); } catch (IllegalArgumentException e) {
                throw new BusinessException("Invalid state '" + to + "'. Valid states: " + Arrays.toString(WorkflowStatus.values()));
            }
        }
    }

    // ==================== Start Workflow ====================

    /**
     * Validates that a document-level workflow is at most as permissive as the project's default.
     * The document workflow states must be a subset of the project workflow states.
     */
    public void validateWorkflowRestriction(UUID definitionId, UUID projectDefaultDefinitionId) {
        if (projectDefaultDefinitionId == null || definitionId.equals(projectDefaultDefinitionId)) {
            return; // No restriction needed or same definition
        }

        WorkflowDefinition projectDef = definitionRepository.findById(projectDefaultDefinitionId).orElse(null);
        WorkflowDefinition docDef = definitionRepository.findById(definitionId).orElse(null);

        if (projectDef == null || docDef == null) return;

        Set<String> projectStates = new HashSet<>(projectDef.getStates());
        Set<String> docStates = new HashSet<>(docDef.getStates());

        // Document workflow states must be subset of project workflow states
        if (!projectStates.containsAll(docStates)) {
            Set<String> extra = new HashSet<>(docStates);
            extra.removeAll(projectStates);
            throw new BusinessException(
                    "Document workflow cannot be more permissive than project workflow. " +
                    "States not allowed by project: " + extra);
        }

        // Document workflow transitions must only use transitions allowed by project
        Set<String> projectTransitions = projectDef.getTransitions().stream()
                .map(t -> t.get("from") + "->" + t.get("action") + "->" + t.get("to"))
                .collect(Collectors.toSet());

        for (Map<String, Object> docTrans : docDef.getTransitions()) {
            String key = docTrans.get("from") + "->" + docTrans.get("action") + "->" + docTrans.get("to");
            if (!projectTransitions.contains(key)) {
                throw new BusinessException(
                        "Document workflow transition '" + key + "' is not allowed by project workflow");
            }
        }
    }

    @Transactional
    public WorkflowInstanceDto startWorkflow(StartWorkflowRequest request, UUID userId) {
        WorkflowDefinition definition = definitionRepository.findById(request.getDefinitionId())
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowDefinition", "id", request.getDefinitionId()));

        if (!definition.getIsActive()) {
            throw new BusinessException("Workflow definition is not active");
        }

        // Validate document workflow is not more permissive than project's default
        if (request.getProjectDefaultWorkflowId() != null) {
            validateWorkflowRestriction(request.getDefinitionId(), request.getProjectDefaultWorkflowId());
        }

        // Check for existing active workflow on this document
        List<WorkflowStatus> activeStates = List.of(
                WorkflowStatus.DRAFT, WorkflowStatus.REVIEW,
                WorkflowStatus.PENDING_APPROVAL, WorkflowStatus.CORRECTION
        );
        instanceRepository.findByDocumentIdAndCurrentStateIn(request.getDocumentId(), activeStates)
                .ifPresent(existing -> {
                    throw new ConflictException("Document already has an active workflow: " + existing.getId());
                });

        WorkflowInstance instance = WorkflowInstance.builder()
                .definition(definition)
                .documentId(request.getDocumentId())
                .currentState(WorkflowStatus.DRAFT)
                .initiatedBy(userId)
                .actorType(request.getActorType() != null ? request.getActorType() : "HUMAN")
                .projectId(request.getProjectId())
                .assignedTo(request.getAssignedTo())
                .priority(request.getPriority() != null ? request.getPriority() : 0)
                .dueDate(request.getDueDate())
                .build();

        instance = instanceRepository.save(instance);

        // Set initial SLA deadline based on escalation rules
        updateSlaDeadline(instance, "DRAFT");
        if (instance.getSlaDeadline() != null) {
            instanceRepository.save(instance);
        }

        // Create approval records if approvers specified
        if (request.getApprovers() != null && !request.getApprovers().isEmpty()) {
            for (StartWorkflowRequest.ApproverConfig config : request.getApprovers()) {
                // Prevent document author/initiator from being assigned as approver
                if (config.getApproverId().equals(userId)) {
                    throw new BusinessException("Document author cannot be an approver on their own document");
                }
                WorkflowApproval approval = WorkflowApproval.builder()
                        .workflowInstance(instance)
                        .approverId(config.getApproverId())
                        .approvalOrder(config.getApprovalOrder() != null ? config.getApprovalOrder() : 0)
                        .isParallel(config.getIsParallel() != null ? config.getIsParallel() : false)
                        .groupId(config.getGroupId())
                        .build();
                approvalRepository.save(approval);
            }
        }

        // Record initial transition
        recordTransition(instance, "INIT", WorkflowStatus.DRAFT.name(), "start", userId, request.getComments());

        publishAudit(userId, "WORKFLOW_STARTED", "WORKFLOW", instance.getId(),
                Map.of("documentId", request.getDocumentId().toString(), "definition", definition.getName()));

        log.info("Workflow started: {} for document {} by user {}", instance.getId(), request.getDocumentId(), userId);
        return toInstanceDto(instance);
    }

    // ==================== Transition Workflow ====================

    @Transactional
    public WorkflowInstanceDto transition(UUID instanceId, TransitionRequest request, UUID userId) {
        WorkflowInstance instance = instanceRepository.findByIdWithDefinition(instanceId)
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowInstance", "id", instanceId));

        String action = request.getAction().toLowerCase();
        WorkflowStatus currentState = instance.getCurrentState();

        // Resolve transition using definition first, then hardcoded fallback
        WorkflowStatus targetState = resolveTransition(instance.getDefinition(), currentState, action);

        // Special handling for approval-based transitions
        if (action.equals("approve") && currentState == WorkflowStatus.PENDING_APPROVAL) {
            return handleApprovalTransition(instance, userId, request.getComments());
        }

        // For rejection from REVIEW or PENDING_APPROVAL → CORRECTION
        if (action.equals("reject")) {
            instance.setCorrectionCount(instance.getCorrectionCount() + 1);
            // Store the document hash and rejection comments for correction proof
            if (request.getDocumentHash() != null) {
                instance.setRejectedDocumentHash(request.getDocumentHash());
            }
            if (request.getComments() != null && !request.getComments().isBlank()) {
                instance.setRejectionComments(request.getComments());
            }

            // High-priority audit for rejections
            publishAudit(userId, "WORKFLOW_REJECTION_HIGH_PRIORITY", "WORKFLOW", instance.getId(),
                    Map.of("from", currentState.name(), "correctionCount", instance.getCorrectionCount(),
                            "documentId", instance.getDocumentId().toString(),
                            "comments", request.getComments() != null ? request.getComments() : ""));
        }

        // For resubmit from CORRECTION → REVIEW, verify document was actually changed
        if (action.equals("resubmit")) {
            if (instance.getRejectedDocumentHash() != null && request.getDocumentHash() != null
                    && instance.getRejectedDocumentHash().equals(request.getDocumentHash())) {
                throw new BusinessException(
                        "Cannot resubmit: the document has not been modified since rejection. " +
                        "Please make the required corrections before resubmitting. " +
                        "Rejection reason: " + (instance.getRejectionComments() != null ? instance.getRejectionComments() : "No reason provided"));
            }
            resetApprovals(instance);
        }

        // Execute transition
        String fromState = currentState.name();
        instance.setCurrentState(targetState);
        instance.setUpdatedAt(LocalDateTime.now());

        if (targetState == WorkflowStatus.APPROVED || targetState == WorkflowStatus.ARCHIVED
                || targetState == WorkflowStatus.CANCELLED) {
            instance.setCompletedAt(LocalDateTime.now());
        }

        // Update SLA deadline for the new state
        updateSlaDeadline(instance, targetState.name());

        instanceRepository.save(instance);
        recordTransition(instance, fromState, targetState.name(), action, userId, request.getComments());

        publishAudit(userId, "WORKFLOW_TRANSITION", "WORKFLOW", instance.getId(),
                Map.of("from", fromState, "to", targetState.name(), "action", action));

        log.info("Workflow {} transitioned: {} -> {} via '{}'", instanceId, fromState, targetState, action);
        return toInstanceDto(instance);
    }

    // ==================== Approval Handling ====================

    @Transactional
    public WorkflowInstanceDto submitApproval(UUID instanceId, ApprovalRequest request, UUID userId) {
        WorkflowInstance instance = instanceRepository.findByIdWithDefinition(instanceId)
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowInstance", "id", instanceId));

        if (instance.getCurrentState() != WorkflowStatus.PENDING_APPROVAL
                && instance.getCurrentState() != WorkflowStatus.REVIEW) {
            throw new BusinessException("Workflow is not in an approval state");
        }

        // Prevent document author/initiator from approving their own workflow
        if (instance.getInitiatedBy() != null && instance.getInitiatedBy().equals(userId)) {
            throw new BusinessException("Document author cannot approve their own document");
        }

        WorkflowApproval approval = approvalRepository
                .findByWorkflowInstanceIdAndApproverId(instanceId, userId)
                .orElseThrow(() -> new BusinessException("You are not an approver for this workflow"));

        if (approval.getDecision() != ApprovalDecision.PENDING) {
            throw new ConflictException("You have already submitted your decision: " + approval.getDecision());
        }

        ApprovalDecision decision;
        try {
            decision = ApprovalDecision.valueOf(request.getDecision().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Invalid decision. Must be: APPROVED, REJECTED, or ABSTAINED");
        }

        approval.setDecision(decision);
        approval.setComments(request.getComments());
        approval.setDecidedAt(LocalDateTime.now());
        approvalRepository.save(approval);

        publishAudit(userId, "APPROVAL_SUBMITTED", "WORKFLOW", instanceId,
                Map.of("decision", decision.name()));

        // Check if all approvals are complete
        return evaluateApprovals(instance);
    }

    private WorkflowInstanceDto handleApprovalTransition(WorkflowInstance instance, UUID userId, String comments) {
        // This is triggered when someone with authority directly approves (bypassing individual approval)
        String fromState = instance.getCurrentState().name();
        instance.setCurrentState(WorkflowStatus.APPROVED);
        instance.setCompletedAt(LocalDateTime.now());
        instance.setUpdatedAt(LocalDateTime.now());
        instanceRepository.save(instance);

        recordTransition(instance, fromState, WorkflowStatus.APPROVED.name(), "APPROVE", userId, comments);

        publishAudit(userId, "WORKFLOW_DIRECT_APPROVED", "WORKFLOW", instance.getId(), Map.of());
        return toInstanceDto(instance);
    }

    private WorkflowInstanceDto evaluateApprovals(WorkflowInstance instance) {
        List<WorkflowApproval> allApprovals = approvalRepository.findByWorkflowInstanceId(instance.getId());

        // Separate parallel and sequential approvals
        List<WorkflowApproval> parallelApprovals = allApprovals.stream()
                .filter(a -> Boolean.TRUE.equals(a.getIsParallel()))
                .collect(Collectors.toList());
        List<WorkflowApproval> sequentialApprovals = allApprovals.stream()
                .filter(a -> !Boolean.TRUE.equals(a.getIsParallel()))
                .sorted(Comparator.comparing(WorkflowApproval::getApprovalOrder))
                .collect(Collectors.toList());

        // Check for any rejection → triggers correction loop
        boolean hasRejection = allApprovals.stream()
                .anyMatch(a -> a.getDecision() == ApprovalDecision.REJECTED);
        if (hasRejection) {
            return triggerCorrection(instance, allApprovals);
        }

        // Evaluate parallel group approvals (by groupId)
        boolean parallelGroupsComplete = evaluateParallelGroups(instance, parallelApprovals);

        // Evaluate sequential approvals
        boolean sequentialComplete = sequentialApprovals.stream()
                .allMatch(a -> a.getDecision() == ApprovalDecision.APPROVED
                        || a.getDecision() == ApprovalDecision.ABSTAINED);

        // Check if all non-grouped parallel approvals are done
        boolean ungroupedParallelComplete = parallelApprovals.stream()
                .filter(a -> a.getGroupId() == null)
                .allMatch(a -> a.getDecision() == ApprovalDecision.APPROVED
                        || a.getDecision() == ApprovalDecision.ABSTAINED);

        // Human-in-the-loop check: if workflow was AI-initiated and definition requires human review,
        // ensure at least one approval came from a HUMAN actor (non-AI)
        WorkflowDefinition def = instance.getDefinition();
        boolean humanReviewSatisfied = true;
        if (Boolean.TRUE.equals(def.getHumanReviewRequired())
                && "AI_SERVICE".equals(instance.getActorType())) {
            // At least one approved decision must not be from an AI-initiated workflow
            // We check that at least one approver explicitly approved (human approvers submitting approval)
            long humanApprovals = allApprovals.stream()
                    .filter(a -> a.getDecision() == ApprovalDecision.APPROVED)
                    .count();
            humanReviewSatisfied = humanApprovals > 0;
            if (!humanReviewSatisfied) {
                log.info("Workflow {} requires human review for AI-initiated workflow — waiting for human approval",
                        instance.getId());
            }
        }

        if (parallelGroupsComplete && sequentialComplete && ungroupedParallelComplete && humanReviewSatisfied) {
            // All approvals satisfied → transition to APPROVED
            String fromState = instance.getCurrentState().name();
            instance.setCurrentState(WorkflowStatus.APPROVED);
            instance.setCompletedAt(LocalDateTime.now());
            instance.setUpdatedAt(LocalDateTime.now());
            instanceRepository.save(instance);

            recordTransition(instance, fromState, WorkflowStatus.APPROVED.name(),
                    "APPROVE", instance.getInitiatedBy(), "All approvals completed");

            publishAudit(instance.getInitiatedBy(), "WORKFLOW_FULLY_APPROVED", "WORKFLOW", instance.getId(), Map.of());
            log.info("Workflow {} fully approved", instance.getId());
        }

        return toInstanceDto(instance);
    }

    private boolean evaluateParallelGroups(WorkflowInstance instance, List<WorkflowApproval> parallelApprovals) {
        // Group approvals by groupId
        Map<UUID, List<WorkflowApproval>> groupedApprovals = parallelApprovals.stream()
                .filter(a -> a.getGroupId() != null)
                .collect(Collectors.groupingBy(WorkflowApproval::getGroupId));

        for (Map.Entry<UUID, List<WorkflowApproval>> entry : groupedApprovals.entrySet()) {
            UUID groupId = entry.getKey();
            List<WorkflowApproval> groupApprovals = entry.getValue();

            ApprovalGroup group = approvalGroupRepository.findById(groupId).orElse(null);
            int requiredApprovals = group != null ? group.getRequiredApprovals() : groupApprovals.size();

            long approvedCount = groupApprovals.stream()
                    .filter(a -> a.getDecision() == ApprovalDecision.APPROVED)
                    .count();

            if (approvedCount < requiredApprovals) {
                return false; // This group isn't satisfied yet
            }
        }
        return true;
    }

    private WorkflowInstanceDto triggerCorrection(WorkflowInstance instance, List<WorkflowApproval> allApprovals) {
        String fromState = instance.getCurrentState().name();
        instance.setCurrentState(WorkflowStatus.CORRECTION);
        instance.setCorrectionCount(instance.getCorrectionCount() + 1);
        instance.setUpdatedAt(LocalDateTime.now());
        instanceRepository.save(instance);

        // Gather rejection comments
        String rejectionComments = allApprovals.stream()
                .filter(a -> a.getDecision() == ApprovalDecision.REJECTED)
                .map(a -> a.getComments() != null ? a.getComments() : "No comment")
                .collect(Collectors.joining("; "));

        recordTransition(instance, fromState, WorkflowStatus.CORRECTION.name(),
                "REJECT", instance.getInitiatedBy(), "Rejected: " + rejectionComments);

        publishAudit(instance.getInitiatedBy(), "WORKFLOW_CORRECTION_REQUIRED", "WORKFLOW", instance.getId(),
                Map.of("correctionCount", instance.getCorrectionCount().toString()));

        log.info("Workflow {} sent to correction (count: {})", instance.getId(), instance.getCorrectionCount());
        return toInstanceDto(instance);
    }

    private void resetApprovals(WorkflowInstance instance) {
        List<WorkflowApproval> approvals = approvalRepository.findByWorkflowInstanceId(instance.getId());
        for (WorkflowApproval approval : approvals) {
            approval.setDecision(ApprovalDecision.PENDING);
            approval.setComments(null);
            approval.setDecidedAt(null);
        }
        approvalRepository.saveAll(approvals);
    }

    // ==================== Queries ====================

    public WorkflowInstanceDto getInstance(UUID instanceId) {
        WorkflowInstance instance = instanceRepository.findByIdWithDefinition(instanceId)
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowInstance", "id", instanceId));
        return toInstanceDto(instance);
    }

    public Page<WorkflowInstanceDto> getMyWorkflows(UUID userId, Pageable pageable) {
        return instanceRepository.findByInitiatedBy(userId, pageable).map(this::toInstanceDto);
    }

    public Page<WorkflowInstanceDto> getPendingApprovals(UUID userId, Pageable pageable) {
        return instanceRepository.findPendingApprovalsByApprover(userId, pageable).map(this::toInstanceDto);
    }

    public long countPendingApprovals(UUID userId) {
        return instanceRepository.countPendingApprovalsByApprover(userId);
    }

    public Page<WorkflowInstanceDto> getByStatus(WorkflowStatus status, Pageable pageable) {
        return instanceRepository.findByCurrentState(status, pageable).map(this::toInstanceDto);
    }

    public List<WorkflowInstanceDto> getByDocument(UUID documentId) {
        return instanceRepository.findByDocumentId(documentId).stream()
                .map(this::toInstanceDto)
                .collect(Collectors.toList());
    }

    public List<WorkflowInstanceDto.TransitionDto> getTransitionHistory(UUID instanceId) {
        return transitionRepository.findByWorkflowInstanceIdOrderByCreatedAtDesc(instanceId).stream()
                .map(this::toTransitionDto)
                .collect(Collectors.toList());
    }

    // ==================== Cancel Workflow ====================

    @Transactional
    public WorkflowInstanceDto cancelWorkflow(UUID instanceId, String comments, UUID userId) {
        WorkflowInstance instance = instanceRepository.findByIdWithDefinition(instanceId)
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowInstance", "id", instanceId));

        if (instance.getCurrentState() == WorkflowStatus.ARCHIVED
                || instance.getCurrentState() == WorkflowStatus.CANCELLED) {
            throw new BusinessException("Cannot cancel a workflow that is already " + instance.getCurrentState());
        }

        String fromState = instance.getCurrentState().name();
        instance.setCurrentState(WorkflowStatus.CANCELLED);
        instance.setCompletedAt(LocalDateTime.now());
        instance.setUpdatedAt(LocalDateTime.now());
        instanceRepository.save(instance);

        recordTransition(instance, fromState, WorkflowStatus.CANCELLED.name(), "cancel", userId, comments);

        publishAudit(userId, "WORKFLOW_CANCELLED", "WORKFLOW", instance.getId(), Map.of());
        log.info("Workflow {} cancelled by user {}", instanceId, userId);
        return toInstanceDto(instance);
    }

    // ==================== Helpers ====================

    /**
     * Resolves the target state for a given action. Uses definition-driven transitions first,
     * falls back to the hardcoded STATE_MACHINE for backward compatibility.
     */
    private WorkflowStatus resolveTransition(WorkflowDefinition definition, WorkflowStatus currentState, String action) {
        // 1. Try definition-driven transitions first
        if (definition != null && definition.getTransitions() != null && !definition.getTransitions().isEmpty()) {
            String currentStateName = currentState.name();
            for (Map<String, Object> t : definition.getTransitions()) {
                String from = String.valueOf(t.get("from"));
                String transAction = String.valueOf(t.get("action"));
                String to = String.valueOf(t.get("to"));
                if (currentStateName.equalsIgnoreCase(from) && transAction.equalsIgnoreCase(action)) {
                    try {
                        return WorkflowStatus.valueOf(to.toUpperCase());
                    } catch (IllegalArgumentException e) {
                        throw new BusinessException("Unknown target state in definition: " + to);
                    }
                }
            }
            // Also allow cancel from any non-terminal state (universal action)
            if ("cancel".equalsIgnoreCase(action)) {
                return WorkflowStatus.CANCELLED;
            }
            throw new BusinessException(
                    String.format("Action '%s' not allowed in state '%s' per workflow definition '%s'",
                            action, currentState, definition.getName()));
        }

        // 2. Fallback to hardcoded state machine
        Map<String, WorkflowStatus> allowed = STATE_MACHINE.get(currentState);
        if (allowed == null || !allowed.containsKey(action)) {
            throw new BusinessException(
                    String.format("Invalid action '%s' for state '%s'. Allowed: %s",
                            action, currentState,
                            allowed != null ? allowed.keySet() : "none"));
        }
        return allowed.get(action);
    }

    private void updateSlaDeadline(WorkflowInstance instance, String stateName) {
        WorkflowDefinition def = instance.getDefinition();
        if (def != null && def.getEscalationRules() != null) {
            for (Map<String, Object> rule : def.getEscalationRules()) {
                if (stateName.equalsIgnoreCase(String.valueOf(rule.get("state")))) {
                    int slaHours = rule.containsKey("slaHours") ? ((Number) rule.get("slaHours")).intValue() : 24;
                    instance.setSlaDeadline(LocalDateTime.now().plusHours(slaHours));
                    instance.setEscalationLevel(0);
                    return;
                }
            }
        }
        instance.setSlaDeadline(null);
        instance.setEscalationLevel(0);
    }

    // ==================== Escalation ====================

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void checkEscalations() {
        List<WorkflowInstance> overdueInstances = instanceRepository.findOverdueInstances(LocalDateTime.now());
        for (WorkflowInstance instance : overdueInstances) {
            escalateInstance(instance);
        }
        if (!overdueInstances.isEmpty()) {
            log.info("Escalation check: processed {} overdue instances", overdueInstances.size());
        }
    }

    private void escalateInstance(WorkflowInstance instance) {
        WorkflowDefinition def = instance.getDefinition();
        if (def == null || def.getEscalationRules() == null) return;

        String currentState = instance.getCurrentState().name();
        for (Map<String, Object> rule : def.getEscalationRules()) {
            String ruleState = String.valueOf(rule.get("state"));
            if (!ruleState.equalsIgnoreCase(currentState)) continue;

            int maxLevel = rule.containsKey("maxLevel") ? ((Number) rule.get("maxLevel")).intValue() : 3;
            if (instance.getEscalationLevel() >= maxLevel) continue;

            instance.setEscalationLevel(instance.getEscalationLevel() + 1);
            instance.setEscalatedAt(LocalDateTime.now());
            instance.setPriority(Math.min(instance.getPriority() + 1, 5));

            int slaHours = rule.containsKey("slaHours") ? ((Number) rule.get("slaHours")).intValue() : 24;
            instance.setSlaDeadline(LocalDateTime.now().plusHours(slaHours));
            instance.setUpdatedAt(LocalDateTime.now());
            instanceRepository.save(instance);

            recordTransition(instance, currentState, currentState, "ESCALATE", instance.getInitiatedBy(),
                    "Auto-escalated to level " + instance.getEscalationLevel());

            publishAudit(instance.getInitiatedBy(), "WORKFLOW_ESCALATED", "WORKFLOW", instance.getId(),
                    Map.of("level", instance.getEscalationLevel().toString(), "state", currentState));

            log.warn("Workflow {} escalated to level {} (state: {})", instance.getId(),
                    instance.getEscalationLevel(), currentState);
            break;
        }
    }

    public List<WorkflowInstanceDto> getOverdueInstances() {
        return instanceRepository.findOverdueInstances(LocalDateTime.now()).stream()
                .map(this::toInstanceDto)
                .collect(Collectors.toList());
    }

    private void recordTransition(WorkflowInstance instance, String fromState, String toState,
                                  String action, UUID performedBy, String comments) {
        WorkflowTransition transition = WorkflowTransition.builder()
                .workflowInstance(instance)
                .fromState(fromState)
                .toState(toState)
                .action(action)
                .performedBy(performedBy)
                .comments(comments)
                .build();
        transitionRepository.save(transition);
    }

    private void publishAudit(UUID userId, String action, String resourceType, UUID resourceId, Map<String, ?> details) {
        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .details(details != null ? new HashMap<>(details) : Map.of())
                .build());
    }

    // ==================== Mappers ====================

    private WorkflowDefinitionDto toDefinitionDto(WorkflowDefinition def) {
        return WorkflowDefinitionDto.builder()
                .id(def.getId())
                .name(def.getName())
                .description(def.getDescription())
                .states(def.getStates())
                .transitions(def.getTransitions())
                .initialState(def.getInitialState())
                .requiredRoles(def.getRequiredRoles())
                .humanReviewRequired(def.getHumanReviewRequired())
                .escalationRules(def.getEscalationRules())
                .isActive(def.getIsActive())
                .createdBy(def.getCreatedBy())
                .createdAt(def.getCreatedAt())
                .build();
    }

    private WorkflowInstanceDto toInstanceDto(WorkflowInstance instance) {
        List<WorkflowInstanceDto.TransitionDto> transitionDtos = new ArrayList<>();
        if (instance.getTransitions() != null) {
            transitionDtos = instance.getTransitions().stream()
                    .map(this::toTransitionDto)
                    .collect(Collectors.toList());
        }

        List<WorkflowInstanceDto.ApprovalDto> approvalDtos = new ArrayList<>();
        if (instance.getApprovals() != null) {
            approvalDtos = instance.getApprovals().stream()
                    .map(a -> WorkflowInstanceDto.ApprovalDto.builder()
                            .id(a.getId())
                            .approverId(a.getApproverId())
                            .approvalOrder(a.getApprovalOrder())
                            .isParallel(a.getIsParallel())
                            .groupId(a.getGroupId())
                            .decision(a.getDecision().name())
                            .comments(a.getComments())
                            .decidedAt(a.getDecidedAt())
                            .createdAt(a.getCreatedAt())
                            .build())
                    .collect(Collectors.toList());
        }

        return WorkflowInstanceDto.builder()
                .id(instance.getId())
                .documentId(instance.getDocumentId())
                .definitionName(instance.getDefinition() != null ? instance.getDefinition().getName() : null)
                .definitionId(instance.getDefinition() != null ? instance.getDefinition().getId() : null)
                .currentState(instance.getCurrentState().name())
                .initiatedBy(instance.getInitiatedBy())
                .assignedTo(instance.getAssignedTo())
                .priority(instance.getPriority())
                .dueDate(instance.getDueDate())
                .completedAt(instance.getCompletedAt())
                .correctionCount(instance.getCorrectionCount())
                .rejectedDocumentHash(instance.getRejectedDocumentHash())
                .rejectionComments(instance.getRejectionComments())
                .actorType(instance.getActorType())
                .projectId(instance.getProjectId())
                .escalationLevel(instance.getEscalationLevel())
                .escalatedAt(instance.getEscalatedAt())
                .slaDeadline(instance.getSlaDeadline())
                .requiredRoles(instance.getDefinition() != null ? instance.getDefinition().getRequiredRoles() : null)
                .humanReviewRequired(instance.getDefinition() != null ? instance.getDefinition().getHumanReviewRequired() : null)
                .transitions(transitionDtos)
                .approvals(approvalDtos)
                .createdAt(instance.getCreatedAt())
                .updatedAt(instance.getUpdatedAt())
                .build();
    }

    private WorkflowInstanceDto.TransitionDto toTransitionDto(WorkflowTransition t) {
        return WorkflowInstanceDto.TransitionDto.builder()
                .id(t.getId())
                .fromState(t.getFromState())
                .toState(t.getToState())
                .action(t.getAction())
                .performedBy(t.getPerformedBy())
                .comments(t.getComments())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
