package com.apexnexus.auth.repository;

import com.apexnexus.auth.model.ProjectMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMember, UUID> {
    List<ProjectMember> findByUserId(UUID userId);
    List<ProjectMember> findByProjectId(UUID projectId);
    Optional<ProjectMember> findByProjectIdAndUserId(UUID projectId, UUID userId);
    boolean existsByProjectIdAndUserId(UUID projectId, UUID userId);

    @Query("SELECT pm FROM ProjectMember pm WHERE pm.userId = :userId AND pm.projectId IN " +
           "(SELECT p.id FROM Project p WHERE p.isActive = true)")
    List<ProjectMember> findActiveProjectMemberships(UUID userId);
}
