package com.apexnexus.auth.controller;

import com.apexnexus.auth.dto.*;
import com.apexnexus.auth.service.ProjectService;
import com.apexnexus.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @PostMapping
    public ResponseEntity<ApiResponse<ProjectDto>> createProject(
            @Valid @RequestBody CreateProjectRequest request,
            Authentication authentication) {
        UUID userId = (UUID) authentication.getPrincipal();
        ProjectDto project = projectService.createProject(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Project created", project));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ProjectDto>>> getActiveProjects() {
        return ResponseEntity.ok(ApiResponse.ok(projectService.getActiveProjects()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProjectDto>> getProject(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(projectService.getProject(id)));
    }

    @GetMapping("/mine")
    public ResponseEntity<ApiResponse<List<ProjectDto>>> getMyProjects(Authentication authentication) {
        UUID userId = (UUID) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(projectService.getUserProjects(userId)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ProjectDto>> updateProject(
            @PathVariable UUID id,
            @Valid @RequestBody CreateProjectRequest request,
            Authentication authentication) {
        UUID userId = (UUID) authentication.getPrincipal();
        ProjectDto updated = projectService.updateProject(id, request, userId);
        return ResponseEntity.ok(ApiResponse.ok("Project updated", updated));
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<ApiResponse<ProjectMemberDto>> addMember(
            @PathVariable UUID id,
            @Valid @RequestBody AddProjectMemberRequest request,
            Authentication authentication) {
        UUID userId = (UUID) authentication.getPrincipal();
        ProjectMemberDto member = projectService.addMember(id, request, userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Member added", member));
    }

    @DeleteMapping("/{projectId}/members/{userId}")
    public ResponseEntity<ApiResponse<Void>> removeMember(
            @PathVariable UUID projectId,
            @PathVariable UUID userId,
            Authentication authentication) {
        UUID removedBy = (UUID) authentication.getPrincipal();
        projectService.removeMember(projectId, userId, removedBy);
        return ResponseEntity.ok(ApiResponse.ok("Member removed", null));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<ApiResponse<List<ProjectMemberDto>>> getMembers(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(projectService.getProjectMembers(id)));
    }

    // ====================== Project Plugins ======================

    @GetMapping("/{id}/plugins")
    public ResponseEntity<ApiResponse<List<ProjectPluginDto>>> getProjectPlugins(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(projectService.getProjectPlugins(id)));
    }

    @PostMapping("/{id}/plugins/{pluginId}/activate")
    public ResponseEntity<ApiResponse<ProjectPluginDto>> activateProjectPlugin(
            @PathVariable UUID id,
            @PathVariable UUID pluginId,
            Authentication authentication) {
        UUID userId = (UUID) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok("Plugin activated for project",
                projectService.activateProjectPlugin(id, pluginId, userId)));
    }

    @PostMapping("/{id}/plugins/{pluginId}/deactivate")
    public ResponseEntity<ApiResponse<ProjectPluginDto>> deactivateProjectPlugin(
            @PathVariable UUID id,
            @PathVariable UUID pluginId,
            Authentication authentication) {
        UUID userId = (UUID) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok("Plugin deactivated for project",
                projectService.deactivateProjectPlugin(id, pluginId, userId)));
    }
}
