package com.apexnexus.document.service;

import com.apexnexus.common.security.SecurityContextUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Builds a lightweight knowledge graph from document metadata, authors, projects,
 * and extracted entities. Returns nodes + edges consumable by a force-directed viewer.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KnowledgeGraphService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public Map<String, Object> buildGraph(String scope, UUID scopeId, int maxNodes) {
        UUID currentUser = SecurityContextUtil.currentUserId();
        boolean admin = SecurityContextUtil.isSystemAdmin();
        Set<UUID> accessibleProjects = admin ? null : SecurityContextUtil.accessibleProjectIds();

        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        Map<String, String> nodeIds = new HashMap<>();

        // Query documents (respecting zero-trust project filter)
        StringBuilder sql = new StringBuilder("""
                SELECT d.id, d.title, d.author_id, d.project_id, d.tags,
                       d.extracted_entities, d.mime_type, u.username AS author_name,
                       p.name AS project_name
                FROM documents d
                LEFT JOIN users u ON u.id = d.author_id
                LEFT JOIN projects p ON p.id = d.project_id
                WHERE d.status != 'ARCHIVED'
                """);
        List<Object> args = new ArrayList<>();
        if (!admin) {
            if (accessibleProjects == null || accessibleProjects.isEmpty()) {
                sql.append(" AND (d.author_id = ? OR d.project_id IS NULL)");
                args.add(currentUser);
            } else {
                String placeholders = String.join(",", Collections.nCopies(accessibleProjects.size(), "?"));
                sql.append(" AND (d.project_id IN (").append(placeholders).append(") OR d.author_id = ?)");
                args.addAll(accessibleProjects);
                args.add(currentUser);
            }
        }
        if ("project".equals(scope) && scopeId != null) {
            sql.append(" AND d.project_id = ?");
            args.add(scopeId);
        } else if ("author".equals(scope) && scopeId != null) {
            sql.append(" AND d.author_id = ?");
            args.add(scopeId);
        }
        sql.append(" ORDER BY d.created_at DESC LIMIT ?");
        args.add(Math.min(maxNodes, 200));

        List<Map<String, Object>> docs = jdbc.queryForList(sql.toString(), args.toArray());

        // Emit document nodes + project/author/tag/entity nodes + edges
        Map<String, Integer> entityCounts = new HashMap<>();
        for (Map<String, Object> d : docs) {
            String docNodeId = "doc:" + d.get("id");
            addNode(nodes, nodeIds, docNodeId, "document",
                    (String) d.get("title"), (String) d.get("mime_type"));

            // Author
            if (d.get("author_id") != null) {
                String aid = "user:" + d.get("author_id");
                addNode(nodes, nodeIds, aid, "user",
                        d.get("author_name") != null ? (String) d.get("author_name") : "Unknown", null);
                edges.add(edge(aid, docNodeId, "authored"));
            }
            // Project
            if (d.get("project_id") != null) {
                String pid = "project:" + d.get("project_id");
                addNode(nodes, nodeIds, pid, "project",
                        d.get("project_name") != null ? (String) d.get("project_name") : "Project", null);
                edges.add(edge(docNodeId, pid, "belongs_to"));
            }
            // Tags
            Object tagsObj = d.get("tags");
            if (tagsObj instanceof java.sql.Array arr) {
                try {
                    String[] tags = (String[]) arr.getArray();
                    for (String tag : tags) {
                        if (tag == null || tag.isBlank()) continue;
                        String tid = "tag:" + tag.toLowerCase();
                        addNode(nodes, nodeIds, tid, "tag", tag, null);
                        edges.add(edge(docNodeId, tid, "tagged"));
                    }
                } catch (Exception ignored) {}
            }
            // Extracted entities (top N per doc)
            Object ent = d.get("extracted_entities");
            if (ent != null) {
                try {
                    JsonNode root = objectMapper.readTree(ent.toString());
                    if (root.isObject()) {
                        root.fields().forEachRemaining(e -> {
                            String type = e.getKey();
                            JsonNode vals = e.getValue();
                            if (vals.isArray()) {
                                int added = 0;
                                for (JsonNode v : vals) {
                                    if (added++ >= 3) break;
                                    String value = v.isObject() ? v.path("value").asText("") : v.asText("");
                                    if (value.isBlank() || value.length() > 100) continue;
                                    String key = "entity:" + type + ":" + value.toLowerCase();
                                    entityCounts.merge(key, 1, Integer::sum);
                                    addNode(nodes, nodeIds, key, "entity:" + type, value, type);
                                    edges.add(edge(docNodeId, key, "mentions"));
                                }
                            }
                        });
                    }
                } catch (Exception ex) {
                    log.debug("parse entities failed: {}", ex.getMessage());
                }
            }
        }

        // Stats
        Map<String, Integer> typeCount = new LinkedHashMap<>();
        for (Map<String, Object> n : nodes) {
            typeCount.merge((String) n.get("type"), 1, Integer::sum);
        }

        Map<String, Object> graph = new LinkedHashMap<>();
        graph.put("scope", scope != null ? scope : "all");
        graph.put("scopeId", scopeId);
        graph.put("nodes", nodes);
        graph.put("edges", edges);
        graph.put("nodeCount", nodes.size());
        graph.put("edgeCount", edges.size());
        graph.put("byType", typeCount);
        return graph;
    }

    private void addNode(List<Map<String, Object>> nodes, Map<String, String> ids,
                         String id, String type, String label, String subtype) {
        if (ids.containsKey(id)) return;
        ids.put(id, id);
        Map<String, Object> n = new LinkedHashMap<>();
        n.put("id", id);
        n.put("type", type);
        n.put("label", label);
        if (subtype != null) n.put("subtype", subtype);
        nodes.add(n);
    }

    private Map<String, Object> edge(String source, String target, String rel) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("source", source);
        e.put("target", target);
        e.put("relation", rel);
        return e;
    }
}
