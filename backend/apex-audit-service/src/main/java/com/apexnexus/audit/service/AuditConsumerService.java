package com.apexnexus.audit.service;

import com.apexnexus.audit.model.AuditLogEntry;
import com.apexnexus.audit.repository.AuditLogRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Consumes audit events from Redis and persists them to the immutable audit_log table.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditConsumerService {

    private final StringRedisTemplate redisTemplate;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @Value("${audit.queue-key:apex:audit:events}")
    private String queueKey;

    @Value("${audit.consumer.batch-size:100}")
    private int batchSize;

    /** Track the last hash for chain continuity across batches */
    private String lastChainHash = "GENESIS";
    private long sequenceCounter = -1;

    @Scheduled(fixedDelayString = "${audit.consumer.poll-interval:2000}")
    @Transactional
    public void consumeAuditEvents() {
        // Initialize sequence counter on first run
        if (sequenceCounter < 0) {
            Long maxSeq = auditLogRepository.findMaxSequenceNumber();
            sequenceCounter = (maxSeq != null) ? maxSeq : 0;
            // If there's existing chain data, load last hash
            if (sequenceCounter > 0) {
                String existingHash = auditLogRepository.findLastEntryHash();
                if (existingHash != null) {
                    lastChainHash = existingHash;
                }
            }
        }

        List<AuditLogEntry> entries = new ArrayList<>();
        int consumed = 0;

        while (consumed < batchSize) {
            String json = redisTemplate.opsForList().leftPop(queueKey);
            if (json == null) break;

            try {
                Map<String, Object> event = objectMapper.readValue(json, new TypeReference<>() {});

                AuditLogEntry entry = AuditLogEntry.builder()
                        .userId(parseUuid((String) event.get("userId")))
                        .actorType(event.get("actorType") != null ? (String) event.get("actorType") : "HUMAN")
                        .action((String) event.get("action"))
                        .resourceType((String) event.get("resourceType"))
                        .resourceId(parseUuid((String) event.get("resourceId")))
                        .projectId(parseUuid((String) event.get("projectId")))
                        .details(event.get("details") != null ? castToStringMap(event.get("details")) : null)
                        .ipAddress((String) event.get("ip"))
                        .userAgent((String) event.get("userAgent"))
                        .createdAt(LocalDateTime.now())
                        .build();

                // Compute tamper-evident hash chain
                sequenceCounter++;
                entry.setSequenceNumber(sequenceCounter);
                entry.setPreviousHash(lastChainHash);
                String entryHash = computeEntryHash(entry, lastChainHash);
                entry.setEntryHash(entryHash);
                lastChainHash = entryHash;

                entries.add(entry);
                consumed++;
            } catch (Exception e) {
                log.error("Failed to parse audit event: {}", e.getMessage());
            }
        }

        if (!entries.isEmpty()) {
            auditLogRepository.saveAll(entries);
            log.debug("Persisted {} audit events", entries.size());
        }
    }

    private UUID parseUuid(String value) {
        if (value == null || value.isBlank() || "SYSTEM".equals(value)) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castToStringMap(Object obj) {
        if (obj instanceof Map) return (Map<String, Object>) obj;
        return null;
    }

    /**
     * Compute SHA-256 hash of audit entry concatenated with previous hash.
     * This creates a blockchain-like tamper-evident chain.
     */
    private String computeEntryHash(AuditLogEntry entry, String previousHash) {
        try {
            String payload = String.join("|",
                    String.valueOf(entry.getSequenceNumber()),
                    previousHash,
                    String.valueOf(entry.getUserId()),
                    entry.getAction() != null ? entry.getAction() : "",
                    entry.getResourceType() != null ? entry.getResourceType() : "",
                    String.valueOf(entry.getResourceId()),
                    String.valueOf(entry.getCreatedAt())
            );
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            log.error("Failed to compute entry hash: {}", e.getMessage());
            return "ERROR";
        }
    }
}
