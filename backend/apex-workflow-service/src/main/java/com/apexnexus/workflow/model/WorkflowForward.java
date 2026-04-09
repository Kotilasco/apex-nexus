package com.apexnexus.workflow.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "workflow_forwards")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class WorkflowForward {

    @Id
    @GeneratedValue(generator = "uuid4")
    @GenericGenerator(name = "uuid4", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "workflow_instance_id")
    private UUID workflowInstanceId;

    @Column(name = "forwarded_by", nullable = false)
    private UUID forwardedBy;

    @Column(name = "forwarded_to", nullable = false)
    private UUID forwardedTo;

    @Column(columnDefinition = "text")
    private String message;

    @Column(name = "action_required", length = 50)
    @Builder.Default
    private String actionRequired = "REVIEW";

    @Column(name = "is_completed")
    @Builder.Default
    private Boolean isCompleted = false;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(columnDefinition = "text")
    private String response;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
