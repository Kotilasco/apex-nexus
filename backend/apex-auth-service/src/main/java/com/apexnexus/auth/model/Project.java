package com.apexnexus.auth.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "projects")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata_schema", columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> metadataSchema = Map.of();

    @Column(name = "ai_enabled")
    @Builder.Default
    private Boolean aiEnabled = true;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "default_workflow_definition_id")
    private UUID defaultWorkflowDefinitionId;

    @Column(name = "default_retention_period_years")
    private Integer defaultRetentionPeriodYears;

    @Column(name = "retention_document_types", columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] retentionDocumentTypes;

    @Column(name = "jurisdiction_code", length = 10)
    private String jurisdictionCode;

    @Column(name = "privacy_redaction_enabled")
    @Builder.Default
    private Boolean privacyRedactionEnabled = false;

    @Column(name = "compliance_category", length = 100)
    private String complianceCategory;

    @CreationTimestamp
    @Column(name = "created_at")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
