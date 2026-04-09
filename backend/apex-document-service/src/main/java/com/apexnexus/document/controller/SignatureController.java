package com.apexnexus.document.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.document.model.DocumentSignature;
import com.apexnexus.document.model.DocumentSignature.SignatureProvider;
import com.apexnexus.document.service.DocumentService;
import com.apexnexus.document.service.SignatureService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/documents/signatures")
@RequiredArgsConstructor
public class SignatureController {

    private final SignatureService signatureService;
    private final DocumentService documentService;

    @PostMapping("/request")
    public ResponseEntity<ApiResponse<DocumentSignature>> requestSignature(
            @RequestBody Map<String, String> request,
            Authentication auth) {
        UUID requesterId = UUID.fromString(auth.getName());
        UUID documentId = UUID.fromString(request.get("documentId"));
        UUID signerId = UUID.fromString(request.get("signerId"));
        SignatureProvider provider = request.containsKey("provider")
                ? SignatureProvider.valueOf(request.get("provider"))
                : SignatureProvider.INTERNAL;

        DocumentSignature signature = signatureService.requestSignature(
                documentId, signerId, requesterId, provider);
        return ResponseEntity.ok(ApiResponse.success(signature));
    }

    @PostMapping("/{signatureId}/sign")
    public ResponseEntity<ApiResponse<DocumentSignature>> sign(
            @PathVariable UUID signatureId,
            Authentication auth) throws Exception {
        UUID signerId = UUID.fromString(auth.getName());
        // Fetch the signature to get the document ID, then load the actual file content
        List<DocumentSignature> allSigs = signatureService.getPendingSignatures(signerId);
        DocumentSignature pending = allSigs.stream()
                .filter(s -> s.getId().equals(signatureId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Signature not found or not assigned to you"));
        byte[] fileContent = documentService.downloadDocument(pending.getDocumentId(), signerId);
        DocumentSignature signature = signatureService.signDocument(signatureId, signerId, fileContent);
        return ResponseEntity.ok(ApiResponse.success(signature));
    }

    @PostMapping("/{signatureId}/decline")
    public ResponseEntity<ApiResponse<DocumentSignature>> decline(
            @PathVariable UUID signatureId,
            Authentication auth) {
        UUID signerId = UUID.fromString(auth.getName());
        DocumentSignature signature = signatureService.declineSignature(signatureId, signerId);
        return ResponseEntity.ok(ApiResponse.success(signature));
    }

    @GetMapping("/{signatureId}/verify")
    public ResponseEntity<ApiResponse<Map<String, Object>>> verify(
            @PathVariable UUID signatureId,
            Authentication auth) throws Exception {
        UUID userId = UUID.fromString(auth.getName());
        // Resolve the signature to get document ID, then fetch actual file content
        DocumentSignature sig = signatureService.getDocumentSignatures(
                signatureService.getSignature(signatureId).getDocumentId())
                .stream().filter(s -> s.getId().equals(signatureId)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Signature not found"));
        byte[] fileContent = documentService.downloadDocument(sig.getDocumentId(), userId);
        boolean valid = signatureService.verifySignature(signatureId, fileContent);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "signatureId", signatureId.toString(),
                "valid", valid
        )));
    }

    @GetMapping("/document/{documentId}")
    public ResponseEntity<ApiResponse<List<DocumentSignature>>> getDocumentSignatures(
            @PathVariable UUID documentId) {
        return ResponseEntity.ok(ApiResponse.success(
                signatureService.getDocumentSignatures(documentId)));
    }

    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<List<DocumentSignature>>> getPendingSignatures(
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(
                signatureService.getPendingSignatures(userId)));
    }
}
