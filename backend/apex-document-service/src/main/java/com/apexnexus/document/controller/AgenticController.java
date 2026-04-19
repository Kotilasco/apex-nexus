package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.common.security.SecurityContextUtil;
import com.apexnexus.document.service.AgenticIntentService;
import com.apexnexus.document.service.MultiAgentOrchestratorService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/agentic")
@RequiredArgsConstructor
public class AgenticController {

    private final AgenticIntentService service;
    private final MultiAgentOrchestratorService orchestrator;

    @GetMapping("/suggestions")
    public ApiResponse<List<Map<String, Object>>> pending(
            @RequestParam(defaultValue = "50") int limit) {
        return ApiResponse.ok(service.listPending(limit));
    }

    @GetMapping("/suggestions/history")
    public ApiResponse<List<Map<String, Object>>> history(
            @RequestParam(defaultValue = "100") int limit) {
        return ApiResponse.ok(service.listAll(limit));
    }

    @PostMapping("/suggestions/{id}/accept")
    public ApiResponse<Map<String, Object>> accept(@PathVariable UUID id) {
        return ApiResponse.ok(service.accept(id, SecurityContextUtil.currentUserId()));
    }

    @PostMapping("/suggestions/{id}/dismiss")
    public ApiResponse<Map<String, Object>> dismiss(@PathVariable UUID id) {
        return ApiResponse.ok(service.dismiss(id, SecurityContextUtil.currentUserId()));
    }

    @PostMapping("/detect/{documentId}")
    public ApiResponse<Map<String, Object>> detect(@PathVariable UUID documentId) {
        service.detectForDocument(documentId);
        orchestrator.runAuditorFor(documentId);
        orchestrator.runBridgeFor(documentId);
        return ApiResponse.ok(Map.of("status", "DETECTION_RUN", "documentId", documentId,
                "agents", List.of("Intake Agent", "Auditor Agent", "Bridge Agent")));
    }

    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary() {
        return ApiResponse.ok(service.summary());
    }

    // ---- Multi-Agent team view ----

    @GetMapping("/team")
    public ApiResponse<List<Map<String, Object>>> team() {
        return ApiResponse.ok(orchestrator.teamSummary());
    }

    @PostMapping("/team/auditor/run")
    public ApiResponse<Map<String, Object>> runAuditor() {
        orchestrator.auditorSweep();
        return ApiResponse.ok(Map.of("status", "OK", "agent", "Auditor Agent", "ranAt", new Date()));
    }

    @PostMapping("/team/archivist/run")
    public ApiResponse<Map<String, Object>> runArchivist() {
        return ApiResponse.ok(orchestrator.runArchivistNow());
    }

    @PostMapping("/team/bridge/run")
    public ApiResponse<Map<String, Object>> runBridge() {
        return ApiResponse.ok(orchestrator.runBridgeSweepNow());
    }
}
