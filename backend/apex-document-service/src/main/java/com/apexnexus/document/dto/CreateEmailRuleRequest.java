package com.apexnexus.document.dto;

import com.apexnexus.document.model.EmailIngestionRule;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateEmailRuleRequest {
    @NotBlank
    private String ruleName;
    @NotNull
    private EmailIngestionRule.RuleType ruleType;
    private String ruleValue;
    private UUID targetFolderId;
}
