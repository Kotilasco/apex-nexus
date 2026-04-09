package com.apexnexus.search.service;

import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Rule-based automated document classification.
 * Classifies documents based on filename patterns, MIME type, Tika metadata, and content analysis.
 * Produces a best-guess label with a confidence score.
 */
@Service
@Slf4j
public class ClassificationService {

    // Classification rules: each rule has patterns to match and a resulting label
    private static final List<ClassificationRule> RULES = List.of(
            // Contracts
            new ClassificationRule("Contract", "LEGAL",
                    List.of("contract", "agreement", "nda", "non-disclosure", "terms and conditions",
                            "service level agreement", "sla", "memorandum of understanding", "mou"),
                    List.of("application/pdf", "application/msword",
                            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                    null),

            // Invoices
            new ClassificationRule("Invoice", "FINANCIAL",
                    List.of("invoice", "rechnung", "facture", "billing", "payment due", "total amount",
                            "tax invoice", "vat", "sub-total", "grand total"),
                    null, null),

            // Reports
            new ClassificationRule("Report", "ANALYSIS",
                    List.of("report", "analysis", "findings", "executive summary", "quarterly",
                            "annual report", "assessment", "evaluation"),
                    null, null),

            // Policy documents
            new ClassificationRule("Policy", "GOVERNANCE",
                    List.of("policy", "procedure", "guideline", "regulation", "compliance",
                            "standard operating", "sop"),
                    null, null),

            // HR documents
            new ClassificationRule("HR Document", "HUMAN_RESOURCES",
                    List.of("employee", "salary", "payroll", "onboarding", "termination",
                            "leave request", "performance review", "hr", "human resources"),
                    null, null),

            // Meeting minutes
            new ClassificationRule("Meeting Minutes", "COMMUNICATION",
                    List.of("meeting minutes", "minutes of meeting", "agenda", "attendees",
                            "action items", "meeting notes"),
                    null, null),

            // Correspondence
            new ClassificationRule("Correspondence", "COMMUNICATION",
                    List.of("dear", "sincerely", "regards", "to whom it may concern",
                            "re:", "ref:", "letter", "memo", "memorandum"),
                    null, null),

            // Technical
            new ClassificationRule("Technical", "ENGINEERING",
                    List.of("specification", "technical", "architecture", "api", "schema",
                            "implementation", "design document", "requirements"),
                    null, null),

            // Presentations
            new ClassificationRule("Presentation", "COMMUNICATION",
                    null,
                    List.of("application/vnd.ms-powerpoint",
                            "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
                    List.of(".ppt", ".pptx", ".key")),

            // Spreadsheets
            new ClassificationRule("Spreadsheet", "DATA",
                    null,
                    List.of("application/vnd.ms-excel",
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            "text/csv"),
                    List.of(".xls", ".xlsx", ".csv")),

            // Images
            new ClassificationRule("Image", "MEDIA",
                    null,
                    List.of("image/png", "image/jpeg", "image/gif", "image/tiff",
                            "image/webp", "image/svg+xml"),
                    null)
    );

    /**
     * Classify a document based on available metadata and content.
     */
    public ClassificationResult classify(String fileName, String mimeType, String extractedText,
                                         Map<String, String> tikaMetadata) {
        Map<String, Double> scores = new LinkedHashMap<>();
        String fileNameLower = fileName != null ? fileName.toLowerCase() : "";
        String textSample = extractedText != null
                ? extractedText.substring(0, Math.min(extractedText.length(), 5000)).toLowerCase()
                : "";

        for (ClassificationRule rule : RULES) {
            double score = 0.0;

            // Check filename keywords
            if (rule.contentKeywords != null) {
                for (String keyword : rule.contentKeywords) {
                    if (fileNameLower.contains(keyword.toLowerCase())) {
                        score += 0.3; // Strong signal from filename
                    }
                }
            }

            // Check MIME type match
            if (rule.mimeTypes != null && mimeType != null) {
                for (String mime : rule.mimeTypes) {
                    if (mimeType.equalsIgnoreCase(mime)) {
                        score += 0.2;
                        break;
                    }
                }
            }

            // Check file extension
            if (rule.extensions != null) {
                for (String ext : rule.extensions) {
                    if (fileNameLower.endsWith(ext.toLowerCase())) {
                        score += 0.15;
                        break;
                    }
                }
            }

            // Check content keywords (most significant)
            if (rule.contentKeywords != null && !textSample.isEmpty()) {
                int matches = 0;
                for (String keyword : rule.contentKeywords) {
                    if (textSample.contains(keyword.toLowerCase())) {
                        matches++;
                    }
                }
                if (matches > 0) {
                    // More keyword matches = higher confidence
                    score += Math.min(0.5, matches * 0.1);
                }
            }

            if (score > 0) {
                scores.put(rule.label, Math.min(score, 1.0));
            }
        }

        if (scores.isEmpty()) {
            return ClassificationResult.builder()
                    .label("Other")
                    .category("GENERAL")
                    .confidence(0.1)
                    .allScores(Map.of("Other", 0.1))
                    .build();
        }

        // Find highest scoring label
        Map.Entry<String, Double> best = scores.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .orElse(null);

        String bestLabel = best != null ? best.getKey() : "Other";
        double bestScore = best != null ? best.getValue() : 0.1;

        // Find category for the label
        String category = RULES.stream()
                .filter(r -> r.label.equals(bestLabel))
                .map(r -> r.category)
                .findFirst()
                .orElse("GENERAL");

        log.info("Classified '{}' as '{}' (confidence: {:.2f})", fileName, bestLabel, bestScore);

        return ClassificationResult.builder()
                .label(bestLabel)
                .category(category)
                .confidence(bestScore)
                .allScores(scores)
                .build();
    }

    @Data
    @Builder
    public static class ClassificationResult {
        private String label;
        private String category;
        private double confidence;
        private Map<String, Double> allScores;
    }

    private record ClassificationRule(
            String label,
            String category,
            List<String> contentKeywords,
            List<String> mimeTypes,
            List<String> extensions
    ) {}
}
