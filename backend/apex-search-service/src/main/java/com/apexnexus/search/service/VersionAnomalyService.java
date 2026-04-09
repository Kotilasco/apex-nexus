package com.apexnexus.search.service;

import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * AI-powered version anomaly detection.
 * Compares a new document version against its predecessor to detect
 * potentially incorrect check-ins (e.g., a completely different document
 * uploaded as a new version by mistake).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VersionAnomalyService {

    private final ContentExtractorService contentExtractor;
    private final EmbeddingService embeddingService;
    private final ClassificationService classificationService;

    private static final double SIMILARITY_FLAG_THRESHOLD = 0.30;
    private static final double SIMILARITY_WARN_THRESHOLD = 0.50;
    private static final double SIZE_RATIO_FLAG_THRESHOLD = 5.0;

    /**
     * Compare two document versions and detect anomalies.
     */
    public AnomalyCheckResult checkAnomaly(
            byte[] previousFile, String prevFileName, String prevMimeType,
            byte[] newFile, String newFileName, String newMimeType) {

        List<String> reasons = new ArrayList<>();
        double anomalyScore = 0.0;

        // 1. Extract text from both versions
        ContentExtractorService.ExtractionResult prevExtraction =
                contentExtractor.extract(previousFile, prevFileName, prevMimeType);
        ContentExtractorService.ExtractionResult newExtraction =
                contentExtractor.extract(newFile, newFileName, newMimeType);

        String prevText = prevExtraction.isSuccess() ? prevExtraction.getText() : "";
        String newText = newExtraction.isSuccess() ? newExtraction.getText() : "";

        // 2. Generate embeddings and compute cosine similarity
        double contentSimilarity = 1.0;
        if (!prevText.isBlank() && !newText.isBlank()) {
            float[] prevEmbedding = embeddingService.generateEmbedding(prevText);
            float[] newEmbedding = embeddingService.generateEmbedding(newText);
            contentSimilarity = cosineSimilarity(prevEmbedding, newEmbedding);

            if (contentSimilarity < SIMILARITY_FLAG_THRESHOLD) {
                reasons.add(String.format("Content similarity very low (%.0f%%) — documents appear unrelated",
                        contentSimilarity * 100));
                anomalyScore += 0.5;
            } else if (contentSimilarity < SIMILARITY_WARN_THRESHOLD) {
                reasons.add(String.format("Content similarity low (%.0f%%) — significant changes detected",
                        contentSimilarity * 100));
                anomalyScore += 0.25;
            }
        } else if (prevText.isBlank() != newText.isBlank()) {
            reasons.add("One version has extractable text content, the other does not");
            anomalyScore += 0.2;
        }

        // 3. Compare classifications
        ClassificationService.ClassificationResult prevClass = classificationService.classify(
                prevFileName, prevMimeType, prevText, prevExtraction.isSuccess() ? prevExtraction.getMetadata() : java.util.Map.of());
        ClassificationService.ClassificationResult newClass = classificationService.classify(
                newFileName, newMimeType, newText, newExtraction.isSuccess() ? newExtraction.getMetadata() : java.util.Map.of());

        if (prevClass != null && newClass != null
                && prevClass.getCategory() != null && newClass.getCategory() != null
                && !prevClass.getCategory().equals(newClass.getCategory())) {
            reasons.add(String.format("Classification changed: %s (%s) → %s (%s)",
                    prevClass.getLabel(), prevClass.getCategory(),
                    newClass.getLabel(), newClass.getCategory()));
            anomalyScore += 0.3;
        }

        // 4. Compare file sizes (extreme size changes are suspicious)
        if (previousFile.length > 0 && newFile.length > 0) {
            double sizeRatio = (double) Math.max(previousFile.length, newFile.length)
                    / Math.min(previousFile.length, newFile.length);
            if (sizeRatio > SIZE_RATIO_FLAG_THRESHOLD) {
                reasons.add(String.format("File size changed dramatically (%.1fx ratio: %d → %d bytes)",
                        sizeRatio, previousFile.length, newFile.length));
                anomalyScore += 0.2;
            }
        }

        // 5. Check MIME type change
        if (prevMimeType != null && newMimeType != null && !prevMimeType.equals(newMimeType)) {
            reasons.add(String.format("File type changed: %s → %s", prevMimeType, newMimeType));
            anomalyScore += 0.2;
        }

        // Normalize score to 0..1
        anomalyScore = Math.min(anomalyScore, 1.0);
        boolean flagged = anomalyScore >= 0.4;

        log.info("Version anomaly check: similarity={}, score={}, flagged={}, reasons={}",
                String.format("%.2f", contentSimilarity), String.format("%.2f", anomalyScore), flagged, reasons);

        return AnomalyCheckResult.builder()
                .flagged(flagged)
                .anomalyScore(anomalyScore)
                .similarityScore(contentSimilarity)
                .reasons(reasons)
                .build();
    }

    private double cosineSimilarity(float[] a, float[] b) {
        if (a.length != b.length) return 0.0;
        double dot = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        double denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom == 0 ? 0.0 : dot / denom;
    }

    @Data
    @Builder
    public static class AnomalyCheckResult {
        private boolean flagged;
        private double anomalyScore;
        private double similarityScore;
        private List<String> reasons;
    }
}
