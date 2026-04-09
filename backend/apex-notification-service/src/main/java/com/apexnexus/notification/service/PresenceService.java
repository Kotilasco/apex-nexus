package com.apexnexus.notification.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Real-time presence tracking for documents.
 * Tracks which users are currently viewing each document and broadcasts changes via WebSocket.
 * Uses Redis for distributed presence state across service instances.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PresenceService {

    private final SimpMessagingTemplate messagingTemplate;
    private final StringRedisTemplate redisTemplate;

    private static final String PRESENCE_KEY_PREFIX = "presence:doc:";
    private static final Duration PRESENCE_TTL = Duration.ofMinutes(5);
    private static final Duration HEARTBEAT_INTERVAL = Duration.ofSeconds(30);

    // Local cache for quick lookups
    private final ConcurrentHashMap<String, Set<ViewerInfo>> localPresence = new ConcurrentHashMap<>();

    /**
     * Register a user as viewing a document.
     */
    public void joinDocument(String documentId, String userId, String username, String displayName) {
        String redisKey = PRESENCE_KEY_PREFIX + documentId;
        String memberValue = userId + "|" + username + "|" + displayName + "|" + Instant.now().toEpochMilli();

        // Add to Redis sorted set with score = current time (for TTL-based cleanup)
        redisTemplate.opsForZSet().add(redisKey, memberValue, Instant.now().toEpochMilli());
        redisTemplate.expire(redisKey, PRESENCE_TTL);

        // Update local cache
        localPresence.computeIfAbsent(documentId, k -> ConcurrentHashMap.newKeySet())
                .add(new ViewerInfo(userId, username, displayName));

        broadcastPresence(documentId);
        log.debug("User {} joined document {}", username, documentId);
    }

    /**
     * Remove a user from a document's viewer list.
     */
    public void leaveDocument(String documentId, String userId) {
        String redisKey = PRESENCE_KEY_PREFIX + documentId;

        // Remove from Redis (find and remove entries matching userId)
        Set<String> members = redisTemplate.opsForZSet().range(redisKey, 0, -1);
        if (members != null) {
            for (String member : members) {
                if (member.startsWith(userId + "|")) {
                    redisTemplate.opsForZSet().remove(redisKey, member);
                }
            }
        }

        // Update local cache
        Set<ViewerInfo> viewers = localPresence.get(documentId);
        if (viewers != null) {
            viewers.removeIf(v -> v.userId().equals(userId));
            if (viewers.isEmpty()) localPresence.remove(documentId);
        }

        broadcastPresence(documentId);
        log.debug("User {} left document {}", userId, documentId);
    }

    /**
     * Heartbeat to keep presence alive.
     */
    public void heartbeat(String documentId, String userId) {
        String redisKey = PRESENCE_KEY_PREFIX + documentId;
        Set<String> members = redisTemplate.opsForZSet().range(redisKey, 0, -1);
        if (members != null) {
            for (String member : members) {
                if (member.startsWith(userId + "|")) {
                    // Update the score (timestamp) to keep it alive
                    redisTemplate.opsForZSet().add(redisKey, member, Instant.now().toEpochMilli());
                    break;
                }
            }
        }
        redisTemplate.expire(redisKey, PRESENCE_TTL);
    }

    /**
     * Get current viewers for a document.
     */
    public List<ViewerInfo> getViewers(String documentId) {
        String redisKey = PRESENCE_KEY_PREFIX + documentId;
        long cutoff = Instant.now().minus(PRESENCE_TTL).toEpochMilli();

        // Remove stale entries
        redisTemplate.opsForZSet().removeRangeByScore(redisKey, 0, cutoff);

        Set<String> members = redisTemplate.opsForZSet().range(redisKey, 0, -1);
        if (members == null || members.isEmpty()) return List.of();

        List<ViewerInfo> viewers = new ArrayList<>();
        Set<String> seenUserIds = new HashSet<>();

        for (String member : members) {
            String[] parts = member.split("\\|", 4);
            if (parts.length >= 3 && seenUserIds.add(parts[0])) {
                viewers.add(new ViewerInfo(parts[0], parts[1], parts[2]));
            }
        }
        return viewers;
    }

    /**
     * Broadcast current presence to all subscribers of a document channel.
     */
    private void broadcastPresence(String documentId) {
        List<ViewerInfo> viewers = getViewers(documentId);
        Map<String, Object> payload = Map.of(
                "documentId", documentId,
                "viewers", viewers,
                "count", viewers.size(),
                "timestamp", Instant.now().toEpochMilli()
        );
        messagingTemplate.convertAndSend("/topic/document/" + documentId + "/presence", payload);
    }

    /**
     * Periodic cleanup of stale presence entries.
     */
    @Scheduled(fixedDelay = 60000) // every 60 seconds
    public void cleanupStalePresence() {
        long cutoff = Instant.now().minus(PRESENCE_TTL).toEpochMilli();
        Set<String> keys = redisTemplate.keys(PRESENCE_KEY_PREFIX + "*");
        if (keys == null) return;

        for (String key : keys) {
            Long removed = redisTemplate.opsForZSet().removeRangeByScore(key, 0, cutoff);
            if (removed != null && removed > 0) {
                String docId = key.replace(PRESENCE_KEY_PREFIX, "");
                broadcastPresence(docId);
            }
        }
    }

    public record ViewerInfo(String userId, String username, String displayName) {}
}
