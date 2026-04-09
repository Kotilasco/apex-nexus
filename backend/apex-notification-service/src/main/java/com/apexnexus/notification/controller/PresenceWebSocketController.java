package com.apexnexus.notification.controller;

import com.apexnexus.notification.service.PresenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.util.Map;

/**
 * WebSocket controller for real-time document presence.
 * Clients send STOMP messages to /app/presence/... and receive broadcasts on /topic/document/{id}/presence.
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class PresenceWebSocketController {

    private final PresenceService presenceService;

    /**
     * User joins a document view.
     * Client sends to: /app/presence/join/{documentId}
     */
    @MessageMapping("/presence/join/{documentId}")
    public void joinDocument(
            @DestinationVariable String documentId,
            @Payload Map<String, String> payload,
            SimpMessageHeaderAccessor headerAccessor) {
        String userId = payload.get("userId");
        String username = payload.get("username");
        String displayName = payload.getOrDefault("displayName", username);

        if (userId != null && username != null) {
            presenceService.joinDocument(documentId, userId, username, displayName);

            // Store in session attributes for disconnect cleanup
            if (headerAccessor.getSessionAttributes() != null) {
                headerAccessor.getSessionAttributes().put("userId", userId);
                headerAccessor.getSessionAttributes().put("username", username);
                headerAccessor.getSessionAttributes().put("currentDocumentId", documentId);
            }
        }
    }

    /**
     * User leaves a document view.
     * Client sends to: /app/presence/leave/{documentId}
     */
    @MessageMapping("/presence/leave/{documentId}")
    public void leaveDocument(
            @DestinationVariable String documentId,
            @Payload Map<String, String> payload) {
        String userId = payload.get("userId");
        if (userId != null) {
            presenceService.leaveDocument(documentId, userId);
        }
    }

    /**
     * Heartbeat to maintain presence.
     * Client sends to: /app/presence/heartbeat/{documentId}
     */
    @MessageMapping("/presence/heartbeat/{documentId}")
    public void heartbeat(
            @DestinationVariable String documentId,
            @Payload Map<String, String> payload) {
        String userId = payload.get("userId");
        if (userId != null) {
            presenceService.heartbeat(documentId, userId);
        }
    }
}
