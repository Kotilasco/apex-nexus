package com.apexnexus.document.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "folders")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Folder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private String path;

    @Column(nullable = false)
    @Builder.Default
    private Integer depth = 0;

    @Column(name = "is_system")
    @Builder.Default
    private Boolean isSystem = false;

    @CreationTimestamp
    @Column(name = "created_at")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
