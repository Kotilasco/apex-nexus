package com.apexnexus.audit.repository;

import com.apexnexus.audit.model.AuditLogEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLogEntry, UUID> {

    Page<AuditLogEntry> findByUserId(UUID userId, Pageable pageable);

    Page<AuditLogEntry> findByAction(String action, Pageable pageable);

    Page<AuditLogEntry> findByResourceTypeAndResourceId(String resourceType, UUID resourceId, Pageable pageable);

    Page<AuditLogEntry> findByResourceType(String resourceType, Pageable pageable);

    @Query("SELECT a FROM AuditLogEntry a WHERE a.createdAt BETWEEN :from AND :to")
    Page<AuditLogEntry> findByDateRange(@Param("from") LocalDateTime from,
                                         @Param("to") LocalDateTime to,
                                         Pageable pageable);

    @Query("SELECT a FROM AuditLogEntry a WHERE a.userId = :userId AND a.createdAt BETWEEN :from AND :to")
    Page<AuditLogEntry> findByUserIdAndDateRange(@Param("userId") UUID userId,
                                                  @Param("from") LocalDateTime from,
                                                  @Param("to") LocalDateTime to,
                                                  Pageable pageable);

    @Query("SELECT a.action, COUNT(a) FROM AuditLogEntry a WHERE a.createdAt >= :since GROUP BY a.action ORDER BY COUNT(a) DESC")
    List<Object[]> getActionCounts(@Param("since") LocalDateTime since);

    @Query("SELECT a.userId, COUNT(a) FROM AuditLogEntry a WHERE a.createdAt >= :since GROUP BY a.userId ORDER BY COUNT(a) DESC")
    List<Object[]> getMostActiveUsers(@Param("since") LocalDateTime since);

    Page<AuditLogEntry> findByActorType(String actorType, Pageable pageable);

    Page<AuditLogEntry> findByProjectId(UUID projectId, Pageable pageable);

    @Query("SELECT a.actorType, COUNT(a) FROM AuditLogEntry a WHERE a.createdAt >= :since GROUP BY a.actorType")
    List<Object[]> getActorTypeCounts(@Param("since") LocalDateTime since);

    @Query("SELECT MAX(a.sequenceNumber) FROM AuditLogEntry a")
    Long findMaxSequenceNumber();

    @Query("SELECT a.entryHash FROM AuditLogEntry a WHERE a.sequenceNumber = (SELECT MAX(a2.sequenceNumber) FROM AuditLogEntry a2)")
    String findLastEntryHash();

    @Query("SELECT a FROM AuditLogEntry a WHERE a.sequenceNumber IS NOT NULL ORDER BY a.sequenceNumber ASC")
    List<AuditLogEntry> findAllChainedEntries();
}
