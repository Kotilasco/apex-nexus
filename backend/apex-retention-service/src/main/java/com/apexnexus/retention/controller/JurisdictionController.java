package com.apexnexus.retention.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.retention.dto.JurisdictionDto;
import com.apexnexus.retention.dto.JurisdictionRetentionRuleDto;
import com.apexnexus.retention.dto.LegalFrameworkDto;
import com.apexnexus.retention.service.JurisdictionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/retention/jurisdictions")
@RequiredArgsConstructor
public class JurisdictionController {

    private final JurisdictionService jurisdictionService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<JurisdictionDto>>> getJurisdictions() {
        return ResponseEntity.ok(ApiResponse.success(jurisdictionService.getActiveJurisdictions()));
    }

    @GetMapping("/{code}")
    public ResponseEntity<ApiResponse<JurisdictionDto>> getJurisdiction(@PathVariable String code) {
        return ResponseEntity.ok(ApiResponse.success(jurisdictionService.getJurisdiction(code)));
    }

    @GetMapping("/{jurisdictionId}/frameworks")
    public ResponseEntity<ApiResponse<List<LegalFrameworkDto>>> getFrameworks(@PathVariable UUID jurisdictionId) {
        return ResponseEntity.ok(ApiResponse.success(jurisdictionService.getFrameworks(jurisdictionId)));
    }

    @GetMapping("/frameworks")
    public ResponseEntity<ApiResponse<List<LegalFrameworkDto>>> getAllFrameworks() {
        return ResponseEntity.ok(ApiResponse.success(jurisdictionService.getAllFrameworks()));
    }

    @GetMapping("/{jurisdictionId}/rules")
    public ResponseEntity<ApiResponse<List<JurisdictionRetentionRuleDto>>> getRulesByJurisdiction(
            @PathVariable UUID jurisdictionId) {
        return ResponseEntity.ok(ApiResponse.success(jurisdictionService.getRulesByJurisdiction(jurisdictionId)));
    }

    @GetMapping("/rules")
    public ResponseEntity<ApiResponse<List<JurisdictionRetentionRuleDto>>> getAllRules() {
        return ResponseEntity.ok(ApiResponse.success(jurisdictionService.getAllRules()));
    }

    @GetMapping("/rules/by-category/{category}")
    public ResponseEntity<ApiResponse<List<JurisdictionRetentionRuleDto>>> getRulesByCategory(
            @PathVariable String category) {
        return ResponseEntity.ok(ApiResponse.success(jurisdictionService.getRulesByCategory(category)));
    }

    @GetMapping("/{jurisdictionId}/rules/check/{category}")
    public ResponseEntity<ApiResponse<List<JurisdictionRetentionRuleDto>>> checkCompliance(
            @PathVariable UUID jurisdictionId,
            @PathVariable String category) {
        return ResponseEntity.ok(ApiResponse.success(jurisdictionService.checkCompliance(jurisdictionId, category)));
    }
}
