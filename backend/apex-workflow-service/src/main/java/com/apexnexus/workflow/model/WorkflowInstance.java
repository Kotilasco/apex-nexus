package com.apexnexus.workflow.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "workflow_instances")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WorkflowInstance {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "definition_id", nullable = false)
    private WorkflowDefinition definition;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "current_state", nullable = false)
    @Enumerated(EnumType.STRING)
    private WorkflowStatus currentState;

    @Column(name = "initiated_by", nullable = false)
    private UUID initiatedBy;

    @Column(name = "actor_type", length = 20)
    @Builder.Default
    private String actorType = "HUMAN";

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "assigned_to")
    private UUID assignedTo;

    @Column(name = "priority")
    @Builder.Default
    private Integer priority = 0;

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "correction_count")
    @Builder.Default
    private Integer correctionCount = 0;

    @Column(name = "rejected_document_hash", length = 64)
    private String rejectedDocumentHash;

    @Column(name = "rejection_comments", columnDefinition = "TEXT")
    private String rejectionComments;

    @Column(name = "parent_instance_id")
    private UUID parentInstanceId;

    @Column(name = "escalation_level")
    @Builder.Default
    private Integer escalationLevel = 0;

    @Column(name = "escalated_at")
    private LocalDateTime escalatedAt;

    @Column(name = "sla_deadline")
    private LocalDateTime slaDeadline;

    @OneToMany(mappedBy = "workflowInstance", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt DESC")
    @Builder.Default
    private List<WorkflowTransition> transitions = new ArrayList<>();

    @OneToMany(mappedBy = "workflowInstance", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<WorkflowApproval> approvals = new ArrayList<>();

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
