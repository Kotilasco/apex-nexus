package com.apexnexus.document.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Client for the search service's version anomaly detection endpoint.
 * Sends previous and new version files for AI-powered comparison.
 */
@Component
@Slf4j
public class VersionAnomalyClient {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String searchServiceUrl;

    public VersionAnomalyClient(
            ObjectMapper objectMapper,
            @Value("${search.service.url:http://apex-search-service:8084}") String searchServiceUrl) {
        // Configure RestTemplate with connection and read timeouts
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(90000);
        this.restTemplate = new RestTemplate(factory);
        this.objectMapper = objectMapper;
        this.searchServiceUrl = searchServiceUrl;
    }

    /**
     * Call the search service to compare two document versions.
     * Returns null if the service is unavailable.
     */
    public AnomalyResult checkAnomaly(
            byte[] previousFile, String prevFileName, String prevMimeType,
            byte[] newFile, String newFileName, String newMimeType) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("previousFile", new NamedByteArrayResource(previousFile, prevFileName));
            body.add("newFile", new NamedByteArrayResource(newFile, newFileName));

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(
                    searchServiceUrl + "/search/version-anomaly",
                    requestEntity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode data = root.path("data");

                boolean flagged = data.path("flagged").asBoolean(false);
                double anomalyScore = data.path("anomalyScore").asDouble(0);
                double similarityScore = data.path("similarityScore").asDouble(1);

                List<String> reasons = new ArrayList<>();
                JsonNode reasonsNode = data.path("reasons");
                if (reasonsNode.isArray()) {
                    for (JsonNode r : reasonsNode) {
                        reasons.add(r.asText());
                    }
                }

                return new AnomalyResult(flagged,
                        BigDecimal.valueOf(anomalyScore),
                        BigDecimal.valueOf(similarityScore),
                        reasons);
            }
        } catch (Exception e) {
            log.warn("Version anomaly check failed (search service may be unavailable): {}", e.getMessage());
        }
        return null;
    }

    public record AnomalyResult(
            boolean flagged,
            BigDecimal anomalyScore,
            BigDecimal similarityScore,
            List<String> reasons) {
    }

    /**
     * Call the search service to extract text content from a file.
     * Used for visual version comparison.
     */
    public String extractText(byte[] fileData, String fileName) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new NamedByteArrayResource(fileData, fileName));

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(
                    searchServiceUrl + "/search/extract",
                    requestEntity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode data = root.path("data");
                if (data.path("success").asBoolean(false)) {
                    return data.path("text").asText(null);
                }
            }
        } catch (Exception e) {
            log.warn("Text extraction via search service failed: {}", e.getMessage());
        }
        return null;
    }

    /**
     * ByteArrayResource with a filename for multipart upload.
     */
    private static class NamedByteArrayResource extends ByteArrayResource {
        private final String filename;

        NamedByteArrayResource(byte[] byteArray, String filename) {
            super(byteArray);
            this.filename = filename;
        }

        @Override
        public String getFilename() {
            return this.filename;
        }
    }
}
