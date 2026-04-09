package com.apexnexus.auth.repository;

import com.apexnexus.auth.model.AiGovernancePolicy;
import com.apexnexus.auth.model.AiGovernancePolicy.PolicyScope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AiGovernancePolicyRepository extends JpaRepository<AiGovernancePolicy, UUID> {

    List<AiGovernancePolicy> findByScopeAndScopeId(PolicyScope scope, UUID scopeId);

    List<AiGovernancePolicy> findByScopeAndScopeIdIsNull(PolicyScope scope);

    Optional<AiGovernancePolicy> findByScopeAndScopeIdAndPolicyType(PolicyScope scope, UUID scopeId, String policyType);

    @Query("SELECT p FROM AiGovernancePolicy p WHERE p.scope = 'GLOBAL' AND p.scopeId IS NULL AND p.policyType = :policyType")
    Optional<AiGovernancePolicy> findGlobalPolicy(String policyType);

    @Query("SELECT p FROM AiGovernancePolicy p WHERE " +
           "(p.scope = 'GLOBAL' AND p.scopeId IS NULL) OR " +
           "(p.scope = 'PROJECT' AND p.scopeId = :projectId) OR " +
           "(p.scope = 'USER' AND p.scopeId = :userId) " +
           "ORDER BY p.scope")
    List<AiGovernancePolicy> findEffectivePolicies(UUID projectId, UUID userId);

    List<AiGovernancePolicy> findByPolicyType(String policyType);
}
