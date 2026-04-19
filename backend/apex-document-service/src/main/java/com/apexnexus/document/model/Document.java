package com.apexnexus.document.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "object_guid", nullable = false, unique = true, length = 64)
    private String objectGuid;

    @Column(name = "folder_id")
    private UUID folderId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "mime_type")
    private String mimeType;

    @Column(name = "file_extension", length = 20)
    private String fileExtension;

    @Column(name = "current_version")
    @Builder.Default
    private Integer currentVersion = 1;

    @Column(name = "sha256_hash", nullable = false, length = 64)
    private String sha256Hash;

    @Column(name = "file_size_bytes", nullable = false)
    private Long fileSizeBytes;

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Column(name = "author_id", nullable = false)
    private UUID authorId;

    @Column(length = 30)
    @Builder.Default
    private String status = "DRAFT";

    @Column(name = "is_checked_out")
    @Builder.Default
    private Boolean isCheckedOut = false;

    @Column(name = "checked_out_by")
    private UUID checkedOutBy;

    @Column(name = "checked_out_at")
    private Instant checkedOutAt;

    @Column(name = "retention_start_date")
    private Instant retentionStartDate;

    @Column(name = "retention_period_years")
    @Builder.Default
    private Integer retentionPeriodYears = 20;

    @Column(name = "retention_period_minutes")
    private Integer retentionPeriodMinutes;

    @Column(name = "retention_expiry")
    private Instant retentionExpiry;

    @Column(name = "legal_hold")
    @Builder.Default
    private Boolean legalHold = false;

    @Column(name = "legal_hold_reason")
    private String legalHoldReason;

    @Column(name = "legal_hold_by")
    private UUID legalHoldBy;

    @Column(name = "legal_hold_at")
    private Instant legalHoldAt;

    @Column(name = "privacy_redaction_enabled")
    @Builder.Default
    private Boolean privacyRedactionEnabled = false;

    @Column(name = "pii_detected")
    @Builder.Default
    private Boolean piiDetected = false;

    @Column(name = "pii_severity", length = 20)
    private String piiSeverity;

    @Column(name = "pii_types", columnDefinition = "TEXT")
    private String piiTypes;

    @Column(name = "pii_scan_date")
    private Instant piiScanDate;

    @Column(name = "extracted_content", columnDefinition = "TEXT")
    private String extractedContent;

    @Column(name = "classification_label", length = 100)
    private String classificationLabel;

    @Column(name = "m365_link", length = 500)
    private String m365Link;

    @Column(name = "docusign_envelope_id", length = 100)
    private String docusignEnvelopeId;

    @Column(name = "sap_document_number", length = 50)
    private String sapDocumentNumber;

    @Column(name = "extracted_entities", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> extractedEntities;

    @Column(name = "ai_generated")
    @Builder.Default
    private Boolean aiGenerated = false;

    @Column(name = "ai_confidence", precision = 5, scale = 4)
    private BigDecimal aiConfidence;

    @Column(name = "parent_document_id")
    private UUID parentDocumentId;

    @Column(name = "email_message_id", length = 500)
    private String emailMessageId;

    @Column(name = "tags", columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] tags;

    @Column(name = "metadata_json", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    private Map<String, Object> metadataJson = new HashMap<>();

    @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<DocumentVersion> versions = new ArrayList<>();

    @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<DocumentNote> notes = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
