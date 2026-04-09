package com.apexnexus.auth.repository;

import com.apexnexus.auth.model.IndustryTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IndustryTemplateRepository extends JpaRepository<IndustryTemplate, UUID> {
    Optional<IndustryTemplate> findByName(String name);
    List<IndustryTemplate> findByIsActiveTrueOrderByDisplayNameAsc();
    List<IndustryTemplate> findByIndustryAndIsActiveTrueOrderByDisplayNameAsc(String industry);
}
