package com.apexnexus.workflow.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "workflow_definitions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WorkflowDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> states;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Map<String, Object>> transitions;

    @Column(name = "initial_state", nullable = false)
    private String initialState;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "required_roles", columnDefinition = "jsonb")
    private List<String> requiredRoles;

    @Column(name = "human_review_required")
    @Builder.Default
    private Boolean humanReviewRequired = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "escalation_rules", columnDefinition = "jsonb")
    private List<Map<String, Object>> escalationRules;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
