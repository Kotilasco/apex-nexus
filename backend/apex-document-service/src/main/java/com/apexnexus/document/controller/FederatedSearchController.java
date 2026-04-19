package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.document.service.FederatedSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/federated")
@RequiredArgsConstructor
public class FederatedSearchController {

    private final FederatedSearchService service;

    @GetMapping("/sources")
    public ApiResponse<List<Map<String, Object>>> sources() {
        return ApiResponse.ok(service.listSources());
    }

    @GetMapping("/search")
    public ApiResponse<Map<String, Object>> search(
            @RequestParam String q,
            @RequestParam(required = false) List<String> types) {
        Set<String> typeSet = (types == null) ? null : new HashSet<>(types);
        return ApiResponse.ok(service.search(q, typeSet));
    }

    @PostMapping("/sources/{id}/toggle")
    public ApiResponse<Map<String, Object>> toggle(@PathVariable UUID id,
                                                   @RequestParam boolean enabled) {
        return ApiResponse.ok(service.toggleSource(id, enabled));
    }

    @PostMapping("/sources")
    public ApiResponse<Map<String, Object>> create(@RequestBody CreateSourceReq req) {
        return ApiResponse.ok(service.createSource(
                req.name, req.sourceType, req.endpointUrl, req.authConfig, req.docCountEstimate));
    }

    @PatchMapping("/sources/{id}")
    public ApiResponse<Map<String, Object>> update(@PathVariable UUID id,
                                                    @RequestBody Map<String, Object> patch) {
        return ApiResponse.ok(service.updateSource(id, patch));
    }

    @DeleteMapping("/sources/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.deleteSource(id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/sources/{id}/test")
    public ApiResponse<Map<String, Object>> test(@PathVariable UUID id) {
        return ApiResponse.ok(service.testSource(id));
    }

    @GetMapping("/email-mailboxes")
    public ApiResponse<List<Map<String, Object>>> emailMailboxes() {
        return ApiResponse.ok(service.listImportableEmailMailboxes());
    }

    @PostMapping("/import-from-email")
    public ApiResponse<Map<String, Object>> importFromEmail() {
        return ApiResponse.ok(service.importFromEmailIngestion());
    }

    public static class CreateSourceReq {
        public String name;
        public String sourceType;   // EXCHANGE | GMAIL | SHAREPOINT | NETWORK_SHARE | LEGACY_ECM
        public String endpointUrl;  // e.g. "user@outlook.office365.com"
        public String authConfig;   // JSON string — client secret / app id / token
        public Integer docCountEstimate;
    }
}
