package com.apexnexus.auth.service;

import com.apexnexus.auth.dto.*;
import com.apexnexus.auth.model.Project;
import com.apexnexus.auth.model.ProjectMember;
import com.apexnexus.auth.model.ProjectPlugin;
import com.apexnexus.auth.model.PluginRegistry;
import com.apexnexus.auth.model.Role;
import com.apexnexus.auth.model.User;
import com.apexnexus.auth.repository.*;
import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.exception.BusinessException;
import com.apexnexus.common.exception.ConflictException;
import com.apexnexus.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository memberRepository;
    private final ProjectPluginRepository projectPluginRepository;
    private final PluginRegistryRepository pluginRegistryRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final AuditPublisher auditPublisher;

    // ====================== Bitwise permission name mapping ======================
    private static final Map<String, Long> PERMISSION_MAP = Map.of(
            "READ", ProjectMember.PERM_READ,
            "WRITE", ProjectMember.PERM_WRITE,
            "DELETE", ProjectMember.PERM_DELETE,
            "MANAGE", ProjectMember.PERM_MANAGE,
            "APPROVE", ProjectMember.PERM_APPROVE,
            "AI_INVOKE", ProjectMember.PERM_AI_INVOKE,
            "AI_CONFIGURE", ProjectMember.PERM_AI_CONFIGURE,
            "RETENTION", ProjectMember.PERM_RETENTION,
            "EXPORT", ProjectMember.PERM_EXPORT,
            "ADMIN", ProjectMember.PERM_ADMIN);

    // ====================== Project CRUD ======================

    @Transactional
    public ProjectDto createProject(CreateProjectRequest request, UUID ownerId) {
        if (projectRepository.existsByName(request.getName())) {
            throw new ConflictException("Project name already exists: " + request.getName());
        }

        // If creating a sub-project, validate parent exists
        if (request.getParentProjectId() != null) {
            if (!projectRepository.existsById(request.getParentProjectId())) {
                throw new ResourceNotFoundException("Project", "id", request.getParentProjectId());
            }
        }

        Project project = Project.builder()
                .name(request.getName())
                .description(request.getDescription())
                .ownerId(ownerId)
                .parentProjectId(request.getParentProjectId())
                .metadataSchema(request.getMetadataSchema() != null ? request.getMetadataSchema() : Map.of())
                .aiEnabled(request.getAiEnabled() != null ? request.getAiEnabled() : true)
                .defaultWorkflowDefinitionId(request.getDefaultWorkflowDefinitionId())
                .defaultRetentionPeriodYears(request.getDefaultRetentionPeriodYears())
                .retentionDocumentTypes(request.getRetentionDocumentTypes())
                .jurisdictionCode(request.getJurisdictionCode())
                .privacyRedactionEnabled(
                        request.getPrivacyRedactionEnabled() != null ? request.getPrivacyRedactionEnabled() : false)
                .complianceCategory(request.getComplianceCategory())
                .build();

        project = projectRepository.save(project);

        // Auto-add owner as admin member with full permissions
        ProjectMember ownerMember = ProjectMember.builder()
                .projectId(project.getId())
                .userId(ownerId)
                .roleId(findAdminRoleId())
                .permissionsMask(Long.MAX_VALUE) // all permissions
                .build();
        memberRepository.save(ownerMember);

        auditPublisher.publish(AuditEvent.builder()
                .userId(ownerId)
                .action("PROJECT_CREATED")
                .resourceType("PROJECT")
                .resourceId(project.getId())
                .resourceName(project.getName())
                .build());

        log.info("Project created: {} by user {}", project.getName(), ownerId);
        return toDto(project);
    }

    @Transactional(readOnly = true)
    public ProjectDto getProject(UUID projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));
        return toDto(project);
    }

    @Transactional(readOnly = true)
    public List<ProjectDto> getActiveProjects() {
        return projectRepository.findByIsActiveTrue().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProjectDto> getUserProjects(UUID userId) {
        List<ProjectMember> memberships = memberRepository.findActiveProjectMemberships(userId);
        return memberships.stream()
                .map(pm -> projectRepository.findById(pm.getProjectId()).orElse(null))
                .filter(Objects::nonNull)
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProjectDto updateProject(UUID projectId, CreateProjectRequest request, UUID userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        if (request.getName() != null)
            project.setName(request.getName());
        if (request.getDescription() != null)
            project.setDescription(request.getDescription());
        if (request.getMetadataSchema() != null)
            project.setMetadataSchema(request.getMetadataSchema());
        if (request.getAiEnabled() != null)
            project.setAiEnabled(request.getAiEnabled());
        if (request.getDefaultWorkflowDefinitionId() != null)
            project.setDefaultWorkflowDefinitionId(request.getDefaultWorkflowDefinitionId());
        if (request.getDefaultRetentionPeriodYears() != null)
            project.setDefaultRetentionPeriodYears(request.getDefaultRetentionPeriodYears());
        if (request.getRetentionDocumentTypes() != null)
            project.setRetentionDocumentTypes(request.getRetentionDocumentTypes());
        if (request.getJurisdictionCode() != null)
            project.setJurisdictionCode(request.getJurisdictionCode());
        if (request.getPrivacyRedactionEnabled() != null)
            project.setPrivacyRedactionEnabled(request.getPrivacyRedactionEnabled());
        if (request.getComplianceCategory() != null)
            project.setComplianceCategory(request.getComplianceCategory());

        project = projectRepository.save(project);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("PROJECT_UPDATED")
                .resourceType("PROJECT")
                .resourceId(project.getId())
                .resourceName(project.getName())
                .build());

        return toDto(project);
    }

    // ====================== Member Management ======================

    @Transactional
    public ProjectMemberDto addMember(UUID projectId, AddProjectMemberRequest request, UUID addedBy) {
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project", "id", projectId);
        }
        if (memberRepository.existsByProjectIdAndUserId(projectId, request.getUserId())) {
            throw new ConflictException("User is already a member of this project");
        }

        long mask = 0L;
        if (request.getPermissions() != null) {
            for (String perm : request.getPermissions()) {
                Long bit = PERMISSION_MAP.get(perm.toUpperCase());
                if (bit != null)
                    mask |= bit;
            }
        }

        ProjectMember member = ProjectMember.builder()
                .projectId(projectId)
                .userId(request.getUserId())
                .roleId(request.getRoleId())
                .permissionsMask(mask)
                .build();

        member = memberRepository.save(member);

        auditPublisher.publish(AuditEvent.builder()
                .userId(addedBy)
                .action("PROJECT_MEMBER_ADDED")
                .resourceType("PROJECT")
                .resourceId(projectId)
                .details(Map.of("memberId", request.getUserId().toString()))
                .build());

        return toMemberDto(member);
    }

    @Transactional
    public void removeMember(UUID projectId, UUID userId, UUID removedBy) {
        ProjectMember member = memberRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectMember", "userId", userId));

        memberRepository.delete(member);

        auditPublisher.publish(AuditEvent.builder()
                .userId(removedBy)
                .action("PROJECT_MEMBER_REMOVED")
                .resourceType("PROJECT")
                .resourceId(projectId)
                .details(Map.of("memberId", userId.toString()))
                .build());
    }

    @Transactional
    public ProjectMemberDto updateMemberPermissions(UUID projectId, UUID userId, List<String> permissions,
            UUID updatedBy) {
        ProjectMember member = memberRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectMember", "userId", userId));

        long mask = 0L;
        if (permissions != null) {
            for (String perm : permissions) {
                Long bit = PERMISSION_MAP.get(perm.toUpperCase());
                if (bit != null)
                    mask |= bit;
            }
        }
        member.setPermissionsMask(mask);
        member = memberRepository.save(member);

        auditPublisher.publish(AuditEvent.builder()
                .userId(updatedBy)
                .action("PROJECT_MEMBER_UPDATED")
                .resourceType("PROJECT")
                .resourceId(projectId)
                .details(Map.of("memberId", userId.toString(), "permissions",
                        String.join(",", permissions != null ? permissions : List.of())))
                .build());

        return toMemberDto(member);
    }

    @Transactional(readOnly = true)
    public List<ProjectMemberDto> getProjectMembers(UUID projectId) {
        return memberRepository.findByProjectId(projectId).stream()
                .map(this::toMemberDto)
                .collect(Collectors.toList());
    }

    /**
     * Returns project-scoped permissions for a user, keyed by projectId.
     * Used to embed in JWT tokens for project-scoped RBAC.
     */
    @Transactional(readOnly = true)
    public Map<UUID, List<String>> getProjectPermissions(UUID userId) {
        List<ProjectMember> memberships = memberRepository.findActiveProjectMemberships(userId);
        Map<UUID, List<String>> result = new HashMap<>();
        for (ProjectMember pm : memberships) {
            result.put(pm.getProjectId(), decodePermissions(pm.getPermissionsMask()));
        }
        return result;
    }

    // ====================== Project Plugin Management ======================

    @Transactional(readOnly = true)
    public List<ProjectPluginDto> getProjectPlugins(UUID projectId) {
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project", "id", projectId);
        }
        List<PluginRegistry> allPlugins = pluginRegistryRepository.findAllByOrderByDisplayNameAsc();
        List<ProjectPlugin> projectPlugins = projectPluginRepository.findByProjectId(projectId);
        Map<UUID, ProjectPlugin> activeMap = new HashMap<>();
        for (ProjectPlugin pp : projectPlugins) {
            activeMap.put(pp.getPluginId(), pp);
        }
        return allPlugins.stream().map(plugin -> {
            ProjectPlugin pp = activeMap.get(plugin.getId());
            return ProjectPluginDto.builder()
                    .pluginId(plugin.getId())
                    .name(plugin.getName())
                    .displayName(plugin.getDisplayName())
                    .description(plugin.getDescription())
                    .version(plugin.getVersion())
                    .vendor(plugin.getVendor())
                    .pluginType(plugin.getPluginType())
                    .category(plugin.getCategory())
                    .globalStatus(plugin.getStatus())
                    .activeInProject(pp != null && Boolean.TRUE.equals(pp.getIsActive()))
                    .iconUrl(plugin.getIconUrl())
                    .isPremium(plugin.getIsPremium())
                    .activatedAt(pp != null ? pp.getActivatedAt() : null)
                    .build();
        }).collect(Collectors.toList());
    }

    @Transactional
    public ProjectPluginDto activateProjectPlugin(UUID projectId, UUID pluginId, UUID userId) {
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project", "id", projectId);
        }
        PluginRegistry plugin = pluginRegistryRepository.findById(pluginId)
                .orElseThrow(() -> new ResourceNotFoundException("Plugin", "id", pluginId));

        ProjectPlugin pp = projectPluginRepository.findByProjectIdAndPluginId(projectId, pluginId)
                .orElse(null);
        if (pp == null) {
            pp = ProjectPlugin.builder()
                    .projectId(projectId)
                    .pluginId(pluginId)
                    .isActive(true)
                    .activatedBy(userId)
                    .build();
        } else {
            pp.setIsActive(true);
            pp.setActivatedBy(userId);
            pp.setActivatedAt(java.time.Instant.now());
        }
        projectPluginRepository.save(pp);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId).action("PROJECT_PLUGIN_ACTIVATED").resourceType("PROJECT")
                .resourceId(projectId).resourceName(plugin.getDisplayName())
                .details(Map.of("pluginId", pluginId.toString())).build());

        return ProjectPluginDto.builder()
                .pluginId(plugin.getId()).name(plugin.getName()).displayName(plugin.getDisplayName())
                .description(plugin.getDescription()).version(plugin.getVersion()).vendor(plugin.getVendor())
                .pluginType(plugin.getPluginType()).category(plugin.getCategory())
                .globalStatus(plugin.getStatus()).activeInProject(true)
                .iconUrl(plugin.getIconUrl()).isPremium(plugin.getIsPremium())
                .activatedAt(pp.getActivatedAt()).build();
    }

    @Transactional
    public ProjectPluginDto deactivateProjectPlugin(UUID projectId, UUID pluginId, UUID userId) {
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project", "id", projectId);
        }
        PluginRegistry plugin = pluginRegistryRepository.findById(pluginId)
                .orElseThrow(() -> new ResourceNotFoundException("Plugin", "id", pluginId));

        ProjectPlugin pp = projectPluginRepository.findByProjectIdAndPluginId(projectId, pluginId)
                .orElse(null);
        if (pp != null) {
            pp.setIsActive(false);
            projectPluginRepository.save(pp);
        }

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId).action("PROJECT_PLUGIN_DEACTIVATED").resourceType("PROJECT")
                .resourceId(projectId).resourceName(plugin.getDisplayName())
                .details(Map.of("pluginId", pluginId.toString())).build());

        return ProjectPluginDto.builder()
                .pluginId(plugin.getId()).name(plugin.getName()).displayName(plugin.getDisplayName())
                .description(plugin.getDescription()).version(plugin.getVersion()).vendor(plugin.getVendor())
                .pluginType(plugin.getPluginType()).category(plugin.getCategory())
                .globalStatus(plugin.getStatus()).activeInProject(false)
                .iconUrl(plugin.getIconUrl()).isPremium(plugin.getIsPremium())
                .activatedAt(pp != null ? pp.getActivatedAt() : null).build();
    }

    // ====================== AI Toggle ======================

    @Transactional
    public ProjectDto toggleAi(UUID projectId, UUID userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        // Only owner or SYSTEM_ADMIN can toggle AI
        boolean isOwner = project.getOwnerId().equals(userId);
        boolean isAdmin = isSystemAdmin(userId);
        if (!isOwner && !isAdmin) {
            throw new BusinessException("Only the project owner or a system admin can toggle AI");
        }

        project.setAiEnabled(!Boolean.TRUE.equals(project.getAiEnabled()));
        project = projectRepository.save(project);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action(project.getAiEnabled() ? "PROJECT_AI_ENABLED" : "PROJECT_AI_DISABLED")
                .resourceType("PROJECT")
                .resourceId(project.getId())
                .resourceName(project.getName())
                .build());

        log.info("AI {} for project {} by user {}", project.getAiEnabled() ? "enabled" : "disabled", project.getName(),
                userId);
        return toDto(project);
    }

    // ====================== Sub-Projects ======================

    @Transactional(readOnly = true)
    public List<ProjectDto> getSubProjects(UUID parentProjectId) {
        if (!projectRepository.existsById(parentProjectId)) {
            throw new ResourceNotFoundException("Project", "id", parentProjectId);
        }
        return projectRepository.findByParentProjectIdAndIsActiveTrue(parentProjectId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    // ====================== Helpers ======================

    private List<String> decodePermissions(long mask) {
        List<String> perms = new ArrayList<>();
        for (Map.Entry<String, Long> entry : PERMISSION_MAP.entrySet()) {
            if ((mask & entry.getValue()) != 0) {
                perms.add(entry.getKey());
            }
        }
        return perms;
    }

    private UUID findAdminRoleId() {
        return roleRepository.findByName("SYSTEM_ADMIN")
                .map(Role::getId)
                .orElseThrow(() -> new BusinessException("SYSTEM_ADMIN role not found"));
    }

    private boolean isSystemAdmin(UUID userId) {
        UUID adminRoleId = roleRepository.findByName("SYSTEM_ADMIN").map(Role::getId).orElse(null);
        if (adminRoleId == null)
            return false;
        return memberRepository.findActiveProjectMemberships(userId).stream()
                .anyMatch(pm -> adminRoleId.equals(pm.getRoleId()));
    }

    private ProjectDto toDto(Project project) {
        int memberCount = memberRepository.findByProjectId(project.getId()).size();
        String ownerName = userRepository.findById(project.getOwnerId())
                .map(u -> u.getFirstName() + " " + u.getLastName())
                .orElse("Unknown");
        String parentProjectName = null;
        if (project.getParentProjectId() != null) {
            parentProjectName = projectRepository.findById(project.getParentProjectId())
                    .map(Project::getName).orElse(null);
        }
        int subProjectCount = projectRepository.countByParentProjectIdAndIsActiveTrue(project.getId());

        return ProjectDto.builder()
                .id(project.getId())
                .name(project.getName())
                .description(project.getDescription())
                .ownerId(project.getOwnerId())
                .ownerName(ownerName)
                .parentProjectId(project.getParentProjectId())
                .parentProjectName(parentProjectName)
                .subProjectCount(subProjectCount)
                .metadataSchema(project.getMetadataSchema())
                .aiEnabled(project.getAiEnabled())
                .isActive(project.getIsActive())
                .defaultWorkflowDefinitionId(project.getDefaultWorkflowDefinitionId())
                .defaultRetentionPeriodYears(project.getDefaultRetentionPeriodYears())
                .retentionDocumentTypes(project.getRetentionDocumentTypes())
                .jurisdictionCode(project.getJurisdictionCode())
                .privacyRedactionEnabled(project.getPrivacyRedactionEnabled())
                .complianceCategory(project.getComplianceCategory())
                .memberCount(memberCount)
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .build();
    }

    private ProjectMemberDto toMemberDto(ProjectMember pm) {
        String username = "";
        String email = "";
        String fullName = "";
        User user = userRepository.findById(pm.getUserId()).orElse(null);
        if (user != null) {
            username = user.getUsername();
            email = user.getEmail();
            fullName = user.getFirstName() + " " + user.getLastName();
        }

        String roleName = roleRepository.findById(pm.getRoleId())
                .map(Role::getName).orElse("UNKNOWN");

        String projectName = projectRepository.findById(pm.getProjectId())
                .map(Project::getName).orElse("Unknown");

        return ProjectMemberDto.builder()
                .id(pm.getId())
                .projectId(pm.getProjectId())
                .projectName(projectName)
                .userId(pm.getUserId())
                .username(username)
                .email(email)
                .fullName(fullName)
                .roleId(pm.getRoleId())
                .roleName(roleName)
                .permissionsMask(pm.getPermissionsMask())
                .effectivePermissions(decodePermissions(pm.getPermissionsMask()))
                .joinedAt(pm.getJoinedAt())
                .build();
    }
}
