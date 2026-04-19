package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.document.service.CaseManagementService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/cases")
@RequiredArgsConstructor
public class CaseController {

    private final CaseManagementService service;

    // ---- cases ----

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "100") int limit) {
        return ApiResponse.ok(service.list(status, category, limit));
    }

    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary() {
        return ApiResponse.ok(service.summary());
    }

    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> get(@PathVariable UUID id) {
        return ApiResponse.ok(service.get(id));
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> create(@RequestBody Map<String, Object> body) {
        return ApiResponse.ok(service.create(
            str(body, "title"), str(body, "description"),
            str(body, "category"), str(body, "priority"),
            uuid(body, "projectId")));
    }

    @PostMapping("/{id}/close")
    public ApiResponse<Map<String, Object>> close(@PathVariable UUID id,
                                                  @RequestBody Map<String, Object> body) {
        return ApiResponse.ok(service.close(id, str(body, "outcome")));
    }

    @PostMapping("/{id}/status")
    public ApiResponse<Map<String, Object>> status(@PathVariable UUID id,
                                                   @RequestBody Map<String, Object> body) {
        return ApiResponse.ok(service.updateStatus(id, str(body, "status")));
    }

    // ---- tasks ----

    @PostMapping("/{id}/tasks")
    public ApiResponse<Map<String, Object>> addTask(@PathVariable UUID id,
                                                    @RequestBody Map<String, Object> body) {
        OffsetDateTime due = null;
        if (body.get("dueAt") != null && !String.valueOf(body.get("dueAt")).isBlank()) {
            try { due = OffsetDateTime.parse(String.valueOf(body.get("dueAt"))); }
            catch (Exception ignored) {}
        }
        return ApiResponse.ok(service.addTask(id,
            str(body, "title"), str(body, "description"),
            uuid(body, "assigneeId"), due));
    }

    @PostMapping("/tasks/{taskId}/complete")
    public ApiResponse<Map<String, Object>> completeTask(@PathVariable UUID taskId) {
        return ApiResponse.ok(service.completeTask(taskId));
    }

    // ---- attachments ----

    @PostMapping("/{id}/documents/{documentId}")
    public ApiResponse<Map<String, Object>> attach(@PathVariable UUID id,
                                                   @PathVariable UUID documentId,
                                                   @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(service.attach(id, documentId,
            body == null ? null : str(body, "note")));
    }

    // ---- participants ----

    @PostMapping("/{id}/participants")
    public ApiResponse<Map<String, Object>> invite(@PathVariable UUID id,
                                                   @RequestBody Map<String, Object> body) {
        return ApiResponse.ok(service.invite(id,
            uuid(body, "userId"), str(body, "externalEmail"), str(body, "role")));
    }

    // ---- helpers ----

    private static String str(Map<String, Object> m, String k) {
        Object v = m.get(k); return v == null ? null : String.valueOf(v);
    }
    private static UUID uuid(Map<String, Object> m, String k) {
        Object v = m.get(k);
        if (v == null || String.valueOf(v).isBlank()) return null;
        try { return UUID.fromString(String.valueOf(v)); } catch (Exception e) { return null; }
    }
}
