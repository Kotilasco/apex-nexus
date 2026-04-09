package com.apexnexus.workflow.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "workflow_templates")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WorkflowTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    private String description;
    private String category;
    private String industry;

    @Column(columnDefinition = "jsonb")
    private String states;

    @Column(columnDefinition = "jsonb")
    private String transitions;

    @Column(name = "initial_state")
    private String initialState;

    @Column(name = "canvas_layout", columnDefinition = "jsonb")
    private String canvasLayout;

    private String icon;
    private String color;

    @Column(name = "estimated_duration_hours")
    private Integer estimatedDurationHours;

    @Column(name = "is_active")
    private Boolean isActive;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
