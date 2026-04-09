package com.apexnexus.auth.controller;

import com.apexnexus.auth.dto.CreateShareLinkRequest;
import com.apexnexus.auth.dto.ShareLinkDto;
import com.apexnexus.auth.service.ShareLinkService;
import com.apexnexus.common.dto.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/auth/share-links")
@RequiredArgsConstructor
public class ShareLinkController {

    private final ShareLinkService shareLinkService;

    /**
     * Create a new share link (authenticated users only).
     */
    @PostMapping
    public ResponseEntity<ApiResponse<ShareLinkDto>> createShareLink(
            @Valid @RequestBody CreateShareLinkRequest request,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        ShareLinkDto link = shareLinkService.createShareLink(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(link));
    }

    /**
     * Get all active share links for a document.
     */
    @GetMapping("/document/{documentId}")
    public ResponseEntity<ApiResponse<List<ShareLinkDto>>> getLinksForDocument(@PathVariable UUID documentId) {
        return ResponseEntity.ok(ApiResponse.success(shareLinkService.getLinksForDocument(documentId)));
    }

    /**
     * Validate a share link (public — no auth required).
     */
    @PostMapping("/validate")
    public ResponseEntity<ApiResponse<ShareLinkDto>> validateShareLink(
            @RequestParam String token,
            @RequestParam(required = false) String password,
            HttpServletRequest request) {
        String clientIp = request.getRemoteAddr();
        ShareLinkDto link = shareLinkService.validateShareLink(token, password, clientIp);
        return ResponseEntity.ok(ApiResponse.success(link));
    }

    /**
     * Record a download through a share link (public — no auth required).
     */
    @PostMapping("/download/{token}")
    public ResponseEntity<ApiResponse<Void>> recordDownload(@PathVariable String token) {
        shareLinkService.recordDownload(token);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /**
     * Revoke a share link.
     */
    @DeleteMapping("/{linkId}")
    public ResponseEntity<ApiResponse<Void>> revokeShareLink(
            @PathVariable UUID linkId,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        shareLinkService.revokeShareLink(linkId, userId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
