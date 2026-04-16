package com.apexnexus.search.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Polls the search_index_queue table (via Redis) for documents that need
 * to be indexed or re-indexed in Elasticsearch.
 * Enhanced with Tika content extraction for full-text search.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class IndexQueueProcessor {

    private final StringRedisTemplate redisTemplate;
    private final SearchService searchService;
    private final ContentExtractorService contentExtractor;
    private final ClassificationService classificationService;
    private final GdprScannerService gdprScannerService;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;

    private static final String QUEUE_KEY = "apex:search:index-queue";

    @Value("${search.batch-size:50}")
    private int batchSize;

    @Scheduled(fixedDelayString = "${search.queue-poll-interval:5000}")
    public void processQueue() {
        int processed = 0;
        while (processed < batchSize) {
            String json = redisTemplate.opsForList().leftPop(QUEUE_KEY);
            if (json == null)
                break;

            try {
                Map<String, Object> event = objectMapper.readValue(json, new TypeReference<>() {
                });
                String action = (String) event.get("action");

                if ("INDEX".equals(action) || "REINDEX".equals(action)) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> document = (Map<String, Object>) event.get("document");

                    // Extract content from file data if present (base64-encoded)
                    enrichWithExtractedContent(document, event);

                    searchService.indexDocument(document);
                } else if ("DELETE".equals(action)) {
                    String documentId = (String) event.get("documentId");
                    searchService.removeDocument(documentId);
                } else if ("UPDATE".equals(action)) {
                    String documentId = (String) event.get("documentId");
                    @SuppressWarnings("unchecked")
                    Map<String, Object> partialDoc = (Map<String, Object>) event.get("document");
                    searchService.updateDocument(documentId, partialDoc);
                } else if ("EXTRACT_CONTENT".equals(action)) {
                    // Dedicated content extraction request
                    handleContentExtraction(event);
                }

                processed++;
            } catch (Exception e) {
                log.error("Failed to process index queue item: {}", e.getMessage());
            }
        }

        if (processed > 0) {
            log.debug("Processed {} items from search index queue", processed);
        }
    }

    /**
     * If the index event includes base64-encoded file data, extract text content
     * and add it to the document map for Elasticsearch indexing.
     */
    @SuppressWarnings("unchecked")
    private void enrichWithExtractedContent(Map<String, Object> document, Map<String, Object> event) {
        String fileDataBase64 = (String) event.get("fileData");
        if (fileDataBase64 == null || fileDataBase64.isBlank())
            return;

        try {
            byte[] fileData = Base64.getDecoder().decode(fileDataBase64);
            String fileName = (String) document.get("title");
            String mimeType = (String) document.get("mimeType");

            ContentExtractorService.ExtractionResult result = contentExtractor.extract(fileData, fileName, mimeType);

            if (result.isSuccess() && !result.getText().isBlank()) {
                document.put("content", result.getText());
                log.info("Enriched document '{}' with extracted content ({} chars, {}ms)",
                        fileName, result.getContentLength(), result.getExtractionTimeMs());

                // Auto-classify based on extracted content (only if AI Classification plugin is
                // ACTIVE)
                if (isClassificationPluginActive()) {
                    ClassificationService.ClassificationResult classification = classificationService.classify(fileName,
                            mimeType, result.getText(), result.getMetadata());
                    if (classification.getConfidence() >= 0.2) {
                        document.put("classificationLabel", classification.getLabel());
                        document.put("classificationCategory", classification.getCategory());
                        document.put("classificationConfidence", classification.getConfidence());

                        // Write classification back to PostgreSQL
                        String docId = (String) document.get("documentId");
                        if (docId != null) {
                            try {
                                jdbcTemplate.update(
                                        "UPDATE documents SET classification_label = ? WHERE id = ?::uuid",
                                        classification.getLabel(), docId);
                                log.info("Classified document '{}' as '{}' (confidence: {})",
                                        fileName, classification.getLabel(), classification.getConfidence());
                            } catch (Exception ex) {
                                log.warn("Failed to update classification_label for doc {}: {}", docId,
                                        ex.getMessage());
                            }
                        }
                    }
                } else {
                    log.debug("AI Document Classification plugin is not active — skipping classification");
                }

                // Microsoft 365 Integration — generate edit/preview links when active
                if (isMicrosoft365PluginActive()) {
                    String docId = (String) document.get("documentId");
                    String title = (String) document.get("title");
                    if (docId != null) {
                        String m365Link = "https://apexnexus.sharepoint.com/sites/ecm/Shared%20Documents/" +
                                (title != null ? title.replace(" ", "%20") : docId);
                        document.put("m365Link", m365Link);
                        try {
                            jdbcTemplate.update(
                                    "UPDATE documents SET m365_link = ? WHERE id = ?::uuid",
                                    m365Link, docId);
                            log.info("Microsoft 365 link generated for document '{}': {}", title, m365Link);
                        } catch (Exception ex) {
                            log.warn("Failed to update m365_link for doc {}: {}", docId, ex.getMessage());
                        }
                    }
                } else {
                    log.debug("Microsoft 365 Integration plugin is not active — skipping M365 linking");
                }

                // SAP ERP Connector — generate SAP document number for invoices/contracts when
                // active
                if (isSapErpPluginActive()) {
                    String docId = (String) document.get("documentId");
                    String classLabel = (String) document.get("classificationLabel");
                    String title = (String) document.get("title");
                    if (docId != null) {
                        String sapPrefix;
                        if ("Invoice".equals(classLabel)) {
                            sapPrefix = "SAP-FI-";
                        } else if ("Contract".equals(classLabel)) {
                            sapPrefix = "SAP-MM-";
                        } else if ("Report".equals(classLabel)) {
                            sapPrefix = "SAP-CO-";
                        } else {
                            sapPrefix = "SAP-DM-";
                        }
                        String sapDocNumber = sapPrefix + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
                        document.put("sapDocumentNumber", sapDocNumber);
                        try {
                            jdbcTemplate.update(
                                    "UPDATE documents SET sap_document_number = ? WHERE id = ?::uuid",
                                    sapDocNumber, docId);
                            log.info("SAP document number {} assigned to '{}' (classification: {})",
                                    sapDocNumber, title, classLabel);
                        } catch (Exception ex) {
                            log.warn("Failed to update sap_document_number for doc {}: {}", docId, ex.getMessage());
                        }
                    }
                } else {
                    log.debug("SAP ERP Connector plugin is not active — skipping SAP document numbering");
                }

                // Store extracted text content in PostgreSQL for redaction previews
                String docIdForContent = (String) document.get("documentId");
                if (docIdForContent != null) {
                    try {
                        jdbcTemplate.update(
                                "UPDATE documents SET extracted_content = ? WHERE id = ?::uuid",
                                result.getText(), docIdForContent);
                    } catch (Exception ex) {
                        log.warn("Failed to save extracted content for doc {}: {}", docIdForContent, ex.getMessage());
                    }
                }

                // Automatic GDPR PII scan on every uploaded document
                String docId4Pii = (String) document.get("documentId");
                if (docId4Pii != null) {
                    try {
                        GdprScannerService.GdprScanResult piiResult = gdprScannerService.scan(result.getText(),
                                docId4Pii);
                        document.put("piiDetected", piiResult.isPiiFound());
                        document.put("piiSeverity", piiResult.getSeverity().name());

                        if (piiResult.isPiiFound()) {
                            String piiTypes = piiResult.getFindings().stream()
                                    .map(GdprScannerService.PiiFinding::getType)
                                    .distinct()
                                    .reduce((a, b) -> a + "," + b)
                                    .orElse("");
                            document.put("piiTypes", piiTypes);

                            jdbcTemplate.update(
                                    "UPDATE documents SET pii_detected = TRUE, pii_severity = ?, pii_types = ?, pii_scan_date = NOW() WHERE id = ?::uuid",
                                    piiResult.getSeverity().name(), piiTypes, docId4Pii);
                            log.warn("PII DETECTED in document '{}': severity={}, types=[{}], count={}",
                                    fileName, piiResult.getSeverity(), piiTypes, piiResult.getTotalPiiCount());
                        } else {
                            jdbcTemplate.update(
                                    "UPDATE documents SET pii_detected = FALSE, pii_severity = 'NONE', pii_scan_date = NOW() WHERE id = ?::uuid",
                                    docId4Pii);
                            log.info("GDPR scan clean for document '{}' — no PII found", fileName);
                        }
                    } catch (Exception ex) {
                        log.warn("GDPR PII scan failed for doc {}: {}", docId4Pii, ex.getMessage());
                    }
                }

                // Store extraction metadata
                Map<String, Object> extractionMeta = new HashMap<>();
                extractionMeta.put("contentExtracted", true);
                extractionMeta.put("ocrApplied", result.isOcrApplied());
                extractionMeta.put("language", result.getLanguage());
                extractionMeta.put("extractionTimeMs", result.getExtractionTimeMs());

                Object existingMeta = document.get("metadata");
                if (existingMeta instanceof Map) {
                    ((Map<String, Object>) existingMeta).putAll(extractionMeta);
                } else {
                    document.put("metadata", extractionMeta);
                }
            }
        } catch (Exception e) {
            log.warn("Content extraction failed during indexing: {}", e.getMessage());
        }
    }

    /**
     * Handle a dedicated content extraction request — extract and update ES
     * document.
     */
    @SuppressWarnings("unchecked")
    private void handleContentExtraction(Map<String, Object> event) {
        String documentId = (String) event.get("documentId");
        String fileDataBase64 = (String) event.get("fileData");
        String fileName = (String) event.get("fileName");
        String mimeType = (String) event.get("mimeType");

        if (documentId == null || fileDataBase64 == null) {
            log.warn("EXTRACT_CONTENT event missing documentId or fileData");
            return;
        }

        try {
            byte[] fileData = Base64.getDecoder().decode(fileDataBase64);
            ContentExtractorService.ExtractionResult result = contentExtractor.extract(fileData, fileName, mimeType);

            if (result.isSuccess() && !result.getText().isBlank()) {
                Map<String, Object> update = new HashMap<>();
                update.put("content", result.getText());
                searchService.updateDocument(documentId, update);
                log.info("Content extracted and indexed for document {}: {} chars", documentId,
                        result.getContentLength());
            }
        } catch (Exception e) {
            log.error("Failed to extract content for document {}: {}", documentId, e.getMessage());
        }
    }

    /**
     * Check if the AI Document Classification plugin is ACTIVE in the
     * plugin_registry.
     */
    private boolean isClassificationPluginActive() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM plugin_registry WHERE name = 'AI Document Classification' AND status = 'ACTIVE'",
                    Integer.class);
            return count != null && count > 0;
        } catch (Exception e) {
            log.warn("Failed to check AI Classification plugin status: {}", e.getMessage());
            return false;
        }
    }

    private boolean isMicrosoft365PluginActive() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM plugin_registry WHERE name = 'Microsoft 365 Integration' AND status = 'ACTIVE'",
                    Integer.class);
            return count != null && count > 0;
        } catch (Exception e) {
            log.warn("Failed to check Microsoft 365 plugin status: {}", e.getMessage());
            return false;
        }
    }

    private boolean isSapErpPluginActive() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM plugin_registry WHERE name = 'SAP ERP Connector' AND status = 'ACTIVE'",
                    Integer.class);
            return count != null && count > 0;
        } catch (Exception e) {
            log.warn("Failed to check SAP ERP Connector plugin status: {}", e.getMessage());
            return false;
        }
    }
}
