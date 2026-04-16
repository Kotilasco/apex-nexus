package com.apexnexus.document.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "email_ingestion_rules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailIngestionRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "config_id", nullable = false)
    @JsonIgnore
    private EmailIngestionConfig config;

    @Column(name = "rule_name", nullable = false)
    private String ruleName;

    @Column(name = "rule_type", nullable = false)
    @Enumerated(EnumType.STRING)
    private RuleType ruleType;

    @Column(name = "rule_value")
    private String ruleValue;

    @Column(name = "target_folder_id")
    private UUID targetFolderId;

    @Column(nullable = false)
    private Boolean enabled;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
        if (enabled == null)
            enabled = true;
    }

    public enum RuleType {
        FROM_CONTAINS,
        FROM_EQUALS,
        SUBJECT_CONTAINS,
        SUBJECT_EQUALS,
        HAS_ATTACHMENT
    }
}
