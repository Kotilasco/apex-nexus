package com.apexnexus.retention.service;

import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.exception.BusinessException;
import com.apexnexus.common.exception.ResourceNotFoundException;
import com.apexnexus.retention.dto.*;
import com.apexnexus.retention.model.DispositionItem;
import com.apexnexus.retention.model.DispositionStatus;
import com.apexnexus.retention.model.RetentionPolicy;
import com.apexnexus.retention.repository.DispositionItemRepository;
import com.apexnexus.retention.repository.RetentionPolicyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RetentionService {

    private final RetentionPolicyRepository policyRepository;
    private final DispositionItemRepository dispositionRepository;
    private final AuditPublisher auditPublisher;
    private final JdbcTemplate jdbcTemplate;

    @Value("${retention.grace-period-days:30}")
    private int gracePeriodDays;

    // ==================== Policies ====================

    public List<RetentionPolicyDto> getActivePolicies() {
        return policyRepository.findByIsActiveTrue().stream()
                .map(this::toPolicyDto)
                .collect(Collectors.toList());
    }

    public RetentionPolicyDto getPolicy(UUID id) {
        return toPolicyDto(policyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("RetentionPolicy", "id", id)));
    }

    @Transactional
    public RetentionPolicyDto createPolicy(CreatePolicyRequest request, UUID userId) {
        RetentionPolicy policy = RetentionPolicy.builder()
                .name(request.getName())
                .description(request.getDescription())
                .retentionYears(request.getRetentionYears())
                .autoDispose(request.getAutoDispose() != null ? request.getAutoDispose() : false)
                .requiresApproval(request.getRequiresApproval() != null ? request.getRequiresApproval() : true)
                .build();
        policy = policyRepository.save(policy);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("RETENTION_POLICY_CREATED")
                .resourceType("RETENTION_POLICY")
                .resourceId(policy.getId())
                .details(Map.of("name", policy.getName(), "years", String.valueOf(policy.getRetentionYears())))
                .build());

        return toPolicyDto(policy);
    }

    // ==================== Scheduled Scan ====================

    @Scheduled(cron = "${retention.scan-cron:0 0 2 * * *}")
    @Transactional
    public void scanExpiredDocuments() {
        log.info("Starting retention scan for expired documents...");

        // Query documents where retention has expired and not already in disposition queue
        List<Map<String, Object>> expired = jdbcTemplate.queryForList(
                """
                SELECT d.id, d.title, d.retention_expiry
                FROM documents d
                WHERE d.retention_expiry IS NOT NULL
                  AND d.retention_expiry <= NOW()
                  AND d.status != 'DESTROYED'
                  AND d.legal_hold = false
                  AND NOT EXISTS (
                    SELECT 1 FROM disposition_queue dq
                    WHERE dq.document_id = d.id AND dq.status IN ('PENDING', 'APPROVED')
                  )
                """
        );

        int queued = 0;
        for (Map<String, Object> doc : expired) {
            UUID documentId = (UUID) doc.get("id");
            String title = (String) doc.get("title");
            java.sql.Timestamp expiresTs = (java.sql.Timestamp) doc.get("retention_expiry");
            LocalDateTime expiresAt = expiresTs != null ? expiresTs.toLocalDateTime() : LocalDateTime.now();

            DispositionItem item = DispositionItem.builder()
                    .documentId(documentId)
                    .documentTitle(title)
                    .retentionExpiresAt(expiresAt)
                    .scheduledDestructionDate(LocalDateTime.now().plusDays(gracePeriodDays))
                    .build();

            // Auto-approve since no policy lookup needed
            item.setStatus(DispositionStatus.PENDING);
            item.setReason("Retention period expired");

            dispositionRepository.save(item);
            queued++;

            auditPublisher.publish(AuditEvent.builder()
                    .userId(new UUID(0, 0))
                    .actorType("SYSTEM")
                    .action("DOCUMENT_QUEUED_FOR_DISPOSITION")
                    .resourceType("DOCUMENT")
                    .resourceId(documentId)
                    .details(Map.of("title", title, "expiresAt", expiresAt.toString()))
                    .build());
        }

        log.info("Retention scan complete. {} documents queued for disposition.", queued);
    }

    // ==================== Disposition Management ====================

    public Page<DispositionItemDto> getPendingDispositions(Pageable pageable) {
        return dispositionRepository.findByStatus(DispositionStatus.PENDING, pageable)
                .map(this::toDispositionDto);
    }

    public DispositionItemDto getDispositionItem(UUID id) {
        return toDispositionDto(dispositionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispositionItem", "id", id)));
    }

    @Transactional
    public DispositionItemDto approveDisposition(UUID id, UUID userId, String reason) {
        DispositionItem item = dispositionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispositionItem", "id", id));

        if (item.getStatus() != DispositionStatus.PENDING) {
            throw new BusinessException("Disposition is not pending: " + item.getStatus());
        }

        item.setStatus(DispositionStatus.APPROVED);
        item.setApprovedBy(userId);
        item.setApprovedAt(LocalDateTime.now());
        item.setReason(reason);
        dispositionRepository.save(item);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("DISPOSITION_APPROVED")
                .resourceType("DOCUMENT")
                .resourceId(item.getDocumentId())
                .details(Map.of("dispositionId", id.toString()))
                .build());

        return toDispositionDto(item);
    }

    @Transactional
    public DispositionItemDto rejectDisposition(UUID id, UUID userId, String reason) {
        DispositionItem item = dispositionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispositionItem", "id", id));

        if (item.getStatus() != DispositionStatus.PENDING) {
            throw new BusinessException("Disposition is not pending: " + item.getStatus());
        }

        item.setStatus(DispositionStatus.REJECTED);
        item.setReason(reason);
        dispositionRepository.save(item);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("DISPOSITION_REJECTED")
                .resourceType("DOCUMENT")
                .resourceId(item.getDocumentId())
                .details(Map.of("dispositionId", id.toString(), "reason", reason != null ? reason : ""))
                .build());

        return toDispositionDto(item);
    }

    @Transactional
    public DispositionItemDto holdDisposition(UUID id, UUID userId, String reason) {
        DispositionItem item = dispositionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("DispositionItem", "id", id));

        item.setStatus(DispositionStatus.ON_HOLD);
        item.setReason(reason);
        dispositionRepository.save(item);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("DISPOSITION_ON_HOLD")
                .resourceType("DOCUMENT")
                .resourceId(item.getDocumentId())
                .build());

        return toDispositionDto(item);
    }

    /**
     * Execute approved destructions where grace period has passed.
     * Marks documents as DESTROYED and removes physical storage.
     */
    @Scheduled(cron = "${retention.scan-cron:0 0 3 * * *}")
    @Transactional
    public void executeApprovedDestructions() {
        log.info("Executing approved document destructions...");

        List<DispositionItem> ready = dispositionRepository.findReadyForDestruction(
                DispositionStatus.APPROVED, LocalDateTime.now());

        for (DispositionItem item : ready) {
            // Update document status to DESTROYED
            jdbcTemplate.update(
                    "UPDATE documents SET status = 'DESTROYED', updated_at = NOW() WHERE id = ?",
                    item.getDocumentId());

            item.setStatus(DispositionStatus.DESTROYED);
            item.setDestroyedAt(LocalDateTime.now());
            dispositionRepository.save(item);

            auditPublisher.publish(AuditEvent.builder()
                    .userId(new UUID(0, 0))
                    .actorType("SYSTEM")
                    .action("DOCUMENT_DESTROYED")
                    .resourceType("DOCUMENT")
                    .resourceId(item.getDocumentId())
                    .details(Map.of("title", item.getDocumentTitle() != null ? item.getDocumentTitle() : "unknown"))
                    .build());

            log.info("Document {} destroyed per retention policy", item.getDocumentId());
        }

        log.info("Destruction execution complete. {} documents destroyed.", ready.size());
    }

    public RetentionStatsDto getStats() {
        return RetentionStatsDto.builder()
                .pendingCount(dispositionRepository.countByStatus(DispositionStatus.PENDING))
                .approvedCount(dispositionRepository.countByStatus(DispositionStatus.APPROVED))
                .destroyedCount(dispositionRepository.countByStatus(DispositionStatus.DESTROYED))
                .onHoldCount(dispositionRepository.countByStatus(DispositionStatus.ON_HOLD))
                .rejectedCount(dispositionRepository.countByStatus(DispositionStatus.REJECTED))
                .build();
    }

    // ==================== Mappers ====================

    private RetentionPolicyDto toPolicyDto(RetentionPolicy p) {
        return RetentionPolicyDto.builder()
                .id(p.getId())
                .name(p.getName())
                .description(p.getDescription())
                .retentionYears(p.getRetentionYears())
                .autoDispose(p.getAutoDispose())
                .requiresApproval(p.getRequiresApproval())
                .isActive(p.getIsActive())
                .createdAt(p.getCreatedAt())
                .build();
    }

    private DispositionItemDto toDispositionDto(DispositionItem d) {
        return DispositionItemDto.builder()
                .id(d.getId())
                .documentId(d.getDocumentId())
                .documentTitle(d.getDocumentTitle())
                .policyName(d.getPolicy() != null ? d.getPolicy().getName() : null)
                .status(d.getStatus().name())
                .retentionExpiresAt(d.getRetentionExpiresAt())
                .scheduledDestructionDate(d.getScheduledDestructionDate())
                .approvedBy(d.getApprovedBy())
                .approvedAt(d.getApprovedAt())
                .destroyedAt(d.getDestroyedAt())
                .reason(d.getReason())
                .createdAt(d.getCreatedAt())
                .build();
    }
}
