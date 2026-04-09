package com.apexnexus.document.repository;

import com.apexnexus.document.model.DocumentSignature;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SignatureRepository extends JpaRepository<DocumentSignature, UUID> {

    List<DocumentSignature> findByDocumentIdOrderByCreatedAtDesc(UUID documentId);

    List<DocumentSignature> findBySignerIdAndStatusOrderByCreatedAtDesc(
            UUID signerId, DocumentSignature.SignatureStatus status);

    long countByDocumentIdAndStatus(UUID documentId, DocumentSignature.SignatureStatus status);

    boolean existsByDocumentIdAndSignerIdAndStatus(
            UUID documentId, UUID signerId, DocumentSignature.SignatureStatus status);
}
