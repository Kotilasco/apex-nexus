package com.apexnexus.auth.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "plugin_registry")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PluginRegistry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    private String description;
    private String version;
    private String vendor;

    @Column(name = "plugin_type", nullable = false)
    private String pluginType;

    private String category;

    @Column(nullable = false)
    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config_schema", columnDefinition = "jsonb")
    private String configSchema;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String capabilities;

    @Column(name = "icon_url")
    private String iconUrl;

    @Column(name = "documentation_url")
    private String documentationUrl;

    @Column(name = "is_premium")
    private Boolean isPremium;

    @Column(name = "installed_count")
    private Integer installedCount;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
