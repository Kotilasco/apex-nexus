package com.apexnexus.common.audit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditEvent {
    private UUID userId;
    private String username;
    @Builder.Default
    private String actorType = "HUMAN";    // HUMAN or AI_SERVICE
    private String action;
    private String resourceType;
    private UUID resourceId;
    private String resourceName;
    private UUID projectId;                // project scope for the action
    private Map<String, Object> details;
    private String ipAddress;
    private String userAgent;
    private String sessionId;
}
