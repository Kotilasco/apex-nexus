package com.apexnexus.auth.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document_share_links")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class ShareLink {

    @Id
    @GeneratedValue(generator = "uuid4")
    @GenericGenerator(name = "uuid4", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(nullable = false, unique = true, length = 128)
    private String token;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "max_downloads")
    private Integer maxDownloads;

    @Column(name = "download_count")
    @Builder.Default
    private Integer downloadCount = 0;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "allow_preview")
    @Builder.Default
    private Boolean allowPreview = true;

    @Column(name = "allow_download")
    @Builder.Default
    private Boolean allowDownload = true;

    @Column(name = "ip_whitelist", columnDefinition = "text[]")
    private String[] ipWhitelist;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();

    /**
     * Check if this share link is still valid.
     */
    public boolean isValid() {
        return Boolean.TRUE.equals(isActive)
                && Instant.now().isBefore(expiresAt)
                && (maxDownloads == null || downloadCount < maxDownloads);
    }
}
