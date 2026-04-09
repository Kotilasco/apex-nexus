package com.apexnexus.auth.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "plugin_hooks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PluginHook {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plugin_id", nullable = false)
    private PluginRegistry plugin;

    @Column(name = "hook_type", nullable = false)
    private String hookType;

    @Column(name = "event_name", nullable = false)
    private String eventName;

    @Column(name = "handler_config", columnDefinition = "jsonb")
    private String handlerConfig;

    @Column(name = "execution_order")
    private Integer executionOrder;

    @Column(name = "is_active")
    private Boolean isActive;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
