package com.apexnexus.common.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Zero-trust access helper. Reads the authenticated user's project permissions
 * (populated by {@link JwtAuthenticationFilter}) from the current request and
 * exposes membership / role / permission checks.
 *
 * System administrators (role {@code SYSTEM_ADMIN}) bypass project-membership
 * checks. All other users must have an entry in {@code projectPerms} for the
 * requested project.
 */
public final class SecurityContextUtil {

    public static final String ROLE_SYSTEM_ADMIN = "SYSTEM_ADMIN";
    public static final String ATTR_PROJECT_PERMS = "currentProjectPerms";

    private SecurityContextUtil() {}

    /** Returns the authenticated user's id, or null if not authenticated. */
    public static UUID currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) return null;
        Object p = auth.getPrincipal();
        if (p instanceof UUID u) return u;
        try { return UUID.fromString(String.valueOf(p)); } catch (Exception e) { return null; }
    }

    /** Granted role names (without the {@code ROLE_} prefix). */
    public static List<String> currentRoles() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return List.of();
        return auth.getAuthorities().stream()
                .map(a -> a.getAuthority().startsWith("ROLE_") ? a.getAuthority().substring(5) : a.getAuthority())
                .toList();
    }

    public static boolean isSystemAdmin() {
        return currentRoles().contains(ROLE_SYSTEM_ADMIN);
    }

    /** Map of projectId -> permission names for the current user. */
    @SuppressWarnings("unchecked")
    public static Map<UUID, List<String>> currentProjectPerms() {
        ServletRequestAttributes attrs =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs == null) return Collections.emptyMap();
        HttpServletRequest req = attrs.getRequest();
        Object v = req.getAttribute(ATTR_PROJECT_PERMS);
        if (v instanceof Map<?, ?> m) return (Map<UUID, List<String>>) m;
        return Collections.emptyMap();
    }

    /**
     * @return true if the caller is a system admin or has at least one permission
     *         on the given project. Null projectId returns false (caller should handle
     *         null project documents separately, e.g. author-only access).
     */
    public static boolean hasProjectAccess(UUID projectId) {
        if (projectId == null) return false;
        if (isSystemAdmin()) return true;
        List<String> perms = currentProjectPerms().get(projectId);
        return perms != null && !perms.isEmpty();
    }

    /**
     * @return true if the caller has the specific permission on the project
     *         (or is a system admin).
     */
    public static boolean hasProjectPermission(UUID projectId, String permission) {
        if (isSystemAdmin()) return true;
        if (projectId == null || permission == null) return false;
        List<String> perms = currentProjectPerms().get(projectId);
        return perms != null && perms.contains(permission);
    }

    /** Throws {@link AccessDeniedException} when the caller is not a member of the project. */
    public static void requireProjectAccess(UUID projectId) {
        if (!hasProjectAccess(projectId)) {
            throw new AccessDeniedException(
                    "Access denied: caller is not a member of project " + projectId);
        }
    }

    /** Throws {@link AccessDeniedException} when the caller lacks the named permission. */
    public static void requireProjectPermission(UUID projectId, String permission) {
        if (!hasProjectPermission(projectId, permission)) {
            throw new AccessDeniedException(
                    "Access denied: missing " + permission + " on project " + projectId);
        }
    }

    /**
     * Access rule for documents / resources that may or may not have a project.
     * <ul>
     *   <li>Resource has a project → caller must be a member (or admin).</li>
     *   <li>Resource is personal (null project) → caller must be the owner or admin.</li>
     * </ul>
     */
    public static void requireResourceAccess(UUID projectId, UUID ownerId) {
        if (isSystemAdmin()) return;
        if (projectId != null) {
            if (hasProjectAccess(projectId)) return;
            throw new AccessDeniedException(
                    "Access denied: caller is not a member of project " + projectId);
        }
        UUID me = currentUserId();
        if (ownerId != null && ownerId.equals(me)) return;
        throw new AccessDeniedException("Access denied: personal resource belongs to another user");
    }

    /** Set of project ids the caller has any access to. Empty for users with no project memberships. */
    public static java.util.Set<UUID> accessibleProjectIds() {
        return currentProjectPerms().keySet();
    }
}
