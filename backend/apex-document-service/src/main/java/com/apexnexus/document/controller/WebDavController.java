package com.apexnexus.document.controller;

import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.common.exception.ResourceNotFoundException;
import com.apexnexus.document.model.Document;
import com.apexnexus.document.model.DocumentVersion;
import com.apexnexus.document.repository.DocumentRepository;
import com.apexnexus.document.repository.DocumentVersionRepository;
import com.apexnexus.document.service.DocumentService;
import com.apexnexus.document.service.LockService;
import com.apexnexus.document.service.StorageService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * WebDAV controller implementing RFC 4918 subset for Edit-In-Place.
 * Supports: GET, PUT, PROPFIND, LOCK, UNLOCK, DELETE, OPTIONS, HEAD.
 * Integrates with existing checkout/checkin flow and Redis distributed locks.
 *
 * Mount point: /webdav/documents/{id}/{filename}
 * Clients: Windows Explorer, macOS Finder, Microsoft Office, LibreOffice
 */
@Slf4j
@RestController
@RequestMapping("/webdav")
@RequiredArgsConstructor
public class WebDavController {

    private static final DateTimeFormatter RFC1123 = DateTimeFormatter.RFC_1123_DATE_TIME;

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final StorageService storageService;
    private final RedisTemplate<String, String> redisTemplate;
    private final AuditPublisher auditPublisher;
    private final LockService lockService;

    // ============ OPTIONS — DAV capability discovery ============

    @RequestMapping(value = "/**", method = RequestMethod.OPTIONS)
    public ResponseEntity<Void> options() {
        return ResponseEntity.ok()
                .header("DAV", "1, 2")
                .header("Allow", "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, LOCK, UNLOCK")
                .header("MS-Author-Via", "DAV")
                .build();
    }

    // ============ HEAD — File metadata ============

