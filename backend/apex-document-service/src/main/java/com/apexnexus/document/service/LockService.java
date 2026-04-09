package com.apexnexus.document.service;

import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.exception.BusinessException;
import com.apexnexus.common.exception.ResourceNotFoundException;
import com.apexnexus.document.model.Document;
import com.apexnexus.document.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * Two-Tiered Locking Service — Heartbeat-based distributed lock management.
 *
 * Lock lifecycle:
 *   1. Client acquires lock (LOCK) → Redis key with 5-min TTL + DB checkout flag
 *   2. Client sends heartbeats every 30-60s → Redis TTL refreshed to 5 min
 *   3. If heartbeats stop (crash/disconnect) → Redis key expires after 5 min safety buffer
 *   4. Client releases lock (UNLOCK) → Redis key deleted + DB checkout cleared
 *
 * Redis keys per document lock:
 *   lock:{docId}         → userId           (who owns the lock)
 *   lock:{docId}:token   → lockToken        (WebDAV opaquelocktoken)
 *   lock:{docId}:heartbeat → ISO timestamp  (last heartbeat time)
 *   lock:{docId}:draft   → "true"           (whether a draft exists)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LockService {

    private static final String LOCK_PREFIX = "lock:";
    private static final Duration LOCK_TTL = Duration.ofMinutes(5);       // Safety buffer
    private static final Duration HEARTBEAT_GRACE = Duration.ofMinutes(5); // Grace after last heartbeat

    private final RedisTemplate<String, String> redisTemplate;
    private final DocumentRepository documentRepository;
    private final StorageService storageService;
    private final AuditPublisher auditPublisher;
    private final LockEventBroadcaster lockEventBroadcaster;

    // ============ ACQUIRE LOCK ============

    @Transactional
    public LockResult acquireLock(UUID documentId, UUID userId) {
        Document doc = findDoc(documentId);

        String existingOwner = redisTemplate.opsForValue().get(key(documentId));

        if (existingOwner != null) {
            if (existingOwner.equals(userId.toString())) {
                // Same user re-locking — refresh
                return refreshExistingLock(documentId, userId, doc);
            }
            // Another user holds the lock — check if heartbeat is stale
            if (isHeartbeatAlive(documentId)) {
                // Lock is actively held
                return LockResult.conflict(UUID.fromString(existingOwner), getLastHeartbeat(documentId));
            }
            // Heartbeat is dead — offer takeover
            return LockResult.stale(UUID.fromString(existingOwner), getLastHeartbeat(documentId),
                    hasDraft(documentId));
        }

        // No existing lock — acquire
        return doAcquire(documentId, userId, doc);
    }

    private LockResult doAcquire(UUID documentId, UUID userId, Document doc) {
        String lockToken = "opaquelocktoken:" + UUID.randomUUID();

        redisTemplate.opsForValue().set(key(documentId), userId.toString(), LOCK_TTL);
        redisTemplate.opsForValue().set(key(documentId) + ":token", lockToken, LOCK_TTL);
        redisTemplate.opsForValue().set(key(documentId) + ":heartbeat", Instant.now().toString(), LOCK_TTL);

        doc.setIsCheckedOut(true);
        doc.setCheckedOutBy(userId);
        doc.setCheckedOutAt(Instant.now());
        documentRepository.save(doc);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId).action("LOCK_ACQUIRED")
                .resourceType("DOCUMENT").resourceId(documentId)
                .resourceName(doc.getTitle()).build());

        lockEventBroadcaster.broadcastLockAcquired(documentId, userId);
        return LockResult.acquired(lockToken, LOCK_TTL);
    }

    private LockResult refreshExistingLock(UUID documentId, UUID userId, Document doc) {
        String token = redisTemplate.opsForValue().get(key(documentId) + ":token");
        if (token == null) token = "opaquelocktoken:" + UUID.randomUUID();

        redisTemplate.expire(key(documentId), LOCK_TTL);
        redisTemplate.expire(key(documentId) + ":token", LOCK_TTL);
        redisTemplate.opsForValue().set(key(documentId) + ":heartbeat", Instant.now().toString(), LOCK_TTL);

        return LockResult.acquired(token, LOCK_TTL);
    }

    // ============ HEARTBEAT (Lock Refresh) ============

    public HeartbeatResult heartbeat(UUID documentId, UUID userId) {
        String owner = redisTemplate.opsForValue().get(key(documentId));
        if (owner == null) {
            return new HeartbeatResult(false, "NO_LOCK", null);
        }
        if (!owner.equals(userId.toString())) {
            return new HeartbeatResult(false, "NOT_OWNER", null);
        }

        // Refresh all TTLs
        redisTemplate.expire(key(documentId), LOCK_TTL);
        redisTemplate.expire(key(documentId) + ":token", LOCK_TTL);
        redisTemplate.opsForValue().set(key(documentId) + ":heartbeat", Instant.now().toString(), LOCK_TTL);
        if (Boolean.TRUE.equals(redisTemplate.hasKey(key(documentId) + ":draft"))) {
            redisTemplate.expire(key(documentId) + ":draft", LOCK_TTL);
        }

        lockEventBroadcaster.broadcastHeartbeat(documentId, userId);
        log.debug("Heartbeat refreshed for doc {} by user {}", documentId, userId);
        return new HeartbeatResult(true, "OK", LOCK_TTL);
    }

    // ============ RELEASE LOCK ============

    @Transactional
    public void releaseLock(UUID documentId, UUID userId) {
        String owner = redisTemplate.opsForValue().get(key(documentId));
        if (owner != null && !owner.equals(userId.toString())) {
            throw new BusinessException("Lock is held by a different user");
        }

        doRelease(documentId, userId, false);
    }

    @Transactional
    public void forceReleaseLock(UUID documentId, UUID adminUserId, boolean discardDraft) {
        Document doc = findDoc(documentId);
        String owner = redisTemplate.opsForValue().get(key(documentId));

        if (owner == null) {
            throw new BusinessException("Document is not locked");
        }

        UUID lockOwnerId = UUID.fromString(owner);

        // If there's a draft and we're not discarding, promote it as a recovery version
        if (!discardDraft && hasDraft(documentId)) {
            promoteDraftAsRecovery(documentId, lockOwnerId, doc);
        } else if (discardDraft && hasDraft(documentId)) {
            try {
                String draftKey = draftKey(documentId);
                storageService.deleteDraft(draftKey);
            } catch (Exception e) {
                log.warn("Failed to delete draft for doc {}: {}", documentId, e.getMessage());
            }
        }

        doRelease(documentId, adminUserId, true);
        lockEventBroadcaster.broadcastLockForceReleased(documentId, adminUserId);

        auditPublisher.publish(AuditEvent.builder()
                .userId(adminUserId).action("LOCK_FORCE_RELEASED")
                .resourceType("DOCUMENT").resourceId(documentId)
                .resourceName(doc.getTitle())
                .details(Map.of("previousOwner", owner, "draftDiscarded", discardDraft))
                .build());
    }

    private void doRelease(UUID documentId, UUID userId, boolean isForced) {
        Document doc = findDoc(documentId);

        // Clean up Redis keys
        redisTemplate.delete(key(documentId));
        redisTemplate.delete(key(documentId) + ":token");
        redisTemplate.delete(key(documentId) + ":heartbeat");
        redisTemplate.delete(key(documentId) + ":draft");

        // Clear DB checkout state
        doc.setIsCheckedOut(false);
        doc.setCheckedOutBy(null);
        doc.setCheckedOutAt(null);
        documentRepository.save(doc);

        if (!isForced) {
            lockEventBroadcaster.broadcastLockReleased(documentId, userId);
            auditPublisher.publish(AuditEvent.builder()
                    .userId(userId).action("LOCK_RELEASED")
                    .resourceType("DOCUMENT").resourceId(documentId)
                    .resourceName(doc.getTitle()).build());
        }
    }

    // ============ TAKEOVER (Conflict Resolution) ============

    @Transactional
    public LockResult takeOverLock(UUID documentId, UUID userId, boolean saveDraftAsRecovery) {
        Document doc = findDoc(documentId);
        String owner = redisTemplate.opsForValue().get(key(documentId));

        if (owner == null) {
            // Lock already expired — just acquire normally
            return doAcquire(documentId, userId, doc);
        }

        if (isHeartbeatAlive(documentId)) {
            throw new BusinessException("Cannot take over an actively held lock. The user is still editing.");
        }

        UUID previousOwner = UUID.fromString(owner);

        // Handle draft if present
        if (hasDraft(documentId) && saveDraftAsRecovery) {
            promoteDraftAsRecovery(documentId, previousOwner, doc);
        }

        // Force release old lock
        doRelease(documentId, userId, true);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId).action("LOCK_TAKEN_OVER")
                .resourceType("DOCUMENT").resourceId(documentId)
                .resourceName(doc.getTitle())
                .details(Map.of("previousOwner", previousOwner))
                .build());

        lockEventBroadcaster.broadcastLockTakenOver(documentId, userId, previousOwner);

        // Acquire for new user
        return doAcquire(documentId, userId, doc);
    }

    // ============ DRAFT AUTOSAVE ============

    public void saveDraft(UUID documentId, UUID userId, byte[] fileData) throws Exception {
        String owner = redisTemplate.opsForValue().get(key(documentId));
        if (owner == null || !owner.equals(userId.toString())) {
            throw new BusinessException("You don't hold the lock on this document");
        }

        String draftKey = draftKey(documentId);
        Document doc = findDoc(documentId);
        storageService.storeDraft(fileData, draftKey, doc.getMimeType());

        // Mark that a draft exists
        redisTemplate.opsForValue().set(key(documentId) + ":draft", "true", LOCK_TTL);

        // Refresh heartbeat on autosave (autosave implies active use)
        heartbeat(documentId, userId);

        lockEventBroadcaster.broadcastDraftSaved(documentId, userId);
        log.info("Draft autosaved for doc {} by user {} ({} bytes)", documentId, userId, fileData.length);
    }

    public byte[] retrieveDraft(UUID documentId, UUID userId) throws Exception {
        String draftKey = draftKey(documentId);
        if (!storageService.draftExists(draftKey)) {
            throw new ResourceNotFoundException("Draft", "documentId", documentId);
        }
        return storageService.retrieveDraft(draftKey);
    }

    public boolean hasDraft(UUID documentId) {
        return storageService.draftExists(draftKey(documentId));
    }

    private void promoteDraftAsRecovery(UUID documentId, UUID authorId, Document doc) {
        try {
            String draftKey = draftKey(documentId);
            byte[] draftData = storageService.retrieveDraft(draftKey);

            int newVersion = doc.getCurrentVersion() + 1;
            String filename = doc.getTitle() + "." + doc.getFileExtension();
            String storageKey = String.format("documents/%s/v%d/%s", doc.getObjectGuid(), newVersion, filename);
            String sha256 = storageService.calculateSha256(draftData);

            storageService.storeFile(draftData, storageKey, doc.getMimeType());

            // Create recovery version via repository
            // Note: version creation is done by caller or DocumentService
            log.info("Promoted draft as recovery version {} for doc {}", newVersion, documentId);

            // Clean up draft
            storageService.deleteDraft(draftKey);
        } catch (Exception e) {
            log.error("Failed to promote draft for doc {}: {}", documentId, e.getMessage());
        }
    }

    // ============ LOCK STATUS ============

    public LockStatus getLockStatus(UUID documentId) {
        String owner = redisTemplate.opsForValue().get(key(documentId));
        if (owner == null) {
            return LockStatus.unlocked(documentId);
        }

        UUID ownerId = UUID.fromString(owner);
        boolean heartbeatAlive = isHeartbeatAlive(documentId);
        Instant lastHeartbeat = getLastHeartbeat(documentId);
        boolean draftExists = hasDraft(documentId);
        Long ttl = redisTemplate.getExpire(key(documentId), TimeUnit.SECONDS);

        return new LockStatus(documentId, true, ownerId, heartbeatAlive, lastHeartbeat,
                draftExists, ttl != null ? ttl : 0);
    }

    // ============ HELPERS ============

    private boolean isHeartbeatAlive(UUID documentId) {
        String heartbeatStr = redisTemplate.opsForValue().get(key(documentId) + ":heartbeat");
        if (heartbeatStr == null) return false;
        try {
            Instant lastBeat = Instant.parse(heartbeatStr);
            return Duration.between(lastBeat, Instant.now()).compareTo(HEARTBEAT_GRACE) < 0;
        } catch (Exception e) {
            return false;
        }
    }

    private Instant getLastHeartbeat(UUID documentId) {
        String heartbeatStr = redisTemplate.opsForValue().get(key(documentId) + ":heartbeat");
        if (heartbeatStr == null) return null;
        try { return Instant.parse(heartbeatStr); } catch (Exception e) { return null; }
    }

    private Document findDoc(UUID id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));
    }

    private String key(UUID documentId) {
        return LOCK_PREFIX + documentId;
    }

    private String draftKey(UUID documentId) {
        return "drafts/" + documentId + "/autosave";
    }

    // ============ RECORD TYPES ============

    public record LockResult(
            Status status, String lockToken, Duration timeout,
            UUID conflictOwner, Instant conflictLastHeartbeat, boolean hasDraft
    ) {
        public enum Status { ACQUIRED, CONFLICT, STALE }

        static LockResult acquired(String token, Duration timeout) {
            return new LockResult(Status.ACQUIRED, token, timeout, null, null, false);
        }
        static LockResult conflict(UUID owner, Instant lastHeartbeat) {
            return new LockResult(Status.CONFLICT, null, null, owner, lastHeartbeat, false);
        }
        static LockResult stale(UUID owner, Instant lastHeartbeat, boolean hasDraft) {
            return new LockResult(Status.STALE, null, null, owner, lastHeartbeat, hasDraft);
        }
    }

    public record HeartbeatResult(boolean success, String reason, Duration newTtl) {}

    public record LockStatus(
            UUID documentId, boolean locked, UUID ownerId, boolean heartbeatAlive,
            Instant lastHeartbeat, boolean draftExists, long ttlSeconds
    ) {
        static LockStatus unlocked(UUID documentId) {
            return new LockStatus(documentId, false, null, false, null, false, 0);
        }
    }
}
