package com.apexnexus.auth.repository;

import com.apexnexus.auth.model.PolicyAuditEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface PolicyAuditRepository extends JpaRepository<PolicyAuditEntry, UUID> {
    Page<PolicyAuditEntry> findByPolicyIdOrderByCreatedAtDesc(UUID policyId, Pageable pageable);
}
