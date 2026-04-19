package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.common.exception.BusinessException;
import com.apexnexus.common.exception.ResourceNotFoundException;
import com.apexnexus.common.security.SecurityContextUtil;
import com.apexnexus.document.dto.FolderDto;
import com.apexnexus.document.model.Folder;
import com.apexnexus.document.repository.FolderRepository;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/folders")
@RequiredArgsConstructor
public class FolderController {

    private final FolderRepository folderRepository;

    @PostMapping
    public ResponseEntity<ApiResponse<FolderDto>> createFolder(
            @RequestBody CreateFolderRequest request,
            Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();

        // Zero-trust: creator must be a member of the target project (or a system admin).
        if (request.getProjectId() != null) {
            SecurityContextUtil.requireProjectAccess(request.getProjectId());
        }

        if (request.getParentId() != null &&
            folderRepository.existsByParentIdAndName(request.getParentId(), request.getName())) {
            throw new BusinessException("Folder with this name already exists in the parent");
        }

        String parentPath = "";
        int depth = 0;
        if (request.getParentId() != null) {
            Folder parent = folderRepository.findById(request.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Folder", "id", request.getParentId()));
            // Must also have access to the parent folder.
            SecurityContextUtil.requireResourceAccess(parent.getProjectId(), parent.getOwnerId());
            parentPath = parent.getPath();
            depth = parent.getDepth() + 1;
        }

        Folder folder = Folder.builder()
                .name(request.getName())
                .parentId(request.getParentId())
                .ownerId(userId)
                .projectId(request.getProjectId())
                .description(request.getDescription())
                .path(parentPath + "/" + request.getName())
                .depth(depth)
                .build();

        folder = folderRepository.save(folder);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Folder created", mapToDto(folder)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<FolderDto>> getFolder(@PathVariable UUID id) {
        Folder folder = folderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Folder", "id", id));
        SecurityContextUtil.requireResourceAccess(folder.getProjectId(), folder.getOwnerId());
        return ResponseEntity.ok(ApiResponse.ok(mapToDto(folder)));
    }

    @GetMapping("/{id}/children")
    public ResponseEntity<ApiResponse<List<FolderDto>>> getChildren(@PathVariable UUID id) {
        Folder parent = folderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Folder", "id", id));
        SecurityContextUtil.requireResourceAccess(parent.getProjectId(), parent.getOwnerId());
        List<FolderDto> children = folderRepository.findByParentIdOrderByNameAsc(id)
                .stream().map(this::mapToDto).toList();
        return ResponseEntity.ok(ApiResponse.ok(children));
    }

    @GetMapping("/root")
    public ResponseEntity<ApiResponse<List<FolderDto>>> getRootFolders() {
        // Root folders are global. Non-admins only see roots for projects they belong to,
        // plus any personal root folders they own.
        UUID me = SecurityContextUtil.currentUserId();
        boolean admin = SecurityContextUtil.isSystemAdmin();
        java.util.Set<UUID> myProjects = SecurityContextUtil.accessibleProjectIds();
        List<FolderDto> roots = folderRepository.findByParentIdIsNullOrderByNameAsc().stream()
                .filter(f -> admin
                        || (f.getProjectId() != null && myProjects.contains(f.getProjectId()))
                        || (f.getProjectId() == null && me != null && me.equals(f.getOwnerId())))
                .map(this::mapToDto).toList();
        return ResponseEntity.ok(ApiResponse.ok(roots));
    }

    @GetMapping("/project/{projectId}")
    public ResponseEntity<ApiResponse<List<FolderDto>>> getProjectFolders(
            @PathVariable UUID projectId,
            @RequestParam(required = false) UUID parentId) {
        SecurityContextUtil.requireProjectAccess(projectId);
        List<FolderDto> folders;
        if (parentId != null) {
            folders = folderRepository.findByProjectIdAndParentIdOrderByNameAsc(projectId, parentId)
                    .stream().map(this::mapToDto).toList();
        } else {
            folders = folderRepository.findByProjectIdAndParentIdIsNullOrderByNameAsc(projectId)
                    .stream().map(this::mapToDto).toList();
        }
        return ResponseEntity.ok(ApiResponse.ok(folders));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteFolder(@PathVariable UUID id) {
        Folder folder = folderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Folder", "id", id));
        SecurityContextUtil.requireResourceAccess(folder.getProjectId(), folder.getOwnerId());
        if (Boolean.TRUE.equals(folder.getIsSystem())) {
            throw new BusinessException("System folders cannot be deleted");
        }
        folderRepository.delete(folder);
        return ResponseEntity.ok(ApiResponse.ok("Folder deleted", null));
    }

    private FolderDto mapToDto(Folder f) {
        return FolderDto.builder()
                .id(f.getId())
                .name(f.getName())
                .parentId(f.getParentId())
                .ownerId(f.getOwnerId())
                .projectId(f.getProjectId())
                .description(f.getDescription())
                .path(f.getPath())
                .depth(f.getDepth())
                .isSystem(f.getIsSystem())
                .createdAt(f.getCreatedAt())
                .updatedAt(f.getUpdatedAt())
                .build();
    }

    @Data
    static class CreateFolderRequest {
        @NotBlank
        private String name;
        private UUID parentId;
        private UUID projectId;
        private String description;
    }
}
