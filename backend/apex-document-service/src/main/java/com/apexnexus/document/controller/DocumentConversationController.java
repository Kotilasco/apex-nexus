package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.document.service.DocumentConversationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequiredArgsConstructor
public class DocumentConversationController {

    private final DocumentConversationService service;

    @GetMapping("/documents/{documentId}/conversations")
    public ApiResponse<List<Map<String, Object>>> listForDocument(@PathVariable UUID documentId) {
        return ApiResponse.ok(service.listForDocument(documentId));
    }

    @GetMapping("/documents/versions/{versionId}/conversations")
    public ApiResponse<List<Map<String, Object>>> listForVersion(@PathVariable UUID versionId) {
        return ApiResponse.ok(service.listForVersion(versionId));
    }

    @PostMapping("/documents/{documentId}/conversations")
    public ApiResponse<Map<String, Object>> save(@PathVariable UUID documentId, @RequestBody SaveReq req) {
        return ApiResponse.ok(service.save(documentId, req.versionId, req.title, req.question, req.answer));
    }

    @DeleteMapping("/documents/conversations/{id}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.ok(Map.of("deleted", true));
    }

    public static class SaveReq {
        public UUID versionId;
        public String title;
        public String question;
        public String answer;
    }
}
