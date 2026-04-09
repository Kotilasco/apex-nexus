package com.apexnexus.auth.repository;

import com.apexnexus.auth.model.PluginHook;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PluginHookRepository extends JpaRepository<PluginHook, UUID> {
    List<PluginHook> findByPluginIdAndIsActiveTrueOrderByExecutionOrderAsc(UUID pluginId);
    List<PluginHook> findByEventNameAndIsActiveTrueOrderByExecutionOrderAsc(String eventName);
}
