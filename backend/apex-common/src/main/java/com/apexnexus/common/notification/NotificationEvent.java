package com.apexnexus.common.notification;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Lightweight DTO used by any service to emit a notification. Consumed by the
 * notification-service via Redis list ("apex:notifications:events").
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationEvent {
    private UUID userId;
    /** e.g. DOCUMENT_CHECKED_IN, WORKFLOW_TASK_ASSIGNED, RETENTION_DESTRUCTION_PENDING, SYSTEM */
    private String type;
    private String title;
    private String message;
    private String resourceType;
    private UUID resourceId;
    private Boolean sendEmail;
}
