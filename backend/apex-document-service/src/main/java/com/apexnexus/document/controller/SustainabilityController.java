package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.document.service.SustainabilityService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/sustainability")
@RequiredArgsConstructor
public class SustainabilityController {

    private final SustainabilityService service;

    @GetMapping("/snapshot")
    public ApiResponse<Map<String, Object>> latest() {
        return ApiResponse.ok(service.latest());
    }

    @PostMapping("/snapshot/refresh")
    public ApiResponse<Map<String, Object>> refresh() {
        return ApiResponse.ok(service.computeAndStore());
    }

    @GetMapping("/trend")
    public ApiResponse<List<Map<String, Object>>> trend(@RequestParam(defaultValue = "30") int days) {
        return ApiResponse.ok(service.trend(days));
    }
}
