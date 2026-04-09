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

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatus() {
        boolean available = aiService.isAvailable();
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "available", available,
                "service", "ollama"
        )));
    }
}
