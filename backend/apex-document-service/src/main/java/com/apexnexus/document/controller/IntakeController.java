package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.document.service.IntakeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@RestController
@RequestMapping("/intake")
@RequiredArgsConstructor
public class IntakeController {

    private final IntakeService intakeService;

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<IntakeService.BatchSubmitResult>> upload(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(value = "autoRoute", defaultValue = "true") boolean autoRoute,
            @RequestParam(value = "projectId", required = false) UUID projectId) {
        return ResponseEntity.ok(ApiResponse.ok(intakeService.submitBatch(files, autoRoute, projectId)));
    }

    @GetMapping("/batches/{batchId}")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> batch(@PathVariable UUID batchId) {
        return ResponseEntity.ok(ApiResponse.ok(intakeService.getBatch(batchId)));
    }

    @GetMapping("/batches")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> recentBatches() {
        return ResponseEntity.ok(ApiResponse.ok(intakeService.recentBatches()));
    }

    @PostMapping("/{intakeId}/route")
    public ResponseEntity<ApiResponse<Map<String, Object>>> route(
            @PathVariable UUID intakeId,
            @RequestBody(required = false) Map<String, Object> body) {
        UUID projectId = null;
        boolean startWorkflow = true;
        if (body != null) {
            Object pid = body.get("projectId");
            if (pid != null) projectId = UUID.fromString(pid.toString());
            if (body.get("startWorkflow") != null) startWorkflow = (Boolean) body.get("startWorkflow");
        }
        return ResponseEntity.ok(ApiResponse.ok(intakeService.route(intakeId, projectId, startWorkflow)));
    }
}
