package com.apexnexus.auth.dto;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectPluginDto {
    private UUID pluginId;
    private String name;
    private String displayName;
    private String description;
    private String version;
    private String vendor;
    private String pluginType;
    private String category;
    private String globalStatus;
    private boolean activeInProject;
    private String iconUrl;
    private Boolean isPremium;
    private Instant activatedAt;
}
