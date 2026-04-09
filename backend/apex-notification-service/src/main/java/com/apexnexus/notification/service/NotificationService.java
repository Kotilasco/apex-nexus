package com.apexnexus.notification.service;

import com.apexnexus.notification.dto.NotificationDto;
import com.apexnexus.notification.dto.SendNotificationRequest;
import com.apexnexus.notification.model.Notification;
import com.apexnexus.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final JavaMailSender mailSender;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${notification.from-email}")
    private String fromEmail;

    @Transactional
    public NotificationDto send(SendNotificationRequest request) {
        Notification notification = Notification.builder()
                .userId(request.getUserId())
                .type(request.getType())
                .title(request.getTitle())
                .message(request.getMessage())
                .resourceType(request.getResourceType())
                .resourceId(request.getResourceId())
                .build();

        notification = notificationRepository.save(notification);

        // Send real-time WebSocket notification
        NotificationDto dto = toDto(notification);
        try {
            messagingTemplate.convertAndSendToUser(
                    request.getUserId().toString(),
                    "/queue/notifications",
                    dto);
        } catch (Exception e) {
            log.debug("WebSocket delivery failed (user may be offline): {}", e.getMessage());
        }

        // Send email if requested
        if (Boolean.TRUE.equals(request.getSendEmail())) {
            sendEmail(request);
            notification.setEmailSent(true);
            notificationRepository.save(notification);
        }

        log.debug("Notification sent to user {}: {}", request.getUserId(), request.getTitle());
        return dto;
    }

    public Page<NotificationDto> getNotifications(UUID userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable).map(this::toDto);
    }

    public Page<NotificationDto> getUnreadNotifications(UUID userId, Pageable pageable) {
        return notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId, pageable).map(this::toDto);
    }

    public long getUnreadCount(UUID userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional
    public void markAsRead(UUID notificationId, UUID userId) {
        notificationRepository.markAsRead(notificationId, userId);
    }

    @Transactional
    public void markAllAsRead(UUID userId) {
        notificationRepository.markAllAsRead(userId);
    }

    private void sendEmail(SendNotificationRequest request) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(request.getUserId() + "@apexnexus.local"); // placeholder; in real app, look up user email
            message.setSubject("[Apex Nexus] " + request.getTitle());
            message.setText(request.getMessage() != null ? request.getMessage() : request.getTitle());
            mailSender.send(message);
            log.debug("Email sent for notification to user {}", request.getUserId());
        } catch (Exception e) {
            log.error("Failed to send notification email: {}", e.getMessage());
        }
    }

    private NotificationDto toDto(Notification n) {
        return NotificationDto.builder()
                .id(n.getId())
                .type(n.getType())
                .title(n.getTitle())
                .message(n.getMessage())
                .resourceType(n.getResourceType())
                .resourceId(n.getResourceId())
                .isRead(n.getIsRead())
                .readAt(n.getReadAt())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
