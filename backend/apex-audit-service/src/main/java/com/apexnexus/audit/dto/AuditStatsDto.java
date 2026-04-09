package com.apexnexus.audit.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class AuditStatsDto {
    private String period;
    private long totalEvents;
    private Map<String, Long> actionCounts;
    private Map<String, Long> mostActiveUsers;
    private Map<String, Long> actorTypeCounts; // HUMAN vs AI_SERVICE breakdown
}
