package com.apexnexus.workflow.repository;

import com.apexnexus.workflow.model.ApprovalGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApprovalGroupRepository extends JpaRepository<ApprovalGroup, UUID> {

    @Query("SELECT ag FROM ApprovalGroup ag LEFT JOIN FETCH ag.members WHERE ag.id = :id")
    Optional<ApprovalGroup> findByIdWithMembers(@Param("id") UUID id);

    @Query("SELECT DISTINCT ag FROM ApprovalGroup ag LEFT JOIN FETCH ag.members")
    List<ApprovalGroup> findAllWithMembers();
}
