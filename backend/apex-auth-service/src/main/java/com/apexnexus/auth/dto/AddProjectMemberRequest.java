package com.apexnexus.auth.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddProjectMemberRequest {
    @NotNull(message = "User ID is required")
    private UUID userId;
    @NotNull(message = "Role ID is required")
    private UUID roleId;
    private List<String> permissions;  // human-readable permission names
}
