package com.apexnexus.auth.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "project_members", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"project_id", "user_id"})
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ProjectMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "role_id", nullable = false)
    private UUID roleId;

    @Column(name = "permissions_mask")
    @Builder.Default
    private Long permissionsMask = 0L;

    @Column(name = "joined_at")
    @Builder.Default
    private Instant joinedAt = Instant.now();

    // ===== Bitwise permission constants =====
    public static final long PERM_READ            = 1L;
    public static final long PERM_WRITE           = 1L << 1;
    public static final long PERM_DELETE          = 1L << 2;
    public static final long PERM_MANAGE          = 1L << 3;
    public static final long PERM_APPROVE         = 1L << 4;
    public static final long PERM_AI_INVOKE       = 1L << 5;
    public static final long PERM_AI_CONFIGURE    = 1L << 6;
    public static final long PERM_RETENTION       = 1L << 7;
    public static final long PERM_EXPORT          = 1L << 8;
    public static final long PERM_ADMIN           = 1L << 9;

    public boolean hasPermission(long permission) {
        return (permissionsMask & permission) != 0;
    }

    public void grantPermission(long permission) {
        this.permissionsMask |= permission;
    }

    public void revokePermission(long permission) {
        this.permissionsMask &= ~permission;
    }
}
