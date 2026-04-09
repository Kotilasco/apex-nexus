package com.apexnexus.auth.service;

import com.apexnexus.auth.dto.CreateShareLinkRequest;
import com.apexnexus.auth.dto.ShareLinkDto;
import com.apexnexus.auth.model.ShareLink;
import com.apexnexus.auth.repository.ShareLinkRepository;
import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.exception.BusinessException;
import com.apexnexus.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShareLinkService {

    private final ShareLinkRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final AuditPublisher auditPublisher;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 48; // 64 chars base64url

    @Value("${share.base-url:http://localhost:3001/share}")
    private String shareBaseUrl;

    @Value("${share.max-links-per-document:10}")
    private int maxLinksPerDocument;

    /**
     * Create a new public share link for a document.
     */
    @Transactional
    public ShareLinkDto createShareLink(CreateShareLinkRequest request, UUID userId) {
        // Limit active links per document
        long activeCount = repository.countByDocumentIdAndIsActiveTrue(request.getDocumentId());
        if (activeCount >= maxLinksPerDocument) {
            throw new BusinessException("Maximum number of active share links reached for this document");
        }

        String token = generateSecureToken();

        ShareLink link = ShareLink.builder()
                .documentId(request.getDocumentId())
                .token(token)
                .createdBy(userId)
                .expiresAt(request.getExpiresAt())
                .passwordHash(request.getPassword() != null
                        ? passwordEncoder.encode(request.getPassword()) : null)
                .maxDownloads(request.getMaxDownloads())
                .allowPreview(request.getAllowPreview() != null ? request.getAllowPreview() : true)
                .allowDownload(request.getAllowDownload() != null ? request.getAllowDownload() : true)
                .ipWhitelist(request.getIpWhitelist())
                .build();

        link = repository.save(link);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("SHARE_LINK_CREATED")
                .resourceType("DOCUMENT")
                .resourceId(request.getDocumentId())
                .details(Map.of(
                        "shareLinkId", link.getId().toString(),
                        "expiresAt", request.getExpiresAt().toString(),
                        "hasPassword", String.valueOf(request.getPassword() != null)
                ))
                .build());

        log.info("Share link created for document {} by user {}", request.getDocumentId(), userId);
        return toDto(link);
    }

    /**
     * Validate a share link token and optional password.
     * Returns the link details if valid.
     */
    @Transactional
    public ShareLinkDto validateShareLink(String token, String password, String clientIp) {
        ShareLink link = repository.findByTokenAndIsActiveTrue(token)
                .orElseThrow(() -> new ResourceNotFoundException("ShareLink", "token", token));

        if (!link.isValid()) {
            throw new BusinessException("Share link has expired or reached its download limit");
        }

        // Check password if set
        if (link.getPasswordHash() != null) {
            if (password == null || !passwordEncoder.matches(password, link.getPasswordHash())) {
                throw new BusinessException("Invalid password for this share link");
            }
        }

        // Check IP whitelist
        if (link.getIpWhitelist() != null && link.getIpWhitelist().length > 0 && clientIp != null) {
            boolean allowed = false;
            for (String allowedIp : link.getIpWhitelist()) {
                if (clientIp.equals(allowedIp)) {
                    allowed = true;
                    break;
                }
            }
            if (!allowed) {
                throw new BusinessException("Access denied from your IP address");
            }
        }

        return toDto(link);
    }

    /**
     * Record a download through a share link (increment counter).
     */
    @Transactional
    public void recordDownload(String token) {
        ShareLink link = repository.findByTokenAndIsActiveTrue(token)
                .orElseThrow(() -> new ResourceNotFoundException("ShareLink", "token", token));
        link.setDownloadCount(link.getDownloadCount() + 1);
        repository.save(link);
    }

    /**
     * Get all active share links for a document.
     */
    public List<ShareLinkDto> getLinksForDocument(UUID documentId) {
        return repository.findByDocumentIdAndIsActiveTrueOrderByCreatedAtDesc(documentId).stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Revoke (deactivate) a share link.
     */
    @Transactional
    public void revokeShareLink(UUID linkId, UUID userId) {
        ShareLink link = repository.findById(linkId)
                .orElseThrow(() -> new ResourceNotFoundException("ShareLink", "id", linkId));
        link.setIsActive(false);
        repository.save(link);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("SHARE_LINK_REVOKED")
                .resourceType("DOCUMENT")
                .resourceId(link.getDocumentId())
                .details(Map.of("shareLinkId", linkId.toString()))
                .build());

        log.info("Share link {} revoked by user {}", linkId, userId);
    }

    private String generateSecureToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private ShareLinkDto toDto(ShareLink link) {
        return ShareLinkDto.builder()
                .id(link.getId())
                .documentId(link.getDocumentId())
                .token(link.getToken())
                .shareUrl(shareBaseUrl + "/" + link.getToken())
                .createdBy(link.getCreatedBy())
                .expiresAt(link.getExpiresAt())
                .passwordProtected(link.getPasswordHash() != null)
                .maxDownloads(link.getMaxDownloads())
                .downloadCount(link.getDownloadCount())
                .allowPreview(link.getAllowPreview())
                .allowDownload(link.getAllowDownload())
                .isActive(link.getIsActive())
                .createdAt(link.getCreatedAt())
                .build();
    }
}
