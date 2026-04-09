package com.apexnexus.retention.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RetentionStatsDto {
    private long pendingCount;
    private long approvedCount;
    private long destroyedCount;
    private long onHoldCount;
    private long rejectedCount;
}
