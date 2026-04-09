package com.apexnexus.retention.repository;

import com.apexnexus.retention.model.DispositionItem;
import com.apexnexus.retention.model.DispositionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DispositionItemRepository extends JpaRepository<DispositionItem, UUID> {
    Page<DispositionItem> findByStatus(DispositionStatus status, Pageable pageable);

    Optional<DispositionItem> findByDocumentIdAndStatus(UUID documentId, DispositionStatus status);

    List<DispositionItem> findByDocumentId(UUID documentId);

    @Query("SELECT d FROM DispositionItem d WHERE d.status = :status AND d.scheduledDestructionDate <= :date")
    List<DispositionItem> findReadyForDestruction(@Param("status") DispositionStatus status,
                                                   @Param("date") LocalDateTime date);

    long countByStatus(DispositionStatus status);
}
