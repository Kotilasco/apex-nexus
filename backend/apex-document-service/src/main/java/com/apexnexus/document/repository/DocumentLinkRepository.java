package com.apexnexus.document.repository;

import com.apexnexus.document.model.DocumentLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DocumentLinkRepository extends JpaRepository<DocumentLink, UUID> {

    List<DocumentLink> findBySourceDocumentId(UUID sourceDocumentId);

    List<DocumentLink> findByTargetDocumentId(UUID targetDocumentId);

    @Query("SELECT l FROM DocumentLink l WHERE l.sourceDocumentId = :docId OR l.targetDocumentId = :docId")
    List<DocumentLink> findAllByDocument(UUID docId);

    boolean existsBySourceDocumentIdAndTargetDocumentIdAndLinkType(
            UUID sourceDocumentId, UUID targetDocumentId, String linkType);
}
