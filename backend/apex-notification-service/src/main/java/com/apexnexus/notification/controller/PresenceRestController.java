package com.apexnexus.notification.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.notification.service.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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

    /**
     * REST heartbeat/join endpoint — allows frontends that do not have an active WebSocket
     * connection to register and maintain presence via periodic POSTs.
     */
    @PostMapping("/{documentId}/heartbeat")
    public ResponseEntity<ApiResponse<Map<String, Object>>> heartbeat(
            @PathVariable String documentId,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String displayName,
            Authentication auth) {
        String userId = auth.getPrincipal().toString();
        String uname = username != null ? username : auth.getName();
        String dname = displayName != null ? displayName : uname;
        // joinDocument is idempotent-enough: it re-adds the member with a fresh score.
        presenceService.joinDocument(documentId, userId, uname, dname);
        List<PresenceService.ViewerInfo> viewers = presenceService.getViewers(documentId);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "documentId", documentId,
                "viewers", viewers,
                "count", viewers.size()
        )));
    }

    @DeleteMapping("/{documentId}")
    public ResponseEntity<ApiResponse<Void>> leave(@PathVariable String documentId, Authentication auth) {
        String userId = auth.getPrincipal().toString();
        presenceService.leaveDocument(documentId, userId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
