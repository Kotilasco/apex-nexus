package com.apexnexus.document.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Broadcasts lock events to WebSocket subscribers.
 * Clients subscribe to /topic/locks/{documentId} for real-time updates.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LockEventBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;

    public void broadcastLockAcquired(UUID documentId, UUID userId) {
        broadcast(documentId, Map.of(
                "event", "LOCK_ACQUIRED",
                "documentId", documentId.toString(),
                "userId", userId.toString(),
                "timestamp", Instant.now().toString()
        ));
    }

    public void broadcastLockReleased(UUID documentId, UUID userId) {
        broadcast(documentId, Map.of(
                "event", "LOCK_RELEASED",
                "documentId", documentId.toString(),
                "userId", userId.toString(),
                "timestamp", Instant.now().toString()
        ));
    }

    public void broadcastHeartbeat(UUID documentId, UUID userId) {
        broadcast(documentId, Map.of(
                "event", "HEARTBEAT",
                "documentId", documentId.toString(),
                "userId", userId.toString(),
                "timestamp", Instant.now().toString()
        ));
    }

    public void broadcastDraftSaved(UUID documentId, UUID userId) {
        broadcast(documentId, Map.of(
                "event", "DRAFT_SAVED",
                "documentId", documentId.toString(),
                "userId", userId.toString(),
                "lastAutosaved", Instant.now().toString()
        ));
    }

    public void broadcastLockTakenOver(UUID documentId, UUID newUser, UUID previousUser) {
        broadcast(documentId, Map.of(
                "event", "LOCK_TAKEN_OVER",
                "documentId", documentId.toString(),
                "newUserId", newUser.toString(),
                "previousUserId", previousUser.toString(),
                "timestamp", Instant.now().toString()
        ));
    }

    public void broadcastLockForceReleased(UUID documentId, UUID adminId) {
        broadcast(documentId, Map.of(
                "event", "LOCK_FORCE_RELEASED",
                "documentId", documentId.toString(),
                "releasedBy", adminId.toString(),
                "timestamp", Instant.now().toString()
        ));
    }

    private void broadcast(UUID documentId, Map<String, String> payload) {
        String destination = "/topic/locks/" + documentId;
        messagingTemplate.convertAndSend(destination, payload);
        log.debug("Broadcast {} to {}", payload.get("event"), destination);
    }
}
