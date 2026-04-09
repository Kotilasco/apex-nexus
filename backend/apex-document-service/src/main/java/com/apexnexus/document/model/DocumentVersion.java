package com.apexnexus.document.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document_versions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class DocumentVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private Document document;

    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @Column(name = "sha256_hash", nullable = false, length = 64)
    private String sha256Hash;

    @Column(name = "file_size_bytes", nullable = false)
    private Long fileSizeBytes;

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Column(name = "author_id", nullable = false)
    private UUID authorId;

    @Column(name = "change_summary", columnDefinition = "TEXT")
    private String changeSummary;

    @Column(name = "version_type", length = 10)
    @Builder.Default
    private String versionType = "MAJOR";

    @Column(name = "version_label", length = 50)
    private String versionLabel;

    @CreationTimestamp
    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "anomaly_flagged")
    @Builder.Default
    private Boolean anomalyFlagged = false;

    @Column(name = "anomaly_score", precision = 5, scale = 4)
    @Builder.Default
    private BigDecimal anomalyScore = BigDecimal.ZERO;

    @Column(name = "similarity_score", precision = 5, scale = 4)
    private BigDecimal similarityScore;

    @Column(name = "anomaly_reasons", columnDefinition = "TEXT")
    private String anomalyReasons;
}
