package com.apexnexus.document.service;

import com.apexnexus.common.security.SecurityContextUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class DocumentConversationService {

    private final JdbcTemplate jdbc;

    public List<Map<String, Object>> listForDocument(UUID documentId) {
        return jdbc.queryForList("""
                SELECT c.id, c.document_id, c.version_id, c.title, c.question, c.answer,
                       c.asked_by, c.asked_by_name, c.created_at,
                       v.version_number
                FROM document_conversations c
                LEFT JOIN document_versions v ON v.id = c.version_id
                WHERE c.document_id = ?
                ORDER BY c.created_at DESC
                """, documentId);
    }

    public List<Map<String, Object>> listForVersion(UUID versionId) {
        return jdbc.queryForList("""
                SELECT c.id, c.document_id, c.version_id, c.title, c.question, c.answer,
                       c.asked_by, c.asked_by_name, c.created_at
                FROM document_conversations c
                WHERE c.version_id = ?
                ORDER BY c.created_at DESC
                """, versionId);
    }

    public Map<String, Object> save(UUID documentId, UUID versionId, String title, String question, String answer) {
        UUID uid = SecurityContextUtil.currentUserId();
        String username = null;
        try {
            username = jdbc.queryForObject("SELECT COALESCE(full_name, username) FROM users WHERE id=?", String.class, uid);
        } catch (Exception ignore) {}
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO document_conversations
                  (id, document_id, version_id, title, question, answer, asked_by, asked_by_name)
                VALUES (?,?,?,?,?,?,?,?)
                """, id, documentId, versionId, title, question, answer, uid, username);
        return Map.of("id", id, "saved", true);
    }

    public void delete(UUID id) {
        jdbc.update("DELETE FROM document_conversations WHERE id=?", id);
    }
}
