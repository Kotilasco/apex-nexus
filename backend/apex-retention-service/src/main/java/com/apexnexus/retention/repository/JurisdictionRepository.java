package com.apexnexus.retention.repository;

import com.apexnexus.retention.model.Jurisdiction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface JurisdictionRepository extends JpaRepository<Jurisdiction, UUID> {
    Optional<Jurisdiction> findByCode(String code);
    List<Jurisdiction> findByIsActiveTrueOrderByNameAsc();
    List<Jurisdiction> findByRegionOrderByNameAsc(String region);
}
