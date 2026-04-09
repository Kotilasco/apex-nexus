package com.apexnexus.auth.service;

import com.apexnexus.auth.dto.PluginDto;
import com.apexnexus.auth.dto.PluginHookDto;
import com.apexnexus.auth.model.PluginHook;
import com.apexnexus.auth.model.PluginRegistry;
import com.apexnexus.auth.repository.PluginHookRepository;
import com.apexnexus.auth.repository.PluginRegistryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PluginService {

    private final PluginRegistryRepository pluginRepository;
    private final PluginHookRepository hookRepository;

    @Transactional(readOnly = true)
    public List<PluginDto> getAllPlugins() {
        return pluginRepository.findAllByOrderByDisplayNameAsc().stream()
                .map(this::toPluginDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PluginDto> getActivePlugins() {
        return pluginRepository.findByStatusOrderByDisplayNameAsc("active").stream()
                .map(this::toPluginDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PluginDto getPlugin(UUID id) {
        PluginRegistry plugin = pluginRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Plugin not found: " + id));
        PluginDto dto = toPluginDto(plugin);
        dto.setHooks(hookRepository.findByPluginIdAndIsActiveTrueOrderByExecutionOrderAsc(id).stream()
                .map(this::toHookDto)
                .collect(Collectors.toList()));
        return dto;
    }

    @Transactional(readOnly = true)
    public PluginDto getPluginByName(String name) {
        PluginRegistry plugin = pluginRepository.findByName(name)
                .orElseThrow(() -> new RuntimeException("Plugin not found: " + name));
        return toPluginDto(plugin);
    }

    @Transactional(readOnly = true)
    public List<PluginDto> getPluginsByType(String type) {
        return pluginRepository.findByPluginTypeOrderByDisplayNameAsc(type).stream()
                .map(this::toPluginDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PluginDto> getPluginsByCategory(String category) {
        return pluginRepository.findByCategoryOrderByDisplayNameAsc(category).stream()
                .map(this::toPluginDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public PluginDto activatePlugin(UUID id) {
        PluginRegistry plugin = pluginRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Plugin not found: " + id));
        plugin.setStatus("ACTIVE");
        plugin.setInstalledCount(plugin.getInstalledCount() != null ? plugin.getInstalledCount() + 1 : 1);
        return toPluginDto(pluginRepository.save(plugin));
    }

    @Transactional
    public PluginDto deactivatePlugin(UUID id) {
        PluginRegistry plugin = pluginRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Plugin not found: " + id));
        plugin.setStatus("INACTIVE");
        return toPluginDto(pluginRepository.save(plugin));
    }

    @Transactional(readOnly = true)
    public List<PluginHookDto> getHooksForEvent(String eventName) {
        return hookRepository.findByEventNameAndIsActiveTrueOrderByExecutionOrderAsc(eventName).stream()
                .map(this::toHookDto)
                .collect(Collectors.toList());
    }

    private PluginDto toPluginDto(PluginRegistry p) {
        return PluginDto.builder()
                .id(p.getId())
                .name(p.getName())
                .displayName(p.getDisplayName())
                .description(p.getDescription())
                .version(p.getVersion())
                .vendor(p.getVendor())
                .pluginType(p.getPluginType())
                .category(p.getCategory())
                .status(p.getStatus())
                .configSchema(p.getConfigSchema())
                .capabilities(p.getCapabilities())
                .iconUrl(p.getIconUrl())
                .documentationUrl(p.getDocumentationUrl())
                .isPremium(p.getIsPremium())
                .installedCount(p.getInstalledCount())
                .createdAt(p.getCreatedAt())
                .build();
    }

    private PluginHookDto toHookDto(PluginHook h) {
        return PluginHookDto.builder()
                .id(h.getId())
                .hookType(h.getHookType())
                .eventName(h.getEventName())
                .handlerConfig(h.getHandlerConfig())
                .executionOrder(h.getExecutionOrder())
                .isActive(h.getIsActive())
                .build();
    }
}
