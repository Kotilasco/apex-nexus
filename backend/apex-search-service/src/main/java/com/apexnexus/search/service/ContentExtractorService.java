package com.apexnexus.search.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.apache.tika.config.TikaConfig;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.TikaCoreProperties;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Extracts text content and metadata from documents using Apache Tika.
 * Supports PDF, Office (docx/xlsx/pptx), images (with OCR via Tesseract if available), and 100+ formats.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ContentExtractorService {

    private final Tika tika = createTika();

    // Maximum text length to extract (10MB of text)
    private static final int MAX_TEXT_LENGTH = 10_000_000;

    private static Tika createTika() {
        try (InputStream is = ContentExtractorService.class.getResourceAsStream("/tika-config.xml")) {
            if (is != null) {
                TikaConfig config = new TikaConfig(is);
                return new Tika(config);
            }
        } catch (Exception e) {
            // fall through to default
        }
        return new Tika();
    }

    /**
     * Extract text content from raw file bytes.
     *
     * @param fileData raw (decrypted) file bytes
     * @param fileName original filename for Tika detection hints
     * @param mimeType declared MIME type
     * @return extraction result with text, metadata, language hint
     */
    public ExtractionResult extract(byte[] fileData, String fileName, String mimeType) {
        long start = System.currentTimeMillis();
        try {
            Metadata metadata = new Metadata();
            if (fileName != null) {
                metadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, fileName);
            }
            if (mimeType != null) {
                metadata.set(Metadata.CONTENT_TYPE, mimeType);
            }

            // Tika auto-detects parser (PDF, Office, images, etc.)
            tika.setMaxStringLength(MAX_TEXT_LENGTH);
            String content = tika.parseToString(new ByteArrayInputStream(fileData), metadata);

            // Collect useful metadata
            Map<String, String> extractedMeta = new HashMap<>();
            for (String name : metadata.names()) {
                String value = metadata.get(name);
                if (value != null && !value.isBlank()) {
                    extractedMeta.put(name, value);
                }
            }

            // Detect language from metadata or content
            String language = metadata.get("language");
            if (language == null && content != null && content.length() > 50) {
                language = detectLanguageHeuristic(content);
            }

            long elapsed = System.currentTimeMillis() - start;
            log.info("Content extraction completed for '{}' ({} chars, {}ms)",
                    fileName, content != null ? content.length() : 0, elapsed);

            return ExtractionResult.builder()
                    .text(content != null ? content.trim() : "")
                    .metadata(extractedMeta)
                    .language(language)
                    .contentLength(content != null ? content.length() : 0)
                    .extractionTimeMs((int) elapsed)
                    .ocrApplied(extractedMeta.containsKey("X-TIKA:Parsed-By-Full-Set")
                            && extractedMeta.get("X-TIKA:Parsed-By-Full-Set").contains("TesseractOCRParser"))
                    .success(true)
                    .build();

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("Content extraction failed for '{}': {}", fileName, e.getMessage());
            return ExtractionResult.builder()
                    .text("")
                    .metadata(Map.of())
                    .contentLength(0)
                    .extractionTimeMs((int) elapsed)
                    .success(false)
                    .error(e.getMessage())
                    .build();
        }
    }

    /**
     * Simple heuristic language detection based on character frequency.
     */
    private String detectLanguageHeuristic(String text) {
        String sample = text.substring(0, Math.min(text.length(), 2000));
        // German-specific characters
        long germanChars = sample.chars().filter(c -> c == 'ä' || c == 'ö' || c == 'ü' || c == 'ß'
                || c == 'Ä' || c == 'Ö' || c == 'Ü').count();
        if (germanChars > 3) return "de";

        // French accents
        long frenchChars = sample.chars().filter(c -> c == 'é' || c == 'è' || c == 'ê' || c == 'ç'
                || c == 'à' || c == 'ù').count();
        if (frenchChars > 3) return "fr";

        return "en"; // default
    }

    @lombok.Builder
    @lombok.Data
    public static class ExtractionResult {
        private String text;
        private Map<String, String> metadata;
        private String language;
        private int contentLength;
        private int extractionTimeMs;
        private boolean ocrApplied;
        private boolean success;
        private String error;
    }
}
