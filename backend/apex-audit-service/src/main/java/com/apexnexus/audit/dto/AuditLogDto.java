package com.apexnexus.audit.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class AuditLogDto {
    private UUID id;
    private UUID userId;
    private String username;
    private String actorType;  // HUMAN or AI_SERVICE
    private String action;
    private String resourceType;
    private UUID resourceId;
    private String resourceName;
    private UUID projectId;
    private Map<String, Object> details;
    private String ipAddress;
    private String userAgent;
    private LocalDateTime createdAt;
}
