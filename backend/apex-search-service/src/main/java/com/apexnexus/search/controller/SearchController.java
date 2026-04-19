package com.apexnexus.search.controller;

import com.apexnexus.common.dto.ApiResponse;
import com.apexnexus.search.dto.SearchRequest;
import com.apexnexus.search.dto.SearchResponse;
import com.apexnexus.search.service.AgenticSearchService;
import com.apexnexus.search.service.ClassificationService;
import com.apexnexus.search.service.CompositeClassifier;
import com.apexnexus.search.service.ContentExtractorService;
import com.apexnexus.search.service.FederatedSearchService;
import com.apexnexus.search.service.GdprScannerService;
import com.apexnexus.search.service.SearchService;
import com.apexnexus.search.service.VersionAnomalyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;
    private final ContentExtractorService contentExtractor;
    private final ClassificationService classificationService;
    private final GdprScannerService gdprScannerService;
    private final VersionAnomalyService versionAnomalyService;
    private final AgenticSearchService agenticSearchService;
    private final FederatedSearchService federatedSearchService;
    private final CompositeClassifier compositeClassifier;

    @PostMapping
    public ResponseEntity<ApiResponse<SearchResponse>> search(
            @RequestBody SearchRequest request,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        SearchResponse response = searchService.search(request, userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<SearchResponse>> quickSearch(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) List<String> tags,
            @RequestParam(required = false) String mimeType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String folder,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());

        SearchRequest request = new SearchRequest();
        request.setQuery(q);
        request.setPage(page);
        request.setSize(size);
        request.setTags(tags);
        request.setMimeType(mimeType);
        request.setStatus(status);
        request.setFolderPath(folder);

        SearchResponse response = searchService.search(request, userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/index")
    public ResponseEntity<ApiResponse<Void>> indexDocument(@RequestBody Map<String, Object> document) {
        searchService.indexDocument(document);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/index/{documentId}")
    public ResponseEntity<ApiResponse<Void>> removeFromIndex(@PathVariable String documentId) {
        searchService.removeDocument(documentId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /**
     * Extract text content from an uploaded file (on-demand OCR/content extraction).
     */
    @PostMapping("/extract")
    public ResponseEntity<ApiResponse<ContentExtractorService.ExtractionResult>> extractContent(
            @RequestParam("file") MultipartFile file) throws Exception {
        ContentExtractorService.ExtractionResult result = contentExtractor.extract(
                file.getBytes(), file.getOriginalFilename(), file.getContentType());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Extract and index content for an existing document by ID.
     */
    @PostMapping("/extract/{documentId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> extractAndIndex(
            @PathVariable String documentId,
            @RequestParam("file") MultipartFile file) throws Exception {
        ContentExtractorService.ExtractionResult result = contentExtractor.extract(
                file.getBytes(), file.getOriginalFilename(), file.getContentType());

        if (result.isSuccess() && !result.getText().isBlank()) {
            searchService.updateDocument(documentId, Map.of("content", result.getText()));
        }

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "documentId", documentId,
                "extracted", result.isSuccess(),
                "contentLength", result.getContentLength(),
                "ocrApplied", result.isOcrApplied(),
                "extractionTimeMs", result.getExtractionTimeMs()
        )));
    }

    /**
     * Classify an uploaded file — returns label, category, and confidence.
     */
    @PostMapping("/classify")
    public ResponseEntity<ApiResponse<ClassificationService.ClassificationResult>> classifyDocument(
            @RequestParam("file") MultipartFile file) throws Exception {
        ContentExtractorService.ExtractionResult extraction = contentExtractor.extract(
                file.getBytes(), file.getOriginalFilename(), file.getContentType());

        ClassificationService.ClassificationResult classification = classificationService.classify(
                file.getOriginalFilename(), file.getContentType(),
                extraction.isSuccess() ? extraction.getText() : "",
                extraction.isSuccess() ? extraction.getMetadata() : Map.of());

        return ResponseEntity.ok(ApiResponse.success(classification));
    }

    /**
     * 3-layer composite classification (Structural + Textual + Semantic LLM).
     * Used by the Intelligent Capture intake pipeline. Accepts already-extracted text
     * so the caller (document-service) doesn't need Tika.
     */
    @PostMapping("/classify-text")
    public ResponseEntity<ApiResponse<CompositeClassifier.CompositeResult>> classifyText(
            @RequestBody Map<String, String> body) {
        String fileName = body.getOrDefault("fileName", "");
        String mimeType = body.getOrDefault("mimeType", "");
        String text = body.getOrDefault("text", "");
        return ResponseEntity.ok(ApiResponse.success(
                compositeClassifier.classify(fileName, mimeType, text)));
    }

    /**
     * Semantic similarity search — finds documents by meaning rather than exact keyword match.
     */
    @GetMapping("/semantic")
    public ResponseEntity<ApiResponse<SearchResponse>> semanticSearch(
            @RequestParam String q,
            @RequestParam(defaultValue = "10") int size,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        SearchResponse response = searchService.semanticSearch(q, Math.min(size, 100), userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * GDPR privacy scan — upload a file and detect PII content.
     */
    @PostMapping("/gdpr-scan")
    public ResponseEntity<ApiResponse<GdprScannerService.GdprScanResult>> gdprScan(
            @RequestParam("file") MultipartFile file) throws Exception {
        ContentExtractorService.ExtractionResult extraction = contentExtractor.extract(
                file.getBytes(), file.getOriginalFilename(), file.getContentType());

        String text = extraction.isSuccess() ? extraction.getText() : "";
        GdprScannerService.GdprScanResult result = gdprScannerService.scan(text, file.getOriginalFilename());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * GDPR scan by document ID — scans already-indexed content.
     */
    @PostMapping("/gdpr-scan/{documentId}")
    public ResponseEntity<ApiResponse<GdprScannerService.GdprScanResult>> gdprScanDocument(
            @PathVariable String documentId,
            @RequestParam("file") MultipartFile file) throws Exception {
        ContentExtractorService.ExtractionResult extraction = contentExtractor.extract(
                file.getBytes(), file.getOriginalFilename(), file.getContentType());

        String text = extraction.isSuccess() ? extraction.getText() : "";
        GdprScannerService.GdprScanResult result = gdprScannerService.scan(text, documentId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Version anomaly detection — compares two document versions to detect
     * potential mistakes (e.g., wrong document checked in as a new version).
     */
    @PostMapping("/version-anomaly")
    public ResponseEntity<ApiResponse<VersionAnomalyService.AnomalyCheckResult>> checkVersionAnomaly(
            @RequestParam("previousFile") MultipartFile previousFile,
            @RequestParam("newFile") MultipartFile newFile) throws Exception {
        VersionAnomalyService.AnomalyCheckResult result = versionAnomalyService.checkAnomaly(
                previousFile.getBytes(), previousFile.getOriginalFilename(), previousFile.getContentType(),
                newFile.getBytes(), newFile.getOriginalFilename(), newFile.getContentType());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Agentic AI search — answer a natural language question using RAG over the document corpus.
     */
    @PostMapping("/ask")
    public ResponseEntity<ApiResponse<Map<String, Object>>> ask(
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        String question = (String) body.getOrDefault("question", "");
        int topK = body.get("topK") instanceof Number ? ((Number) body.get("topK")).intValue() : 5;
        if (question.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("question is required"));
        }
        return ResponseEntity.ok(ApiResponse.success(agenticSearchService.ask(question, userId, topK)));
    }

    /**
     * Federated search — merge results from internal index + external connectors (Outlook, SharePoint, …).
     */
    @GetMapping("/federated")
    public ResponseEntity<ApiResponse<Map<String, Object>>> federated(
            @RequestParam String q,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) List<String> sources,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(
                federatedSearchService.federatedSearch(q, size, sources, userId)));
    }

    /**
     * Knowledge Synthesis — multi-document briefing with themes, risks, and citations.
     */
    @PostMapping("/synthesize")
    public ResponseEntity<ApiResponse<Map<String, Object>>> synthesize(
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        String topic = (String) body.getOrDefault("topic", "");
        int topK = body.get("topK") instanceof Number ? ((Number) body.get("topK")).intValue() : 8;
        if (topic.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("topic is required"));
        }
        return ResponseEntity.ok(ApiResponse.success(
                agenticSearchService.synthesize(topic, userId, topK)));
    }

    /**
     * Command Bar — intent-based natural language router.
     */
    @PostMapping("/intent")
    public ResponseEntity<ApiResponse<Map<String, Object>>> intent(
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        String prompt = (String) body.getOrDefault("prompt", "");
        if (prompt.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("prompt is required"));
        }
        return ResponseEntity.ok(ApiResponse.success(
                agenticSearchService.routeIntent(prompt, userId)));
    }
}
