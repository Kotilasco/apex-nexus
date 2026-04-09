package com.apexnexus.search.service;

import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * GDPR Privacy Scanner — detects Personally Identifiable Information (PII) in document text.
 * Scans for email addresses, phone numbers, IBANs, credit card numbers, German/EU ID numbers,
 * dates of birth patterns, and national insurance numbers.
 */
@Service
@Slf4j
public class GdprScannerService {

    private static final List<PiiPattern> PII_PATTERNS = List.of(
            // Email addresses
            new PiiPattern("EMAIL", "Email Address",
                    Pattern.compile("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"),
                    Severity.MEDIUM),

            // Phone numbers (international, German, US, UK formats)
            new PiiPattern("PHONE", "Phone Number",
                    Pattern.compile("(?:\\+\\d{1,3}[\\s-]?)?(?:\\(\\d{2,5}\\)[\\s-]?)?\\d{3,5}[\\s-]?\\d{3,8}"),
                    Severity.MEDIUM),

            // IBAN (European bank account)
            new PiiPattern("IBAN", "Bank Account (IBAN)",
                    Pattern.compile("[A-Z]{2}\\d{2}[\\s]?\\d{4}[\\s]?\\d{4}[\\s]?\\d{4}[\\s]?\\d{4}[\\s]?(?:\\d{4})?(?:\\d{2})?"),
                    Severity.HIGH),

            // Credit card numbers (Visa, MC, Amex)
            new PiiPattern("CREDIT_CARD", "Credit Card Number",
                    Pattern.compile("\\b(?:4\\d{3}|5[1-5]\\d{2}|3[47]\\d{2}|6(?:011|5\\d{2}))[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{3,4}\\b"),
                    Severity.CRITICAL),

            // German social insurance number (Sozialversicherungsnummer)
            new PiiPattern("SSN_DE", "German Social Insurance Number",
                    Pattern.compile("\\b\\d{2}[\\s]?\\d{6}[\\s]?[A-Z]\\d{3}\\b"),
                    Severity.HIGH),

            // Date of birth patterns (DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD)
            new PiiPattern("DOB", "Date of Birth",
                    Pattern.compile("(?:geboren|birth|dob|geb\\.?)[:\\s]*(?:\\d{1,2}[./]\\d{1,2}[./]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})"),
                    Severity.MEDIUM),

            // German tax ID (Steuerliche Identifikationsnummer)
            new PiiPattern("TAX_ID_DE", "German Tax ID",
                    Pattern.compile("\\b(?:Steuer-?ID|IdNr)[:\\s]*\\d{11}\\b"),
                    Severity.HIGH),

            // IP addresses (can identify individuals)
            new PiiPattern("IP_ADDRESS", "IP Address",
                    Pattern.compile("\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b"),
                    Severity.LOW),

            // Passport numbers (generic pattern)
            new PiiPattern("PASSPORT", "Passport Number",
                    Pattern.compile("(?:passport|reisepass|pass)[:\\s]*[A-Z0-9]{6,12}"),
                    Severity.HIGH),

            // Health insurance number (Krankenversichertennummer)
            new PiiPattern("HEALTH_ID_DE", "Health Insurance Number",
                    Pattern.compile("\\b[A-Z]\\d{9}\\b"),
                    Severity.HIGH)
    );

    /**
     * Scan text content for PII and return a comprehensive scan result.
     */
    public GdprScanResult scan(String text, String documentId) {
        if (text == null || text.isBlank()) {
            return GdprScanResult.builder()
                    .documentId(documentId)
                    .piiFound(false)
                    .severity(Severity.NONE)
                    .findings(List.of())
                    .scannedLength(0)
                    .build();
        }

        List<PiiFinding> findings = new ArrayList<>();

        for (PiiPattern pattern : PII_PATTERNS) {
            Matcher matcher = pattern.pattern.matcher(text);
            int count = 0;
            List<String> sampleLocations = new ArrayList<>();

            while (matcher.find()) {
                count++;
                if (sampleLocations.size() < 3) {
                    // Store character position, NOT the actual PII value (privacy!)
                    sampleLocations.add("position:" + matcher.start());
                }
            }

            if (count > 0) {
                findings.add(PiiFinding.builder()
                        .type(pattern.type)
                        .description(pattern.description)
                        .severity(pattern.severity)
                        .occurrences(count)
                        .sampleLocations(sampleLocations)
                        .build());
            }
        }

        // Determine overall severity
        Severity maxSeverity = findings.stream()
                .map(PiiFinding::getSeverity)
                .max(Comparator.comparingInt(Severity::ordinal))
                .orElse(Severity.NONE);

        GdprScanResult result = GdprScanResult.builder()
                .documentId(documentId)
                .piiFound(!findings.isEmpty())
                .severity(maxSeverity)
                .findings(findings)
                .totalPiiCount(findings.stream().mapToInt(PiiFinding::getOccurrences).sum())
                .scannedLength(text.length())
                .build();

        if (result.isPiiFound()) {
            log.warn("GDPR scan for document {}: found {} PII items (severity: {})",
                    documentId, result.getTotalPiiCount(), maxSeverity);
        }

        return result;
    }

    @Data
    @Builder
    public static class GdprScanResult {
        private String documentId;
        private boolean piiFound;
        private Severity severity;
        private List<PiiFinding> findings;
        private int totalPiiCount;
        private int scannedLength;
    }

    @Data
    @Builder
    public static class PiiFinding {
        private String type;
        private String description;
        private Severity severity;
        private int occurrences;
        private List<String> sampleLocations;
    }

    public enum Severity {
        NONE, LOW, MEDIUM, HIGH, CRITICAL
    }

    private record PiiPattern(String type, String description, Pattern pattern, Severity severity) {}
}
