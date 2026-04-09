package com.apexnexus.auth.dto;

import lombok.*;
import java.util.UUID;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class PluginHookDto {
    private UUID id;
    private String hookType;
    private String eventName;
    private String handlerConfig;
    private Integer executionOrder;
    private Boolean isActive;
}
