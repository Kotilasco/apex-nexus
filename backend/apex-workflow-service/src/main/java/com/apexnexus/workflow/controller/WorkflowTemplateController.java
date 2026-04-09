package com.apexnexus.workflow.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.workflow.dto.WorkflowTemplateDto;
import com.apexnexus.workflow.service.WorkflowTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/workflows/templates")
@RequiredArgsConstructor
public class WorkflowTemplateController {

    private final WorkflowTemplateService templateService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<WorkflowTemplateDto>>> getTemplates() {
        return ResponseEntity.ok(ApiResponse.success(templateService.getActiveTemplates()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<WorkflowTemplateDto>> getTemplate(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(templateService.getTemplate(id)));
    }

    @GetMapping("/by-name/{name}")
    public ResponseEntity<ApiResponse<WorkflowTemplateDto>> getTemplateByName(@PathVariable String name) {
        return ResponseEntity.ok(ApiResponse.success(templateService.getTemplateByName(name)));
    }

    @GetMapping("/by-category/{category}")
    public ResponseEntity<ApiResponse<List<WorkflowTemplateDto>>> getTemplatesByCategory(@PathVariable String category) {
        return ResponseEntity.ok(ApiResponse.success(templateService.getTemplatesByCategory(category)));
    }

    @GetMapping("/by-industry/{industry}")
    public ResponseEntity<ApiResponse<List<WorkflowTemplateDto>>> getTemplatesByIndustry(@PathVariable String industry) {
        return ResponseEntity.ok(ApiResponse.success(templateService.getTemplatesByIndustry(industry)));
    }
}
