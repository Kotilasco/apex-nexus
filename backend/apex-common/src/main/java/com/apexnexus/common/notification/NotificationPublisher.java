package com.apexnexus.common.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Publishes notification events to a Redis list that the notification-service
 * consumes asynchronously. Fire-and-forget so slow mailers never block user
 * requests.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationPublisher {

    public static final String NOTIFICATION_STREAM = "apex:notifications:events";

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    public void publish(NotificationEvent event) {
        if (event == null || event.getUserId() == null) return;
        try {
            String json = objectMapper.writeValueAsString(event);
            redisTemplate.opsForList().rightPush(NOTIFICATION_STREAM, json);
        } catch (Exception e) {
            log.error("Failed to publish notification event: {}", event, e);
        }
    }
}
