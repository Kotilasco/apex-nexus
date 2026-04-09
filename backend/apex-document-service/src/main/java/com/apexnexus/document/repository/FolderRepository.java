package com.apexnexus.document.repository;

import com.apexnexus.document.model.Folder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FolderRepository extends JpaRepository<Folder, UUID> {
    List<Folder> findByParentIdOrderByNameAsc(UUID parentId);
    List<Folder> findByParentIdIsNullOrderByNameAsc();
    List<Folder> findByOwnerId(UUID ownerId);
    boolean existsByParentIdAndName(UUID parentId, String name);
    List<Folder> findByProjectIdOrderByNameAsc(UUID projectId);
    List<Folder> findByProjectIdAndParentIdOrderByNameAsc(UUID projectId, UUID parentId);
    List<Folder> findByProjectIdAndParentIdIsNullOrderByNameAsc(UUID projectId);
}
