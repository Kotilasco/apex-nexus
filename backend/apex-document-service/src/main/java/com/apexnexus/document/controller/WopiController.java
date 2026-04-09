package com.apexnexus.document.controller;

import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.document.model.Document;
import com.apexnexus.document.model.DocumentVersion;
import com.apexnexus.document.model.WopiAccessToken;
import com.apexnexus.document.repository.DocumentRepository;
import com.apexnexus.document.repository.DocumentVersionRepository;
import com.apexnexus.document.service.StorageService;
import com.apexnexus.document.service.WopiTokenService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * WOPI host endpoints for Microsoft Office Online / Office 365 co-authoring integration.
 *
 * Protocol: https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/
 *
 * Flow:
 *   1. Client calls POST /wopi/token/{documentId} to get a WOPI access token
 *   2. Client opens Office Online with the WOPI source URL + access_token
 *   3. Office Online calls CheckFileInfo, GetFile, PutFile against these endpoints
 *
 * Endpoints:
 *   GET  /wopi/files/{id}           — CheckFileInfo
 *   GET  /wopi/files/{id}/contents  — GetFile
 *   POST /wopi/files/{id}/contents  — PutFile
 *   POST /wopi/files/{id}           — Lock/Unlock/RefreshLock
 */
@Slf4j
@RestController
@RequestMapping("/wopi")
@RequiredArgsConstructor
public class WopiController {

    private static final String LOCK_PREFIX = "wopi:lock:";

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final StorageService storageService;
    private final WopiTokenService wopiTokenService;
    private final RedisTemplate<String, String> redisTemplate;
    private final AuditPublisher auditPublisher;

    // ============ Token Generation (authenticated REST endpoint) ============

    @PostMapping("/token/{documentId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> generateToken(
            @PathVariable UUID documentId,
            @RequestParam(defaultValue = "EDIT") String permissions,
            Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();

        // Verify document exists
        documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        WopiAccessToken token = wopiTokenService.createToken(documentId, userId, permissions);

        Map<String, Object> response = Map.of(
                "accessToken", token.getToken(),
                "expiresAt", token.getExpiresAt().toString(),
                "wopiSrc", "/wopi/files/" + documentId
        );

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    // ============ CheckFileInfo — returns document metadata ============

    @GetMapping(value = "/files/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> checkFileInfo(
            @PathVariable UUID id,
            @RequestParam("access_token") String accessToken) {
        WopiAccessToken token = validateWopiToken(accessToken, id);
        Document doc = findDoc(id);

        boolean canEdit = "EDIT".equals(token.getPermissions());

        Map<String, Object> info = new LinkedHashMap<>();
        // Required WOPI properties
        info.put("BaseFileName", doc.getTitle() + "." + doc.getFileExtension());
        info.put("OwnerId", doc.getAuthorId().toString());
        info.put("Size", doc.getFileSizeBytes());
        info.put("UserId", token.getUserId().toString());
        info.put("Version", doc.getCurrentVersion().toString());
        info.put("SHA256", doc.getSha256Hash());

        // Permission flags
        info.put("ReadOnly", !canEdit);
        info.put("UserCanWrite", canEdit);
        info.put("UserCanNotWriteRelative", true);
        info.put("SupportsLocks", true);
        info.put("SupportsUpdate", canEdit);
        info.put("SupportsGetLock", true);

        // UI features
        info.put("BreadcrumbBrandName", "Apex Nexus");
        info.put("BreadcrumbFolderName", "Documents");
        info.put("DisablePrint", false);
        info.put("DisableTranslation", false);

        // Version tracking
        info.put("SupportsCoauth", true);
        info.put("SupportsFolders", false);

        return ResponseEntity.ok(info);
    }

    // ============ GetFile — download file content ============

    @GetMapping("/files/{id}/contents")
    public ResponseEntity<byte[]> getFile(
            @PathVariable UUID id,
            @RequestParam("access_token") String accessToken) throws Exception {
        WopiAccessToken token = validateWopiToken(accessToken, id);
        Document doc = findDoc(id);
        byte[] data = storageService.retrieveFile(doc.getStorageKey());

        auditPublisher.publish(AuditEvent.builder()
                .userId(token.getUserId())
                .action("WOPI_GET_FILE")
                .resourceType("DOCUMENT")
                .resourceId(id)
                .resourceName(doc.getTitle())
                .build());

        String mimeType = doc.getMimeType() != null ? doc.getMimeType() : "application/octet-stream";
        String filename = doc.getTitle();
        if (doc.getFileExtension() != null && !filename.endsWith("." + doc.getFileExtension())) {
            filename += "." + doc.getFileExtension();
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mimeType))
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .header("X-WOPI-ItemVersion", doc.getCurrentVersion().toString())
                .body(data);
    }

