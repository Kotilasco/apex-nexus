package com.apexnexus.auth.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
public class CreateShareLinkRequest {

    @NotNull
    private UUID documentId;

    @NotNull
    @Future
    private Instant expiresAt;

    private String password;            // optional — will be bcrypt-hashed
    private Integer maxDownloads;       // optional — null = unlimited
    private Boolean allowPreview;       // default true
    private Boolean allowDownload;      // default true
    private String[] ipWhitelist;       // optional IP restrictions
}
