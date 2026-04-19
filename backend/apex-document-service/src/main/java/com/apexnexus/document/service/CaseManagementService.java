package com.apexnexus.document.service;

import com.apexnexus.common.security.SecurityContextUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;

/**
 * Adaptive Case Management (ACM).
 *
 * Unlike a linear workflow, a Case is a living folder: knowledge workers add
 * ad-hoc tasks, invite external experts, attach documents, and pivot based on
 * new information. The case_events table gives an auditable activity feed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CaseManagementService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper om;

    // ---- create / read / close ----

    public Map<String, Object> create(String title, String description, String category,
                                       String priority, UUID projectId) {
        UUID caseId = UUID.randomUUID();
        UUID userId = SecurityContextUtil.currentUserId();
        jdbc.update("""
            INSERT INTO cases (id, title, description, category, priority, status,
                               project_id, opened_by, opened_at)
            VALUES (?, ?, ?, ?, COALESCE(?, 'MEDIUM'), 'OPEN', ?, ?, now())
            """, caseId, title, description, category, priority, projectId, userId);
        // Creator is automatically the owner
        jdbc.update("""
            INSERT INTO case_participants (case_id, user_id, role, invited_by)
            VALUES (?, ?, 'OWNER', ?)
            """, caseId, userId, userId);
        event(caseId, userId, "OPENED",
              Map.of("title", title, "category", category, "priority", priority));
        return get(caseId);
    }

    public List<Map<String, Object>> list(String status, String category, int limit) {
        StringBuilder sql = new StringBuilder("""
            SELECT c.id, c.title, c.category, c.priority, c.status, c.project_id,
                   c.opened_at, c.closed_at, c.outcome,
                   u.username AS opened_by_username,
                   (SELECT COUNT(*) FROM case_tasks ct WHERE ct.case_id=c.id) AS task_count,
                   (SELECT COUNT(*) FROM case_tasks ct WHERE ct.case_id=c.id AND ct.status='DONE') AS task_done,
                   (SELECT COUNT(*) FROM case_attachments ca WHERE ca.case_id=c.id) AS attachment_count,
                   (SELECT COUNT(*) FROM case_participants cp WHERE cp.case_id=c.id) AS participant_count
            FROM cases c
            LEFT JOIN users u ON u.id = c.opened_by
            WHERE 1=1
            """);
        List<Object> args = new ArrayList<>();
        if (status != null && !status.isBlank()) {
            sql.append(" AND c.status = ?"); args.add(status);
        }
        if (category != null && !category.isBlank()) {
            sql.append(" AND c.category = ?"); args.add(category);
        }
        sql.append(" ORDER BY c.opened_at DESC LIMIT ?");
        args.add(limit);
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    public Map<String, Object> get(UUID caseId) {
        Map<String, Object> c = jdbc.queryForMap("""
            SELECT c.*, u.username AS opened_by_username, p.name AS project_name
            FROM cases c
            LEFT JOIN users u ON u.id = c.opened_by
            LEFT JOIN projects p ON p.id = c.project_id
            WHERE c.id = ?
            """, caseId);
        Map<String, Object> out = new LinkedHashMap<>(c);
        out.put("tasks", jdbc.queryForList("""
            SELECT t.*, u.username AS assignee_username
            FROM case_tasks t
            LEFT JOIN users u ON u.id = t.assignee_id
            WHERE t.case_id = ?
            ORDER BY t.created_at DESC
            """, caseId));
        out.put("participants", jdbc.queryForList("""
            SELECT p.*, u.username, (COALESCE(u.first_name,'')||' '||COALESCE(u.last_name,'')) AS full_name
            FROM case_participants p
            LEFT JOIN users u ON u.id = p.user_id
            WHERE p.case_id = ?
            ORDER BY p.invited_at ASC
            """, caseId));
        out.put("attachments", jdbc.queryForList("""
            SELECT a.*, d.title AS document_title, d.mime_type
            FROM case_attachments a
            JOIN documents d ON d.id = a.document_id
            WHERE a.case_id = ?
            ORDER BY a.attached_at DESC
            """, caseId));
        out.put("events", jdbc.queryForList("""
            SELECT e.*, u.username AS actor_username
            FROM case_events e
            LEFT JOIN users u ON u.id = e.actor_id
            WHERE e.case_id = ?
            ORDER BY e.created_at DESC
            LIMIT 100
            """, caseId));
        return out;
    }

    public Map<String, Object> close(UUID caseId, String outcome) {
        UUID userId = SecurityContextUtil.currentUserId();
        jdbc.update("""
            UPDATE cases SET status='CLOSED', closed_at=now(), closed_by=?, outcome=?
            WHERE id=?
            """, userId, outcome, caseId);
        event(caseId, userId, "CLOSED", Map.of("outcome", outcome == null ? "" : outcome));
        return get(caseId);
    }

    public Map<String, Object> updateStatus(UUID caseId, String status) {
        UUID userId = SecurityContextUtil.currentUserId();
        jdbc.update("UPDATE cases SET status=? WHERE id=?", status, caseId);
        event(caseId, userId, "STATUS_CHANGED", Map.of("status", status));
        return get(caseId);
    }

    // ---- tasks ----

    public Map<String, Object> addTask(UUID caseId, String title, String description,
                                        UUID assigneeId, OffsetDateTime dueAt) {
        UUID taskId = UUID.randomUUID();
        UUID userId = SecurityContextUtil.currentUserId();
        jdbc.update("""
            INSERT INTO case_tasks (id, case_id, title, description, assignee_id, due_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, taskId, caseId, title, description, assigneeId,
                 dueAt != null ? dueAt.toInstant() : null, userId);
        event(caseId, userId, "TASK_ADDED",
              Map.of("taskId", taskId.toString(), "title", title));
        return Map.of("id", taskId, "status", "PENDING");
    }

    public Map<String, Object> completeTask(UUID taskId) {
        UUID userId = SecurityContextUtil.currentUserId();
        Map<String, Object> t = jdbc.queryForMap("SELECT case_id, title FROM case_tasks WHERE id=?", taskId);
        jdbc.update("UPDATE case_tasks SET status='DONE', completed_at=now() WHERE id=?", taskId);
        event((UUID) t.get("case_id"), userId, "TASK_COMPLETED",
              Map.of("taskId", taskId.toString(), "title", t.get("title")));
        return Map.of("id", taskId, "status", "DONE");
    }

    // ---- attachments ----

    public Map<String, Object> attach(UUID caseId, UUID documentId, String note) {
        UUID userId = SecurityContextUtil.currentUserId();
        try {
            jdbc.update("""
                INSERT INTO case_attachments (case_id, document_id, note, attached_by)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (case_id, document_id) DO UPDATE SET note=EXCLUDED.note
                """, caseId, documentId, note, userId);
        } catch (Exception e) {
            throw new RuntimeException("Could not attach document: " + e.getMessage());
        }
        event(caseId, userId, "DOC_ATTACHED",
              Map.of("documentId", documentId.toString(), "note", note == null ? "" : note));
        return Map.of("status", "ATTACHED");
    }

    // ---- participants ----

    public Map<String, Object> invite(UUID caseId, UUID userId, String externalEmail, String role) {
        UUID actor = SecurityContextUtil.currentUserId();
        jdbc.update("""
            INSERT INTO case_participants (case_id, user_id, external_email, role, invited_by)
            VALUES (?, ?, ?, COALESCE(?, 'COLLABORATOR'), ?)
            """, caseId, userId, externalEmail, role, actor);
        event(caseId, actor, "PARTICIPANT_INVITED",
              Map.of("userId", userId == null ? "" : userId.toString(),
                     "externalEmail", externalEmail == null ? "" : externalEmail,
                     "role", role == null ? "COLLABORATOR" : role));
        return Map.of("status", "INVITED");
    }

    // ---- dashboard ----

    public Map<String, Object> summary() {
        return jdbc.queryForMap("""
            SELECT
                COUNT(*) FILTER (WHERE status='OPEN')         AS open,
                COUNT(*) FILTER (WHERE status='IN_PROGRESS')  AS in_progress,
                COUNT(*) FILTER (WHERE status='ON_HOLD')      AS on_hold,
                COUNT(*) FILTER (WHERE status='CLOSED')       AS closed,
                COUNT(*) FILTER (WHERE priority='CRITICAL' AND status<>'CLOSED') AS critical_open,
                COUNT(*) FILTER (WHERE priority='HIGH' AND status<>'CLOSED')     AS high_open,
                COUNT(*)                                       AS total
            FROM cases
            """);
    }

    // ---- helper ----

    private void event(UUID caseId, UUID actorId, String type, Map<String, Object> details) {
        try {
            jdbc.update("""
                INSERT INTO case_events (case_id, actor_id, event_type, details)
                VALUES (?, ?, ?, ?::jsonb)
                """, caseId, actorId, type, om.writeValueAsString(details == null ? Map.of() : details));
        } catch (Exception e) {
            log.warn("case event insert failed: {}", e.getMessage());
        }
    }
}
