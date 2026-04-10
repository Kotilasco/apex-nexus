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
            // Auto-enrich from request context if not already set
            try {
                var ctx = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
                if (ctx instanceof org.springframework.web.context.request.ServletRequestAttributes sra) {
                    var request = sra.getRequest();
                    if (event.getUsername() == null) {
                        Object uname = request.getAttribute("currentUsername");
                        if (uname != null) {
                            event.setUsername(uname.toString());
                        }
                    }
                    if (event.getIpAddress() == null) {
                        String xff = request.getHeader("X-Forwarded-For");
                        event.setIpAddress(xff != null ? xff.split(",")[0].trim() : request.getRemoteAddr());
                    }
                    if (event.getUserAgent() == null) {
                        event.setUserAgent(request.getHeader("User-Agent"));
                    }
                }
            } catch (Exception ignored) { /* background threads won't have request context */ }
            String json = objectMapper.writeValueAsString(event);
            redisTemplate.opsForList().rightPush(AUDIT_STREAM, json);
        } catch (Exception e) {
            log.error("Failed to publish audit event: {}", event, e);
        }
    }
}
