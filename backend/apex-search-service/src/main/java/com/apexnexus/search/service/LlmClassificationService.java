package com.apexnexus.search.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.*;

/**
 * Layer 3 — Semantic / AI classifier using a local LLM (Ollama).
 * Understands document INTENT, not just keywords. Used as a tie-breaker or
 * confidence boost when rule-based confidence is low.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LlmClassificationService {

    private final ObjectMapper objectMapper;

    @Value("${ollama.host:http://localhost:11434}")
    private String ollamaHost;

    @Value("${ollama.model:llama3.2:1b}")
    private String ollamaModel;

    private RestTemplate rest() {
        org.springframework.http.client.SimpleClientHttpRequestFactory f =
                new org.springframework.http.client.SimpleClientHttpRequestFactory();
        f.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        f.setReadTimeout((int) Duration.ofSeconds(60).toMillis());
        return new RestTemplate(f);
    }

    public SemanticResult classify(String fileName, String mimeType, String text) {
        SemanticResult fallback = SemanticResult.builder()
                .available(false).label(null).category(null).confidence(0.0)
                .reasoning("LLM not consulted").priority("NORMAL").suggestedProjectHint(null)
                .build();

        if (text == null || text.isBlank()) return fallback;
        String sample = text.length() > 2500 ? text.substring(0, 2500) : text;

        String prompt = """
            You are an enterprise document classifier. Classify this document and respond with ONLY valid JSON.
            Available categories: LEGAL, FINANCIAL, HR, GOVERNANCE, ENGINEERING, COMMUNICATION, ANALYSIS, MEDIA, DATA, OPERATIONS, GENERAL.
            Available labels: Contract, Invoice, Purchase Order, Meter Reading, Infrastructure Map, Report, Policy, HR Document, Resume, Meeting Minutes, Correspondence, Memo, Technical Spec, Presentation, Spreadsheet, Image, Receipt, Tax Document, Dispute Notice, Other.
            Priority: LOW, NORMAL, HIGH, URGENT (URGENT for disputes/legal threats/overdue invoices).

            Filename: %s
            MIME: %s
            Excerpt:
            %s

            Respond ONLY with: {"label":"...","category":"...","confidence":0.85,"reasoning":"one short sentence","priority":"NORMAL","suggestedProjectHint":"short keyword like 'finance' or 'engineering'"}
            """.formatted(fileName == null ? "" : fileName, mimeType == null ? "" : mimeType, sample);

        Map<String, Object> body = new HashMap<>();
        body.put("model", ollamaModel);
        body.put("prompt", prompt);
        body.put("stream", false);
        body.put("format", "json");
        body.put("options", Map.of("temperature", 0.1, "num_predict", 200));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            ResponseEntity<String> resp = rest().exchange(
                    ollamaHost + "/api/generate", HttpMethod.POST,
                    new HttpEntity<>(body, headers), String.class);
            JsonNode root = objectMapper.readTree(resp.getBody());
            String raw = root.path("response").asText("").trim();
            if (raw.isEmpty()) return fallback;
            JsonNode parsed = objectMapper.readTree(raw);
            return SemanticResult.builder()
                    .available(true)
                    .label(parsed.path("label").asText("Other"))
                    .category(parsed.path("category").asText("GENERAL"))
                    .confidence(parsed.path("confidence").asDouble(0.5))
                    .reasoning(parsed.path("reasoning").asText(""))
                    .priority(parsed.path("priority").asText("NORMAL"))
                    .suggestedProjectHint(parsed.path("suggestedProjectHint").asText(""))
                    .build();
        } catch (Exception e) {
            log.warn("LLM classification failed: {}", e.getMessage());
            return fallback.toBuilder().reasoning("LLM unreachable: " + e.getMessage()).build();
        }
    }

    @Data
    @lombok.Builder(toBuilder = true)
    public static class SemanticResult {
        private boolean available;
        private String label;
        private String category;
        private double confidence;
        private String reasoning;
        private String priority;
        private String suggestedProjectHint;
    }
}
