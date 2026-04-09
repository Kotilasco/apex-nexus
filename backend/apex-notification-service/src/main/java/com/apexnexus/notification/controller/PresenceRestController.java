package com.apexnexus.notification.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.notification.service.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST endpoint for querying document presence (who is currently viewing).
 */
@RestController
@RequestMapping("/notifications/presence")
@RequiredArgsConstructor
public class PresenceRestController {

    private final PresenceService presenceService;

    @GetMapping("/{documentId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPresence(@PathVariable String documentId) {
        List<PresenceService.ViewerInfo> viewers = presenceService.getViewers(documentId);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "documentId", documentId,
                "viewers", viewers,
                "count", viewers.size()
        )));
    }
}
