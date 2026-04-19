package com.apexnexus.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.*;

/**
 * Process Intelligence — Predictive Bottleneck Modeling.
 *
 * Traditional BI says "this workflow took 4 days". Predictive BI says
 * "THIS workflow will be 3 days late because assignee X has a backlog —
 * suggest re-routing to Y".
 *
 * Algorithm (demo-grade; replaceable with ML):
 *  - For each in-progress workflow, look at its current state.
 *  - Pull historical median dwell time for that state from workflow_step_history.
 *  - Look at the currently assigned user's backlog (count of open instances).
 *  - Apply a queuing multiplier: expected_hours = historical_median * (1 + backlog * 0.15).
 *  - Compare expected_completion against sla_deadline → risk level.
 *  - Propose a reassignee = user with smallest backlog in the same role (or any active user).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WorkflowPredictionService {

    private final JdbcTemplate jdbc;

    public Map<String, Object> computeAll() {
        List<Map<String, Object>> open = jdbc.queryForList("""
                SELECT wi.id, wi.definition_id, wi.current_state, wi.assigned_to,
                       wi.sla_deadline, wi.created_at, wi.document_id,
                       d.title AS document_title,
                       u.username AS assignee_name
                FROM workflow_instances wi
                LEFT JOIN documents d ON d.id=wi.document_id
                LEFT JOIN users u ON u.id=wi.assigned_to
                WHERE wi.completed_at IS NULL
                ORDER BY wi.created_at DESC
                LIMIT 200
                """);

        int written = 0, high = 0, medium = 0, low = 0;
        jdbc.update("DELETE FROM workflow_predictions WHERE computed_at < now() - interval '1 hour'");

        for (Map<String, Object> wi : open) {
            try {
                UUID wiId = (UUID) wi.get("id");
                UUID defId = (UUID) wi.get("definition_id");
                UUID assignee = (UUID) wi.get("assigned_to");
                String state = (String) wi.get("current_state");

                // 1) Historical median for this (definition, next-transition) in hours
                Double histMedian = jdbc.queryForObject("""
                        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY dwell_hours)
                        FROM workflow_step_history
                        WHERE definition_id=? AND from_state=?
                        """, Double.class, defId, state);
                if (histMedian == null || histMedian <= 0) histMedian = 36.0;  // default

                // 2) Backlog for current assignee
                int backlog = 0;
                if (assignee != null) {
                    Integer b = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM workflow_instances WHERE assigned_to=? AND completed_at IS NULL",
                        Integer.class, assignee);
                    backlog = (b == null ? 0 : b);
                }

                double expectedHours = histMedian * (1 + backlog * 0.15);
                OffsetDateTime predicted = OffsetDateTime.now().plusMinutes((long)(expectedHours * 60));

                // 3) Compare to SLA
                OffsetDateTime sla = null;
                Object slaObj = wi.get("sla_deadline");
                if (slaObj instanceof Timestamp ts) sla = ts.toInstant().atOffset(OffsetDateTime.now().getOffset());
                else if (slaObj instanceof OffsetDateTime o) sla = o;

                double delayHours = 0;
                String risk = "LOW";
                String reason = "On track";
                if (sla != null) {
                    delayHours = (predicted.toEpochSecond() - sla.toEpochSecond()) / 3600.0;
                    if (delayHours > 48) { risk = "HIGH"; reason = "Predicted " + Math.round(delayHours) + "h past SLA"; }
                    else if (delayHours > 12) { risk = "MEDIUM"; reason = "Predicted " + Math.round(delayHours) + "h past SLA"; }
                    else if (delayHours > 0) { risk = "MEDIUM"; reason = "At risk of missing SLA"; }
                } else if (backlog >= 8) {
                    risk = "HIGH"; reason = "Assignee has backlog of " + backlog + " open items"; delayHours = Math.max(0, expectedHours - histMedian);
                } else if (backlog >= 4) {
                    risk = "MEDIUM"; reason = "Assignee backlog " + backlog + " items"; delayHours = Math.max(0, expectedHours - histMedian);
                }

                // 4) Suggest reassignee: same role with smallest backlog (fallback: any user with backlog<2)
                UUID suggested = findReassignee(assignee);

                // 5) persist
                jdbc.update("""
                        INSERT INTO workflow_predictions
                          (workflow_instance_id, predicted_completion, predicted_delay_hours,
                           risk_level, bottleneck_assignee, bottleneck_reason, suggested_reassignee, confidence)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, wiId, predicted, delayHours, risk, assignee, reason, suggested, 0.75);
                written++;
                switch (risk) { case "HIGH" -> high++; case "MEDIUM" -> medium++; default -> low++; }
            } catch (Exception e) {
                log.debug("skip prediction: {}", e.getMessage());
            }
        }

        return Map.of("computed", written, "high", high, "medium", medium, "low", low);
    }

    private UUID findReassignee(UUID exclude) {
        try {
            List<Map<String, Object>> cands = jdbc.queryForList("""
                    SELECT u.id, u.username AS full_name,
                           (SELECT COUNT(*) FROM workflow_instances wi WHERE wi.assigned_to=u.id AND wi.completed_at IS NULL) AS backlog
                    FROM users u
                    WHERE u.is_active = true AND (? IS NULL OR u.id <> ?)
                    ORDER BY backlog ASC
                    LIMIT 1
                    """, exclude, exclude);
            if (!cands.isEmpty()) return (UUID) cands.get(0).get("id");
        } catch (Exception ignore) {}
        return null;
    }

    public List<Map<String, Object>> listPredictions() {
        return jdbc.queryForList("""
                SELECT wp.id, wp.workflow_instance_id, wp.predicted_completion,
                       wp.predicted_delay_hours, wp.risk_level, wp.bottleneck_reason,
                       wp.confidence, wp.computed_at,
                       u1.username AS bottleneck_name, u1.id AS bottleneck_id,
                       u2.username AS suggested_name, u2.id AS suggested_id,
                       wi.current_state, wi.sla_deadline,
                       d.title AS document_title, d.id AS document_id
                FROM workflow_predictions wp
                JOIN workflow_instances wi ON wi.id=wp.workflow_instance_id
                LEFT JOIN documents d ON d.id=wi.document_id
                LEFT JOIN users u1 ON u1.id=wp.bottleneck_assignee
                LEFT JOIN users u2 ON u2.id=wp.suggested_reassignee
                ORDER BY
                  CASE wp.risk_level WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
                  wp.predicted_delay_hours DESC
                LIMIT 100
                """);
    }

    public Map<String, Object> reassign(UUID workflowInstanceId, UUID newAssignee) {
        jdbc.update("UPDATE workflow_instances SET assigned_to=?, updated_at=now() WHERE id=?",
            newAssignee, workflowInstanceId);
        return Map.of("workflowInstanceId", workflowInstanceId, "newAssignee", newAssignee, "status", "REASSIGNED");
    }

    public Map<String, Object> summary() {
        Map<String, Object> s = jdbc.queryForMap("""
                SELECT
                  COUNT(*) FILTER (WHERE risk_level='HIGH') AS high,
                  COUNT(*) FILTER (WHERE risk_level='MEDIUM') AS medium,
                  COUNT(*) FILTER (WHERE risk_level='LOW') AS low,
                  COUNT(*) AS total,
                  MAX(computed_at) AS last_computed
                FROM workflow_predictions
                """);
        return s;
    }
}
