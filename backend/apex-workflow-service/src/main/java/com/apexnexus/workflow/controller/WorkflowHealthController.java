package com.apexnexus.workflow.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.workflow.service.WorkflowHealthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/workflows/health")
@RequiredArgsConstructor
public class WorkflowHealthController {

    private final WorkflowHealthService healthService;

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<Map<String, Object>>> overview(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.ok(healthService.overview(days)));
    }
}
