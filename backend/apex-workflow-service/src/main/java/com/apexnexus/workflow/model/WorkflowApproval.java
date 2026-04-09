package com.apexnexus.workflow.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "workflow_approvals")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WorkflowApproval {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instance_id", nullable = false)
    private WorkflowInstance workflowInstance;

    @Column(name = "approver_id", nullable = false)
    private UUID approverId;

    @Column(name = "approval_order")
    @Builder.Default
    private Integer approvalOrder = 0;

    @Column(name = "is_parallel")
    @Builder.Default
    private Boolean isParallel = false;

    @Column(name = "group_id")
    private UUID groupId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ApprovalDecision decision = ApprovalDecision.PENDING;

    @Column(columnDefinition = "text")
    private String comments;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
