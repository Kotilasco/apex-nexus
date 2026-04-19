package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.document.service.SapIntegrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Real SAP integration endpoints (called by Apex UI or workflow automations).
 * In production these are unchanged — only the backing service points at a
 * real SAP endpoint instead of /sap-mock.
 */
@RestController
@RequestMapping("/sap")
@RequiredArgsConstructor
public class SapIntegrationController {

    private final SapIntegrationService sapIntegrationService;

    /** End-to-end Procure-to-Pay for one invoice document. */
    @PostMapping("/invoices/process/{documentId}")
    public ResponseEntity<ApiResponse<Map<String,Object>>> process(@PathVariable UUID documentId) {
        return ResponseEntity.ok(ApiResponse.ok(sapIntegrationService.processInvoice(documentId)));
    }

    /** Link a field document / photo to a SAP Equipment record. */
    @PostMapping("/assets/{equipmentId}/link/{documentId}")
    public ResponseEntity<ApiResponse<Map<String,Object>>> linkAsset(
            @PathVariable String equipmentId,
            @PathVariable UUID documentId,
            @RequestParam(value = "linkType", defaultValue = "ATTACHMENT") String linkType) {
        return ResponseEntity.ok(ApiResponse.ok(
                sapIntegrationService.linkToAsset(documentId, equipmentId, linkType)));
    }

    /** What SAP sees: all Apex documents attached to a given SAP object. */
    @GetMapping("/transactions/{arObject}/{objectKey}/documents")
    public ResponseEntity<ApiResponse<List<Map<String,Object>>>> transactionDocs(
            @PathVariable String arObject, @PathVariable String objectKey) {
        return ResponseEntity.ok(ApiResponse.ok(
                sapIntegrationService.getTransactionDocuments(arObject, objectKey)));
    }

    /** SAP integration dashboard numbers. */
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<Map<String,Object>>> summary() {
        return ResponseEntity.ok(ApiResponse.ok(sapIntegrationService.summary()));
    }
}
