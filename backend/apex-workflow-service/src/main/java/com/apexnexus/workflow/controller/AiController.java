package com.apexnexus.workflow.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.workflow.dto.AiGenerateWorkflowRequest;
import com.apexnexus.workflow.dto.CreateDefinitionRequest;
import com.apexnexus.workflow.service.AiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    @PostMapping("/generate-workflow")
    public ResponseEntity<ApiResponse<CreateDefinitionRequest>> generateWorkflow(
            @Valid @RequestBody AiGenerateWorkflowRequest request) {
        CreateDefinitionRequest definition = aiService.generateWorkflowDefinition(request.getPrompt());
        return ResponseEntity.ok(ApiResponse.success(definition));
    }

    @PostMapping("/summarize")
    public ResponseEntity<ApiResponse<Map<String, String>>> summarizeDocument(
            @RequestBody Map<String, String> request) {
        String content = request.getOrDefault("content", "");
        String title = request.getOrDefault("title", "Untitled");
        if (content.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Document content is required"));
        }
        String summary = aiService.summarizeDocument(content, title);
        return ResponseEntity.ok(ApiResponse.success(Map.of("summary", summary)));
    }

    @PostMapping("/ask")
    public ResponseEntity<ApiResponse<Map<String, String>>> askQuestion(
            @RequestBody Map<String, String> request) {
        String content = request.getOrDefault("content", "");
        String title = request.getOrDefault("title", "Untitled");
        String question = request.getOrDefault("question", "");
        if (content.isBlank() || question.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Document content and question are required"));
        }
        String answer = aiService.askDocumentQuestion(content, title, question);
        return ResponseEntity.ok(ApiResponse.success(Map.of("answer", answer)));
    }

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatus() {
        boolean available = aiService.isAvailable();
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "available", available,
                "service", "ollama"
        )));
    }
}
