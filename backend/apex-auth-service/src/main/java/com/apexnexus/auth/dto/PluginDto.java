package com.apexnexus.auth.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class PluginDto {
    private UUID id;
    private String name;
    private String displayName;
    private String description;
    private String version;
    private String vendor;
    private String pluginType;
    private String category;
    private String status;
    private String configSchema;
    private String capabilities;
    private String iconUrl;
    private String documentationUrl;
    private Boolean isPremium;
    private Integer installedCount;
    private LocalDateTime createdAt;
    private List<PluginHookDto> hooks;
}
