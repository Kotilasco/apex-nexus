package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.document.service.VendorPortalService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequiredArgsConstructor
public class VendorPortalController {

    private final VendorPortalService service;

    // ---------- Admin-facing (authenticated) ----------

    @PostMapping("/vendor-portals")
    public ApiResponse<Map<String, Object>> create(@RequestBody CreateReq req) {
        return ApiResponse.ok(service.create(
            req.vendorCode, req.vendorName, req.contactEmail,
            req.projectId, req.requiredDocs,
            req.expiryDays == null ? 30 : req.expiryDays));
    }

    @GetMapping("/vendor-portals")
    public ApiResponse<List<Map<String, Object>>> list() {
        return ApiResponse.ok(service.list());
    }

    @GetMapping("/vendor-portals/summary")
    public ApiResponse<Map<String, Object>> summary() {
        return ApiResponse.ok(service.summary());
    }

    @GetMapping("/vendor-portals/{id}")
    public ApiResponse<Map<String, Object>> get(@PathVariable UUID id) {
        return ApiResponse.ok(service.get(id));
    }

    @PostMapping("/vendor-portals/{id}/revoke")
    public ApiResponse<Map<String, Object>> revoke(@PathVariable UUID id) {
        return ApiResponse.ok(service.revoke(id));
    }

    @PostMapping("/vendor-portals/uploads/{uploadId}/approve")
    public ApiResponse<Map<String, Object>> approve(@PathVariable UUID uploadId,
                                                    @RequestBody(required = false) NoteReq body) {
        return ApiResponse.ok(service.approveUpload(uploadId, body == null ? null : body.notes));
    }

    @PostMapping("/vendor-portals/uploads/{uploadId}/reject")
    public ApiResponse<Map<String, Object>> reject(@PathVariable UUID uploadId,
                                                   @RequestBody(required = false) NoteReq body) {
        return ApiResponse.ok(service.rejectUpload(uploadId, body == null ? null : body.notes));
    }

    @PostMapping("/vendor-portals/{id}/compliance-docs")
    public ApiResponse<Map<String, Object>> addComplianceDoc(@PathVariable UUID id,
                                                              @RequestBody ComplianceDocReq req) {
        LocalDate exp = LocalDate.parse(req.expiresOn);
        LocalDate from = req.validFrom == null ? null : LocalDate.parse(req.validFrom);
        return ApiResponse.ok(service.addComplianceDoc(id, req.docType, req.label, exp, from, req.uploadId));
    }

    @DeleteMapping("/vendor-portals/compliance-docs/{cdId}")
    public ApiResponse<Void> removeComplianceDoc(@PathVariable UUID cdId) {
        service.removeComplianceDoc(cdId);
        return ApiResponse.ok(null);
    }

    // ---------- Public (vendor-facing, no JWT required) ----------

    @GetMapping("/public/vendor-portal/{token}")
    public ApiResponse<Map<String, Object>> verify(@PathVariable String token,
                                                    HttpServletRequest http) {
        try {
            service.logView(token, null, clientIp(http), http.getHeader("User-Agent"));
            return ApiResponse.ok(service.verifyToken(token));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/public/vendor-portal/{token}/upload")
    public ApiResponse<Map<String, Object>> upload(@PathVariable String token,
                                                   @RequestParam("file") MultipartFile file,
                                                   HttpServletRequest http) {
        try {
            return ApiResponse.ok(service.acceptUpload(token, file,
                clientIp(http), http.getHeader("User-Agent")));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    private String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return req.getRemoteAddr();
    }

    @Data public static class CreateReq {
        private String vendorCode;
        private String vendorName;
        private String contactEmail;
        private UUID projectId;
        private List<String> requiredDocs;
        private Integer expiryDays;
    }

    @Data public static class NoteReq {
        private String notes;
    }

    @Data public static class ComplianceDocReq {
        private String docType;
        private String label;
        private String expiresOn;   // ISO yyyy-MM-dd
        private String validFrom;   // optional ISO yyyy-MM-dd
        private UUID uploadId;      // optional — link to an existing upload
    }
}
