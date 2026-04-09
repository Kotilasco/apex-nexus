package com.apexnexus.auth.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "policy_audit_log")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PolicyAuditEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "policy_id", nullable = false)
    private UUID policyId;

    @Column(name = "changed_by", nullable = false)
    private UUID changedBy;

    @Column(name = "change_type", nullable = false, length = 20)
    private String changeType;  // CREATED, UPDATED, DISABLED, ENABLED, DELETED

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "old_settings", columnDefinition = "jsonb")
    private Map<String, Object> oldSettings;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_settings", columnDefinition = "jsonb")
    private Map<String, Object> newSettings;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @CreationTimestamp
    @Column(name = "created_at")
    private Instant createdAt;
}
