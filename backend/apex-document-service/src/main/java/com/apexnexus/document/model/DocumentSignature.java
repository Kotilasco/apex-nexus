package com.apexnexus.document.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "document_signatures")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentSignature {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "version_number", nullable = false)
    @Builder.Default
    private Integer versionNumber = 1;

    @Column(name = "version_id")
    private UUID versionId;

    @Column(name = "signer_id", nullable = false)
    private UUID signerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private SignatureStatus status = SignatureStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private SignatureProvider provider = SignatureProvider.INTERNAL;

    @Column(name = "certificate_data")
    private String certificateData;

    @Column(name = "signed_hash")
    private String signedHash;

    @Column(name = "signed_at")
    private LocalDateTime signedAt;

    @Column(name = "external_reference")
    private String externalReference;

    @Column(columnDefinition = "jsonb")
    private String metadata;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public enum SignatureStatus {
        PENDING, SIGNED, DECLINED, EXPIRED, REVOKED
    }

    public enum SignatureProvider {
        INTERNAL, DOCUSIGN, ADOBE_SIGN, QUALIFIED_EU
    }
}
