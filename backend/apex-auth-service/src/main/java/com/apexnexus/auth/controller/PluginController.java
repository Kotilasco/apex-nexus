package com.apexnexus.auth.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.auth.dto.PluginDto;
import com.apexnexus.auth.dto.PluginHookDto;
import com.apexnexus.auth.service.PluginService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/auth/plugins")
@RequiredArgsConstructor
public class PluginController {

    private final PluginService pluginService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<PluginDto>>> getAllPlugins() {
        return ResponseEntity.ok(ApiResponse.success(pluginService.getAllPlugins()));
    }

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<PluginDto>>> getActivePlugins() {
        return ResponseEntity.ok(ApiResponse.success(pluginService.getActivePlugins()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PluginDto>> getPlugin(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(pluginService.getPlugin(id)));
    }

    @GetMapping("/by-name/{name}")
    public ResponseEntity<ApiResponse<PluginDto>> getPluginByName(@PathVariable String name) {
        return ResponseEntity.ok(ApiResponse.success(pluginService.getPluginByName(name)));
    }

    @GetMapping("/by-type/{type}")
    public ResponseEntity<ApiResponse<List<PluginDto>>> getPluginsByType(@PathVariable String type) {
        return ResponseEntity.ok(ApiResponse.success(pluginService.getPluginsByType(type)));
    }

    @GetMapping("/by-category/{category}")
    public ResponseEntity<ApiResponse<List<PluginDto>>> getPluginsByCategory(@PathVariable String category) {
        return ResponseEntity.ok(ApiResponse.success(pluginService.getPluginsByCategory(category)));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<ApiResponse<PluginDto>> activatePlugin(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(pluginService.activatePlugin(id)));
    }

    @PostMapping("/{id}/deactivate")
    public ResponseEntity<ApiResponse<PluginDto>> deactivatePlugin(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(pluginService.deactivatePlugin(id)));
    }

    @GetMapping("/hooks/{eventName}")
    public ResponseEntity<ApiResponse<List<PluginHookDto>>> getHooksForEvent(@PathVariable String eventName) {
        return ResponseEntity.ok(ApiResponse.success(pluginService.getHooksForEvent(eventName)));
    }
}
