package com.apexnexus.search.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts structured entities (amounts, dates, vendors, invoice numbers, emails, phone numbers)
 * from document text using regex-based NLP. Used for faceted search and smart filtering.
 */
@Service
@Slf4j
public class EntityExtractionService {

    // Currency amounts: $1,234.56 | USD 1234.56 | 1.234,56 EUR | R 500 | $1000+
    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
            "(?:(USD|EUR|GBP|ZAR|ZWL|R|\\$|€|£)\\s*)([0-9]{1,3}(?:[,.\\s][0-9]{3})*(?:[.,][0-9]{2})?)|" +
            "([0-9]{1,3}(?:[,.\\s][0-9]{3})*(?:[.,][0-9]{2})?)\\s*(USD|EUR|GBP|ZAR|ZWL|R)",
            Pattern.CASE_INSENSITIVE);

    // Dates: 2024-01-15 | 15/01/2024 | Jan 15, 2024 | 15-Jan-2024
    private static final Pattern DATE_ISO = Pattern.compile("\\b(20\\d{2})-([01]?\\d)-([0-3]?\\d)\\b");
    private static final Pattern DATE_SLASH = Pattern.compile("\\b([0-3]?\\d)/([01]?\\d)/(20\\d{2})\\b");
    private static final Pattern DATE_TEXT = Pattern.compile(
            "\\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+([0-3]?\\d),?\\s+(20\\d{2})\\b",
            Pattern.CASE_INSENSITIVE);

    // Invoice numbers: INV-12345, INVOICE #12345, Bill No: ABC-123
    private static final Pattern INVOICE_NO = Pattern.compile(
            "(?:(?:invoice|inv|bill|receipt|ref)[\\s.#:-]*)([A-Z]{0,5}[-]?[0-9]{3,10})",
            Pattern.CASE_INSENSITIVE);

    // Vendor / company patterns (after "From:", "Vendor:", "Supplier:", "Bill To:")
    private static final Pattern VENDOR_LABEL = Pattern.compile(
            "(?:from|vendor|supplier|bill to|billed to|pay to|issued by)\\s*[:\\-]\\s*([A-Z][A-Za-z0-9&',. ]{2,60}?)(?:\\r|\\n|$|  )",
            Pattern.CASE_INSENSITIVE);

    // Email
    private static final Pattern EMAIL = Pattern.compile(
            "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}");

    // Phone (international + local)
    private static final Pattern PHONE = Pattern.compile(
            "(?:\\+?\\d{1,3}[ .-]?)?(?:\\(\\d{2,4}\\)[ .-]?)?\\d{3,4}[ .-]?\\d{3,4}(?:[ .-]?\\d{2,4})?");

    // Tax / VAT IDs
    private static final Pattern TAX_ID = Pattern.compile(
            "(?:VAT|TAX|TIN|EIN)[\\s.#:-]*([A-Z]{0,3}[-]?[0-9A-Z]{6,15})",
            Pattern.CASE_INSENSITIVE);

    private static final Map<String, Integer> MONTHS = Map.ofEntries(
            Map.entry("jan", 1), Map.entry("feb", 2), Map.entry("mar", 3), Map.entry("apr", 4),
            Map.entry("may", 5), Map.entry("jun", 6), Map.entry("jul", 7), Map.entry("aug", 8),
            Map.entry("sep", 9), Map.entry("oct", 10), Map.entry("nov", 11), Map.entry("dec", 12));

    /**
     * Extract structured entities from document text.
     *
     * @param text extracted document text
     * @return Map with keys: amounts, dates, invoiceNumbers, vendors, emails, phones, taxIds,
     *         plus summary scalars: totalAmount (largest found), primaryVendor, primaryDate.
     */
    public Map<String, Object> extract(String text) {
        if (text == null || text.isBlank()) return Map.of();

        // Truncate to avoid regex catastrophic backtracking on huge docs
        String sample = text.length() > 50_000 ? text.substring(0, 50_000) : text;

        Map<String, Object> entities = new HashMap<>();

        List<Map<String, Object>> amounts = extractAmounts(sample);
        List<String> dates = extractDates(sample);
        List<String> invoiceNos = extractMatches(INVOICE_NO, sample, 1, 5);
        List<String> vendors = extractMatches(VENDOR_LABEL, sample, 1, 5);
        List<String> emails = extractMatches(EMAIL, sample, 0, 10);
        List<String> taxIds = extractMatches(TAX_ID, sample, 1, 3);

        if (!amounts.isEmpty()) entities.put("amounts", amounts);
        if (!dates.isEmpty()) entities.put("dates", dates);
        if (!invoiceNos.isEmpty()) entities.put("invoiceNumbers", invoiceNos);
        if (!vendors.isEmpty()) entities.put("vendors", vendors);
        if (!emails.isEmpty()) entities.put("emails", emails);
        if (!taxIds.isEmpty()) entities.put("taxIds", taxIds);

        // Derived scalars for facet filtering
        if (!amounts.isEmpty()) {
            double max = amounts.stream()
                    .mapToDouble(a -> ((Number) a.getOrDefault("value", 0)).doubleValue())
                    .max().orElse(0);
            entities.put("totalAmount", max);
            entities.put("currency", amounts.get(0).get("currency"));
        }
        if (!vendors.isEmpty()) entities.put("primaryVendor", vendors.get(0));
        if (!dates.isEmpty()) entities.put("primaryDate", dates.get(0));
        if (!invoiceNos.isEmpty()) entities.put("primaryInvoiceNumber", invoiceNos.get(0));

        log.debug("Extracted entities: amounts={}, dates={}, vendors={}, invoices={}",
                amounts.size(), dates.size(), vendors.size(), invoiceNos.size());
        return entities;
    }

    private List<Map<String, Object>> extractAmounts(String text) {
        List<Map<String, Object>> out = new ArrayList<>();
        Matcher m = AMOUNT_PATTERN.matcher(text);
        Set<String> seen = new HashSet<>();
        while (m.find() && out.size() < 20) {
            String currency = m.group(1) != null ? m.group(1) : m.group(4);
            String raw = m.group(2) != null ? m.group(2) : m.group(3);
            if (raw == null) continue;
            Double value = parseAmount(raw);
            if (value == null || value < 1) continue;
            String key = currency + ":" + value;
            if (seen.contains(key)) continue;
            seen.add(key);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("value", value);
            entry.put("currency", normalizeCurrency(currency));
            entry.put("raw", m.group().trim());
            out.add(entry);
        }
        return out;
    }

    private Double parseAmount(String raw) {
        try {
            String cleaned = raw.trim();
            // European format: 1.234,56 -> 1234.56
            if (cleaned.matches(".*\\d[.,]\\d{3}[.,]\\d{2}$") && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
                cleaned = cleaned.replace(".", "").replace(",", ".");
            } else {
                cleaned = cleaned.replace(",", "").replace(" ", "");
            }
            return Double.parseDouble(cleaned);
        } catch (Exception e) { return null; }
    }

    private String normalizeCurrency(String c) {
        if (c == null) return "USD";
        c = c.trim().toUpperCase();
        return switch (c) {
            case "$" -> "USD";
            case "€" -> "EUR";
            case "£" -> "GBP";
            case "R" -> "ZAR";
            default -> c;
        };
    }

    private List<String> extractDates(String text) {
        Set<String> out = new LinkedHashSet<>();
        Matcher m1 = DATE_ISO.matcher(text);
        while (m1.find() && out.size() < 10) {
            try {
                LocalDate d = LocalDate.of(Integer.parseInt(m1.group(1)), Integer.parseInt(m1.group(2)), Integer.parseInt(m1.group(3)));
                out.add(d.format(DateTimeFormatter.ISO_DATE));
            } catch (Exception ignored) {}
        }
        Matcher m2 = DATE_SLASH.matcher(text);
        while (m2.find() && out.size() < 10) {
            try {
                LocalDate d = LocalDate.of(Integer.parseInt(m2.group(3)), Integer.parseInt(m2.group(2)), Integer.parseInt(m2.group(1)));
                out.add(d.format(DateTimeFormatter.ISO_DATE));
            } catch (Exception ignored) {}
        }
        Matcher m3 = DATE_TEXT.matcher(text);
        while (m3.find() && out.size() < 10) {
            try {
                String monthKey = m3.group(1).substring(0, 3).toLowerCase();
                Integer mi = MONTHS.get(monthKey);
                if (mi == null) continue;
                LocalDate d = LocalDate.of(Integer.parseInt(m3.group(3)), mi, Integer.parseInt(m3.group(2)));
                out.add(d.format(DateTimeFormatter.ISO_DATE));
            } catch (Exception ignored) {}
        }
        return new ArrayList<>(out);
    }

    private List<String> extractMatches(Pattern p, String text, int group, int max) {
        Set<String> out = new LinkedHashSet<>();
        Matcher m = p.matcher(text);
        while (m.find() && out.size() < max) {
            String v = (group == 0 ? m.group() : m.group(group));
            if (v != null && !v.isBlank() && v.length() < 80) out.add(v.trim());
        }
        return new ArrayList<>(out);
    }
}
