package com.apexnexus.document.dto;

import com.apexnexus.document.model.EmailIngestionRule;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class EmailIngestionRuleDto {
    private UUID id;
    private UUID configId;
    private String ruleName;
    private EmailIngestionRule.RuleType ruleType;
    private String ruleValue;
    private UUID targetFolderId;
    private Boolean enabled;
    private Instant createdAt;
}
