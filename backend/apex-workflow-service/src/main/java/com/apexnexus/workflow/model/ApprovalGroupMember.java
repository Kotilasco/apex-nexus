package com.apexnexus.workflow.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "approval_group_members")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ApprovalGroupMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private ApprovalGroup approvalGroup;

    @Column(name = "user_id", nullable = false)
    private UUID userId;
}
