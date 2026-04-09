package com.apexnexus.notification.config;

import com.apexnexus.notification.service.PresenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;

/**
 * Listens for WebSocket disconnect events and cleans up presence state.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {

    private final PresenceService presenceService;

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        Map<String, Object> attrs = event.getMessage().getHeaders()
                .get("simpSessionAttributes", Map.class);

        if (attrs != null) {
            String userId = (String) attrs.get("userId");
            String documentId = (String) attrs.get("currentDocumentId");

            if (userId != null && documentId != null) {
                presenceService.leaveDocument(documentId, userId);
                log.debug("Cleaned up presence for disconnected user {} from document {}", userId, documentId);
            }
        }
    }
}
