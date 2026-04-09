package com.apexnexus.document.repository;

import com.apexnexus.document.model.DocumentNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DocumentNoteRepository extends JpaRepository<DocumentNote, UUID> {
    List<DocumentNote> findByDocumentIdOrderByIsPinnedDescCreatedAtDesc(UUID documentId);
    List<DocumentNote> findByDocumentIdAndNoteType(UUID documentId, String noteType);
    List<DocumentNote> findByParentNoteId(UUID parentNoteId);
}
