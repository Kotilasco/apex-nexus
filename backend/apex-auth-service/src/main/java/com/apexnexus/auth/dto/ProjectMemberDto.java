package com.apexnexus.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectMemberDto {
    private UUID id;
    private UUID projectId;
    private String projectName;
    private UUID userId;
    private String username;
    private String fullName;
    private UUID roleId;
    private String roleName;
    private long permissionsMask;
    private List<String> effectivePermissions;
    private Instant joinedAt;
}
