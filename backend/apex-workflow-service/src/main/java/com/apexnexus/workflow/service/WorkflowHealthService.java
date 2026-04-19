package com.apexnexus.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Computes workflow health metrics: average time in each state, bottlenecks,
 * currently stuck instances, and throughput.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WorkflowHealthService {

    private final JdbcTemplate jdbc;

    public Map<String, Object> overview(int days) {
        Map<String, Object> out = new LinkedHashMap<>();

        // Summary counts
        Map<String, Object> counts = jdbc.queryForMap("""
            SELECT
              COUNT(*) FILTER (WHERE completed_at IS NULL) AS active,
              COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS completed,
              COUNT(*) FILTER (WHERE current_state = 'ESCALATED') AS escalated,
              COUNT(*) FILTER (WHERE sla_deadline IS NOT NULL AND sla_deadline < now() AND completed_at IS NULL) AS sla_breached,
              COUNT(*) AS total
            FROM workflow_instances
            WHERE created_at >= now() - make_interval(days => ?)
            """, days);
        out.put("counts", counts);

        // Avg time in each state (computed from transitions)
        List<Map<String, Object>> stateTimings = jdbc.queryForList("""
            SELECT from_state AS state,
                   COUNT(*) AS transitions,
                   AVG(EXTRACT(EPOCH FROM (t.created_at - prev.created_at))/3600) AS avg_hours,
                   MAX(EXTRACT(EPOCH FROM (t.created_at - prev.created_at))/3600) AS max_hours
            FROM workflow_transitions t
            JOIN LATERAL (
              SELECT created_at FROM workflow_transitions p
              WHERE p.instance_id = t.instance_id AND p.created_at < t.created_at
              ORDER BY p.created_at DESC LIMIT 1
            ) prev ON true
            WHERE t.created_at >= now() - make_interval(days => ?)
            GROUP BY from_state
            ORDER BY avg_hours DESC NULLS LAST
            """, days);
        out.put("stateTimings", stateTimings);

        // State distribution (where are things right now)
        List<Map<String, Object>> stateDist = jdbc.queryForList("""
            SELECT current_state AS state, COUNT(*) AS count
            FROM workflow_instances
            WHERE completed_at IS NULL
            GROUP BY current_state
            ORDER BY count DESC
            """);
        out.put("stateDistribution", stateDist);

        // Stuck instances (in same state > 48h, not completed)
        List<Map<String, Object>> stuck = jdbc.queryForList("""
            SELECT wi.id, wi.current_state, wi.document_id, wi.assigned_to,
                   u.username AS assigned_to_name,
                   d.title AS document_title,
                   EXTRACT(EPOCH FROM (now() - COALESCE(max_t.last_transition, wi.created_at)))/3600 AS hours_stuck,
                   wi.priority, wi.escalation_level
            FROM workflow_instances wi
            LEFT JOIN users u ON u.id = wi.assigned_to
            LEFT JOIN documents d ON d.id = wi.document_id
            LEFT JOIN LATERAL (
              SELECT MAX(created_at) AS last_transition
              FROM workflow_transitions WHERE instance_id = wi.id
            ) max_t ON true
            WHERE wi.completed_at IS NULL
              AND EXTRACT(EPOCH FROM (now() - COALESCE(max_t.last_transition, wi.created_at))) > 172800
            ORDER BY hours_stuck DESC
            LIMIT 20
            """);
        out.put("stuckInstances", stuck);

        // Throughput by day
        List<Map<String, Object>> throughput = jdbc.queryForList("""
            SELECT DATE_TRUNC('day', completed_at)::date AS day,
                   COUNT(*) AS completed
            FROM workflow_instances
            WHERE completed_at >= now() - make_interval(days => ?)
            GROUP BY day
            ORDER BY day ASC
            """, days);
        out.put("throughputByDay", throughput);

        // Actor performance (top approvers by throughput + avg time)
        List<Map<String, Object>> actors = jdbc.queryForList("""
            SELECT u.username, u.id AS user_id,
                   COUNT(*) AS actions_taken,
                   AVG(EXTRACT(EPOCH FROM (t.created_at - wi.created_at))/3600) AS avg_response_hours
            FROM workflow_transitions t
            JOIN users u ON u.id = t.performed_by
            JOIN workflow_instances wi ON wi.id = t.instance_id
            WHERE t.created_at >= now() - make_interval(days => ?)
            GROUP BY u.username, u.id
            ORDER BY actions_taken DESC
            LIMIT 10
            """, days);
        out.put("topActors", actors);

        // Heat-map friendly: ranked bottleneck list
        out.put("windowDays", days);
        return out;
    }
}
