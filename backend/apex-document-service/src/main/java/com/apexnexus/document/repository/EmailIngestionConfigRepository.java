package com.apexnexus.document.repository;

import com.apexnexus.document.model.EmailIngestionConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface EmailIngestionConfigRepository extends JpaRepository<EmailIngestionConfig, UUID> {
    List<EmailIngestionConfig> findByEnabledTrue();
}
