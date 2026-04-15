package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.document.dto.*;
import com.apexnexus.document.model.EmailIngestionConfig;
import com.apexnexus.document.model.EmailIngestionRule;
import com.apexnexus.document.repository.EmailIngestionConfigRepository;
import com.apexnexus.document.repository.EmailIngestionRuleRepository;
import com.apexnexus.document.service.EmailIngestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/email-ingestion")
@RequiredArgsConstructor
public class EmailIngestionController {

    private final EmailIngestionConfigRepository configRepository;
    private final EmailIngestionRuleRepository ruleRepository;
    private final EmailIngestionService emailIngestionService;

    /* ─── Config CRUD ─── */

    @GetMapping("/configs")
    public ResponseEntity<ApiResponse<List<EmailIngestionConfigDto>>> listConfigs() {
        List<EmailIngestionConfigDto> list = configRepository.findAll().stream()
                .map(this::toDto).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @GetMapping("/configs/{id}")
    public ResponseEntity<ApiResponse<EmailIngestionConfigDto>> getConfig(@PathVariable UUID id) {
        EmailIngestionConfig config = configRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Config not found"));
        return ResponseEntity.ok(ApiResponse.ok(toDto(config)));
    }

    @PostMapping("/configs")
    public ResponseEntity<ApiResponse<EmailIngestionConfigDto>> createConfig(
            @RequestBody @Valid CreateEmailConfigRequest req,
            Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        EmailIngestionConfig config = EmailIngestionConfig.builder()
                .name(req.getName())
                .protocol(req.getProtocol() != null ? req.getProtocol().toUpperCase() : "IMAP")
                .imapHost(req.getImapHost())
                .imapPort(req.getImapPort())
                .ewsUrl(req.getEwsUrl())
                .username(req.getUsername())
                .password(req.getPassword())
                .folderName(req.getFolderName() != null ? req.getFolderName() : "INBOX")
                .useSsl(req.getUseSsl() != null ? req.getUseSsl() : true)
                .pollInterval(req.getPollInterval() != null ? req.getPollInterval() : 5)
                .enabled(false)
                .targetFolderId(req.getTargetFolderId())
                .projectId(req.getProjectId())
                .createdBy(userId)
                .build();
        config = configRepository.save(config);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Config created", toDto(config)));
    }

    @PutMapping("/configs/{id}")
    public ResponseEntity<ApiResponse<EmailIngestionConfigDto>> updateConfig(
            @PathVariable UUID id,
            @RequestBody CreateEmailConfigRequest req) {
        EmailIngestionConfig config = configRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Config not found"));
        config.setName(req.getName());
        if (req.getProtocol() != null) config.setProtocol(req.getProtocol().toUpperCase());
        config.setImapHost(req.getImapHost());
        config.setImapPort(req.getImapPort());
        if (req.getEwsUrl() != null) config.setEwsUrl(req.getEwsUrl());
        config.setUsername(req.getUsername());
        if (req.getPassword() != null && !req.getPassword().isBlank())
            config.setPassword(req.getPassword());
        if (req.getFolderName() != null) config.setFolderName(req.getFolderName());
        if (req.getUseSsl() != null) config.setUseSsl(req.getUseSsl());
        if (req.getPollInterval() != null) config.setPollInterval(req.getPollInterval());
        if (req.getTargetFolderId() != null) config.setTargetFolderId(req.getTargetFolderId());
        if (req.getProjectId() != null) config.setProjectId(req.getProjectId());
        config = configRepository.save(config);
        return ResponseEntity.ok(ApiResponse.ok("Config updated", toDto(config)));
    }

    @PatchMapping("/configs/{id}/toggle")
    public ResponseEntity<ApiResponse<EmailIngestionConfigDto>> toggleConfig(@PathVariable UUID id) {
        EmailIngestionConfig config = configRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Config not found"));
        config.setEnabled(!config.getEnabled());
        config = configRepository.save(config);
        return ResponseEntity.ok(ApiResponse.ok(config.getEnabled() ? "Enabled" : "Disabled", toDto(config)));
    }

    @DeleteMapping("/configs/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteConfig(@PathVariable UUID id) {
        configRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.ok("Config deleted", null));
    }

    /* ─── Rules CRUD ─── */

    @PostMapping("/configs/{configId}/rules")
    public ResponseEntity<ApiResponse<EmailIngestionRuleDto>> addRule(
            @PathVariable UUID configId,
            @RequestBody @Valid CreateEmailRuleRequest req) {
        EmailIngestionConfig config = configRepository.findById(configId)
                .orElseThrow(() -> new RuntimeException("Config not found"));
        EmailIngestionRule rule = EmailIngestionRule.builder()
                .config(config)
                .ruleName(req.getRuleName())
                .ruleType(req.getRuleType())
                .ruleValue(req.getRuleValue())
                .targetFolderId(req.getTargetFolderId())
                .enabled(true)
                .build();
        rule = ruleRepository.save(rule);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Rule added", toRuleDto(rule)));
    }

    @PatchMapping("/rules/{ruleId}/toggle")
    public ResponseEntity<ApiResponse<EmailIngestionRuleDto>> toggleRule(@PathVariable UUID ruleId) {
        EmailIngestionRule rule = ruleRepository.findById(ruleId)
                .orElseThrow(() -> new RuntimeException("Rule not found"));
        rule.setEnabled(!rule.getEnabled());
        rule = ruleRepository.save(rule);
        return ResponseEntity.ok(ApiResponse.ok(rule.getEnabled() ? "Enabled" : "Disabled", toRuleDto(rule)));
    }

    @DeleteMapping("/rules/{ruleId}")
    public ResponseEntity<ApiResponse<Void>> deleteRule(@PathVariable UUID ruleId) {
        ruleRepository.deleteById(ruleId);
        return ResponseEntity.ok(ApiResponse.ok("Rule deleted", null));
    }

    /* ─── Manual poll ─── */

    @PostMapping("/configs/{id}/poll")
    public ResponseEntity<ApiResponse<Map<String, Object>>> pollNow(@PathVariable UUID id) {
        EmailIngestionConfig config = configRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Config not found"));
        int count = emailIngestionService.pollMailbox(config);
        return ResponseEntity.ok(ApiResponse.ok("Poll complete",
                Map.of("documentsIngested", count, "configName", config.getName())));
    }

    /* ─── Mappers ─── */

    private EmailIngestionConfigDto toDto(EmailIngestionConfig c) {
        return EmailIngestionConfigDto.builder()
                .id(c.getId())
                .name(c.getName())
                .protocol(c.getProtocol())
                .imapHost(c.getImapHost())
                .imapPort(c.getImapPort())
                .ewsUrl(c.getEwsUrl())
                .username(c.getUsername())
                .folderName(c.getFolderName())
                .useSsl(c.getUseSsl())
                .pollInterval(c.getPollInterval())
                .enabled(c.getEnabled())
                .targetFolderId(c.getTargetFolderId())
                .projectId(c.getProjectId())
                .createdBy(c.getCreatedBy())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .rules(c.getRules() != null ? c.getRules().stream().map(this::toRuleDto).toList() : List.of())
                .build();
    }

    private EmailIngestionRuleDto toRuleDto(EmailIngestionRule r) {
        return EmailIngestionRuleDto.builder()
                .id(r.getId())
                .configId(r.getConfig().getId())
                .ruleName(r.getRuleName())
                .ruleType(r.getRuleType())
                .ruleValue(r.getRuleValue())
                .targetFolderId(r.getTargetFolderId())
                .enabled(r.getEnabled())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
