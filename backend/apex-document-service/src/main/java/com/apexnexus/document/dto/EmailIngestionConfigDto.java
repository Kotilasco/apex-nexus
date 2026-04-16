package com.apexnexus.document.dto;

import lombok.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailIngestionConfigDto {
    private UUID id;
    private String name;
    private String protocol;
    private String imapHost;
    private Integer imapPort;
    private String ewsUrl;
    private String username;
    // password deliberately excluded from read responses
    private String folderName;
    private Boolean useSsl;
    private Integer pollInterval;
    private Boolean enabled;
    private UUID targetFolderId;
    private UUID projectId;
    private UUID createdBy;
    private Instant createdAt;
    private Instant updatedAt;
    private List<EmailIngestionRuleDto> rules;
}
