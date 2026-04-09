package com.apexnexus.retention.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "jurisdiction_retention_rules")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class JurisdictionRetentionRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jurisdiction_id", nullable = false)
    private Jurisdiction jurisdiction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "legal_framework_id")
    private LegalFramework legalFramework;

    @Column(name = "document_category", nullable = false, length = 100)
    private String documentCategory;

    @Column(name = "min_retention_years", nullable = false)
    private Integer minRetentionYears;

    @Column(name = "max_retention_years")
    private Integer maxRetentionYears;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "legal_citation", length = 500)
    private String legalCitation;

    @Column(name = "penalty_info", columnDefinition = "text")
    private String penaltyInfo;

    @Column(name = "is_mandatory")
    @Builder.Default
    private Boolean isMandatory = true;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
