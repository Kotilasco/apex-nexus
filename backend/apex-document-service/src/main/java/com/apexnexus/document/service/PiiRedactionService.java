package com.apexnexus.document.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Redacts Personally Identifiable Information (PII) from text content.
 * Uses the same pattern set as the GDPR Scanner to ensure consistency.
 */
@Service
public class PiiRedactionService {

        private static final String REDACTED = "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588";

        private static final List<RedactionPattern> PATTERNS = List.of(
                        new RedactionPattern("EMAIL",
                                        Pattern.compile("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}")),
                        new RedactionPattern("PHONE",
                                        Pattern.compile("(?:\\+\\d{1,3}[\\s-]?)?(?:\\(\\d{2,5}\\)[\\s-]?)?\\d{3,5}[\\s-]?\\d{3,8}")),
                        new RedactionPattern("IBAN",
                                        Pattern.compile("[A-Z]{2}\\d{2}[\\s]?\\d{4}[\\s]?\\d{4}[\\s]?\\d{4}[\\s]?\\d{4}[\\s]?(?:\\d{4})?(?:\\d{2})?")),
                        new RedactionPattern("CREDIT_CARD",
                                        Pattern.compile("\\b(?:4\\d{3}|5[1-5]\\d{2}|3[47]\\d{2}|6(?:011|5\\d{2}))[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{3,4}\\b")),
                        new RedactionPattern("SSN_DE",
                                        Pattern.compile("\\b\\d{2}[\\s]?\\d{6}[\\s]?[A-Z]\\d{3}\\b")),
                        new RedactionPattern("DOB",
                                        Pattern.compile("(?:geboren|birth|dob|geb\\.?)[:\\s]*(?:\\d{1,2}[./]\\d{1,2}[./]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})")),
                        new RedactionPattern("TAX_ID_DE",
                                        Pattern.compile("\\b(?:Steuer-?ID|IdNr)[:\\s]*\\d{11}\\b")),
                        new RedactionPattern("IP_ADDRESS",
                                        Pattern.compile("\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b")),
                        new RedactionPattern("PASSPORT",
                                        Pattern.compile("(?:passport|reisepass|pass)[:\\s]*[A-Z0-9]{6,12}")),
                        new RedactionPattern("HEALTH_ID_DE",
                                        Pattern.compile("\\b[A-Z]\\d{9}\\b")));

        /**
         * Replace all PII occurrences in the text with redaction blocks.
         */
        public String redact(String text) {
                if (text == null || text.isBlank())
                        return text;

                String redacted = text;
                for (RedactionPattern rp : PATTERNS) {
                        Matcher matcher = rp.pattern.matcher(redacted);
                        redacted = matcher.replaceAll("[" + REDACTED + " " + rp.type + "]");
                }
                return redacted;
        }

        private record RedactionPattern(String type, Pattern pattern) {
        }
}
