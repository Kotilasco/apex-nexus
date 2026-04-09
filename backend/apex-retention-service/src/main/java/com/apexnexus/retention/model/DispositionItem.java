package com.apexnexus.retention.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "disposition_queue")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DispositionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "document_title")
    private String documentTitle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "policy_id")
    private RetentionPolicy policy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private DispositionStatus status = DispositionStatus.PENDING;

    @Column(name = "retention_expires_at")
    private LocalDateTime retentionExpiresAt;

    @Column(name = "scheduled_destruction_date")
    private LocalDateTime scheduledDestructionDate;

    @Column(name = "approved_by")
    private UUID approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "destroyed_at")
    private LocalDateTime destroyedAt;

    @Column(columnDefinition = "text")
    private String reason;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
