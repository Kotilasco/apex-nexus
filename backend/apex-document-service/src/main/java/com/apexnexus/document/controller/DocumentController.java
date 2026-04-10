package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.common.dto.PagedResponse;
import com.apexnexus.document.dto.*;
import com.apexnexus.document.service.DocumentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<DocumentDto>> createDocument(
            @RequestPart("metadata") @Valid CreateDocumentRequest request,
            @RequestPart("file") MultipartFile file,
            Authentication auth) throws Exception {
        UUID userId = (UUID) auth.getPrincipal();
        DocumentDto doc = documentService.createDocument(request, file, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Document created", doc));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DocumentDto>> getDocument(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.getDocument(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DocumentDto>> updateDocument(
            @PathVariable UUID id,
            @RequestBody UpdateDocumentRequest request,
            Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok("Document updated",
                documentService.updateDocument(id, request, userId)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteDocument(@PathVariable UUID id, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        documentService.deleteDocument(id, userId);
        return ResponseEntity.ok(ApiResponse.ok("Document deleted", null));
    }

    @GetMapping("/folder/{folderId}")
    public ResponseEntity<ApiResponse<PagedResponse<DocumentDto>>> getByFolder(
            @PathVariable UUID folderId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<DocumentDto> result = documentService.getDocumentsByFolder(folderId,
                PageRequest.of(page, size, Sort.by("createdAt").descending()));
        return ResponseEntity.ok(ApiResponse.ok(toPagedResponse(result)));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<PagedResponse<DocumentDto>>> getMyDocuments(
            Authentication auth,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID userId = (UUID) auth.getPrincipal();
        Page<DocumentDto> result = documentService.getMyDocuments(userId,
                PageRequest.of(page, size, Sort.by("createdAt").descending()));
        return ResponseEntity.ok(ApiResponse.ok(toPagedResponse(result)));
    }

    @GetMapping("/project/{projectId}")
    public ResponseEntity<ApiResponse<PagedResponse<DocumentDto>>> getByProject(
            @PathVariable UUID projectId,
            @RequestParam(required = false) UUID folderId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<DocumentDto> result;
        if (folderId != null) {
            result = documentService.getDocumentsByProjectAndFolder(projectId, folderId,
                    PageRequest.of(page, size, Sort.by("createdAt").descending()));
        } else {
            result = documentService.getDocumentsByProject(projectId,
                    PageRequest.of(page, size, Sort.by("createdAt").descending()));
        }
        return ResponseEntity.ok(ApiResponse.ok(toPagedResponse(result)));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> downloadDocument(@PathVariable UUID id, Authentication auth) throws Exception {
        UUID userId = (UUID) auth.getPrincipal();
        byte[] data = documentService.downloadDocument(id, userId);
        DocumentDto doc = documentService.getDocument(id);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(doc.getMimeType() != null ? doc.getMimeType() : "application/octet-stream"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + doc.getTitle() + "." + doc.getFileExtension() + "\"")
                .body(data);
    }

    // --- Check-out / Check-in ---

    @PostMapping("/{id}/checkout")
    public ResponseEntity<ApiResponse<DocumentDto>> checkOut(@PathVariable UUID id, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok("Document checked out", documentService.checkOut(id, userId)));
    }

    @PostMapping(value = "/{id}/checkin", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<DocumentDto>> checkIn(
            @PathVariable UUID id,
            @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) String changeSummary,
            @RequestParam(required = false, defaultValue = "MAJOR") String versionType,
            Authentication auth) throws Exception {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok("Document checked in",
                documentService.checkIn(id, file, changeSummary, versionType, userId)));
    }

    @PostMapping(value = "/{id}/checkin-precheck", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<VersionPreCheckResult>> checkinPreCheck(
            @PathVariable UUID id,
            @RequestPart("file") MultipartFile file) throws Exception {
        return ResponseEntity.ok(ApiResponse.ok(documentService.preCheckVersion(id, file)));
    }

    @PostMapping("/{id}/cancel-checkout")
    public ResponseEntity<ApiResponse<DocumentDto>> cancelCheckOut(@PathVariable UUID id, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(documentService.cancelCheckOut(id, userId)));
    }

    // --- Version History ---

    @GetMapping("/{id}/versions")
    public ResponseEntity<ApiResponse<List<DocumentVersionDto>>> getVersions(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.getVersionHistory(id)));
    }

    @GetMapping("/{id}/versions/{versionNumber}/download")
    public ResponseEntity<byte[]> downloadVersion(
            @PathVariable UUID id,
            @PathVariable int versionNumber,
            Authentication auth) throws Exception {
        UUID userId = (UUID) auth.getPrincipal();
        byte[] data = documentService.downloadVersion(id, versionNumber, userId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(data);
    }

    @PostMapping("/{id}/versions/{versionNumber}/rollback")
    public ResponseEntity<ApiResponse<DocumentDto>> rollbackVersion(
            @PathVariable UUID id,
            @PathVariable int versionNumber,
            Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok("Rolled back to version " + versionNumber,
                documentService.rollbackToVersion(id, versionNumber, userId)));
    }

    @GetMapping("/{id}/versions/{v1}/compare/{v2}")
    public ResponseEntity<ApiResponse<Map<String, String>>> compareVersions(
            @PathVariable UUID id,
            @PathVariable int v1,
            @PathVariable int v2,
            Authentication auth) throws Exception {
        return ResponseEntity.ok(ApiResponse.ok(documentService.compareVersionTexts(id, v1, v2)));
    }

    @PostMapping("/{id}/versions/{versionNumber}/copy-to-project")
    public ResponseEntity<ApiResponse<DocumentDto>> copyVersionToProject(
            @PathVariable UUID id,
            @PathVariable int versionNumber,
            @Valid @RequestBody CopyVersionToProjectRequest request,
            Authentication auth) throws Exception {
        UUID userId = (UUID) auth.getPrincipal();
        DocumentDto doc = documentService.copyVersionToProject(id, versionNumber, request, userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Version copied to project", doc));
    }

    // --- Notes ---

    @PostMapping("/{id}/notes")
    public ResponseEntity<ApiResponse<DocumentNoteDto>> addNote(
            @PathVariable UUID id,
            @Valid @RequestBody CreateNoteRequest request,
            Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Note added", documentService.addNote(id, request, userId)));
    }

    @GetMapping("/{id}/notes")
    public ResponseEntity<ApiResponse<List<DocumentNoteDto>>> getNotes(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.getNotes(id)));
    }

    @PutMapping("/notes/{noteId}")
    public ResponseEntity<ApiResponse<DocumentNoteDto>> updateNote(
            @PathVariable UUID noteId,
            @Valid @RequestBody CreateNoteRequest request,
            Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok("Note updated",
                documentService.updateNote(noteId, request, userId)));
    }

    @DeleteMapping("/notes/{noteId}")
    public ResponseEntity<ApiResponse<Void>> deleteNote(@PathVariable UUID noteId, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        documentService.deleteNote(noteId, userId);
        return ResponseEntity.ok(ApiResponse.ok("Note deleted", null));
    }

    // --- Legal Hold ---

    @PostMapping("/{id}/legal-hold")
    public ResponseEntity<ApiResponse<DocumentDto>> setLegalHold(
            @PathVariable UUID id,
            @RequestParam String reason,
            Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(documentService.setLegalHold(id, reason, userId)));
    }

    @DeleteMapping("/{id}/legal-hold")
    public ResponseEntity<ApiResponse<DocumentDto>> removeLegalHold(@PathVariable UUID id, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(documentService.removeLegalHold(id, userId)));
    }

    // --- Text content editing ---

    @GetMapping("/{id}/content")
    public ResponseEntity<ApiResponse<Map<String, String>>> getTextContent(@PathVariable UUID id, Authentication auth) throws Exception {
        UUID userId = (UUID) auth.getPrincipal();
        String text = documentService.getTextContent(id, userId);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("content", text)));
    }

    @PutMapping("/{id}/content")
    public ResponseEntity<ApiResponse<DocumentDto>> updateTextContent(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body,
            Authentication auth) throws Exception {
        UUID userId = (UUID) auth.getPrincipal();
        String content = body.get("content");
        if (content == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Missing 'content' field"));
        }
        DocumentDto doc = documentService.updateTextContent(id, content, userId);
        return ResponseEntity.ok(ApiResponse.ok("Content saved", doc));
    }

    // --- Preview (inline rendering without download) ---

    @PostMapping("/reindex")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reindexAll() {
        int count = documentService.reindexAll();
        return ResponseEntity.ok(ApiResponse.ok("Re-index queued",
                Map.of("documentsQueued", count)));
    }

    @GetMapping("/{id}/preview")
    public ResponseEntity<byte[]> previewDocument(@PathVariable UUID id, Authentication auth) throws Exception {
        UUID userId = (UUID) auth.getPrincipal();
        byte[] data = documentService.downloadDocument(id, userId);
        DocumentDto doc = documentService.getDocument(id);
        String mimeType = doc.getMimeType() != null ? doc.getMimeType() : "application/octet-stream";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mimeType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + doc.getTitle() + "." + doc.getFileExtension() + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
                .body(data);
    }

    private <T> PagedResponse<T> toPagedResponse(Page<T> page) {
        return PagedResponse.<T>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}
