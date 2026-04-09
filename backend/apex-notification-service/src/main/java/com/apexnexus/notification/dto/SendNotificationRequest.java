package com.apexnexus.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class SendNotificationRequest {
    @NotNull(message = "User ID is required")
    private UUID userId;

    @NotBlank(message = "Type is required")
    private String type;

    @NotBlank(message = "Title is required")
    private String title;

    private String message;
    private String resourceType;
    private UUID resourceId;
    private Boolean sendEmail;
}
