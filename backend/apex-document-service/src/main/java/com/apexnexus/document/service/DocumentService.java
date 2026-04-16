package com.apexnexus.document.service;

import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.exception.BusinessException;
import com.apexnexus.common.exception.ConflictException;
import com.apexnexus.common.exception.ResourceNotFoundException;
import com.apexnexus.document.dto.*;
import com.apexnexus.document.model.Document;
import com.apexnexus.document.model.DocumentNote;
import com.apexnexus.document.model.DocumentVersion;
import com.apexnexus.document.repository.DocumentNoteRepository;
import com.apexnexus.document.repository.DocumentRepository;
import com.apexnexus.document.repository.DocumentVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final DocumentNoteRepository noteRepository;
    private final StorageService storageService;
    private final RedisTemplate<String, String> redisTemplate;
    private final AuditPublisher auditPublisher;
    private final LockService lockService;
    private final SearchIndexPublisher searchIndexPublisher;
    private final JdbcTemplate jdbcTemplate;
    private final VersionAnomalyClient versionAnomalyClient;

    @Transactional
    public DocumentDto createDocument(CreateDocumentRequest request, MultipartFile file, UUID authorId)
            throws Exception {
        byte[] fileData = file.getBytes();
        String sha256 = storageService.calculateSha256(fileData);
        String objectGuid = UUID.randomUUID().toString().replace("-", "");
        String extension = getFileExtension(file.getOriginalFilename());
        String storageKey = String.format("documents/%s/v1/%s", objectGuid, file.getOriginalFilename());

        // Store encrypted file in MinIO
        storageService.storeFile(fileData, storageKey, file.getContentType());

        // Resolve projectId from folder if not explicitly provided
        UUID resolvedProjectId = request.getProjectId();
        if (resolvedProjectId == null && request.getFolderId() != null) {
            try {
                UUID folderProjectId = jdbcTemplate.queryForObject(
                        "SELECT project_id FROM folders WHERE id = ?",
                        UUID.class, request.getFolderId());
                if (folderProjectId != null) {
                    resolvedProjectId = folderProjectId;
                    log.info("Inherited project {} from folder {}", resolvedProjectId, request.getFolderId());
                }
            } catch (Exception e) {
                log.debug("Could not resolve project from folder {}", request.getFolderId());
            }
        }

        // Resolve retention/compliance defaults from project settings
        int retentionYears = request.getRetentionPeriodYears() != null ? request.getRetentionPeriodYears() : 20;
        boolean privacyRedaction = false;

        if (resolvedProjectId != null) {
            try {
                Map<String, Object> project = jdbcTemplate.queryForMap(
                        "SELECT default_retention_period_years, privacy_redaction_enabled, " +
                                "jurisdiction_code FROM projects WHERE id = ?",
                        resolvedProjectId);

                Integer projectRetention = (Integer) project.get("default_retention_period_years");
                if (projectRetention != null && projectRetention > retentionYears) {
                    retentionYears = projectRetention;
                }

                Boolean projectPrivacy = (Boolean) project.get("privacy_redaction_enabled");
                if (Boolean.TRUE.equals(projectPrivacy)) {
                    privacyRedaction = true;
                }

                // Apply jurisdiction minimum retention if project has a jurisdiction
                String jurisdictionCode = (String) project.get("jurisdiction_code");
                if (jurisdictionCode != null && !jurisdictionCode.isBlank()) {
                    try {
                        Integer minRetention = jdbcTemplate.queryForObject(
                                "SELECT MAX(jrr.min_retention_years) FROM jurisdiction_retention_rules jrr " +
                                        "JOIN jurisdictions j ON jrr.jurisdiction_id = j.id WHERE j.code = ?",
                                Integer.class, jurisdictionCode);
                        if (minRetention != null && minRetention > retentionYears) {
                            retentionYears = minRetention;
                        }
                    } catch (Exception e) {
                        log.debug("No jurisdiction retention rules found for {}", jurisdictionCode);
                    }
                }
            } catch (Exception e) {
                log.warn("Could not look up project {} for retention defaults", resolvedProjectId, e);
            }
        }

        Document doc = Document.builder()
                .objectGuid(objectGuid)
                .folderId(request.getFolderId())
                .projectId(resolvedProjectId)
                .title(request.getTitle())
                .description(request.getDescription())
                .mimeType(file.getContentType())
                .fileExtension(extension)
                .sha256Hash(sha256)
                .fileSizeBytes((long) fileData.length)
                .storageKey(storageKey)
                .authorId(authorId)
                .tags(request.getTags())
                .metadataJson(request.getMetadata() != null ? request.getMetadata() : new HashMap<>())
                .retentionPeriodYears(retentionYears)
                .retentionStartDate(Instant.now())
                .privacyRedactionEnabled(privacyRedaction)
                .build();

        doc = documentRepository.save(doc);

        // Create initial version entry
        DocumentVersion version = DocumentVersion.builder()
                .document(doc)
                .versionNumber(1)
                .sha256Hash(sha256)
                .fileSizeBytes((long) fileData.length)
                .storageKey(storageKey)
                .authorId(authorId)
                .changeSummary("Initial upload")
                .build();
        versionRepository.save(version);

        auditPublisher.publish(AuditEvent.builder()
                .userId(authorId)
                .action("CREATE")
                .resourceType("DOCUMENT")
                .resourceId(doc.getId())
                .resourceName(doc.getTitle())
                .details(Map.of("sha256", sha256, "size", fileData.length))
                .build());

        // Publish to search index queue for Elasticsearch indexing
        searchIndexPublisher.publishIndex(doc, fileData);

        return mapToDto(doc);
    }

    @Transactional(readOnly = true)
    public DocumentDto getDocument(UUID documentId) {
        Document doc = findDocumentOrThrow(documentId);
        return mapToDto(doc);
    }

    @Transactional(readOnly = true)
    public Page<DocumentDto> getDocumentsByFolder(UUID folderId, Pageable pageable) {
        return documentRepository.findByFolderId(folderId, pageable).map(this::mapToDto);
    }

    @Transactional(readOnly = true)
    public Page<DocumentDto> getMyDocuments(UUID authorId, Pageable pageable) {
        return documentRepository.findByAuthorId(authorId, pageable).map(this::mapToDto);
    }

    @Transactional(readOnly = true)
    public Page<DocumentDto> getDocumentsByProject(UUID projectId, Pageable pageable) {
        return documentRepository.findByProjectId(projectId, pageable).map(this::mapToDto);
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> getMyCheckouts(UUID userId) {
        return documentRepository.findCheckedOutByUser(userId).stream().map(this::mapToDto).toList();
    }

    @Transactional(readOnly = true)
    public Page<DocumentDto> getDocumentsByProjectAndFolder(UUID projectId, UUID folderId, Pageable pageable) {
        return documentRepository.findByProjectIdAndFolderId(projectId, folderId, pageable).map(this::mapToDto);
    }

    public byte[] downloadDocument(UUID documentId, UUID userId) throws Exception {
        Document doc = findDocumentOrThrow(documentId);
        byte[] data = storageService.retrieveFile(doc.getStorageKey());

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("DOWNLOAD")
                .resourceType("DOCUMENT")
                .resourceId(documentId)
                .resourceName(doc.getTitle())
                .build());

        return data;
    }

    // ============ CHECK-OUT / CHECK-IN ============

    @Transactional
    public DocumentDto updateDocument(UUID documentId, UpdateDocumentRequest request, UUID userId) {
        Document doc = findDocumentOrThrow(documentId);

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            doc.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            doc.setDescription(request.getDescription());
        }
        if (request.getStatus() != null) {
            doc.setStatus(request.getStatus());
        }
        if (request.getFolderId() != null) {
            doc.setFolderId(request.getFolderId());
        }
        if (request.getTags() != null) {
            doc.setTags(request.getTags());
        }
        if (request.getMetadata() != null) {
            doc.setMetadataJson(request.getMetadata());
        }

        // Assign document to a project — also inherit retention/privacy settings
        if (request.getProjectId() != null) {
            doc.setProjectId(request.getProjectId());
            try {
                Map<String, Object> project = jdbcTemplate.queryForMap(
                        "SELECT default_retention_period_years, privacy_redaction_enabled, " +
                                "jurisdiction_code FROM projects WHERE id = ?",
                        request.getProjectId());

                Integer projectRetention = (Integer) project.get("default_retention_period_years");
                int currentRetention = doc.getRetentionPeriodYears() != null ? doc.getRetentionPeriodYears() : 0;
                if (projectRetention != null && projectRetention > currentRetention) {
                    doc.setRetentionPeriodYears(projectRetention);
                }

                Boolean projectPrivacy = (Boolean) project.get("privacy_redaction_enabled");
                if (Boolean.TRUE.equals(projectPrivacy)) {
                    doc.setPrivacyRedactionEnabled(true);
                }

                String jurisdictionCode = (String) project.get("jurisdiction_code");
                if (jurisdictionCode != null && !jurisdictionCode.isBlank()) {
                    try {
                        Integer minRetention = jdbcTemplate.queryForObject(
                                "SELECT MAX(jrr.min_retention_years) FROM jurisdiction_retention_rules jrr " +
                                        "JOIN jurisdictions j ON jrr.jurisdiction_id = j.id WHERE j.code = ?",
                                Integer.class, jurisdictionCode);
                        int docRetention = doc.getRetentionPeriodYears() != null ? doc.getRetentionPeriodYears() : 0;
                        if (minRetention != null && minRetention > docRetention) {
                            doc.setRetentionPeriodYears(minRetention);
                        }
                    } catch (Exception e) {
                        log.debug("No jurisdiction retention rules found for {}", jurisdictionCode);
                    }
                }
            } catch (Exception e) {
                log.warn("Could not look up project {} for retention defaults on assign", request.getProjectId(), e);
            }
        }

        doc = documentRepository.save(doc);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("UPDATE_METADATA")
                .resourceType("DOCUMENT")
                .resourceId(documentId)
                .resourceName(doc.getTitle())
                .build());

        // Update search index
        searchIndexPublisher.publishUpdate(doc);

        return mapToDto(doc);
    }

    public String getTextContent(UUID documentId, UUID userId) throws Exception {
        Document doc = findDocumentOrThrow(documentId);
        String mime = doc.getMimeType() != null ? doc.getMimeType() : "";

        // For text-based files, read raw bytes directly
        if (mime.startsWith("text/") || mime.equals("application/json")) {
            byte[] data = storageService.retrieveFile(doc.getStorageKey());
            return new String(data, java.nio.charset.StandardCharsets.UTF_8);
        }

        // For binary files (PDF, Word, etc.), return Tika-extracted text if available
        String extracted = doc.getExtractedContent();
        if (extracted != null && !extracted.isBlank()) {
            return extracted;
        }

        throw new BusinessException(
                "No extracted text available for this document. The file may not have been processed yet.");
    }

    public String getExtractedContent(UUID documentId) {
        Document doc = findDocumentOrThrow(documentId);
        return doc.getExtractedContent();
    }

    public String getRawTextContent(UUID documentId) throws Exception {
        Document doc = findDocumentOrThrow(documentId);
        byte[] data = storageService.retrieveFile(doc.getStorageKey());
        return new String(data, java.nio.charset.StandardCharsets.UTF_8);
    }

    @Transactional
    public DocumentDto updateTextContent(UUID documentId, String content, UUID userId) throws Exception {
        Document doc = findDocumentOrThrow(documentId);
        String mime = doc.getMimeType() != null ? doc.getMimeType() : "";
        if (!mime.startsWith("text/") && !mime.equals("application/json")) {
            throw new BusinessException("Only text-based documents can be edited");
        }
        if (Boolean.TRUE.equals(doc.getLegalHold())) {
            throw new BusinessException("Cannot edit a document under legal hold");
        }

        byte[] newData = content.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String sha256 = storageService.calculateSha256(newData);
        int newVersion = doc.getCurrentVersion() + 1;
        String storageKey = String.format("documents/%s/v%d/%s.%s",
                doc.getObjectGuid(), newVersion, doc.getTitle(), doc.getFileExtension());

        storageService.storeFile(newData, storageKey, mime);

        DocumentVersion version = DocumentVersion.builder()
                .document(doc)
                .versionNumber(newVersion)
                .storageKey(storageKey)
                .sha256Hash(sha256)
                .fileSizeBytes((long) newData.length)
                .authorId(userId)
                .changeSummary("Edited via text editor")
                .build();
        versionRepository.save(version);

        doc.setCurrentVersion(newVersion);
        doc.setStorageKey(storageKey);
        doc.setSha256Hash(sha256);
        doc.setFileSizeBytes((long) newData.length);
        doc = documentRepository.save(doc);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("EDIT_CONTENT")
                .resourceType("DOCUMENT")
                .resourceId(documentId)
                .resourceName(doc.getTitle())
                .details(Map.of("newVersion", newVersion, "sizeBytes", newData.length))
                .build());

        searchIndexPublisher.publishUpdate(doc);
        return mapToDto(doc);
    }

    @Transactional
    public void deleteDocument(UUID documentId, UUID userId) {
        Document doc = findDocumentOrThrow(documentId);

        if (Boolean.TRUE.equals(doc.getLegalHold())) {
            throw new BusinessException("Cannot delete a document under legal hold");
        }
        if (Boolean.TRUE.equals(doc.getIsCheckedOut())) {
            throw new BusinessException("Cannot delete a checked-out document");
        }

        // Delete all version files from storage
        List<DocumentVersion> versions = versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);
        for (DocumentVersion v : versions) {
            try {
                storageService.deleteFile(v.getStorageKey());
            } catch (Exception e) {
                log.warn("Failed to delete version file {}: {}", v.getStorageKey(), e.getMessage());
            }
        }

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("DELETE")
                .resourceType("DOCUMENT")
                .resourceId(documentId)
                .resourceName(doc.getTitle())
                .details(Map.of("versions", versions.size()))
                .build());

        documentRepository.delete(doc);
        // Remove from search index
        searchIndexPublisher.publishDelete(documentId);
        // Clean up any Redis lock keys for the deleted document
        redisTemplate.delete("lock:" + documentId);
        redisTemplate.delete("lock:" + documentId + ":token");
        redisTemplate.delete("lock:" + documentId + ":heartbeat");
        redisTemplate.delete("lock:" + documentId + ":draft");
    }

    @Transactional
    public DocumentDto rollbackToVersion(UUID documentId, int versionNumber, UUID userId) {
        Document doc = findDocumentOrThrow(documentId);

        if (Boolean.TRUE.equals(doc.getIsCheckedOut())) {
            throw new BusinessException("Cannot rollback a checked-out document");
        }
        if (Boolean.TRUE.equals(doc.getLegalHold())) {
            throw new BusinessException("Cannot rollback a document under legal hold");
        }

        DocumentVersion targetVersion = versionRepository.findByDocumentIdAndVersionNumber(documentId, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Version", "number", versionNumber));

        // Create a new version that points to the same storage as the target version
        int newVersionNumber = doc.getCurrentVersion() + 1;
        DocumentVersion rollbackVersion = DocumentVersion.builder()
                .document(doc)
                .versionNumber(newVersionNumber)
                .sha256Hash(targetVersion.getSha256Hash())
                .fileSizeBytes(targetVersion.getFileSizeBytes())
                .storageKey(targetVersion.getStorageKey())
                .authorId(userId)
                .changeSummary("Rollback to version " + versionNumber)
                .versionType("MAJOR")
                .build();
        versionRepository.save(rollbackVersion);

        doc.setCurrentVersion(newVersionNumber);
        doc.setSha256Hash(targetVersion.getSha256Hash());
        doc.setFileSizeBytes(targetVersion.getFileSizeBytes());
        doc.setStorageKey(targetVersion.getStorageKey());
        doc = documentRepository.save(doc);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("VERSION_ROLLBACK")
                .resourceType("DOCUMENT")
                .resourceId(documentId)
                .resourceName(doc.getTitle())
                .details(Map.of("fromVersion", doc.getCurrentVersion() - 1,
                        "toVersion", versionNumber, "newVersion", newVersionNumber))
                .build());

        return mapToDto(doc);
    }

    @Transactional
    public DocumentDto checkOut(UUID documentId, UUID userId) {
        Document doc = findDocumentOrThrow(documentId);

        // Use LockService for distributed locking (handles Redis + DB checkout)
        LockService.LockResult result = lockService.acquireLock(documentId, userId);
        if (result.status() == LockService.LockResult.Status.CONFLICT) {
            throw new ConflictException("Document is already checked out by another user");
        }

        // Reload doc after lockService may have updated it
        doc = findDocumentOrThrow(documentId);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("CHECKOUT")
                .resourceType("DOCUMENT")
                .resourceId(documentId)
                .resourceName(doc.getTitle())
                .build());

        return mapToDto(doc);
    }

    @Transactional
    public DocumentDto checkIn(UUID documentId, MultipartFile file, String changeSummary, UUID userId)
            throws Exception {
        return checkIn(documentId, file, changeSummary, "MAJOR", userId);
    }

    @Transactional
    public DocumentDto checkIn(UUID documentId, MultipartFile file, String changeSummary, String versionType,
            UUID userId) throws Exception {
        Document doc = findDocumentOrThrow(documentId);

        if (!Boolean.TRUE.equals(doc.getIsCheckedOut())) {
            throw new BusinessException("Document is not checked out");
        }
        if (!userId.equals(doc.getCheckedOutBy())) {
            throw new BusinessException("Document is checked out by a different user");
        }

        byte[] fileData = file.getBytes();
        String sha256 = storageService.calculateSha256(fileData);
        // Determine next version from actual DB records (not doc.currentVersion which
        // can be stale)
        int newVersion = versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId)
                .stream().findFirst().map(v -> v.getVersionNumber() + 1).orElse(1);
        String storageKey = String.format("documents/%s/v%d/%s", doc.getObjectGuid(), newVersion,
                file.getOriginalFilename());

        storageService.storeFile(fileData, storageKey, file.getContentType());

        // Create new version with type support
        String resolvedType = (versionType != null && !versionType.isBlank()) ? versionType.toUpperCase() : "MAJOR";
        DocumentVersion version = DocumentVersion.builder()
                .document(doc)
                .versionNumber(newVersion)
                .sha256Hash(sha256)
                .fileSizeBytes((long) fileData.length)
                .storageKey(storageKey)
                .authorId(userId)
                .changeSummary(changeSummary)
                .versionType(resolvedType)
                .build();
        versionRepository.save(version);

        // AI-powered version anomaly detection: run async AFTER transaction commits
        // so the version record is visible to the new thread
        if (newVersion > 1) {
            final UUID versionId = version.getId();
            final UUID docId = doc.getId();
            final byte[] newFileData = fileData;
            final String origFilename = file.getOriginalFilename();
            final String contentType = file.getContentType();
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    Thread.startVirtualThread(
                            () -> runAnomalyCheckAsync(versionId, docId, newFileData, origFilename, contentType));
                }
            });
        }

        // Update document
        doc.setCurrentVersion(newVersion);
        doc.setSha256Hash(sha256);
        doc.setFileSizeBytes((long) fileData.length);
        doc.setStorageKey(storageKey);
        doc = documentRepository.save(doc);

        // Release lock via LockService (handles Redis cleanup + DB checkout clear +
        // draft cleanup)
        lockService.releaseLock(documentId, userId);

        // Reload doc after lock release
        doc = findDocumentOrThrow(documentId);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("CHECKIN")
                .resourceType("DOCUMENT")
                .resourceId(documentId)
                .resourceName(doc.getTitle())
                .details(Map.of("version", newVersion, "sha256", sha256))
                .build());

        // Reindex with new file content
        searchIndexPublisher.publishReindex(doc, fileData);

        return mapToDto(doc);
    }

    @Transactional
    public DocumentDto cancelCheckOut(UUID documentId, UUID userId) {
        Document doc = findDocumentOrThrow(documentId);

        if (!Boolean.TRUE.equals(doc.getIsCheckedOut())) {
            throw new BusinessException("Document is not checked out");
        }
        if (!userId.equals(doc.getCheckedOutBy())) {
            throw new BusinessException("Document is checked out by a different user");
        }

        lockService.releaseLock(documentId, userId);

        // Reload doc
        doc = findDocumentOrThrow(documentId);
        return mapToDto(doc);
    }

    // ============ NOTES ============

    @Transactional
    public DocumentNoteDto addNote(UUID documentId, CreateNoteRequest request, UUID authorId) {
        Document doc = findDocumentOrThrow(documentId);

        DocumentNote note = DocumentNote.builder()
                .document(doc)
                .authorId(authorId)
                .content(request.getContent())
                .noteType(request.getNoteType())
                .isPinned(request.getIsPinned())
                .color(request.getColor())
                .parentNoteId(request.getParentNoteId())
                .build();

        note = noteRepository.save(note);

        auditPublisher.publish(AuditEvent.builder()
                .userId(authorId)
                .action("ADD_NOTE")
                .resourceType("DOCUMENT")
                .resourceId(documentId)
                .resourceName(doc.getTitle())
                .build());

        return mapNoteToDto(note);
    }

    @Transactional(readOnly = true)
    public List<DocumentNoteDto> getNotes(UUID documentId) {
        return noteRepository.findByDocumentIdOrderByIsPinnedDescCreatedAtDesc(documentId)
                .stream()
                .map(this::mapNoteToDto)
                .toList();
    }

    @Transactional
    public void deleteNote(UUID noteId, UUID userId) {
        DocumentNote note = noteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("Note", "id", noteId));
        if (!userId.equals(note.getAuthorId())) {
            throw new BusinessException("Only the note author can delete this note");
        }
        noteRepository.delete(note);
    }

    @Transactional
    public DocumentNoteDto updateNote(UUID noteId, CreateNoteRequest request, UUID userId) {
        DocumentNote note = noteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("Note", "id", noteId));
        if (!userId.equals(note.getAuthorId())) {
            throw new BusinessException("Only the note author can update this note");
        }

        if (request.getContent() != null && !request.getContent().isBlank()) {
            note.setContent(request.getContent());
        }
        if (request.getNoteType() != null) {
            note.setNoteType(request.getNoteType());
        }
        if (request.getIsPinned() != null) {
            note.setIsPinned(request.getIsPinned());
        }
        if (request.getColor() != null) {
            note.setColor(request.getColor());
        }

        note = noteRepository.save(note);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("UPDATE_NOTE")
                .resourceType("DOCUMENT")
                .resourceId(note.getDocument().getId())
                .build());

        return mapNoteToDto(note);
    }

    // ============ LEGAL HOLD ============

    /**
     * Re-index all existing documents into Elasticsearch with full content extraction.
     * Loads file data from storage so the search service can extract text for full-text search.
     * Returns the number of documents queued for indexing.
     */
    @Transactional(readOnly = true)
    public int reindexAll() {
        List<Document> allDocs = documentRepository.findAll();
        for (Document doc : allDocs) {
            byte[] fileData = null;
            try {
                if (doc.getStorageKey() != null) {
                    fileData = storageService.retrieveFile(doc.getStorageKey());
                }
            } catch (Exception e) {
                log.warn("Could not load file data for doc {} ({}): {}", doc.getId(), doc.getTitle(), e.getMessage());
            }
            searchIndexPublisher.publishIndex(doc, fileData);
        }
        log.info("Queued {} documents for re-indexing (with content)", allDocs.size());
        return allDocs.size();
    }

    @Transactional
    public DocumentDto setLegalHold(UUID documentId, String reason, UUID userId) {
        Document doc = findDocumentOrThrow(documentId);
        doc.setLegalHold(true);
        doc.setLegalHoldReason(reason);
        doc.setLegalHoldBy(userId);
        doc.setLegalHoldAt(Instant.now());
        doc = documentRepository.save(doc);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("LEGAL_HOLD_SET")
                .resourceType("DOCUMENT")
                .resourceId(documentId)
                .resourceName(doc.getTitle())
                .details(Map.of("reason", reason))
                .build());

        return mapToDto(doc);
    }

    @Transactional
    public DocumentDto removeLegalHold(UUID documentId, UUID userId) {
        Document doc = findDocumentOrThrow(documentId);
        doc.setLegalHold(false);
        doc.setLegalHoldReason(null);
        doc.setLegalHoldBy(null);
        doc.setLegalHoldAt(null);
        doc = documentRepository.save(doc);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("LEGAL_HOLD_REMOVED")
                .resourceType("DOCUMENT")
                .resourceId(documentId)
                .resourceName(doc.getTitle())
                .build());

        return mapToDto(doc);
    }

    // ============ VERSION HISTORY ============

    @Transactional(readOnly = true)
    public List<DocumentVersionDto> getVersionHistory(UUID documentId) {
        Document doc = findDocumentOrThrow(documentId);
        List<DocumentVersion> versions = versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);

        // Collect unique authorIds to resolve names in one query
        Set<UUID> authorIds = new HashSet<>();
        for (DocumentVersion v : versions) {
            if (v.getAuthorId() != null)
                authorIds.add(v.getAuthorId());
        }
        Map<UUID, String> authorNames = resolveUserNames(authorIds);

        String fileName = buildFileName(doc);
        return versions.stream()
                .map(v -> mapVersionToDto(v, doc.getId(), fileName,
                        authorNames.getOrDefault(v.getAuthorId(), "Unknown")))
                .toList();
    }

    public byte[] downloadVersion(UUID documentId, int versionNumber, UUID userId) throws Exception {
        DocumentVersion version = versionRepository.findByDocumentIdAndVersionNumber(documentId, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Version", "number", versionNumber));

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("DOWNLOAD_VERSION")
                .resourceType("DOCUMENT_VERSION")
                .resourceId(version.getId())
                .details(Map.of("documentId", documentId, "version", versionNumber))
                .build());

        return storageService.retrieveFile(version.getStorageKey());
    }

    // ============ COPY VERSION TO PROJECT ============

    @Transactional
    public DocumentDto copyVersionToProject(UUID documentId, int versionNumber,
            CopyVersionToProjectRequest request, UUID userId) throws Exception {
        Document sourceDoc = findDocumentOrThrow(documentId);
        DocumentVersion sourceVersion = versionRepository.findByDocumentIdAndVersionNumber(documentId, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Version", "number", versionNumber));

        // Retrieve the file from storage (decrypted)
        byte[] fileData = storageService.retrieveFile(sourceVersion.getStorageKey());
        String sha256 = storageService.calculateSha256(fileData);

        String title = (request.getTitle() != null && !request.getTitle().isBlank())
                ? request.getTitle()
                : sourceDoc.getTitle();
        String objectGuid = UUID.randomUUID().toString().replace("-", "");
        String fileName = buildFileName(sourceDoc);
        String storageKey = String.format("documents/%s/v1/%s", objectGuid, fileName);

        // Store encrypted copy in MinIO
        storageService.storeFile(fileData, storageKey, sourceDoc.getMimeType());

        // Resolve retention/privacy from target project
        int retentionYears = sourceDoc.getRetentionPeriodYears() != null ? sourceDoc.getRetentionPeriodYears() : 20;
        boolean privacyRedaction = false;

        try {
            Map<String, Object> project = jdbcTemplate.queryForMap(
                    "SELECT default_retention_period_years, privacy_redaction_enabled, " +
                            "jurisdiction_code FROM projects WHERE id = ?",
                    request.getTargetProjectId());

            Integer projectRetention = (Integer) project.get("default_retention_period_years");
            if (projectRetention != null && projectRetention > retentionYears) {
                retentionYears = projectRetention;
            }
            Boolean projectPrivacy = (Boolean) project.get("privacy_redaction_enabled");
            if (Boolean.TRUE.equals(projectPrivacy)) {
                privacyRedaction = true;
            }
            String jurisdictionCode = (String) project.get("jurisdiction_code");
            if (jurisdictionCode != null && !jurisdictionCode.isBlank()) {
                try {
                    Integer minRetention = jdbcTemplate.queryForObject(
                            "SELECT MAX(jrr.min_retention_years) FROM jurisdiction_retention_rules jrr " +
                                    "JOIN jurisdictions j ON jrr.jurisdiction_id = j.id WHERE j.code = ?",
                            Integer.class, jurisdictionCode);
                    if (minRetention != null && minRetention > retentionYears) {
                        retentionYears = minRetention;
                    }
                } catch (Exception e) {
                    log.debug("No jurisdiction retention rules for {}", jurisdictionCode);
                }
            }
        } catch (Exception e) {
            log.warn("Could not look up target project {} for retention", request.getTargetProjectId(), e);
        }

        Document newDoc = Document.builder()
                .objectGuid(objectGuid)
                .folderId(request.getTargetFolderId())
                .projectId(request.getTargetProjectId())
                .title(title)
                .description(sourceDoc.getDescription())
                .mimeType(sourceDoc.getMimeType())
                .fileExtension(sourceDoc.getFileExtension())
                .sha256Hash(sha256)
                .fileSizeBytes((long) fileData.length)
                .storageKey(storageKey)
                .authorId(userId)
                .tags(sourceDoc.getTags())
                .metadataJson(sourceDoc.getMetadataJson() != null ? new HashMap<>(sourceDoc.getMetadataJson())
                        : new HashMap<>())
                .retentionPeriodYears(retentionYears)
                .retentionStartDate(Instant.now())
                .privacyRedactionEnabled(privacyRedaction)
                .build();

        newDoc = documentRepository.save(newDoc);

        DocumentVersion newVersion = DocumentVersion.builder()
                .document(newDoc)
                .versionNumber(1)
                .sha256Hash(sha256)
                .fileSizeBytes((long) fileData.length)
                .storageKey(storageKey)
                .authorId(userId)
                .changeSummary("Copied from \"" + sourceDoc.getTitle() + "\" v" + versionNumber)
                .build();
        versionRepository.save(newVersion);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("COPY_VERSION_TO_PROJECT")
                .resourceType("DOCUMENT")
                .resourceId(newDoc.getId())
                .resourceName(newDoc.getTitle())
                .details(Map.of(
                        "sourceDocumentId", documentId.toString(),
                        "sourceVersion", versionNumber,
                        "targetProjectId", request.getTargetProjectId().toString()))
                .build());

        searchIndexPublisher.publishIndex(newDoc, fileData);

        return mapToDto(newDoc);
    }

    // ============ HELPERS ============

    /**
     * Pre-check a file before check-in: duplicate hash, format mismatch, similarity
     * score.
     */
    @Transactional(readOnly = true)
    public VersionPreCheckResult preCheckVersion(UUID documentId, MultipartFile file) throws Exception {
        Document doc = findDocumentOrThrow(documentId);
        byte[] fileData = file.getBytes();
        String sha256 = storageService.calculateSha256(fileData);
        List<String> warnings = new ArrayList<>();

        // 1. DUPLICATE CHECK — hash fingerprint across ALL documents
        boolean duplicateFound = false;
        UUID duplicateDocId = null;
        String duplicateDocTitle = null;
        Integer duplicateVersionNum = null;

        List<DocumentVersion> hashMatches = versionRepository.findBySha256Hash(sha256);
        for (DocumentVersion match : hashMatches) {
            // Skip versions belonging to this same document
            if (match.getDocument().getId().equals(documentId))
                continue;
            duplicateFound = true;
            duplicateDocId = match.getDocument().getId();
            duplicateDocTitle = match.getDocument().getTitle();
            duplicateVersionNum = match.getVersionNumber();
            warnings.add(String.format("Duplicate detected: Identical file already exists as \"%s\" (Version %d)",
                    duplicateDocTitle, duplicateVersionNum));
            break;
        }

        // 2. FORMAT / MIME TYPE MISMATCH
        boolean formatMismatch = false;
        String previousFormat = doc.getMimeType();
        String newFormat = file.getContentType();

        if (previousFormat != null && newFormat != null && !previousFormat.equals(newFormat)) {
            formatMismatch = true;
            warnings.add(String.format("Format mismatch: Previous version was %s, new file is %s",
                    humanMimeType(previousFormat), humanMimeType(newFormat)));
        }

        // 3. SIMILARITY SCORE — call search service for quick comparison
        Double similarityScore = null;
        boolean highRisk = false;

        List<DocumentVersion> versions = versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);
        if (!versions.isEmpty()) {
            DocumentVersion prevVersion = versions.get(0);
            try {
                byte[] prevFileData = storageService.retrieveFile(prevVersion.getStorageKey());
                if (prevFileData != null && prevFileData.length > 0) {
                    String prevFileName = buildFileName(doc);
                    VersionAnomalyClient.AnomalyResult result = versionAnomalyClient.checkAnomaly(
                            prevFileData, prevFileName, doc.getMimeType(),
                            fileData, file.getOriginalFilename(), file.getContentType());

                    if (result != null) {
                        similarityScore = result.similarityScore() != null
                                ? result.similarityScore().doubleValue()
                                : null;
                        if (similarityScore != null && similarityScore < 0.20) {
                            highRisk = true;
                            warnings.add(String.format(
                                    "High-Risk Version: Content similarity is only %.0f%% — this may be a completely different document",
                                    similarityScore * 100));
                        }
                        // Add any additional reasons from the anomaly check
                        if (result.reasons() != null) {
                            for (String reason : result.reasons()) {
                                if (!warnings.stream().anyMatch(w -> w.contains(reason))) {
                                    warnings.add(reason);
                                }
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Pre-check similarity analysis failed for doc {}: {}", documentId, e.getMessage());
            }
        }

        return VersionPreCheckResult.builder()
                .duplicateFound(duplicateFound)
                .duplicateDocumentId(duplicateDocId)
                .duplicateDocumentTitle(duplicateDocTitle)
                .duplicateVersionNumber(duplicateVersionNum)
                .formatMismatch(formatMismatch)
                .previousFormat(previousFormat)
                .newFormat(newFormat)
                .similarityScore(similarityScore)
                .highRisk(highRisk)
                .warnings(warnings)
                .build();
    }

    /**
     * Compare two versions' text content for visual side-by-side comparison.
     */
    @Transactional(readOnly = true)
    public Map<String, String> compareVersionTexts(UUID documentId, int version1, int version2) throws Exception {
        findDocumentOrThrow(documentId);

        DocumentVersion v1 = versionRepository.findByDocumentIdAndVersionNumber(documentId, version1)
                .orElseThrow(() -> new ResourceNotFoundException("Version", "number", version1));
        DocumentVersion v2 = versionRepository.findByDocumentIdAndVersionNumber(documentId, version2)
                .orElseThrow(() -> new ResourceNotFoundException("Version", "number", version2));

        byte[] v1Data = storageService.retrieveFile(v1.getStorageKey());
        byte[] v2Data = storageService.retrieveFile(v2.getStorageKey());

        // Call search service to extract text from both files
        String v1Text = extractTextViaSearchService(v1Data, v1.getStorageKey());
        String v2Text = extractTextViaSearchService(v2Data, v2.getStorageKey());

        return Map.of(
                "version1", String.valueOf(version1),
                "version2", String.valueOf(version2),
                "text1", v1Text != null ? v1Text : "(No extractable text)",
                "text2", v2Text != null ? v2Text : "(No extractable text)");
    }

    private String extractTextViaSearchService(byte[] fileData, String filename) {
        try {
            return versionAnomalyClient.extractText(fileData, filename);
        } catch (Exception e) {
            log.warn("Text extraction failed for {}: {}", filename, e.getMessage());
            return null;
        }
    }

    private String humanMimeType(String mime) {
        if (mime == null)
            return "Unknown";
        return switch (mime) {
            case "application/pdf" -> "PDF";
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> "Word (.docx)";
            case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" -> "Excel (.xlsx)";
            case "application/vnd.openxmlformats-officedocument.presentationml.presentation" -> "PowerPoint (.pptx)";
            case "application/msword" -> "Word (.doc)";
            case "application/vnd.ms-excel" -> "Excel (.xls)";
            case "text/plain" -> "Plain Text (.txt)";
            case "text/csv" -> "CSV";
            case "image/jpeg" -> "JPEG Image";
            case "image/png" -> "PNG Image";
            default -> mime;
        };
    }

    /**
     * Run AI-powered anomaly detection comparing new version against previous
     * version.
     * Retrieves the previous version file from storage, sends both to the search
     * service
     * for content comparison, and stores the result on the version record.
     */
    @Transactional
    private void runAnomalyCheckAsync(UUID versionId, UUID docId, byte[] newFileData,
            String newFileName, String newMimeType) {
        try {
            log.info("Starting async anomaly check for version {} of doc {}", versionId, docId);
            DocumentVersion version = versionRepository.findById(versionId).orElse(null);
            Document doc = documentRepository.findById(docId).orElse(null);
            if (version == null || doc == null) {
                log.warn("Async anomaly check: version or doc not found (v={}, d={})", version != null, doc != null);
                return;
            }

            runAnomalyCheck(version, doc, newFileData, newFileName, newMimeType);
        } catch (Exception e) {
            log.warn("Async anomaly check failed for version {}: {}", versionId, e.getMessage());
        }
    }

    private void runAnomalyCheck(DocumentVersion version, Document doc, byte[] newFileData,
            String newFileName, String newMimeType) {
        try {
            // Find previous version
            Optional<DocumentVersion> prevVersionOpt = versionRepository
                    .findByDocumentIdAndVersionNumber(doc.getId(), version.getVersionNumber() - 1);
            if (prevVersionOpt.isEmpty())
                return;

            DocumentVersion prevVersion = prevVersionOpt.get();
            byte[] prevFileData = storageService.retrieveFile(prevVersion.getStorageKey());
            if (prevFileData == null || prevFileData.length == 0)
                return;

            String prevFileName = buildFileName(doc);

            VersionAnomalyClient.AnomalyResult result = versionAnomalyClient.checkAnomaly(
                    prevFileData, prevFileName, doc.getMimeType(),
                    newFileData, newFileName, newMimeType);

            if (result != null) {
                version.setAnomalyFlagged(result.flagged());
                version.setAnomalyScore(result.anomalyScore());
                version.setSimilarityScore(result.similarityScore());
                if (result.reasons() != null && !result.reasons().isEmpty()) {
                    version.setAnomalyReasons(String.join("||", result.reasons()));
                }
                versionRepository.save(version);

                if (result.flagged()) {
                    log.warn("⚠ VERSION ANOMALY DETECTED for doc {} v{}: score={}, reasons={}",
                            doc.getId(), version.getVersionNumber(), result.anomalyScore(), result.reasons());

                    auditPublisher.publish(AuditEvent.builder()
                            .userId(version.getAuthorId())
                            .action("VERSION_ANOMALY_DETECTED")
                            .resourceType("DOCUMENT_VERSION")
                            .resourceId(version.getId())
                            .resourceName(doc.getTitle())
                            .details(Map.of(
                                    "versionNumber", version.getVersionNumber(),
                                    "anomalyScore", result.anomalyScore().toString(),
                                    "similarityScore", result.similarityScore().toString(),
                                    "reasons", result.reasons().toString()))
                            .build());
                }
            }
        } catch (Exception e) {
            log.warn("Version anomaly check failed for doc {} v{}: {}",
                    doc.getId(), version.getVersionNumber(), e.getMessage());
        }
    }

    private Document findDocumentOrThrow(UUID id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));
    }

    private String getFileExtension(String filename) {
        if (filename == null)
            return "";
        int idx = filename.lastIndexOf('.');
        return idx > 0 ? filename.substring(idx + 1).toLowerCase() : "";
    }

    private DocumentDto mapToDto(Document doc) {
        // Resolve author name
        String authorName = resolveUserName(doc.getAuthorId());
        // Resolve checked-out-by name if applicable
        String checkedOutByName = (doc.getIsCheckedOut() != null && doc.getIsCheckedOut()
                && doc.getCheckedOutBy() != null)
                        ? resolveUserName(doc.getCheckedOutBy())
                        : null;

        return DocumentDto.builder()
                .id(doc.getId())
                .objectGuid(doc.getObjectGuid())
                .folderId(doc.getFolderId())
                .projectId(doc.getProjectId())
                .title(doc.getTitle())
                .description(doc.getDescription())
                .mimeType(doc.getMimeType())
                .fileExtension(doc.getFileExtension())
                .currentVersion(doc.getCurrentVersion())
                .sha256Hash(doc.getSha256Hash())
                .fileSizeBytes(doc.getFileSizeBytes())
                .authorId(doc.getAuthorId())
                .authorName(authorName)
                .status(doc.getStatus())
                .isCheckedOut(doc.getIsCheckedOut())
                .checkedOutBy(doc.getCheckedOutBy())
                .checkedOutByName(checkedOutByName)
                .checkedOutAt(doc.getCheckedOutAt())
                .retentionStartDate(doc.getRetentionStartDate())
                .retentionPeriodYears(doc.getRetentionPeriodYears())
                .retentionExpiry(doc.getRetentionExpiry())
                .legalHold(doc.getLegalHold())
                .legalHoldReason(doc.getLegalHoldReason())
                .privacyRedactionEnabled(doc.getPrivacyRedactionEnabled())
                .piiDetected(doc.getPiiDetected())
                .piiSeverity(doc.getPiiSeverity())
                .piiTypes(doc.getPiiTypes())
                .piiScanDate(doc.getPiiScanDate())
                .classificationLabel(doc.getClassificationLabel())
                .m365Link(doc.getM365Link())
                .docusignEnvelopeId(doc.getDocusignEnvelopeId())
                .sapDocumentNumber(doc.getSapDocumentNumber())
                .aiGenerated(doc.getAiGenerated())
                .aiConfidence(doc.getAiConfidence())
                .tags(doc.getTags())
                .metadata(doc.getMetadataJson())
                .createdAt(doc.getCreatedAt())
                .updatedAt(doc.getUpdatedAt())
                .build();
    }

    private DocumentVersionDto mapVersionToDto(DocumentVersion v, UUID documentId, String fileName, String authorName) {
        // Parse anomaly reasons from stored JSON-like string
        List<String> reasons = null;
        if (v.getAnomalyReasons() != null && !v.getAnomalyReasons().isBlank()) {
            reasons = Arrays.asList(v.getAnomalyReasons().split("\\|\\|"));
        }
        return DocumentVersionDto.builder()
                .id(v.getId())
                .documentId(documentId)
                .versionNumber(v.getVersionNumber())
                .versionType(v.getVersionType())
                .versionLabel(v.getVersionLabel())
                .fileName(fileName)
                .sha256Hash(v.getSha256Hash())
                .fileSizeBytes(v.getFileSizeBytes())
                .authorId(v.getAuthorId())
                .authorName(authorName)
                .changeSummary(v.getChangeSummary())
                .createdAt(v.getCreatedAt())
                .anomalyFlagged(v.getAnomalyFlagged())
                .anomalyScore(v.getAnomalyScore())
                .similarityScore(v.getSimilarityScore())
                .anomalyReasons(reasons)
                .build();
    }

    private String resolveUserName(UUID userId) {
        if (userId == null)
            return null;
        try {
            String name = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(first_name || ' ' || last_name, username) FROM users WHERE id = ?",
                    String.class, userId);
            return name != null ? name : "Unknown";
        } catch (Exception e) {
            return "Unknown";
        }
    }

    private Map<UUID, String> resolveUserNames(Set<UUID> userIds) {
        if (userIds.isEmpty())
            return Collections.emptyMap();
        Map<UUID, String> result = new HashMap<>();
        for (UUID uid : userIds) {
            result.put(uid, resolveUserName(uid));
        }
        return result;
    }

    private String buildFileName(Document doc) {
        String title = doc.getTitle();
        String ext = doc.getFileExtension();
        if (ext != null && !ext.isEmpty() && !title.toLowerCase().endsWith("." + ext.toLowerCase())) {
            return title + "." + ext;
        }
        return title;
    }

    private DocumentNoteDto mapNoteToDto(DocumentNote n) {
        return DocumentNoteDto.builder()
                .id(n.getId())
                .documentId(n.getDocument().getId())
                .authorId(n.getAuthorId())
                .content(n.getContent())
                .noteType(n.getNoteType())
                .isPinned(n.getIsPinned())
                .color(n.getColor())
                .parentNoteId(n.getParentNoteId())
                .createdAt(n.getCreatedAt())
                .updatedAt(n.getUpdatedAt())
                .build();
    }
}
