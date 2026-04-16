package com.apexnexus.document.service;

import com.apexnexus.document.model.Document;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;

/**
 * Publishes document indexing events to the Redis queue consumed by apex-search-service.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SearchIndexPublisher {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    private static final String QUEUE_KEY = "apex:search:index-queue";

    /**
     * Publish an INDEX event so the search service indexes the document in Elasticsearch.
     */
    public void publishIndex(Document doc, byte[] fileData) {
        try {
            Map<String, Object> document = buildDocumentMap(doc);

            Map<String, Object> event = new HashMap<>();
            event.put("action", "INDEX");
            event.put("document", document);
            if (fileData != null) {
                event.put("fileData", Base64.getEncoder().encodeToString(fileData));
            }

            String json = objectMapper.writeValueAsString(event);
            redisTemplate.opsForList().rightPush(QUEUE_KEY, json);
            log.info("Published INDEX event for document: {} ({})", doc.getTitle(), doc.getId());
        } catch (Exception e) {
            log.error("Failed to publish INDEX event for document {}: {}", doc.getId(), e.getMessage());
        }
    }

    /**
     * Publish an UPDATE event for metadata changes (no new file content).
     */
    public void publishUpdate(Document doc) {
        try {
            Map<String, Object> document = buildDocumentMap(doc);

            Map<String, Object> event = new HashMap<>();
            event.put("action", "UPDATE");
            event.put("documentId", doc.getId().toString());
            event.put("document", document);

            String json = objectMapper.writeValueAsString(event);
            redisTemplate.opsForList().rightPush(QUEUE_KEY, json);
            log.info("Published UPDATE event for document: {}", doc.getId());
        } catch (Exception e) {
            log.error("Failed to publish UPDATE event for document {}: {}", doc.getId(), e.getMessage());
        }
    }

    /**
     * Publish a REINDEX event (new version checked in).
     */
    public void publishReindex(Document doc, byte[] fileData) {
        try {
            Map<String, Object> document = buildDocumentMap(doc);

            Map<String, Object> event = new HashMap<>();
            event.put("action", "REINDEX");
            event.put("document", document);
            if (fileData != null) {
                event.put("fileData", Base64.getEncoder().encodeToString(fileData));
            }

            String json = objectMapper.writeValueAsString(event);
            redisTemplate.opsForList().rightPush(QUEUE_KEY, json);
            log.info("Published REINDEX event for document: {} ({})", doc.getTitle(), doc.getId());
        } catch (Exception e) {
            log.error("Failed to publish REINDEX event for document {}: {}", doc.getId(), e.getMessage());
        }
    }

    /**
     * Publish a DELETE event to remove the document from the search index.
     */
    public void publishDelete(UUID documentId) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("action", "DELETE");
            event.put("documentId", documentId.toString());

            String json = objectMapper.writeValueAsString(event);
            redisTemplate.opsForList().rightPush(QUEUE_KEY, json);
            log.info("Published DELETE event for document: {}", documentId);
        } catch (Exception e) {
            log.error("Failed to publish DELETE event for document {}: {}", documentId, e.getMessage());
        }
    }

    private Map<String, Object> buildDocumentMap(Document doc) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("documentId", doc.getId().toString());
        map.put("title", doc.getTitle());
        map.put("description", doc.getDescription());
        map.put("mimeType", doc.getMimeType());
        map.put("status", doc.getStatus());
        map.put("authorId", doc.getAuthorId() != null ? doc.getAuthorId().toString() : null);
        map.put("folderPath", doc.getFolderId() != null ? doc.getFolderId().toString() : null);
        map.put("projectId", doc.getProjectId() != null ? doc.getProjectId().toString() : null);
        map.put("aiGenerated", doc.getAiGenerated());
        map.put("aiConfidence", doc.getAiConfidence());
        map.put("tags", doc.getTags() != null ? Arrays.asList(doc.getTags()) : List.of());
        map.put("metadata", doc.getMetadataJson());
        map.put("fileSize", doc.getFileSizeBytes());
        map.put("createdAt", doc.getCreatedAt() != null ? doc.getCreatedAt().toString() : Instant.now().toString());
        map.put("updatedAt", doc.getUpdatedAt() != null ? doc.getUpdatedAt().toString() : Instant.now().toString());
        // Include previously extracted content as fallback for full-text search
        if (doc.getExtractedContent() != null && !doc.getExtractedContent().isBlank()) {
            map.put("content", doc.getExtractedContent());
        }
        return map;
    }
}
