package com.apexnexus.document.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket configuration for real-time lock status updates.
 *
 * Clients subscribe to:
 *   /topic/locks/{documentId}  → lock status changes (locked, unlocked, heartbeat, typing)
 *
 * Clients send to:
 *   /app/locks/{documentId}/heartbeat → heartbeat signal
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws/documents")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
