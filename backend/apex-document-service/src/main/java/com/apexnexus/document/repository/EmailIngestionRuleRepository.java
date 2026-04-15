package com.apexnexus.document.repository;

import com.apexnexus.document.model.EmailIngestionRule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface EmailIngestionRuleRepository extends JpaRepository<EmailIngestionRule, UUID> {
    List<EmailIngestionRule> findByConfigIdAndEnabledTrue(UUID configId);
}
