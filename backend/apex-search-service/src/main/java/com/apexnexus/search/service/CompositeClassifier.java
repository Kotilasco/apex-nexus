package com.apexnexus.search.service;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Composite 3-layer classification:
 *   Layer 1 — Structural (MIME / extension / file size patterns)
 *   Layer 2 — Textual (keyword & regex rules over OCR/extracted text)
 *   Layer 3 — Semantic (LLM understands intent)
 *
 * Returns a unified result + suggested project (matched against existing projects).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CompositeClassifier {

    private final ClassificationService ruleClassifier;
    private final LlmClassificationService llmClassifier;
    private final JdbcTemplate jdbc;

    public CompositeResult classify(String fileName, String mimeType, String text) {
        // Layer 1+2 (rule-based service mixes structural + textual signals)
        ClassificationService.ClassificationResult rule = ruleClassifier.classify(
                fileName, mimeType, text == null ? "" : text, Map.of());

        Layer structural = layerFromRule(rule, "structural", mimeType, fileName);
        Layer textual = Layer.builder()
                .layer("textual").label(rule.getLabel()).category(rule.getCategory())
                .confidence(rule.getConfidence())
                .reasoning("matched " + (rule.getAllScores() == null ? 0 : rule.getAllScores().size()) + " keyword rule(s)")
                .build();

        // Layer 3 — semantic LLM
        LlmClassificationService.SemanticResult sem = llmClassifier.classify(fileName, mimeType, text);
        Layer semantic = Layer.builder()
                .layer("semantic")
                .label(sem.getLabel()).category(sem.getCategory())
                .confidence(sem.getConfidence())
                .reasoning(sem.getReasoning())
                .available(sem.isAvailable())
                .build();

        // Decide final label — prefer LLM if it's available AND (rule conf < 0.5 OR labels disagree with high LLM conf)
        String finalLabel = rule.getLabel();
        String finalCategory = rule.getCategory();
        double finalConf = rule.getConfidence();
        String source = "RULE";
        if (sem.isAvailable() && (rule.getConfidence() < 0.5 || sem.getConfidence() >= 0.8)) {
            finalLabel = sem.getLabel();
            finalCategory = sem.getCategory();
            finalConf = Math.max(sem.getConfidence(), rule.getConfidence());
            source = "LLM";
        }

        // Suggest project: look up by category match first, then by name keyword
        UUID suggestedProject = null;
        String suggestedProjectName = null;
        try {
            List<Map<String, Object>> matches = jdbc.queryForList("""
                SELECT id, name, compliance_category
                FROM projects
                WHERE is_active = true
                  AND (UPPER(compliance_category) = UPPER(?)
                       OR LOWER(name) LIKE LOWER(?)
                       OR LOWER(name) LIKE LOWER(?))
                LIMIT 1
                """, finalCategory, "%" + safeLower(finalCategory) + "%",
                    "%" + safeLower(sem.getSuggestedProjectHint()) + "%");
            if (!matches.isEmpty()) {
                suggestedProject = (UUID) matches.get(0).get("id");
                suggestedProjectName = (String) matches.get(0).get("name");
            }
        } catch (Exception e) {
            log.debug("project suggest failed: {}", e.getMessage());
        }

        // Suggest tags
        List<String> tags = new ArrayList<>();
        tags.add(finalLabel.toLowerCase().replace(" ", "-"));
        tags.add(finalCategory.toLowerCase());
        if (sem.isAvailable() && !"NORMAL".equals(sem.getPriority())) tags.add("priority:" + sem.getPriority().toLowerCase());

        return CompositeResult.builder()
                .label(finalLabel).category(finalCategory).confidence(finalConf)
                .source(source)
                .priority(sem.isAvailable() ? sem.getPriority() : "NORMAL")
                .suggestedProjectId(suggestedProject)
                .suggestedProjectName(suggestedProjectName)
                .suggestedTags(tags)
                .language(detectLanguage(text))
                .layers(List.of(structural, textual, semantic))
                .build();
    }

    /**
     * Lightweight stop-word language detection for Zimbabwe-context content.
     * Returns ISO-639-1: 'en' | 'sn' (Shona) | 'nd' (Ndebele).
     * Default 'en' when no obvious local-language signal.
     */
    private String detectLanguage(String text) {
        if (text == null || text.isBlank()) return "en";
        String low = " " + text.toLowerCase().replaceAll("[^a-z\\s]", " ") + " ";
        int sn = countTokens(low,
            " ndini ", " kwete ", " hongu ", " chii ", " uye ", " akati ",
            " mwana ", " baba ", " amai ", " mukadzi ", " murume ", " musha ",
            " chibvumirano ", " chikwereti ", " mutemo ", " mhuri ",
            " tinotenda ", " makadini ", " ndapota ", " ndakuvara ",
            " mvura ", " moto ", " magetsi ", " mutengo ", " kawedzera ", " ne ");
        int nd = countTokens(low,
            " ngingu ", " hatshi ", " yebo ", " yini ", " futhi ", " uthe ",
            " umfana ", " ubaba ", " umama ", " inkosikazi ", " indoda ", " ikhaya ",
            " isivumelwano ", " inifothi ", " umthetho ", " imuli ",
            " siyabonga ", " sawubona ", " ngicela ",
            " amanzi ", " umlilo ", " ugesi ", " inani ", " likhuphukile ");
        int en = countTokens(low,
            " the ", " and ", " of ", " to ", " is ", " in ", " for ",
            " that ", " this ", " with ", " on ", " by ", " was ", " are ");
        if (sn >= nd && sn >= en && sn >= 2) return "sn";
        if (nd > sn && nd >= en && nd >= 2) return "nd";
        return "en";
    }

    private int countTokens(String text, String... tokens) {
        int hits = 0;
        for (String t : tokens) if (text.contains(t)) hits++;
        return hits;
    }

    private Layer layerFromRule(ClassificationService.ClassificationResult r, String name, String mime, String fn) {
        StringBuilder why = new StringBuilder();
        if (mime != null) why.append("mime=").append(mime).append("; ");
        if (fn != null && fn.contains(".")) why.append("ext=").append(fn.substring(fn.lastIndexOf('.')));
        return Layer.builder().layer(name).label(r.getLabel()).category(r.getCategory())
                .confidence(r.getConfidence()).reasoning(why.toString()).build();
    }

    private String safeLower(String s) { return s == null ? "" : s.toLowerCase(); }

    @Data @lombok.Builder
    public static class CompositeResult {
        private String label;
        private String category;
        private double confidence;
        private String source;       // RULE | LLM
        private String priority;
        private UUID suggestedProjectId;
        private String suggestedProjectName;
        private List<String> suggestedTags;
        private List<Layer> layers;
        private String language;       // ISO-639-1: en | sn | nd
    }

    @Data @lombok.Builder
    public static class Layer {
        private String layer;
        private String label;
        private String category;
        private double confidence;
        private String reasoning;
        private Boolean available;
    }
}
