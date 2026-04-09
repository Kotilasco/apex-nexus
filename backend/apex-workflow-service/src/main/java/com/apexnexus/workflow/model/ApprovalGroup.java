package com.apexnexus.workflow.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "approval_groups")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ApprovalGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(name = "required_approvals")
    @Builder.Default
    private Integer requiredApprovals = 1;

    @OneToMany(mappedBy = "approvalGroup", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ApprovalGroupMember> members = new ArrayList<>();

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
