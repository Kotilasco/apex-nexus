package com.apexnexus.workflow.service;

import com.apexnexus.workflow.dto.CreateDefinitionRequest;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
@Slf4j
public class AiService {

    @Value("${ollama.host:http://localhost:11434}")
    private String ollamaHost;

    @Value("${ollama.model:llama3.2:1b}")
    private String ollamaModel;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String SYSTEM_PROMPT = """
        You are an expert workflow designer for an enterprise content management system.
        Given a user's description of a workflow, generate a valid workflow definition as JSON.
        
        IMPORTANT RULES:
        - Available states: DRAFT, REVIEW, PENDING_APPROVAL, APPROVED, REJECTED, CORRECTION, ARCHIVED, CANCELLED, ESCALATED
        - Every workflow MUST include DRAFT as the initial state
        - Every workflow MUST include at least APPROVED and CANCELLED as final states
        - Transitions have: "from" (source state), "to" (target state), "action" (verb like submit, approve, reject, resubmit, cancel, archive, escalate)
        - DRAFT should transition to the next review/approval state via "submit"
        - Include "cancel" transitions from non-terminal states
        - Escalation rules are optional: define "state", "slaHours", "maxLevel", "notifyRole"
        
        Respond with ONLY valid JSON (no markdown, no explanation) in this exact format:
        {
          "name": "Workflow Name",
          "description": "Brief description",
          "states": ["DRAFT", "REVIEW", ...],
          "transitions": [
            {"from": "DRAFT", "to": "REVIEW", "action": "submit"},
            ...
          ],
          "initialState": "DRAFT",
          "humanReviewRequired": true/false,
          "escalationRules": []
        }
        """;

    public CreateDefinitionRequest generateWorkflowDefinition(String userPrompt) {
        log.info("Generating workflow definition from prompt: {}", userPrompt);

        String url = ollamaHost + "/api/generate";

        Map<String, Object> body = new HashMap<>();
        body.put("model", ollamaModel);
        body.put("prompt", SYSTEM_PROMPT + "\n\nUser request: " + userPrompt);
        body.put("stream", false);
        body.put("format", "json");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            String responseBody = response.getBody();
            log.debug("Ollama raw response: {}", responseBody);

            JsonNode root = objectMapper.readTree(responseBody);
            String generatedText = root.has("response") ? root.get("response").asText() : responseBody;

            // Extract JSON from the response
            String json = extractJson(generatedText);
            log.debug("Extracted JSON: {}", json);

            return parseWorkflowJson(json);
        } catch (Exception e) {
            log.error("Failed to generate workflow via Ollama: {}", e.getMessage());
            // Return a sensible default based on the prompt
            return buildFallbackDefinition(userPrompt);
        }
    }

    public boolean isAvailable() {
        try {
            String url = ollamaHost + "/api/tags";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            return false;
        }
    }

    private String extractJson(String text) {
        // Find JSON object in the response
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return text;
    }

    @SuppressWarnings("unchecked")
    private CreateDefinitionRequest parseWorkflowJson(String json) throws Exception {
        Map<String, Object> parsed = objectMapper.readValue(json, new TypeReference<>() {});

        CreateDefinitionRequest request = new CreateDefinitionRequest();
        request.setName((String) parsed.getOrDefault("name", "AI Generated Workflow"));
        request.setDescription((String) parsed.getOrDefault("description", ""));

        // Parse states
        Object statesObj = parsed.get("states");
        if (statesObj instanceof List) {
            request.setStates((List<String>) statesObj);
        } else {
            request.setStates(List.of("DRAFT", "REVIEW", "PENDING_APPROVAL", "APPROVED", "CANCELLED"));
        }

        // Parse transitions
        Object transObj = parsed.get("transitions");
        if (transObj instanceof List) {
            List<Map<String, Object>> transitions = new ArrayList<>();
            for (Object t : (List<?>) transObj) {
                if (t instanceof Map) {
                    transitions.add((Map<String, Object>) t);
                }
            }
            request.setTransitions(transitions);
        } else {
            request.setTransitions(buildDefaultTransitions(request.getStates()));
        }

        request.setInitialState((String) parsed.getOrDefault("initialState", "DRAFT"));
        request.setHumanReviewRequired(parsed.get("humanReviewRequired") instanceof Boolean b ? b : true);

        Object escalation = parsed.get("escalationRules");
        if (escalation instanceof List) {
            request.setEscalationRules((List<Map<String, Object>>) escalation);
        }

        return request;
    }

    private CreateDefinitionRequest buildFallbackDefinition(String prompt) {
        CreateDefinitionRequest request = new CreateDefinitionRequest();
        String name = prompt.length() > 50 ? prompt.substring(0, 50) + "..." : prompt;
        request.setName("AI: " + name);
        request.setDescription("AI-generated workflow based on: " + prompt);
        request.setStates(List.of("DRAFT", "REVIEW", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CORRECTION", "CANCELLED"));
        request.setTransitions(buildDefaultTransitions(request.getStates()));
        request.setInitialState("DRAFT");
        request.setHumanReviewRequired(true);
        return request;
    }

    private List<Map<String, Object>> buildDefaultTransitions(List<String> states) {
        List<Map<String, Object>> transitions = new ArrayList<>();
        transitions.add(Map.of("from", "DRAFT", "to", "REVIEW", "action", "submit"));
        transitions.add(Map.of("from", "DRAFT", "to", "CANCELLED", "action", "cancel"));

        if (states.contains("REVIEW")) {
            transitions.add(Map.of("from", "REVIEW", "to", "PENDING_APPROVAL", "action", "approve"));
            if (states.contains("CORRECTION")) {
                transitions.add(Map.of("from", "REVIEW", "to", "CORRECTION", "action", "reject"));
            }
            transitions.add(Map.of("from", "REVIEW", "to", "CANCELLED", "action", "cancel"));
        }

        if (states.contains("PENDING_APPROVAL")) {
            transitions.add(Map.of("from", "PENDING_APPROVAL", "to", "APPROVED", "action", "approve"));
            if (states.contains("CORRECTION")) {
                transitions.add(Map.of("from", "PENDING_APPROVAL", "to", "CORRECTION", "action", "reject"));
            }
            transitions.add(Map.of("from", "PENDING_APPROVAL", "to", "CANCELLED", "action", "cancel"));
        }

        if (states.contains("CORRECTION")) {
            transitions.add(Map.of("from", "CORRECTION", "to", "REVIEW", "action", "resubmit"));
            transitions.add(Map.of("from", "CORRECTION", "to", "CANCELLED", "action", "cancel"));
        }

        if (states.contains("APPROVED") && states.contains("ARCHIVED")) {
            transitions.add(Map.of("from", "APPROVED", "to", "ARCHIVED", "action", "archive"));
        }

        return transitions;
    }
}
