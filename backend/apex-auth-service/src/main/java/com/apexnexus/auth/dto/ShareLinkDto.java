package com.apexnexus.auth.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class ShareLinkDto {
    private UUID id;
    private UUID documentId;
    private String token;
    private String shareUrl;
    private UUID createdBy;
    private Instant expiresAt;
    private boolean passwordProtected;
    private Integer maxDownloads;
    private Integer downloadCount;
    private Boolean allowPreview;
    private Boolean allowDownload;
    private Boolean isActive;
    private Instant createdAt;
}
