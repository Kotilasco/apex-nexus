package com.apexnexus.auth.repository;

import com.apexnexus.auth.model.PluginRegistry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PluginRegistryRepository extends JpaRepository<PluginRegistry, UUID> {
    Optional<PluginRegistry> findByName(String name);
    List<PluginRegistry> findByStatusOrderByDisplayNameAsc(String status);
    List<PluginRegistry> findByPluginTypeOrderByDisplayNameAsc(String pluginType);
    List<PluginRegistry> findByCategoryOrderByDisplayNameAsc(String category);
    List<PluginRegistry> findByStatusAndPluginTypeOrderByDisplayNameAsc(String status, String pluginType);
    List<PluginRegistry> findAllByOrderByDisplayNameAsc();
}
