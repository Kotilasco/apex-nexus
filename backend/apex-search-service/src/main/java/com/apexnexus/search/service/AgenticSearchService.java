package com.apexnexus.search.service;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.core.search.Hit;
import com.apexnexus.search.dto.SearchRequest;
import com.apexnexus.search.dto.SearchResponse;
import com.apexnexus.search.dto.SearchResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.*;

/**
 * Agentic AI search: answers a natural-language question by retrieving
 * top-K relevant documents (RAG) and asking the local LLM to answer with citations.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AgenticSearchService {

    private final SearchService searchService;
    private final ElasticsearchClient esClient;
    private final ObjectMapper objectMapper;

    @Value("${ollama.host:http://localhost:11434}")
    private String ollamaHost;

    @Value("${ollama.model:llama3.2:1b}")
    private String ollamaModel;

    @Value("${elasticsearch.index.documents}")
    private String documentsIndex;

    private RestTemplate restTemplate() {
        RestTemplate rt = new RestTemplate();
        var f = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        f.setConnectTimeout(Duration.ofSeconds(15));
        f.setReadTimeout(Duration.ofSeconds(120));
        rt.setRequestFactory(f);
        return rt;
    }

    /**
     * Ask a question against the document corpus.
     * Returns answer + cited sources.
     */
    public Map<String, Object> ask(String question, UUID userId, int topK) {
        long t0 = System.currentTimeMillis();
        topK = Math.max(1, Math.min(topK, 10));

        // 1. Retrieve candidate documents
        SearchRequest req = new SearchRequest();
        req.setQuery(question);
        req.setPage(0);
        req.setSize(topK);
        SearchResponse hits = searchService.search(req, userId);

        // 2. Load content snippets from ES directly (SearchResult doesn't carry content)
        List<Map<String, Object>> sources = new ArrayList<>();
        StringBuilder context = new StringBuilder();
        int idx = 1;
        for (SearchResult r : hits.getResults()) {
            String content = fetchContentSnippet(r.getDocumentId());
            String snippet = trim(content, 1200);
            sources.add(Map.of(
                    "index", idx,
                    "documentId", r.getDocumentId(),
                    "title", r.getTitle() != null ? r.getTitle() : "(untitled)",
                    "score", r.getScore(),
                    "snippet", snippet
            ));
            context.append("[Source ").append(idx).append("] ")
                   .append(r.getTitle() != null ? r.getTitle() : "(untitled)")
                   .append("\n").append(snippet).append("\n\n");
            idx++;
        }

        // 3. Ask the LLM
        String answer;
        String modelStatus = "OK";
        if (sources.isEmpty()) {
            answer = "I couldn't find any documents matching your question. Try rephrasing or uploading relevant documents.";
            modelStatus = "NO_CONTEXT";
        } else {
            try {
                answer = callOllama(question, context.toString());
            } catch (Exception e) {
                log.warn("Agentic LLM call failed: {}", e.getMessage());
                answer = fallbackAnswer(question, sources);
                modelStatus = "FALLBACK";
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("question", question);
        result.put("answer", answer);
        result.put("sources", sources);
        result.put("modelStatus", modelStatus);
        result.put("model", ollamaModel);
        result.put("latencyMs", System.currentTimeMillis() - t0);
        return result;
    }

    private String callOllama(String question, String context) {
        String url = ollamaHost + "/api/generate";

        String prompt = """
            You are an assistant that answers questions using only the provided document excerpts.
            Cite sources inline like [1], [2] matching the [Source N] labels.
            If the excerpts don't contain the answer, say "The available documents don't cover that."
            Keep the answer concise (4-8 sentences).

            === DOCUMENT EXCERPTS ===
            %s

            === QUESTION ===
            %s

            === ANSWER (with citations) ===
            """.formatted(context, question);

        Map<String, Object> body = new HashMap<>();
        body.put("model", ollamaModel);
        body.put("prompt", prompt);
        body.put("stream", false);
        body.put("options", Map.of("temperature", 0.2, "num_predict", 400));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        ResponseEntity<String> resp = restTemplate().exchange(url, HttpMethod.POST, entity, String.class);
        try {
            JsonNode root = objectMapper.readTree(resp.getBody());
            String out = root.path("response").asText("").trim();
            return out.isEmpty() ? "The model returned an empty response." : out;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse Ollama response", e);
        }
    }

    private String fallbackAnswer(String question, List<Map<String, Object>> sources) {
        StringBuilder sb = new StringBuilder();
        sb.append("Based on the top matching documents:\n\n");
        for (Map<String, Object> s : sources) {
            sb.append("• [").append(s.get("index")).append("] ").append(s.get("title")).append("\n");
        }
        sb.append("\n(The AI model is currently unreachable; showing keyword-matched results only.)");
        return sb.toString();
    }

    private String fetchContentSnippet(UUID documentId) {
        if (documentId == null) return "";
        try {
            var resp = esClient.get(g -> g.index(documentsIndex).id(documentId.toString()), Map.class);
            if (resp.source() == null) return "";
            Object content = resp.source().get("content");
            if (content == null) {
                Object desc = resp.source().get("description");
                return desc != null ? desc.toString() : "";
            }
            return content.toString();
        } catch (Exception e) {
            log.debug("Could not fetch content for {}: {}", documentId, e.getMessage());
            return "";
        }
    }

    private static String trim(String s, int max) {
        if (s == null) return "";
        s = s.replaceAll("\\s+", " ").trim();
        return s.length() > max ? s.substring(0, max) + "…" : s;
    }

    /**
     * Knowledge Synthesis: broader search + structured multi-doc summary with themes and citations.
     */
    public Map<String, Object> synthesize(String topic, UUID userId, int topK) {
        long t0 = System.currentTimeMillis();
        topK = Math.max(3, Math.min(topK, 15));

        SearchRequest req = new SearchRequest();
        req.setQuery(topic);
        req.setPage(0);
        req.setSize(topK);
        SearchResponse hits = searchService.search(req, userId);

        List<Map<String, Object>> sources = new ArrayList<>();
        StringBuilder context = new StringBuilder();
        int idx = 1;
        for (SearchResult r : hits.getResults()) {
            String content = fetchContentSnippet(r.getDocumentId());
            String snippet = trim(content, 900);
            sources.add(Map.of(
                    "index", idx,
                    "documentId", r.getDocumentId(),
                    "title", r.getTitle() != null ? r.getTitle() : "(untitled)",
                    "score", r.getScore(),
                    "snippet", snippet
            ));
            context.append("[Source ").append(idx).append("] ")
                   .append(r.getTitle() != null ? r.getTitle() : "(untitled)")
                   .append("\n").append(snippet).append("\n\n");
            idx++;
        }

        String summary;
        String modelStatus = "OK";
        if (sources.isEmpty()) {
            summary = "No documents found for topic: " + topic;
            modelStatus = "NO_CONTEXT";
        } else {
            try {
                summary = callOllamaSynthesis(topic, context.toString());
            } catch (Exception e) {
                log.warn("Synthesis LLM call failed: {}", e.getMessage());
                summary = fallbackAnswer(topic, sources);
                modelStatus = "FALLBACK";
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("topic", topic);
        result.put("summary", summary);
        result.put("sourceCount", sources.size());
        result.put("sources", sources);
        result.put("modelStatus", modelStatus);
        result.put("model", ollamaModel);
        result.put("latencyMs", System.currentTimeMillis() - t0);
        return result;
    }

    private String callOllamaSynthesis(String topic, String context) {
        String url = ollamaHost + "/api/generate";
        String prompt = """
            You are a senior analyst synthesizing insights across multiple internal documents.
            Produce a structured briefing for the topic below, based ONLY on the excerpts.

            Format your response as:
            ## Executive Summary
            (2-3 sentences)

            ## Key Themes
            - Theme 1 — finding [N]
            - Theme 2 — finding [N]
            (3-5 bullets, cite sources inline like [1], [2])

            ## Risks / Notable Items
            - Risk/item [N]
            (bullet list)

            ## Recommended Next Steps
            - Step 1
            (2-4 bullets)

            Cite sources inline like [1], [2] matching the [Source N] labels.

            === DOCUMENT EXCERPTS ===
            %s

            === TOPIC ===
            %s

            === BRIEFING ===
            """.formatted(context, topic);

        Map<String, Object> body = new HashMap<>();
        body.put("model", ollamaModel);
        body.put("prompt", prompt);
        body.put("stream", false);
        body.put("options", Map.of("temperature", 0.25, "num_predict", 700));
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<String> resp = restTemplate().exchange(url, HttpMethod.POST, entity, String.class);
        try {
            JsonNode root = objectMapper.readTree(resp.getBody());
            String out = root.path("response").asText("").trim();
            return out.isEmpty() ? "The model returned an empty briefing." : out;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse Ollama response", e);
        }
    }

    /**
     * Command-bar intent router: classifies a free-form instruction and
     * returns the intent + suggested actions + (for Q&A) an answer.
     */
    public Map<String, Object> routeIntent(String prompt, UUID userId) {
        long t0 = System.currentTimeMillis();
        String lower = prompt.toLowerCase(Locale.ROOT);
        String intent;
        List<Map<String, String>> actions = new ArrayList<>();

        if (lower.matches(".*\\b(summari[sz]e|brief|synth|overview of|summary of)\\b.*")) {
            intent = "SYNTHESIZE";
            actions.add(Map.of("type", "synthesize", "label", "Generate briefing"));
        } else if (lower.matches(".*\\b(notify|alert|email|message|send to)\\b.*")) {
            intent = "NOTIFY";
            actions.add(Map.of("type", "ask", "label", "Answer the question first"));
            actions.add(Map.of("type", "notify", "label", "Send notification (review before send)"));
        } else if (lower.matches(".*\\b(approve|reject|assign|escalate|route)\\b.*")) {
            intent = "WORKFLOW";
            actions.add(Map.of("type", "workflow", "label", "Open workflow actions"));
        } else if (lower.matches(".*\\b(find|list|show|search|get|which|who|where)\\b.*")) {
            intent = "SEARCH";
            actions.add(Map.of("type", "search", "label", "Open search results"));
            actions.add(Map.of("type", "ask", "label", "Ask AI for an answer"));
        } else {
            intent = "ASK";
            actions.add(Map.of("type", "ask", "label", "Ask AI"));
        }

        Map<String, Object> answer = null;
        if (intent.equals("ASK") || intent.equals("SEARCH") || intent.equals("NOTIFY")) {
            answer = ask(prompt, userId, 4);
        } else if (intent.equals("SYNTHESIZE")) {
            String topic = prompt.replaceAll("(?i)\\b(summari[sz]e|brief|synth|overview of|summary of)\\b", "").trim();
            if (topic.isEmpty()) topic = prompt;
            answer = synthesize(topic, userId, 8);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("prompt", prompt);
        result.put("intent", intent);
        result.put("actions", actions);
        result.put("answer", answer);
        result.put("latencyMs", System.currentTimeMillis() - t0);
        return result;
    }
}
