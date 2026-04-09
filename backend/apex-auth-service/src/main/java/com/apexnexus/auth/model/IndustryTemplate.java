package com.apexnexus.auth.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "industry_templates")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IndustryTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    private String description;
    private String industry;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "included_plugins", columnDefinition = "jsonb")
    private String includedPlugins;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "default_workflows", columnDefinition = "jsonb")
    private String defaultWorkflows;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "retention_rules", columnDefinition = "jsonb")
    private String retentionRules;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "compliance_frameworks", columnDefinition = "jsonb")
    private String complianceFrameworks;

    @Column(name = "icon_url")
    private String iconUrl;

    @Column(name = "is_active")
    private Boolean isActive;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
