package com.apexnexus.document.service;

import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.exception.BusinessException;
import com.apexnexus.document.model.DocumentSignature;
import com.apexnexus.document.model.DocumentSignature.SignatureProvider;
import com.apexnexus.document.model.DocumentSignature.SignatureStatus;
import com.apexnexus.document.repository.SignatureRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Signature service — manages document signing lifecycle.
 * Currently supports internal (hash-based) signing.
 * Designed for integration with external providers (DocuSign, Adobe Sign, qualified EU).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SignatureService {

    private final SignatureRepository signatureRepository;
    private final AuditPublisher auditPublisher;
    private final JdbcTemplate jdbcTemplate;

    /**
     * Request a signature on a document from a specific signer.
     */
    @Transactional
    public DocumentSignature requestSignature(UUID documentId, UUID signerId, UUID requesterId,
                                              SignatureProvider provider) {
        // If DocuSign provider requested, verify the plugin is active
        if (provider == SignatureProvider.DOCUSIGN) {
            if (!isDocuSignPluginActive()) {
                throw new BusinessException("DocuSign Integration plugin is not active — enable it in the marketplace first");
            }
        }

        // Check if already has a pending signature from this signer
        if (signatureRepository.existsByDocumentIdAndSignerIdAndStatus(
                documentId, signerId, SignatureStatus.PENDING)) {
            throw new BusinessException("A pending signature request already exists for this signer");
        }

        DocumentSignature signature = DocumentSignature.builder()
                .documentId(documentId)
                .signerId(signerId)
                .provider(provider)
                .status(SignatureStatus.PENDING)
                .build();

        signature = signatureRepository.save(signature);

        // For DocuSign provider, generate an envelope ID and store on the document
        if (provider == SignatureProvider.DOCUSIGN) {
            String envelopeId = "DS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            signature.setExternalReference(envelopeId);
            signature = signatureRepository.save(signature);
            try {
                jdbcTemplate.update(
                    "UPDATE documents SET docusign_envelope_id = ? WHERE id = ?::uuid",
                    envelopeId, documentId.toString());
                log.info("DocuSign envelope {} created for document {}", envelopeId, documentId);
            } catch (Exception ex) {
                log.warn("Failed to update docusign_envelope_id for doc {}: {}", documentId, ex.getMessage());
            }
        }

        auditPublisher.publish(AuditEvent.builder()
                .userId(requesterId)
                .action("SIGNATURE_REQUESTED")
                .resourceType("DOCUMENT")
                .resourceId(documentId)
                .details(Map.of("signerId", signerId.toString(), "provider", provider.name()))
                .build());

        log.info("Signature requested for document {} from signer {} via {}", documentId, signerId, provider);
        return signature;
    }

    /**
     * Sign a document (internal provider). Generates SHA-256 hash of the file content.
     */
    @Transactional
    public DocumentSignature signDocument(UUID signatureId, UUID signerId, byte[] fileContent) {
        DocumentSignature signature = signatureRepository.findById(signatureId)
                .orElseThrow(() -> new IllegalArgumentException("Signature request not found"));

        if (!signature.getSignerId().equals(signerId)) {
            throw new SecurityException("Not authorized to sign this document");
        }
        if (signature.getStatus() != SignatureStatus.PENDING) {
            throw new IllegalStateException("Signature is not in pending state");
        }

        // Generate hash of file content
        String hash = computeSha256(fileContent);

        signature.setSignedHash(hash);
        signature.setStatus(SignatureStatus.SIGNED);
        signature.setSignedAt(LocalDateTime.now());

        signature = signatureRepository.save(signature);

        auditPublisher.publish(AuditEvent.builder()
                .userId(signerId)
                .action("DOCUMENT_SIGNED")
                .resourceType("DOCUMENT")
                .resourceId(signature.getDocumentId())
                .details(Map.of("signatureId", signatureId.toString(), "hashAlgorithm", "SHA-256"))
                .build());

        log.info("Document {} signed by user {}", signature.getDocumentId(), signerId);
        return signature;
    }

    /**
     * Decline a signature request.
     */
    @Transactional
    public DocumentSignature declineSignature(UUID signatureId, UUID signerId) {
        DocumentSignature signature = signatureRepository.findById(signatureId)
                .orElseThrow(() -> new IllegalArgumentException("Signature request not found"));

        if (!signature.getSignerId().equals(signerId)) {
            throw new SecurityException("Not authorized to manage this signature");
        }

        signature.setStatus(SignatureStatus.DECLINED);
        signature = signatureRepository.save(signature);

        auditPublisher.publish(AuditEvent.builder()
                .userId(signerId)
                .action("SIGNATURE_DECLINED")
                .resourceType("DOCUMENT")
                .resourceId(signature.getDocumentId())
                .details(Map.of("signatureId", signatureId.toString()))
                .build());

        return signature;
    }

    /**
     * Verify a signature's hash against current file content.
     */
    public boolean verifySignature(UUID signatureId, byte[] currentFileContent) {
        DocumentSignature signature = signatureRepository.findById(signatureId)
                .orElseThrow(() -> new IllegalArgumentException("Signature not found"));

        if (signature.getStatus() != SignatureStatus.SIGNED || signature.getSignedHash() == null) {
            return false;
        }

        String currentHash = computeSha256(currentFileContent);
        return signature.getSignedHash().equals(currentHash);
    }

    public List<DocumentSignature> getDocumentSignatures(UUID documentId) {
        return signatureRepository.findByDocumentIdOrderByCreatedAtDesc(documentId);
    }

    public DocumentSignature getSignature(UUID signatureId) {
        return signatureRepository.findById(signatureId)
                .orElseThrow(() -> new IllegalArgumentException("Signature not found"));
    }

    public List<DocumentSignature> getPendingSignatures(UUID signerId) {
        return signatureRepository.findBySignerIdAndStatusOrderByCreatedAtDesc(
                signerId, SignatureStatus.PENDING);
    }

    private String computeSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("Failed to compute hash", e);
        }
    }

    private boolean isDocuSignPluginActive() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM plugin_registry WHERE name = 'DocuSign Integration' AND status = 'ACTIVE'",
                Integer.class);
            return count != null && count > 0;
        } catch (Exception e) {
            log.warn("Failed to check DocuSign plugin status: {}", e.getMessage());
            return false;
        }
    }
}
