package com.apexnexus.workflow.controller;

import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.workflow.dto.AiGenerateWorkflowRequest;
import com.apexnexus.workflow.dto.CreateDefinitionRequest;
import com.apexnexus.workflow.service.AiService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
@Slf4j
public class AiController {

    private final AiService aiService;
    private final AuditPublisher auditPublisher;

    @PostMapping("/generate-workflow")
    public ResponseEntity<ApiResponse<CreateDefinitionRequest>> generateWorkflow(
            @Valid @RequestBody AiGenerateWorkflowRequest request,
            HttpServletRequest httpReq) {
        long t0 = System.currentTimeMillis();
        String status = "SUCCESS";
        CreateDefinitionRequest definition = null;
        try {
            definition = aiService.generateWorkflowDefinition(request.getPrompt());
            return ResponseEntity.ok(ApiResponse.success(definition));
        } catch (Exception e) {
            status = "ERROR";
            throw e;
        } finally {
            auditAi("AI_GENERATE_WORKFLOW", "WORKFLOW_DEFINITION", null,
                    Map.of(
                        "promptLength", request.getPrompt() != null ? request.getPrompt().length() : 0,
                        "status", status,
                        "latencyMs", System.currentTimeMillis() - t0,
                        "generatedName", definition != null && definition.getName() != null ? definition.getName() : ""
                    ), httpReq);
        }
    }

    @PostMapping("/summarize")
    public ResponseEntity<ApiResponse<Map<String, String>>> summarizeDocument(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpReq) {
        String content = request.getOrDefault("content", "");
        String title = request.getOrDefault("title", "Untitled");
        if (content.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Document content is required"));
        }
        long t0 = System.currentTimeMillis();
        String status = "SUCCESS";
        String summary = "";
        try {
            summary = aiService.summarizeDocument(content, title);
            return ResponseEntity.ok(ApiResponse.success(Map.of("summary", summary)));
        } catch (Exception e) {
            status = "ERROR";
            throw e;
        } finally {
            auditAi("AI_SUMMARIZE", "DOCUMENT", null, Map.of(
                    "title", title,
                    "contentLength", content.length(),
                    "status", status,
                    "latencyMs", System.currentTimeMillis() - t0,
                    "outputLength", summary != null ? summary.length() : 0
            ), httpReq);
        }
    }

    @PostMapping("/ask")
    public ResponseEntity<ApiResponse<Map<String, String>>> askQuestion(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpReq) {
        String content = request.getOrDefault("content", "");
        String title = request.getOrDefault("title", "Untitled");
        String question = request.getOrDefault("question", "");
        if (content.isBlank() || question.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Document content and question are required"));
        }
        long t0 = System.currentTimeMillis();
        String status = "SUCCESS";
        String answer = "";
        try {
            answer = aiService.askDocumentQuestion(content, title, question);
            return ResponseEntity.ok(ApiResponse.success(Map.of("answer", answer)));
        } catch (Exception e) {
            status = "ERROR";
            throw e;
        } finally {
            auditAi("AI_ASK", "DOCUMENT", null, Map.of(
                    "title", title,
                    "contentLength", content.length(),
                    "questionLength", question.length(),
                    "question", question.length() > 200 ? question.substring(0, 200) : question,
                    "status", status,
                    "latencyMs", System.currentTimeMillis() - t0,
                    "outputLength", answer != null ? answer.length() : 0
            ), httpReq);
        }
    }

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatus() {
        boolean available = aiService.isAvailable();
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "available", available,
                "service", "ollama"
        )));
    }

    private void auditAi(String action, String resourceType, UUID resourceId,
                          Map<String, Object> details, HttpServletRequest req) {
        try {
            UUID userId = null;
            String username = null;
            try {
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.getName() != null) {
                    try { userId = UUID.fromString(auth.getName()); } catch (IllegalArgumentException ignored) { username = auth.getName(); }
                }
            } catch (Exception ignored) { }
            Map<String, Object> enriched = new HashMap<>(details);
            enriched.put("model", "ollama");
            auditPublisher.publish(AuditEvent.builder()
                    .userId(userId)
                    .username(username)
                    .actorType("HUMAN")
                    .action(action)
                    .resourceType(resourceType)
                    .resourceId(resourceId)
                    .details(enriched)
                    .ipAddress(req != null ? req.getRemoteAddr() : null)
                    .userAgent(req != null ? req.getHeader("User-Agent") : null)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to audit AI invocation: {}", e.getMessage());
        }
    }
}
