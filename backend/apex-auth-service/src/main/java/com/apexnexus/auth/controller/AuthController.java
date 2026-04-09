package com.apexnexus.auth.controller;

import com.apexnexus.auth.dto.*;
import com.apexnexus.auth.service.AuthService;
import com.apexnexus.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.ok("Login successful", response));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UserDto>> register(@Valid @RequestBody RegisterRequest request) {
        UserDto user = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Registration successful", user));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @RequestHeader("Authorization") String authHeader,
            Authentication authentication) {
        String token = authHeader.substring(7);
        UUID userId = (UUID) authentication.getPrincipal();
        authService.logout(token, userId);
        return ResponseEntity.ok(ApiResponse.ok("Logout successful", null));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserDto>> getCurrentUser(Authentication authentication) {
        UUID userId = (UUID) authentication.getPrincipal();
        UserDto user = authService.getUserById(userId);
        return ResponseEntity.ok(ApiResponse.ok(user));
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<UserDto>>> getAllUsers() {
        List<UserDto> users = authService.getAllUsers();
        return ResponseEntity.ok(ApiResponse.ok(users));
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<ApiResponse<UserDto>> getUserById(@PathVariable UUID id) {
        UserDto user = authService.getUserById(id);
        return ResponseEntity.ok(ApiResponse.ok(user));
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<ApiResponse<UserDto>> updateUser(
            @PathVariable UUID id,
            @RequestBody UpdateUserRequest request) {
        UserDto user = authService.updateUser(id, request);
        return ResponseEntity.ok(ApiResponse.ok("User updated", user));
    }

    @PutMapping("/users/{id}/roles")
    public ResponseEntity<ApiResponse<UserDto>> updateUserRoles(
            @PathVariable UUID id,
            @RequestBody UpdateRolesRequest request) {
        UserDto user = authService.updateUserRoles(id, request.getRoles());
        return ResponseEntity.ok(ApiResponse.ok("Roles updated", user));
    }

    @PutMapping("/users/{id}/status")
    public ResponseEntity<ApiResponse<UserDto>> updateUserStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, Boolean> request) {
        UserDto user = authService.updateUserStatus(id, request.getOrDefault("active", true));
        return ResponseEntity.ok(ApiResponse.ok("Status updated", user));
    }

    @GetMapping("/roles")
    public ResponseEntity<ApiResponse<List<RoleDto>>> getAllRoles() {
        List<RoleDto> roles = authService.getAllRoles();
        return ResponseEntity.ok(ApiResponse.ok(roles));
    }
}