    @RequestMapping(value = "/documents/{id}/**", method = RequestMethod.HEAD)
    public ResponseEntity<Void> head(@PathVariable UUID id) {
        Document doc = findDoc(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        doc.getMimeType() != null ? doc.getMimeType() : "application/octet-stream"))
                .contentLength(doc.getFileSizeBytes())
                .header("ETag", "\"" + doc.getSha256Hash() + "\"")
                .header("Last-Modified", formatLastModified(doc.getUpdatedAt()))
                .build();
    }

    // ============ GET — Download file content ============

    @GetMapping("/documents/{id}/**")
    public ResponseEntity<byte[]> get(@PathVariable UUID id, Authentication auth) throws Exception {
        UUID userId = (UUID) auth.getPrincipal();
        Document doc = findDoc(id);
        byte[] data = storageService.retrieveFile(doc.getStorageKey());

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("WEBDAV_GET")
                .resourceType("DOCUMENT")
                .resourceId(id)
                .resourceName(doc.getTitle())
                .build());

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        doc.getMimeType() != null ? doc.getMimeType() : "application/octet-stream"))
                .contentLength(data.length)
                .header("ETag", "\"" + doc.getSha256Hash() + "\"")
                .header("Last-Modified", formatLastModified(doc.getUpdatedAt()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + safeFilename(doc) + "\"")
                .body(data);
    }

    // ============ PUT — Word auto-save: store file and update document ============

    @PutMapping("/documents/{id}/**")
    @Transactional
    public ResponseEntity<Void> put(
            @PathVariable UUID id,
            HttpServletRequest request,
            Authentication auth) throws Exception {
        UUID userId = (UUID) auth.getPrincipal();
        Document doc = findDoc(id);

        // Verify lock ownership via LockService
        LockService.LockStatus status = lockService.getLockStatus(id);
        if (status.locked() && !userId.equals(status.ownerId())) {
            return ResponseEntity.status(HttpStatus.LOCKED).build();
        }

        byte[] fileData = request.getInputStream().readAllBytes();
        if (fileData.length == 0) {
            return ResponseEntity.badRequest().build();
        }

        String sha256 = storageService.calculateSha256(fileData);

        // Skip if content hasn't changed (auto-save sends redundant PUTs)
        if (sha256.equals(doc.getSha256Hash())) {
            return ResponseEntity.noContent().build();
        }

        // Determine next version number
        int nextVersion = versionRepository.findByDocumentIdOrderByVersionNumberDesc(doc.getId())
                .stream().findFirst().map(v -> v.getVersionNumber() + 1).orElse(1);

        // Build a unique storage key for this version: documents/{objectGuid}/v{N}/{filename}
        String filename = safeFilename(doc);
        String versionStorageKey = String.format("documents/%s/v%d/%s",
                doc.getObjectGuid(), nextVersion, filename);

        String contentType = doc.getMimeType() != null ? doc.getMimeType() : "application/octet-stream";
        storageService.storeFile(fileData, versionStorageKey, contentType);

        // Update document metadata to point to latest version
        doc.setSha256Hash(sha256);
        doc.setFileSizeBytes((long) fileData.length);
        doc.setStorageKey(versionStorageKey);
        doc.setCurrentVersion(nextVersion);
        doc.setUpdatedAt(Instant.now());
        documentRepository.save(doc);

        // Create version record with its own unique storage key
        DocumentVersion version = DocumentVersion.builder()
                .document(doc)
                .versionNumber(nextVersion)
                .storageKey(versionStorageKey)
                .fileSizeBytes((long) fileData.length)
                .sha256Hash(sha256)
                .changeSummary("Auto-saved from Word via WebDAV")
                .authorId(userId)
                .build();
        versionRepository.save(version);

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("WEBDAV_PUT")
                .resourceType("DOCUMENT")
                .resourceId(id)
                .resourceName(doc.getTitle())
                .details(Map.of("sha256", sha256, "action", "AUTO_SAVED", "version", String.valueOf(version.getVersionNumber())))
                .build());

        log.info("[WebDAV] Auto-saved doc {} v{} from Word (user={})", id, version.getVersionNumber(), userId);

        return ResponseEntity.noContent()
                .header("ETag", "\"" + sha256 + "\"")
                .build();
    }

    // ============ LOCK — Exclusive lock for editing (delegates to LockService) ============

    @PostMapping("/documents/{id}/lock")
    public ResponseEntity<String> lock(
            @PathVariable UUID id,
            @RequestHeader(value = "Timeout", required = false) String timeout,
            Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();

        LockService.LockResult result = lockService.acquireLock(id, userId);

        return switch (result.status()) {
            case ACQUIRED -> ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_XML)
                    .header("Lock-Token", "<" + result.lockToken() + ">")
                    .body(buildLockResponseXml(result.lockToken(), userId.toString(), result.timeout()));
            case CONFLICT -> ResponseEntity.status(HttpStatus.LOCKED)
                    .body(buildLockErrorXml(id));
            case STALE -> ResponseEntity.status(HttpStatus.LOCKED)
                    .header("X-Lock-Stale", "true")
                    .header("X-Lock-Owner", result.conflictOwner().toString())
                    .body(buildLockErrorXml(id));
        };
    }

    // ============ UNLOCK (delegates to LockService) ============

    @PostMapping("/documents/{id}/unlock")
    public ResponseEntity<Void> unlock(
            @PathVariable UUID id,
            @RequestHeader(value = "Lock-Token", required = false) String lockTokenHeader,
            Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();

        lockService.releaseLock(id, userId);

        return ResponseEntity.noContent().build();
    }

    // ============ DELETE ============

    @DeleteMapping("/documents/{id}/**")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        Document doc = findDoc(id);

        if (Boolean.TRUE.equals(doc.getLegalHold())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        auditPublisher.publish(AuditEvent.builder()
                .userId(userId)
                .action("WEBDAV_DELETE")
                .resourceType("DOCUMENT")
                .resourceId(id)
                .resourceName(doc.getTitle())
                .build());

        // Soft delete - set status to DESTROYED
        doc.setStatus("DESTROYED");
        documentRepository.save(doc);

        return ResponseEntity.noContent().build();
    }

    // ============ PROPFIND — Property discovery ============

    @GetMapping("/documents/{id}/propfind")
    public ResponseEntity<String> propfind(
            @PathVariable UUID id,
            @RequestHeader(value = "Depth", defaultValue = "0") String depth) {
        Document doc = findDoc(id);
        String filename = safeFilename(doc);

        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <D:multistatus xmlns:D="DAV:">
                  <D:response>
                    <D:href>/webdav/documents/%s/%s</D:href>
                    <D:propstat>
                      <D:prop>
                        <D:displayname>%s</D:displayname>
                        <D:getcontentlength>%d</D:getcontentlength>
                        <D:getcontenttype>%s</D:getcontenttype>
                        <D:getetag>"%s"</D:getetag>
                        <D:getlastmodified>%s</D:getlastmodified>
                        <D:resourcetype/>
                        <D:supportedlock>
                          <D:lockentry>
                            <D:lockscope><D:exclusive/></D:lockscope>
                            <D:locktype><D:write/></D:locktype>
                          </D:lockentry>
                        </D:supportedlock>
                      </D:prop>
                      <D:status>HTTP/1.1 200 OK</D:status>
                    </D:propstat>
                  </D:response>
                </D:multistatus>
                """.formatted(
                doc.getId(), escapeXml(filename),
                escapeXml(filename),
                doc.getFileSizeBytes(),
                doc.getMimeType() != null ? doc.getMimeType() : "application/octet-stream",
                doc.getSha256Hash(),
                formatLastModified(doc.getUpdatedAt())
        );

        return ResponseEntity.status(HttpStatus.MULTI_STATUS)
                .contentType(MediaType.APPLICATION_XML)
                .body(xml);
    }

    // ============ PROPFIND for root — list all user documents ============

    @GetMapping("/documents/propfind")
    public ResponseEntity<String> propfindRoot(
            @RequestHeader(value = "Depth", defaultValue = "1") String depth,
            Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        List<Document> docs = documentRepository.findByAuthorId(userId,
                org.springframework.data.domain.PageRequest.of(0, 1000)).getContent();

        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<D:multistatus xmlns:D=\"DAV:\">\n");

        // Root collection
        xml.append("  <D:response>\n");
        xml.append("    <D:href>/webdav/documents/</D:href>\n");
        xml.append("    <D:propstat>\n");
        xml.append("      <D:prop>\n");
        xml.append("        <D:displayname>Apex Documents</D:displayname>\n");
        xml.append("        <D:resourcetype><D:collection/></D:resourcetype>\n");
        xml.append("      </D:prop>\n");
        xml.append("      <D:status>HTTP/1.1 200 OK</D:status>\n");
        xml.append("    </D:propstat>\n");
        xml.append("  </D:response>\n");

        if ("1".equals(depth) || "infinity".equalsIgnoreCase(depth)) {
            for (Document doc : docs) {
                String filename = safeFilename(doc);
                xml.append("  <D:response>\n");
                xml.append("    <D:href>/webdav/documents/").append(doc.getId())
                        .append("/").append(escapeXml(filename)).append("</D:href>\n");
                xml.append("    <D:propstat>\n");
                xml.append("      <D:prop>\n");
                xml.append("        <D:displayname>").append(escapeXml(filename)).append("</D:displayname>\n");
                xml.append("        <D:getcontentlength>").append(doc.getFileSizeBytes()).append("</D:getcontentlength>\n");
                xml.append("        <D:getcontenttype>").append(
                        doc.getMimeType() != null ? doc.getMimeType() : "application/octet-stream").append("</D:getcontenttype>\n");
                xml.append("        <D:getetag>\"").append(doc.getSha256Hash()).append("\"</D:getetag>\n");
                xml.append("        <D:getlastmodified>").append(formatLastModified(doc.getUpdatedAt())).append("</D:getlastmodified>\n");
                xml.append("        <D:resourcetype/>\n");
                xml.append("      </D:prop>\n");
                xml.append("      <D:status>HTTP/1.1 200 OK</D:status>\n");
                xml.append("    </D:propstat>\n");
                xml.append("  </D:response>\n");
            }
        }

        xml.append("</D:multistatus>\n");

        return ResponseEntity.status(HttpStatus.MULTI_STATUS)
                .contentType(MediaType.APPLICATION_XML)
                .body(xml.toString());
    }

    // ============ HELPERS ============

    private Document findDoc(UUID id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));
    }

    private String formatLastModified(Instant instant) {
        if (instant == null) instant = Instant.now();
        return RFC1123.format(instant.atZone(ZoneOffset.UTC));
    }


    private String escapeXml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }

    /** Build filename from title + extension, avoiding double extension (.docx.docx). */
    private String safeFilename(Document doc) {
        String title = doc.getTitle();
        String ext = doc.getFileExtension();
        if (ext != null && title.toLowerCase().endsWith("." + ext.toLowerCase())) {
            return title;
        }
        return title + "." + ext;
    }

    private String buildLockResponseXml(String lockToken, String owner, Duration timeout) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <D:prop xmlns:D="DAV:">
                  <D:lockdiscovery>
                    <D:activelock>
                      <D:locktype><D:write/></D:locktype>
                      <D:lockscope><D:exclusive/></D:lockscope>
                      <D:depth>0</D:depth>
                      <D:owner><D:href>%s</D:href></D:owner>
                      <D:timeout>Second-%d</D:timeout>
                      <D:locktoken><D:href>%s</D:href></D:locktoken>
                    </D:activelock>
                  </D:lockdiscovery>
                </D:prop>
                """.formatted(escapeXml(owner), timeout.getSeconds(), lockToken);
    }

    private String buildLockErrorXml(UUID documentId) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <D:error xmlns:D="DAV:">
                  <D:lock-token-submitted>
                    <D:href>/webdav/documents/%s</D:href>
                  </D:lock-token-submitted>
                </D:error>
                """.formatted(documentId);
    }
}
