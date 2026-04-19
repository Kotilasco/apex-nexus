package com.apexnexus.document.service;

import com.apexnexus.common.security.SecurityContextUtil;
import com.apexnexus.document.dto.CreateDocumentRequest;
import com.apexnexus.document.dto.DocumentDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Zero-Touch Intelligent Capture pipeline.
 *
 *  1. Bulk multipart upload lands in /api/intake/upload  (autoRoute optional)
 *  2. Each file is created as a real Document (in author's inbox / null project)
 *  3. We extract a quick text sample from the bytes and call search-service
 *     /search/classify-text which runs the 3-layer classifier
 *     (Structural + Textual + Semantic LLM)
 *  4. The intake_uploads row is updated with classification + suggested project + tags
 *  5. If autoRoute=true, the document is moved to the suggested project AND
 *     the project's default workflow is started — fully autonomous.
 *
 * The user gets a "reveal" view: drop 5 mixed files → see them auto-routed
 * to the right projects with the right workflows kicked off.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class IntakeService {

    private final DocumentService documentService;
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final AgenticIntentService agenticIntent;
    private final MultiAgentOrchestratorService multiAgent;

    @Value("${search.service.url:http://apex-search-service:8084}")
    private String searchServiceUrl;

    private RestTemplate rest() {
        var f = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        f.setConnectTimeout(5000);
        f.setReadTimeout(90000);
        return new RestTemplate(f);
    }

    /**
     * Bulk upload. Returns the batch id immediately; classification continues async.
     */
    public BatchSubmitResult submitBatch(List<MultipartFile> files, boolean autoRoute, UUID pinnedProjectId) {
        UUID userId = SecurityContextUtil.currentUserId();
        UUID batchId = UUID.randomUUID();
        List<UUID> intakeIds = new ArrayList<>();

        for (MultipartFile f : files) {
            UUID intakeId = UUID.randomUUID();
            jdbc.update("""
                    INSERT INTO intake_uploads
                    (id, batch_id, filename, mime_type, file_size, status, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, 'PENDING', ?, now())
                    """, intakeId, batchId, f.getOriginalFilename(), f.getContentType(),
                    f.getSize(), userId);
            intakeIds.add(intakeId);
            try {
                processOne(intakeId, f.getBytes(), f.getOriginalFilename(),
                        f.getContentType(), userId, autoRoute, pinnedProjectId);
            } catch (Exception e) {
                jdbc.update("UPDATE intake_uploads SET status='FAILED', error_message=? WHERE id=?",
                        e.getMessage(), intakeId);
                log.error("Intake processing failed for {}", f.getOriginalFilename(), e);
            }
        }

        return BatchSubmitResult.builder()
                .batchId(batchId).fileCount(files.size()).intakeIds(intakeIds)
                .build();
    }

    private void processOne(UUID intakeId, byte[] bytes, String filename, String mimeType,
                            UUID userId, boolean autoRoute, UUID pinnedProjectId) throws Exception {
        // 1) Create a real document (pinned project if specified, else inbox)
        CreateDocumentRequest req = new CreateDocumentRequest();
        req.setTitle(filename != null ? filename : "Untitled");
        req.setDescription("Auto-captured via Intelligent Intake on "
                + java.time.OffsetDateTime.now());
        if (pinnedProjectId != null) req.setProjectId(pinnedProjectId);

        MultipartFile multipart = new InMemoryMultipartFile(filename, mimeType, bytes);
        DocumentDto created = documentService.createDocument(req, multipart, userId);

        jdbc.update("UPDATE intake_uploads SET document_id=?, status='UPLOADED' WHERE id=?",
                created.getId(), intakeId);

        // 2) Quick text sample from bytes (best-effort — full Tika happens async via search-service)
        String textSample = quickTextSample(bytes, mimeType);

        // 3) Call search-service composite classifier
        Map<String, Object> body = new HashMap<>();
        body.put("fileName", filename);
        body.put("mimeType", mimeType);
        body.put("text", textSample);

        try {
            HttpHeaders h = new HttpHeaders();
            h.setContentType(MediaType.APPLICATION_JSON);
            ResponseEntity<String> resp = rest().exchange(
                    searchServiceUrl + "/search/classify-text",
                    HttpMethod.POST, new HttpEntity<>(body, h), String.class);
            JsonNode root = objectMapper.readTree(resp.getBody()).path("data");

            String label = root.path("label").asText("Other");
            String category = root.path("category").asText("GENERAL");
            double confidence = root.path("confidence").asDouble(0.5);
            String suggestedProjectId = root.path("suggestedProjectId").asText(null);
            String suggestedProjectName = root.path("suggestedProjectName").asText(null);
            String language = root.path("language").asText("en");

            List<String> tags = new ArrayList<>();
            JsonNode tagsNode = root.path("suggestedTags");
            if (tagsNode.isArray()) tagsNode.forEach(t -> tags.add(t.asText()));

            UUID suggested = (suggestedProjectId != null && !suggestedProjectId.isBlank())
                    ? UUID.fromString(suggestedProjectId) : null;

            jdbc.update("""
                    UPDATE intake_uploads
                    SET classification=?, confidence=?, suggested_project=?, suggested_tags=?,
                        status='CLASSIFIED'
                    WHERE id=?
                    """, label, confidence, suggested, tags.toArray(new String[0]), intakeId);

            // Persist classification + language on the document itself
            jdbc.update("UPDATE documents SET classification_label=?, tags=?, language=? WHERE id=?",
                    label, tags.toArray(new String[0]), language, created.getId());

            log.info("Intake {} classified as '{}' ({}%) → project {}", filename, label,
                    Math.round(confidence * 100), suggestedProjectName);

            // 4) Auto-route. Pinned project wins over AI suggestion.
            UUID target = pinnedProjectId != null ? pinnedProjectId : (autoRoute ? suggested : null);
            if (target != null) {
                jdbc.update("UPDATE documents SET project_id=? WHERE id=?",
                        target, created.getId());
                Integer wfStarted = startDefaultWorkflow(created.getId(), target, userId);
                jdbc.update("UPDATE intake_uploads SET suggested_project=?, status=? WHERE id=?",
                        target,
                        wfStarted != null && wfStarted > 0 ? "ROUTED_AND_WORKFLOW" : "ROUTED",
                        intakeId);
            }

            // 5) Agentic intent detection — best-effort, proactive suggestions
            try {
                agenticIntent.detectForDocument(created.getId());
                multiAgent.runAuditorFor(created.getId());
                multiAgent.runBridgeFor(created.getId());
            } catch (Exception ex) {
                log.debug("agentic detection skipped for {}: {}", created.getId(), ex.getMessage());
            }
        } catch (Exception e) {
            log.warn("classify-text call failed for {}: {}", filename, e.getMessage());
            jdbc.update("UPDATE intake_uploads SET status='CLASSIFICATION_FAILED', error_message=? WHERE id=?",
                    e.getMessage(), intakeId);
        }
    }

    private Integer startDefaultWorkflow(UUID documentId, UUID projectId, UUID userId) {
        try {
            UUID defId = jdbc.queryForObject(
                    "SELECT default_workflow_definition_id FROM projects WHERE id=?",
                    UUID.class, projectId);
            if (defId == null) return 0;
            UUID wfId = UUID.randomUUID();
            return jdbc.update("""
                    INSERT INTO workflow_instances
                    (id, definition_id, document_id, project_id, current_state, initiated_by, actor_type)
                    VALUES (?, ?, ?, ?, 'SUBMITTED', ?, 'SYSTEM')
                    """, wfId, defId, documentId, projectId, userId);
        } catch (Exception e) {
            log.debug("no default workflow for project {}: {}", projectId, e.getMessage());
            return 0;
        }
    }

    public List<Map<String, Object>> getBatch(UUID batchId) {
        UUID userId = SecurityContextUtil.currentUserId();
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT iu.*, p.name AS suggested_project_name, d.title AS document_title
                FROM intake_uploads iu
                LEFT JOIN projects p ON p.id = iu.suggested_project
                LEFT JOIN documents d ON d.id = iu.document_id
                WHERE iu.batch_id = ? AND (iu.created_by = ? OR ? = true)
                ORDER BY iu.created_at ASC
                """, batchId, userId, SecurityContextUtil.isSystemAdmin());
        return normalizeRows(rows);
    }

    public List<Map<String, Object>> recentBatches() {
        UUID userId = SecurityContextUtil.currentUserId();
        return jdbc.queryForList("""
                SELECT batch_id, COUNT(*) AS file_count,
                       MIN(created_at) AS submitted_at,
                       SUM(CASE WHEN status IN ('ROUTED','ROUTED_AND_WORKFLOW') THEN 1 ELSE 0 END) AS routed,
                       SUM(CASE WHEN status='FAILED' OR status='CLASSIFICATION_FAILED' THEN 1 ELSE 0 END) AS failed
                FROM intake_uploads
                WHERE created_by = ? OR ? = true
                GROUP BY batch_id
                ORDER BY submitted_at DESC
                LIMIT 20
                """, userId, SecurityContextUtil.isSystemAdmin());
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> normalizeRows(List<Map<String, Object>> rows) {
        for (Map<String, Object> row : rows) {
            for (Map.Entry<String, Object> e : row.entrySet()) {
                Object v = e.getValue();
                if (v instanceof java.sql.Array arr) {
                    try {
                        Object javaArr = arr.getArray();
                        if (javaArr instanceof Object[] oa) {
                            List<String> list = new ArrayList<>();
                            for (Object o : oa) if (o != null) list.add(o.toString());
                            e.setValue(list);
                        }
                    } catch (Exception ex) {
                        e.setValue(java.util.Collections.emptyList());
                    }
                }
            }
        }
        return rows;
    }

    public Map<String, Object> route(UUID intakeId, UUID projectId, boolean startWorkflow) {
        UUID userId = SecurityContextUtil.currentUserId();
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT * FROM intake_uploads WHERE id = ?", intakeId);
        UUID docId = (UUID) row.get("document_id");
        if (docId == null) throw new IllegalStateException("Intake row has no associated document yet");
        UUID target = projectId != null ? projectId : (UUID) row.get("suggested_project");
        if (target == null) throw new IllegalArgumentException("No target project");
        jdbc.update("UPDATE documents SET project_id=? WHERE id=?", target, docId);
        String newStatus = "ROUTED";
        if (startWorkflow) {
            Integer started = startDefaultWorkflow(docId, target, userId);
            if (started != null && started > 0) newStatus = "ROUTED_AND_WORKFLOW";
        }
        jdbc.update("UPDATE intake_uploads SET status=?, suggested_project=? WHERE id=?",
                newStatus, target, intakeId);
        return Map.of("intakeId", intakeId, "documentId", docId, "projectId", target, "status", newStatus);
    }

    private String quickTextSample(byte[] bytes, String mimeType) {
        if (mimeType == null) return "";
        if (mimeType.startsWith("text/") || mimeType.contains("json") || mimeType.contains("xml")
                || mimeType.contains("csv")) {
            int len = Math.min(bytes.length, 4000);
            return new String(bytes, 0, len, StandardCharsets.UTF_8);
        }
        // For PDF/Office/images we leave text empty — search-service will do full Tika
        // when it processes the index queue. Layer 3 LLM will use filename+mime only.
        return "";
    }

    @Data @lombok.Builder
    public static class BatchSubmitResult {
        private UUID batchId;
        private int fileCount;
        private List<UUID> intakeIds;
    }

    /** Lightweight MultipartFile wrapper for in-memory bytes. */
    private static class InMemoryMultipartFile implements MultipartFile {
        private final String name;
        private final String mime;
        private final byte[] data;

        InMemoryMultipartFile(String name, String mime, byte[] data) {
            this.name = name == null ? "file" : name;
            this.mime = mime;
            this.data = data;
        }
        @Override public String getName() { return "file"; }
        @Override public String getOriginalFilename() { return name; }
        @Override public String getContentType() { return mime; }
        @Override public boolean isEmpty() { return data == null || data.length == 0; }
        @Override public long getSize() { return data == null ? 0 : data.length; }
        @Override public byte[] getBytes() { return data; }
        @Override public java.io.InputStream getInputStream() { return new java.io.ByteArrayInputStream(data); }
        @Override public org.springframework.core.io.Resource getResource() { return new ByteArrayResource(data); }
        @Override public void transferTo(java.io.File dest) throws java.io.IOException {
            java.nio.file.Files.write(dest.toPath(), data);
        }
    }
}
