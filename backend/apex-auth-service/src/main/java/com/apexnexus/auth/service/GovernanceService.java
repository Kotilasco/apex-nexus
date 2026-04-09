package com.apexnexus.auth.service;

import com.apexnexus.auth.dto.*;
import com.apexnexus.auth.model.AiGovernancePolicy;
import com.apexnexus.auth.model.AiGovernancePolicy.PolicyScope;
import com.apexnexus.auth.model.PolicyAuditEntry;
import com.apexnexus.auth.model.Project;
import com.apexnexus.auth.model.User;
import com.apexnexus.auth.repository.*;
import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.exception.BusinessException;
import com.apexnexus.common.exception.ConflictException;
import com.apexnexus.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Hierarchical AI governance policy engine.
 * Resolution order: GLOBAL → PROJECT → USER (most specific wins).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GovernanceService {

    private final AiGovernancePolicyRepository policyRepository;
    private final PolicyAuditRepository policyAuditRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final AuditPublisher auditPublisher;

    // ====================== Effective Policy Resolution ======================

    /**
     * Resolves the effective policy for a given policy type.
     * Checks USER → PROJECT → GLOBAL (most specific enabled policy wins).
     */
    @Transactional(readOnly = true)
    public GovernancePolicyDto resolveEffectivePolicy(String policyType, UUID projectId, UUID userId) {
        // 1. User-level override
        if (userId != null) {
            Optional<AiGovernancePolicy> userPolicy =
                    policyRepository.findByScopeAndScopeIdAndPolicyType(PolicyScope.USER, userId, policyType);
            if (userPolicy.isPresent()) return toDto(userPolicy.get());
        }

        // 2. Project-level override
        if (projectId != null) {
            Optional<AiGovernancePolicy> projectPolicy =
                    policyRepository.findByScopeAndScopeIdAndPolicyType(PolicyScope.PROJECT, projectId, policyType);
            if (projectPolicy.isPresent()) return toDto(projectPolicy.get());
        }

        // 3. Global default
        Optional<AiGovernancePolicy> globalPolicy = policyRepository.findGlobalPolicy(policyType);
        if (globalPolicy.isPresent()) return toDto(globalPolicy.get());

        // No policy found — feature disabled by default
        return GovernancePolicyDto.builder()
                .policyType(policyType)
                .isEnabled(false)
                .settings(Map.of())
                .scope("NONE")
                .build();
    }

    /**
     * Returns all effective policies for a project+user context (the Trust Center view).
     */
    @Transactional(readOnly = true)
    public List<GovernancePolicyDto> getEffectivePolicies(UUID projectId, UUID userId) {
        List<AiGovernancePolicy> all = policyRepository.findEffectivePolicies(projectId, userId);

        // Group by policyType, most-specific scope wins
        Map<String, AiGovernancePolicy> effective = new LinkedHashMap<>();
        for (AiGovernancePolicy p : all) {
            String type = p.getPolicyType();
            AiGovernancePolicy existing = effective.get(type);
            if (existing == null || scopePriority(p.getScope()) > scopePriority(existing.getScope())) {
                effective.put(type, p);
            }
        }

        return effective.values().stream().map(this::toDto).collect(Collectors.toList());
    }

    private int scopePriority(PolicyScope scope) {
        return switch (scope) {
            case GLOBAL -> 0;
            case PROJECT -> 1;
            case USER -> 2;
        };
    }

    // ====================== CRUD ======================

    @Transactional
    public GovernancePolicyDto createPolicy(CreatePolicyRequest request, UUID userId) {
        PolicyScope scope = PolicyScope.valueOf(request.getScope().toUpperCase());

        if (scope != PolicyScope.GLOBAL && request.getScopeId() == null) {
            throw new BusinessException("scopeId is required for " + scope + " scope");
        }

        UUID scopeId = scope == PolicyScope.GLOBAL ? null : request.getScopeId();

        // Check for duplicate
        Optional<AiGovernancePolicy> existing =
                policyRepository.findByScopeAndScopeIdAndPolicyType(scope, scopeId, request.getPolicyType());
        if (existing.isPresent()) {
            throw new ConflictException("Policy already exists for this scope and type");
        }

        AiGovernancePolicy policy = AiGovernancePolicy.builder()
                .scope(scope)
                .scopeId(scopeId)
                .policyType(request.getPolicyType())
                .isEnabled(request.getIsEnabled())
                .settings(request.getSettings() != null ? request.getSettings() : Map.of())
                .createdBy(userId)
                .build();

        policy = policyRepository.save(policy);

        // Record in policy audit log
        recordPolicyAudit(policy.getId(), userId, "CREATED", null, policy.getSettings(), request.getReason());

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("GOVERNANCE_POLICY_CREATED")
                .resourceType("GOVERNANCE")
                .resourceId(policy.getId())
                .resourceName(policy.getPolicyType())
                .details(Map.of("scope", scope.name(), "policyType", request.getPolicyType()))
                .build());

        log.info("Governance policy created: {} scope={} by user {}", request.getPolicyType(), scope, userId);
        return toDto(policy);
    }

    @Transactional
    public GovernancePolicyDto updatePolicy(UUID policyId, UpdatePolicyRequest request, UUID userId) {
        AiGovernancePolicy policy = policyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("AiGovernancePolicy", "id", policyId));

        Map<String, Object> oldSettings = policy.getSettings() != null ? new HashMap<>(policy.getSettings()) : null;
        String changeType = "UPDATED";

        if (request.getSettings() != null) {
            policy.setSettings(request.getSettings());
        }
        if (request.getIsEnabled() != null) {
            if (!request.getIsEnabled().equals(policy.getIsEnabled())) {
                changeType = request.getIsEnabled() ? "ENABLED" : "DISABLED";
            }
            policy.setIsEnabled(request.getIsEnabled());
        }

        policy = policyRepository.save(policy);

        recordPolicyAudit(policyId, userId, changeType, oldSettings, policy.getSettings(), request.getReason());

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("GOVERNANCE_POLICY_" + changeType)
                .resourceType("GOVERNANCE")
                .resourceId(policyId)
                .resourceName(policy.getPolicyType())
                .build());

        return toDto(policy);
    }

    @Transactional(readOnly = true)
    public List<GovernancePolicyDto> getGlobalPolicies() {
        return policyRepository.findByScopeAndScopeIdIsNull(PolicyScope.GLOBAL).stream()
                .map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GovernancePolicyDto> getProjectPolicies(UUID projectId) {
        return policyRepository.findByScopeAndScopeId(PolicyScope.PROJECT, projectId).stream()
                .map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public GovernancePolicyDto getPolicy(UUID policyId) {
        AiGovernancePolicy policy = policyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("AiGovernancePolicy", "id", policyId));
        return toDto(policy);
    }

    @Transactional(readOnly = true)
    public Page<PolicyAuditDto> getPolicyAuditTrail(UUID policyId, Pageable pageable) {
        return policyAuditRepository.findByPolicyIdOrderByCreatedAtDesc(policyId, pageable)
                .map(this::toAuditDto);
    }

    /**
     * Quick boolean check: is a given AI feature allowed for this context?
     */
    @Transactional(readOnly = true)
    public boolean isFeatureAllowed(String policyType, UUID projectId, UUID userId) {
        GovernancePolicyDto effective = resolveEffectivePolicy(policyType, projectId, userId);
        return Boolean.TRUE.equals(effective.getIsEnabled());
    }

    // ====================== Helpers ======================

    private void recordPolicyAudit(UUID policyId, UUID changedBy, String changeType,
                                   Map<String, Object> oldSettings, Map<String, Object> newSettings, String reason) {
        PolicyAuditEntry entry = PolicyAuditEntry.builder()
                .policyId(policyId)
                .changedBy(changedBy)
                .changeType(changeType)
                .oldSettings(oldSettings)
                .newSettings(newSettings)
                .reason(reason)
                .build();
        policyAuditRepository.save(entry);
    }

    private GovernancePolicyDto toDto(AiGovernancePolicy policy) {
        String scopeName = resolveScopeName(policy.getScope(), policy.getScopeId());
        String createdByName = userRepository.findById(policy.getCreatedBy())
                .map(u -> u.getFirstName() + " " + u.getLastName()).orElse("System");

        return GovernancePolicyDto.builder()
                .id(policy.getId())
                .scope(policy.getScope().name())
                .scopeId(policy.getScopeId())
                .scopeName(scopeName)
                .policyType(policy.getPolicyType())
                .isEnabled(policy.getIsEnabled())
                .settings(policy.getSettings())
                .createdBy(policy.getCreatedBy())
                .createdByName(createdByName)
                .createdAt(policy.getCreatedAt())
                .updatedAt(policy.getUpdatedAt())
                .build();
    }

    private String resolveScopeName(PolicyScope scope, UUID scopeId) {
        return switch (scope) {
            case GLOBAL -> "Global";
            case PROJECT -> projectRepository.findById(scopeId)
                    .map(Project::getName).orElse("Unknown Project");
            case USER -> userRepository.findById(scopeId)
                    .map(u -> u.getFirstName() + " " + u.getLastName()).orElse("Unknown User");
        };
    }

    private PolicyAuditDto toAuditDto(PolicyAuditEntry entry) {
        String changedByName = userRepository.findById(entry.getChangedBy())
                .map(u -> u.getFirstName() + " " + u.getLastName()).orElse("System");

        return PolicyAuditDto.builder()
                .id(entry.getId())
                .policyId(entry.getPolicyId())
                .changedBy(entry.getChangedBy())
                .changedByName(changedByName)
                .changeType(entry.getChangeType())
                .oldSettings(entry.getOldSettings())
                .newSettings(entry.getNewSettings())
                .reason(entry.getReason())
                .createdAt(entry.getCreatedAt())
                .build();
    }
}