    // ============ PutFile — save file content (auto-save from Office Online) ============

    @PostMapping("/files/{id}/contents")
    @Transactional
    public ResponseEntity<Map<String, Object>> putFile(
            @PathVariable UUID id,
            @RequestParam("access_token") String accessToken,
            @RequestHeader(value = "X-WOPI-Lock", required = false) String lockId,
            HttpServletRequest request) throws Exception {
        WopiAccessToken token = validateWopiToken(accessToken, id);

        if (!"EDIT".equals(token.getPermissions())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "No write permission"));
        }

        Document doc = findDoc(id);

        // Verify lock if present
        String currentLock = redisTemplate.opsForValue().get(LOCK_PREFIX + id);
        if (currentLock != null && lockId != null && !currentLock.equals(lockId)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .header("X-WOPI-Lock", currentLock)
                    .body(Map.of("error", "Lock mismatch"));
        }

        byte[] fileData = request.getInputStream().readAllBytes();
        String sha256 = storageService.calculateSha256(fileData);

        // Skip if content unchanged
        if (sha256.equals(doc.getSha256Hash())) {
            return ResponseEntity.ok(Map.of(
                    "ItemVersion", doc.getCurrentVersion().toString(),
                    "SHA256", sha256
            ));
        }

        int newVersion = doc.getCurrentVersion() + 1;
        String filename = doc.getTitle() + "." + doc.getFileExtension();
        String storageKey = String.format("documents/%s/v%d/%s", doc.getObjectGuid(), newVersion, filename);

        storageService.storeFile(fileData, storageKey, doc.getMimeType());

        // Create MINOR auto-save version
        DocumentVersion version = DocumentVersion.builder()
                .document(doc)
                .versionNumber(newVersion)
                .sha256Hash(sha256)
                .fileSizeBytes((long) fileData.length)
                .storageKey(storageKey)
                .authorId(token.getUserId())
                .changeSummary("WOPI auto-save")
                .versionType("MINOR")
                .build();
        versionRepository.save(version);

        doc.setCurrentVersion(newVersion);
        doc.setSha256Hash(sha256);
        doc.setFileSizeBytes((long) fileData.length);
        doc.setStorageKey(storageKey);
        documentRepository.save(doc);

        auditPublisher.publish(AuditEvent.builder()
                .userId(token.getUserId())
                .action("WOPI_PUT_FILE")
                .resourceType("DOCUMENT")
                .resourceId(id)
                .resourceName(doc.getTitle())
                .details(Map.of("version", newVersion, "versionType", "MINOR"))
                .build());

        return ResponseEntity.ok(Map.of(
                "ItemVersion", String.valueOf(newVersion),
                "SHA256", sha256
        ));
    }

    // ============ Lock/Unlock/RefreshLock/GetLock operations ============

    @PostMapping("/files/{id}")
    public ResponseEntity<Map<String, Object>> lockOperations(
            @PathVariable UUID id,
            @RequestParam("access_token") String accessToken,
            @RequestHeader("X-WOPI-Override") String override,
            @RequestHeader(value = "X-WOPI-Lock", required = false) String lockId,
            @RequestHeader(value = "X-WOPI-OldLock", required = false) String oldLockId) {
        WopiAccessToken token = validateWopiToken(accessToken, id);
        findDoc(id); // verify document exists

        return switch (override.toUpperCase()) {
            case "LOCK" -> handleLock(id, lockId, token);
            case "GET_LOCK" -> handleGetLock(id);
            case "REFRESH_LOCK" -> handleRefreshLock(id, lockId, token);
            case "UNLOCK" -> handleUnlock(id, lockId, token);
            case "UNLOCK_AND_RELOCK" -> {
                handleUnlock(id, oldLockId, token);
                yield handleLock(id, lockId, token);
            }
            default -> ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Unknown operation: " + override));
        };
    }

    private ResponseEntity<Map<String, Object>> handleLock(UUID docId, String lockId, WopiAccessToken token) {
        String currentLock = redisTemplate.opsForValue().get(LOCK_PREFIX + docId);

        if (currentLock != null) {
            if (currentLock.equals(lockId)) {
                // Refresh existing lock
                redisTemplate.expire(LOCK_PREFIX + docId, Duration.ofMinutes(30));
                return ResponseEntity.ok(Map.of("status", "refreshed"));
            }
            // Conflict — different lock exists
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .header("X-WOPI-Lock", currentLock)
                    .body(Map.of("error", "Lock conflict"));
        }

        // Set new lock
        redisTemplate.opsForValue().set(LOCK_PREFIX + docId, lockId, Duration.ofMinutes(30));

        auditPublisher.publish(AuditEvent.builder()
                .userId(token.getUserId())
                .action("WOPI_LOCK")
                .resourceType("DOCUMENT")
                .resourceId(docId)
                .build());

        return ResponseEntity.ok(Map.of("status", "locked"));
    }

    private ResponseEntity<Map<String, Object>> handleGetLock(UUID docId) {
        String currentLock = redisTemplate.opsForValue().get(LOCK_PREFIX + docId);
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-WOPI-Lock", currentLock != null ? currentLock : "");
        return new ResponseEntity<>(Map.of("lock", currentLock != null ? currentLock : ""), headers, HttpStatus.OK);
    }

    private ResponseEntity<Map<String, Object>> handleRefreshLock(UUID docId, String lockId, WopiAccessToken token) {
        String currentLock = redisTemplate.opsForValue().get(LOCK_PREFIX + docId);
        if (currentLock == null || !currentLock.equals(lockId)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .header("X-WOPI-Lock", currentLock != null ? currentLock : "")
                    .body(Map.of("error", "Lock mismatch"));
        }
        redisTemplate.expire(LOCK_PREFIX + docId, Duration.ofMinutes(30));
        return ResponseEntity.ok(Map.of("status", "refreshed"));
    }

    private ResponseEntity<Map<String, Object>> handleUnlock(UUID docId, String lockId, WopiAccessToken token) {
        String currentLock = redisTemplate.opsForValue().get(LOCK_PREFIX + docId);
        if (currentLock != null && !currentLock.equals(lockId)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .header("X-WOPI-Lock", currentLock)
                    .body(Map.of("error", "Lock mismatch"));
        }
        redisTemplate.delete(LOCK_PREFIX + docId);

        auditPublisher.publish(AuditEvent.builder()
                .userId(token.getUserId())
                .action("WOPI_UNLOCK")
                .resourceType("DOCUMENT")
                .resourceId(docId)
                .build());

        return ResponseEntity.ok(Map.of("status", "unlocked"));
    }

    // ============ HELPERS ============

    private WopiAccessToken validateWopiToken(String accessToken, UUID documentId) {
        WopiAccessToken token = wopiTokenService.validateToken(accessToken)
                .orElseThrow(() -> new SecurityException("Invalid or expired WOPI access token"));

        if (!token.getDocumentId().equals(documentId)) {
            throw new SecurityException("Token does not match the requested document");
        }

        return token;
    }

    private Document findDoc(UUID id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));
    }
}
