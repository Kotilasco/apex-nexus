package com.apexnexus.audit.controller;

import com.apexnexus.audit.dto.AuditLogDto;
import com.apexnexus.audit.dto.AuditStatsDto;
import com.apexnexus.audit.model.AuditLogEntry;
import com.apexnexus.audit.repository.AuditLogRepository;
import com.apexnexus.audit.service.AuditQueryService;
import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.common.dto.PagedResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditQueryService auditQueryService;
    private final AuditLogRepository auditLogRepository;

    @GetMapping("/logs/by-user/{userId}")
    public ResponseEntity<ApiResponse<PagedResponse<AuditLogDto>>> getByUser(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<AuditLogDto> result = auditQueryService.getByUser(userId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.of(result)));
    }

    @GetMapping("/logs/by-action/{action}")
    public ResponseEntity<ApiResponse<PagedResponse<AuditLogDto>>> getByAction(
            @PathVariable String action,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<AuditLogDto> result = auditQueryService.getByAction(action,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.of(result)));
    }

    @GetMapping("/logs/by-resource/{resourceType}/{resourceId}")
    public ResponseEntity<ApiResponse<PagedResponse<AuditLogDto>>> getByResource(
            @PathVariable String resourceType,
            @PathVariable UUID resourceId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<AuditLogDto> result = auditQueryService.getByResource(resourceType, resourceId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.of(result)));
    }

    @GetMapping("/logs/by-resource-type/{resourceType}")
    public ResponseEntity<ApiResponse<PagedResponse<AuditLogDto>>> getByResourceType(
            @PathVariable String resourceType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<AuditLogDto> result = auditQueryService.getByResourceType(resourceType,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.of(result)));
    }

    @GetMapping("/logs/by-date")
    public ResponseEntity<ApiResponse<PagedResponse<AuditLogDto>>> getByDateRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<AuditLogDto> result;
        if (userId != null) {
            result = auditQueryService.getByUserAndDateRange(userId, from, to,
                    PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        } else {
            result = auditQueryService.getByDateRange(from, to,
                    PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        }
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.of(result)));
    }

    @GetMapping("/recent")
    public ResponseEntity<ApiResponse<PagedResponse<AuditLogDto>>> getRecent(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<AuditLogDto> result = auditQueryService.getRecent(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.of(result)));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<AuditStatsDto>> getStats(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.success(auditQueryService.getStats(days)));
    }

    @GetMapping("/logs/by-actor/{actorType}")
    public ResponseEntity<ApiResponse<PagedResponse<AuditLogDto>>> getByActorType(
            @PathVariable String actorType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<AuditLogDto> result = auditQueryService.getByActorType(actorType,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.of(result)));
    }

    @GetMapping("/logs/by-project/{projectId}")
    public ResponseEntity<ApiResponse<PagedResponse<AuditLogDto>>> getByProject(
            @PathVariable UUID projectId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<AuditLogDto> result = auditQueryService.getByProject(projectId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.of(result)));
    }

    // ============ SIGNED CSV EXPORT ============

    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportCsv(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        Page<AuditLogDto> result = auditQueryService.getByDateRange(from, to,
                PageRequest.of(0, 10000, Sort.by(Sort.Direction.ASC, "createdAt")));

        StringBuilder csv = new StringBuilder();
        csv.append("id,userId,actorType,action,resourceType,resourceId,projectId,ipAddress,createdAt\n");
        for (AuditLogDto log : result.getContent()) {
            csv.append(String.join(",",
                    str(log.getId()), str(log.getUserId()), str(log.getActorType()),
                    str(log.getAction()), str(log.getResourceType()), str(log.getResourceId()),
                    str(log.getProjectId()), str(log.getIpAddress()), str(log.getCreatedAt())
            )).append("\n");
        }

        byte[] csvBytes = csv.toString().getBytes(StandardCharsets.UTF_8);
        // HMAC-SHA256 integrity signature
        String hmac = computeHmac(csvBytes);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"audit_export_" + from.toLocalDate() + "_" + to.toLocalDate() + ".csv\"")
                .header("X-Audit-HMAC-SHA256", hmac)
                .header("X-Audit-Record-Count", String.valueOf(result.getContent().size()))
                .body(csvBytes);
    }

    // ============ CHAIN INTEGRITY VERIFICATION ============

    @GetMapping("/chain/verify")
    public ResponseEntity<ApiResponse<Map<String, Object>>> verifyChain(
            @RequestParam(required = false) Long fromSequence) {
        List<AuditLogEntry> entries = (fromSequence != null)
                ? auditLogRepository.findChainedEntriesFrom(fromSequence)
                : auditLogRepository.findAllChainedEntries();

        if (entries.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.success(Map.of(
                    "valid", true, "entriesChecked", 0, "message", "No chained entries found")));
        }

        // When verifying from a mid-point, seed previousHash from the actual chain
        String previousHash = (fromSequence != null && !entries.isEmpty())
                ? (entries.get(0).getPreviousHash() != null ? entries.get(0).getPreviousHash() : "GENESIS")
                : "GENESIS";
        int checked = 0;
        Long brokenAt = null;

        for (AuditLogEntry entry : entries) {
            if (entry.getEntryHash() == null) continue;

            // Verify previous hash linkage
            if (entry.getPreviousHash() != null && !entry.getPreviousHash().equals(previousHash)) {
                brokenAt = entry.getSequenceNumber();
                break;
            }

            // Recompute hash to verify integrity
            String recomputed = recomputeHash(entry);
            if (!recomputed.equals(entry.getEntryHash())) {
                brokenAt = entry.getSequenceNumber();
                break;
            }

            previousHash = entry.getEntryHash();
            checked++;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("valid", brokenAt == null);
        result.put("entriesChecked", checked);
        result.put("totalChainedEntries", entries.size());
        if (brokenAt != null) {
            result.put("brokenAtSequence", brokenAt);
            result.put("message", "Chain integrity broken at sequence " + brokenAt);
        } else {
            result.put("message", "All " + checked + " entries verified — chain is intact");
        }

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ============ HELPERS ============

    private String str(Object o) {
        return o != null ? o.toString().replace(",", ";") : "";
    }

    private String computeHmac(byte[] data) {
        try {
            // In production, use a configured secret key
            String secret = "apex-audit-export-hmac-key";
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hmac = mac.doFinal(data);
            return HexFormat.of().formatHex(hmac);
        } catch (Exception e) {
            return "ERROR";
        }
    }

    private String recomputeHash(AuditLogEntry entry) {
        try {
            String payload = String.join("|",
                    String.valueOf(entry.getSequenceNumber()),
                    entry.getPreviousHash() != null ? entry.getPreviousHash() : "GENESIS",
                    String.valueOf(entry.getUserId()),
                    entry.getAction() != null ? entry.getAction() : "",
                    entry.getResourceType() != null ? entry.getResourceType() : "",
                    String.valueOf(entry.getResourceId()),
                    String.valueOf(entry.getCreatedAt())
            );
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            return "ERROR";
        }
    }
}
