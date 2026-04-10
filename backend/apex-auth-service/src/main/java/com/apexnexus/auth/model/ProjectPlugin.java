package com.apexnexus.auth.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "project_plugins", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"project_id", "plugin_id"})
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ProjectPlugin {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "plugin_id", nullable = false)
    private UUID pluginId;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "activated_by")
    private UUID activatedBy;

    @Column(name = "activated_at")
    @Builder.Default
    private Instant activatedAt = Instant.now();
}
