package com.apexnexus.auth.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.auth.dto.IndustryTemplateDto;
import com.apexnexus.auth.service.IndustryTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/auth/industry-templates")
@RequiredArgsConstructor
public class IndustryTemplateController {

    private final IndustryTemplateService templateService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<IndustryTemplateDto>>> getActiveTemplates() {
        return ResponseEntity.ok(ApiResponse.success(templateService.getActiveTemplates()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<IndustryTemplateDto>> getTemplate(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(templateService.getTemplate(id)));
    }

    @GetMapping("/by-name/{name}")
    public ResponseEntity<ApiResponse<IndustryTemplateDto>> getTemplateByName(@PathVariable String name) {
        return ResponseEntity.ok(ApiResponse.success(templateService.getTemplateByName(name)));
    }

    @GetMapping("/by-industry/{industry}")
    public ResponseEntity<ApiResponse<List<IndustryTemplateDto>>> getTemplatesByIndustry(@PathVariable String industry) {
        return ResponseEntity.ok(ApiResponse.success(templateService.getTemplatesByIndustry(industry)));
    }
}
