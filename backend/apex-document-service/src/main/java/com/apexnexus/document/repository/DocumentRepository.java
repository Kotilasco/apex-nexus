package com.apexnexus.document.repository;

import com.apexnexus.document.model.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {

    Optional<Document> findByObjectGuid(String objectGuid);

    Page<Document> findByFolderId(UUID folderId, Pageable pageable);

    Page<Document> findByAuthorId(UUID authorId, Pageable pageable);

    Page<Document> findByStatus(String status, Pageable pageable);

    @Query("SELECT d FROM Document d WHERE d.retentionExpiry < :now AND d.legalHold = false AND d.status != 'PENDING_DESTRUCTION' AND d.status != 'DESTROYED'")
    List<Document> findExpiredDocuments(Instant now);

    @Query("SELECT d FROM Document d WHERE d.isCheckedOut = true AND d.checkedOutBy = :userId")
    List<Document> findCheckedOutByUser(UUID userId);

    @Query("SELECT d FROM Document d WHERE d.legalHold = true")
    Page<Document> findDocumentsOnLegalHold(Pageable pageable);

    Page<Document> findByProjectId(UUID projectId, Pageable pageable);

    Page<Document> findByProjectIdAndStatusNotIn(UUID projectId, List<String> statuses, Pageable pageable);

    Page<Document> findByProjectIdAndFolderId(UUID projectId, UUID folderId, Pageable pageable);

    Page<Document> findByProjectIdAndFolderIdAndStatusNotIn(UUID projectId, UUID folderId, List<String> statuses,
            Pageable pageable);

    List<Document> findByParentDocumentId(UUID parentDocumentId);

    Optional<Document> findByEmailMessageId(String emailMessageId);
}
