package com.apexnexus.retention.repository;

import com.apexnexus.retention.model.LegalFramework;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LegalFrameworkRepository extends JpaRepository<LegalFramework, UUID> {
    List<LegalFramework> findByJurisdictionIdAndIsActiveTrueOrderByCodeAsc(UUID jurisdictionId);
    List<LegalFramework> findByIsActiveTrueOrderByCodeAsc();
}
