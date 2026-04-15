package com.apexnexus.document.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import java.util.UUID;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class CreateEmailConfigRequest {
    @NotBlank private String name;
    private String protocol;      // IMAP (default) or EWS
    private String imapHost;      // required for IMAP
    private Integer imapPort;     // required for IMAP
    private String ewsUrl;        // required for EWS
    @NotBlank private String username;
    @NotBlank private String password;
    private String folderName;
    private Boolean useSsl;
    private Integer pollInterval;
    private UUID targetFolderId;
    private UUID projectId;
}
