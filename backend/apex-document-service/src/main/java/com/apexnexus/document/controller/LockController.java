package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.document.service.LockService;
import com.apexnexus.document.service.LockService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

/**
 * Lock Management REST API — Heartbeat, Draft Autosave, Conflict Resolution.
 *
 * Endpoints:
 *   POST   /locks/{docId}/acquire          — Acquire or re-acquire lock
 *   POST   /locks/{docId}/heartbeat        — Refresh lock TTL (call every 30-60s)
 *   POST   /locks/{docId}/release          — Voluntarily release lock
 *   GET    /locks/{docId}/status           — Get lock status (who holds it, heartbeat, draft)
 *   POST   /locks/{docId}/draft            — Autosave draft (shadow save to MinIO drafts bucket)
 *   GET    /locks/{docId}/draft            — Retrieve current draft
 *   POST   /locks/{docId}/force-release    — Admin: force release with draft handling
 *   POST   /locks/{docId}/takeover         — Take over a stale lock (dead heartbeat)
 */
@RestController
@RequestMapping("/locks")
@RequiredArgsConstructor
public class LockController {

    private final LockService lockService;

    // ============ ACQUIRE ============

    @PostMapping("/{docId}/acquire")
    public ResponseEntity<ApiResponse<Map<String, Object>>> acquireLock(
            @PathVariable UUID docId, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        LockResult result = lockService.acquireLock(docId, userId);

        return switch (result.status()) {
            case ACQUIRED -> ResponseEntity.ok(ApiResponse.ok("Lock acquired", Map.of(
                    "lockToken", result.lockToken(),
                    "timeoutSeconds", result.timeout().getSeconds()
            )));
            case CONFLICT -> ResponseEntity.status(HttpStatus.LOCKED).body(ApiResponse.error(
                    "Document is actively locked by another user", Map.of(
                            "lockedBy", result.conflictOwner(),
                            "lastHeartbeat", result.conflictLastHeartbeat() != null
                                    ? result.conflictLastHeartbeat().toString() : "unknown"
                    )));
            case STALE -> ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(
                    "Document has a stale lock (user may have disconnected)", Map.of(
                            "lockedBy", result.conflictOwner(),
                            "lastHeartbeat", result.conflictLastHeartbeat() != null
                                    ? result.conflictLastHeartbeat().toString() : "unknown",
                            "hasDraft", result.hasDraft(),
                            "hint", "Use POST /locks/{docId}/takeover to take over the lock"
                    )));
        };
    }

    // ============ HEARTBEAT ============

    @PostMapping("/{docId}/heartbeat")
    public ResponseEntity<ApiResponse<Map<String, Object>>> heartbeat(
            @PathVariable UUID docId, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        HeartbeatResult result = lockService.heartbeat(docId, userId);

        if (result.success()) {
            return ResponseEntity.ok(ApiResponse.ok("Heartbeat accepted", Map.of(
                    "newTtlSeconds", result.newTtl().getSeconds()
            )));
        }
        return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                .body(ApiResponse.error("Heartbeat rejected: " + result.reason(), null));
    }

    // ============ RELEASE ============

    @PostMapping("/{docId}/release")
    public ResponseEntity<ApiResponse<Void>> releaseLock(
            @PathVariable UUID docId, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        lockService.releaseLock(docId, userId);
        return ResponseEntity.ok(ApiResponse.ok("Lock released", null));
    }

    // ============ STATUS ============

    @GetMapping("/{docId}/status")
    public ResponseEntity<ApiResponse<LockStatus>> getLockStatus(@PathVariable UUID docId) {
        LockStatus status = lockService.getLockStatus(docId);
        return ResponseEntity.ok(ApiResponse.ok(status));
    }

    // ============ DRAFT AUTOSAVE ============

    @PostMapping(value = "/{docId}/draft", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Void>> saveDraft(
            @PathVariable UUID docId,
            @RequestPart("file") MultipartFile file,
            Authentication auth) throws Exception {
        UUID userId = (UUID) auth.getPrincipal();
        lockService.saveDraft(docId, userId, file.getBytes());
        return ResponseEntity.ok(ApiResponse.ok("Draft autosaved", null));
    }

    @GetMapping("/{docId}/draft")
    public ResponseEntity<byte[]> getDraft(
            @PathVariable UUID docId, Authentication auth) throws Exception {
        UUID userId = (UUID) auth.getPrincipal();
        byte[] draft = lockService.retrieveDraft(docId, userId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(draft);
    }

    // ============ ADMIN: FORCE RELEASE ============

    @PostMapping("/{docId}/force-release")
    public ResponseEntity<ApiResponse<Map<String, Object>>> forceRelease(
            @PathVariable UUID docId,
            @RequestParam(defaultValue = "false") boolean discardDraft,
            Authentication auth) {
        UUID adminId = (UUID) auth.getPrincipal();

        // Check for draft before force-releasing
        LockStatus status = lockService.getLockStatus(docId);
        if (!status.locked()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Document is not locked", null));
        }

        lockService.forceReleaseLock(docId, adminId, discardDraft);

        return ResponseEntity.ok(ApiResponse.ok("Lock force-released", Map.of(
                "previousOwner", status.ownerId(),
                "draftDiscarded", discardDraft
        )));
    }

    // ============ TAKEOVER (stale lock) ============

    @PostMapping("/{docId}/takeover")
    public ResponseEntity<ApiResponse<Map<String, Object>>> takeOverLock(
            @PathVariable UUID docId,
            @RequestParam(defaultValue = "true") boolean saveDraftAsRecovery,
            Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        LockResult result = lockService.takeOverLock(docId, userId, saveDraftAsRecovery);

        if (result.status() == LockResult.Status.ACQUIRED) {
            return ResponseEntity.ok(ApiResponse.ok("Lock taken over", Map.of(
                    "lockToken", result.lockToken(),
                    "timeoutSeconds", result.timeout().getSeconds()
            )));
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error("Cannot take over lock", null));
    }
}
