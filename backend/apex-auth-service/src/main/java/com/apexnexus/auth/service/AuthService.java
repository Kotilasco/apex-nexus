package com.apexnexus.auth.service;

import com.apexnexus.auth.dto.*;
import com.apexnexus.auth.model.Role;
import com.apexnexus.auth.model.User;
import com.apexnexus.auth.repository.RoleRepository;
import com.apexnexus.auth.repository.UserRepository;
import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.exception.BusinessException;
import com.apexnexus.common.exception.ConflictException;
import com.apexnexus.common.exception.ResourceNotFoundException;
import com.apexnexus.common.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final String SESSION_PREFIX = "session:";
    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final JwtTokenProvider tokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final RedisTemplate<String, String> redisTemplate;
    private final AuditPublisher auditPublisher;
    private final ProjectService projectService;

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsernameWithRolesAndPermissions(request.getUsername())
                .orElseThrow(() -> new BusinessException("Invalid credentials"));

        if (Boolean.TRUE.equals(user.getIsLocked())) {
            throw new BusinessException("Account is locked. Contact administrator.");
        }

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new BusinessException("Account is inactive");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            user.setFailedAttempts(user.getFailedAttempts() + 1);
            if (user.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) {
                user.setIsLocked(true);
            }
            userRepository.save(user);
            throw new BusinessException("Invalid credentials");
        }

        // Reset failed attempts
        user.setFailedAttempts(0);
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        List<String> roleNames = user.getRoles().stream()
                .map(Role::getName)
                .toList();

        List<String> permissions = user.getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(p -> p.getResource() + ":" + p.getAction())
                .distinct()
                .toList();

        // Resolve project-scoped permissions
        Map<UUID, List<String>> projectPermissions = projectService.getProjectPermissions(user.getId());

        String accessToken = tokenProvider.generateAccessToken(user.getId(), user.getUsername(), roleNames, projectPermissions);
        String refreshToken = tokenProvider.generateRefreshToken(user.getId());

        // Store session in Redis
        redisTemplate.opsForValue().set(
                SESSION_PREFIX + user.getId(),
                accessToken,
                Duration.ofHours(1)
        );

        auditPublisher.publish(AuditEvent.builder()
                .userId(user.getId())
                .action("LOGIN")
                .resourceType("AUTH")
                .resourceName(user.getUsername())
                .build());

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(3600)
                .userId(user.getId())
                .username(user.getUsername())
                .fullName(user.getFirstName() + " " + user.getLastName())
                .roles(roleNames)
                .permissions(permissions)
                .projectPermissions(projectPermissions)
                .build();
    }

    @Transactional
    public UserDto register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new ConflictException("Username already exists");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ConflictException("Email already registered");
        }

        Role authorRole = roleRepository.findByName("AUTHOR")
                .orElseThrow(() -> new BusinessException("Default role not found"));

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .department(request.getDepartment())
                .roles(Set.of(authorRole))
                .build();

        user = userRepository.save(user);

        auditPublisher.publish(AuditEvent.builder()
                .userId(user.getId())
                .action("REGISTER")
                .resourceType("USER")
                .resourceId(user.getId())
                .resourceName(user.getUsername())
                .build());

        return mapToDto(user);
    }

    public void logout(String token, UUID userId) {
        // Blacklist the token
        redisTemplate.opsForValue().set(BLACKLIST_PREFIX + token, "true", Duration.ofHours(2));
        redisTemplate.delete(SESSION_PREFIX + userId);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("LOGOUT")
                .resourceType("AUTH")
                .build());
    }

    @Transactional(readOnly = true)
    public UserDto getUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        return mapToDto(user);
    }

    @Transactional(readOnly = true)
    public List<UserDto> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional
    public UserDto updateUser(UUID userId, UpdateUserRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName() != null) user.setLastName(request.getLastName());
        if (request.getEmail() != null) user.setEmail(request.getEmail());
        if (request.getDepartment() != null) user.setDepartment(request.getDepartment());
        user = userRepository.save(user);
        return mapToDto(user);
    }

    @Transactional
    public UserDto updateUserRoles(UUID userId, List<String> roleNames) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        Set<Role> roles = new HashSet<>();
        for (String roleName : roleNames) {
            Role role = roleRepository.findByName(roleName)
                    .orElseThrow(() -> new ResourceNotFoundException("Role", "name", roleName));
            roles.add(role);
        }
        user.setRoles(roles);
        user = userRepository.save(user);
        return mapToDto(user);
    }

    @Transactional
    public UserDto updateUserStatus(UUID userId, boolean active) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        user.setIsActive(active);
        if (active) user.setIsLocked(false);
        user = userRepository.save(user);
        return mapToDto(user);
    }

    @Transactional(readOnly = true)
    public List<RoleDto> getAllRoles() {
        return roleRepository.findAll().stream()
                .map(this::mapRoleToDto)
                .toList();
    }

    private RoleDto mapRoleToDto(Role role) {
        return RoleDto.builder()
                .id(role.getId())
                .name(role.getName())
                .description(role.getDescription())
                .permissions(role.getPermissions().stream()
                        .map(p -> p.getResource() + ":" + p.getAction())
                        .toList())
                .build();
    }

    private UserDto mapToDto(User user) {
        return UserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .department(user.getDepartment())
                .isActive(user.getIsActive())
                .roles(user.getRoles().stream().map(Role::getName).toList())
                .lastLoginAt(user.getLastLoginAt())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
