package com.apexnexus.audit.service;

import com.apexnexus.audit.dto.AuditLogDto;
import com.apexnexus.audit.dto.AuditStatsDto;
import com.apexnexus.audit.model.AuditLogEntry;
import com.apexnexus.audit.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuditQueryService {

    private final AuditLogRepository auditLogRepository;

    public Page<AuditLogDto> getByUser(UUID userId, Pageable pageable) {
        return auditLogRepository.findByUserId(userId, pageable).map(this::toDto);
    }

    public Page<AuditLogDto> getByAction(String action, Pageable pageable) {
        return auditLogRepository.findByAction(action, pageable).map(this::toDto);
    }

    public Page<AuditLogDto> getByResource(String resourceType, UUID resourceId, Pageable pageable) {
        return auditLogRepository.findByResourceTypeAndResourceId(resourceType, resourceId, pageable).map(this::toDto);
    }

    public Page<AuditLogDto> getByResourceType(String resourceType, Pageable pageable) {
        return auditLogRepository.findByResourceType(resourceType, pageable).map(this::toDto);
    }

    public Page<AuditLogDto> getByDateRange(LocalDateTime from, LocalDateTime to, Pageable pageable) {
        return auditLogRepository.findByDateRange(from, to, pageable).map(this::toDto);
    }

    public Page<AuditLogDto> getByUserAndDateRange(UUID userId, LocalDateTime from, LocalDateTime to, Pageable pageable) {
        return auditLogRepository.findByUserIdAndDateRange(userId, from, to, pageable).map(this::toDto);
    }

    public Page<AuditLogDto> getByActorType(String actorType, Pageable pageable) {
        return auditLogRepository.findByActorType(actorType, pageable).map(this::toDto);
    }

    public Page<AuditLogDto> getByProject(UUID projectId, Pageable pageable) {
        return auditLogRepository.findByProjectId(projectId, pageable).map(this::toDto);
    }

    public Page<AuditLogDto> getRecent(Pageable pageable) {
        return auditLogRepository.findAll(pageable).map(this::toDto);
    }

    public AuditStatsDto getStats(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);

        List<Object[]> actionCounts = auditLogRepository.getActionCounts(since);
        Map<String, Long> actionMap = new LinkedHashMap<>();
        for (Object[] row : actionCounts) {
            actionMap.put((String) row[0], (Long) row[1]);
        }

        List<Object[]> userCounts = auditLogRepository.getMostActiveUsers(since);
        Map<String, Long> userMap = new LinkedHashMap<>();
        for (Object[] row : userCounts) {
            UUID userId = (UUID) row[0];
            userMap.put(userId != null ? userId.toString() : "SYSTEM", (Long) row[1]);
        }

        List<Object[]> actorTypeCounts = auditLogRepository.getActorTypeCounts(since);
        Map<String, Long> actorTypeMap = new LinkedHashMap<>();
        for (Object[] row : actorTypeCounts) {
            String actorType = row[0] != null ? (String) row[0] : "HUMAN";
            actorTypeMap.put(actorType, (Long) row[1]);
        }

        return AuditStatsDto.builder()
                .period(days + " days")
                .actionCounts(actionMap)
                .mostActiveUsers(userMap)
                .actorTypeCounts(actorTypeMap)
                .totalEvents(actionMap.values().stream().mapToLong(Long::longValue).sum())
                .build();
    }

    private AuditLogDto toDto(AuditLogEntry entry) {
        return AuditLogDto.builder()
                .id(entry.getId())
                .userId(entry.getUserId())
                .username(entry.getUsername())
                .actorType(entry.getActorType())
                .action(entry.getAction())
                .resourceType(entry.getResourceType())
                .resourceId(entry.getResourceId())
                .resourceName(entry.getResourceName())
                .projectId(entry.getProjectId())
                .details(entry.getDetails())
                .ipAddress(entry.getIpAddress())
                .userAgent(entry.getUserAgent())
                .createdAt(entry.getCreatedAt())
                .build();
    }
}
