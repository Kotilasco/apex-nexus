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
@Table(name = "ai_governance_policies",
       uniqueConstraints = @UniqueConstraint(columnNames = {"scope", "scope_id", "policy_type"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class AiGovernancePolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "policy_scope")
    private PolicyScope scope;

    @Column(name = "scope_id")
    private UUID scopeId;

    @Column(name = "policy_type", nullable = false, length = 100)
    private String policyType;

    @Column(name = "is_enabled")
    @Builder.Default
    private Boolean isEnabled = true;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> settings = Map.of();

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public enum PolicyScope {
        GLOBAL, PROJECT, USER
    }
}
