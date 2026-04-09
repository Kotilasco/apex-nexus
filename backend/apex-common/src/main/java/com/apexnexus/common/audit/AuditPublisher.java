package com.apexnexus.common.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AuditPublisher {

    private static final String AUDIT_STREAM = "apex:audit:events";

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    public void publish(AuditEvent event) {
        try {
            String json = objectMapper.writeValueAsString(event);
            redisTemplate.opsForList().rightPush(AUDIT_STREAM, json);
        } catch (Exception e) {
            log.error("Failed to publish audit event: {}", event, e);
        }
    }
}
