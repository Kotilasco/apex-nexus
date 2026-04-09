package com.apexnexus.auth.repository;

import com.apexnexus.auth.model.ShareLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShareLinkRepository extends JpaRepository<ShareLink, UUID> {

    Optional<ShareLink> findByTokenAndIsActiveTrue(String token);

    List<ShareLink> findByDocumentIdAndIsActiveTrueOrderByCreatedAtDesc(UUID documentId);

    List<ShareLink> findByCreatedByAndIsActiveTrueOrderByCreatedAtDesc(UUID userId);

    long countByDocumentIdAndIsActiveTrue(UUID documentId);

    void deleteByExpiresAtBefore(Instant cutoff);
}
