package com.apexnexus.retention.repository;

import com.apexnexus.retention.model.RetentionPolicy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RetentionPolicyRepository extends JpaRepository<RetentionPolicy, UUID> {
    Optional<RetentionPolicy> findByName(String name);
    List<RetentionPolicy> findByIsActiveTrue();
}
