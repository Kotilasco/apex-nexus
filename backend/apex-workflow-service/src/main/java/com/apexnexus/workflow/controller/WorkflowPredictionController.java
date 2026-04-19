package com.apexnexus.workflow.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.workflow.service.WorkflowPredictionService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/workflows/predictions")
@RequiredArgsConstructor
public class WorkflowPredictionController {

    private final WorkflowPredictionService service;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list() {
        return ApiResponse.ok(service.listPredictions());
    }

    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary() {
        return ApiResponse.ok(service.summary());
    }

    @PostMapping("/refresh")
    public ApiResponse<Map<String, Object>> refresh() {
        return ApiResponse.ok(service.computeAll());
    }

    @PostMapping("/{instanceId}/reassign")
    public ApiResponse<Map<String, Object>> reassign(@PathVariable UUID instanceId,
                                                     @RequestBody ReassignReq req) {
        return ApiResponse.ok(service.reassign(instanceId, req.userId));
    }

    @Data public static class ReassignReq { private UUID userId; }
}
