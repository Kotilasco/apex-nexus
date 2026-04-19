package com.apexnexus.notification.service;

import com.apexnexus.common.notification.NotificationEvent;
import com.apexnexus.common.notification.NotificationPublisher;
import com.apexnexus.notification.dto.SendNotificationRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Drains the shared Redis notification stream and persists / delivers each
 * event via the local NotificationService. Runs every 2 seconds.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationEventConsumer {

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;

    @Scheduled(fixedDelay = 2000L)
    public void drain() {
        for (int i = 0; i < 100; i++) {
            String json = redisTemplate.opsForList().leftPop(NotificationPublisher.NOTIFICATION_STREAM);
            if (json == null) return;
            try {
                NotificationEvent evt = objectMapper.readValue(json, NotificationEvent.class);
                SendNotificationRequest req = new SendNotificationRequest();
                req.setUserId(evt.getUserId());
                req.setType(evt.getType() != null ? evt.getType() : "SYSTEM");
                req.setTitle(evt.getTitle() != null ? evt.getTitle() : "Notification");
                req.setMessage(evt.getMessage());
                req.setResourceType(evt.getResourceType());
                req.setResourceId(evt.getResourceId());
                req.setSendEmail(Boolean.TRUE.equals(evt.getSendEmail()));
                notificationService.send(req);
            } catch (Exception e) {
                log.warn("Failed to process notification event: {}", e.getMessage());
            }
        }
    }
}
