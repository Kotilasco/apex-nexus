package com.apexnexus.auth.repository;

import com.apexnexus.auth.model.ProjectPlugin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProjectPluginRepository extends JpaRepository<ProjectPlugin, UUID> {

    List<ProjectPlugin> findByProjectId(UUID projectId);

    List<ProjectPlugin> findByProjectIdAndIsActiveTrue(UUID projectId);

    Optional<ProjectPlugin> findByProjectIdAndPluginId(UUID projectId, UUID pluginId);

    boolean existsByProjectIdAndPluginId(UUID projectId, UUID pluginId);
}
