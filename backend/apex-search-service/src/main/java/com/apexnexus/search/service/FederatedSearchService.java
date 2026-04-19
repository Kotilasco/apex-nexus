package com.apexnexus.search.service;

import com.apexnexus.search.dto.SearchRequest;
import com.apexnexus.search.dto.SearchResponse;
import com.apexnexus.search.dto.SearchResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Federated search across the internal index + external connectors (Outlook, SharePoint,
 * Google Drive, Confluence, etc.). External sources are currently stubbed to demonstrate
 * the merge-and-rank architecture.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FederatedSearchService {

    private final SearchService searchService;

    public Map<String, Object> federatedSearch(String query, int size, List<String> sources, UUID userId) {
        long t0 = System.currentTimeMillis();
        if (sources == null || sources.isEmpty()) {
            sources = List.of("internal", "outlook", "sharepoint");
        }

        List<Map<String, Object>> all = new ArrayList<>();
        Map<String, Integer> counts = new LinkedHashMap<>();

        // Internal
        if (sources.contains("internal")) {
            SearchRequest req = new SearchRequest();
            req.setQuery(query);
            req.setPage(0);
            req.setSize(size);
            try {
                SearchResponse resp = searchService.search(req, userId);
                for (SearchResult r : resp.getResults()) {
                    all.add(internalResult(r));
                }
                counts.put("internal", (int) resp.getTotalHits());
            } catch (Exception e) {
                log.warn("Internal federated search failed: {}", e.getMessage());
                counts.put("internal", 0);
            }
        }

        // Outlook (stub)
        if (sources.contains("outlook")) {
            List<Map<String, Object>> emails = stubOutlook(query, size);
            all.addAll(emails);
            counts.put("outlook", emails.size());
        }

        // SharePoint (stub)
        if (sources.contains("sharepoint")) {
            List<Map<String, Object>> sp = stubSharePoint(query, size);
            all.addAll(sp);
            counts.put("sharepoint", sp.size());
        }

        // Google Drive (stub)
        if (sources.contains("gdrive")) {
            List<Map<String, Object>> gd = stubGoogleDrive(query, size);
            all.addAll(gd);
            counts.put("gdrive", gd.size());
        }

        // Confluence (stub)
        if (sources.contains("confluence")) {
            List<Map<String, Object>> cf = stubConfluence(query, size);
            all.addAll(cf);
            counts.put("confluence", cf.size());
        }

        // Sort by score desc
        all.sort((a, b) -> Double.compare(
                ((Number) b.getOrDefault("score", 0)).doubleValue(),
                ((Number) a.getOrDefault("score", 0)).doubleValue()));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("query", query);
        out.put("totalHits", all.size());
        out.put("results", all);
        out.put("sourceCounts", counts);
        out.put("latencyMs", System.currentTimeMillis() - t0);
        return out;
    }

    private Map<String, Object> internalResult(SearchResult r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("source", "internal");
        m.put("sourceIcon", "📄");
        m.put("id", r.getDocumentId());
        m.put("title", r.getTitle());
        m.put("snippet", r.getDescription());
        m.put("mimeType", r.getMimeType());
        m.put("author", r.getAuthorName());
        m.put("score", r.getScore());
        m.put("url", "/documents?open=" + r.getDocumentId());
        m.put("createdAt", r.getCreatedAt());
        return m;
    }

    private List<Map<String, Object>> stubOutlook(String q, int size) {
        String[] subjects = {
                "Re: " + q + " — budget approval",
                "FW: " + q + " contract review",
                q + " — follow-up from yesterday",
                "Meeting notes: " + q
        };
        List<Map<String, Object>> out = new ArrayList<>();
        int n = Math.min(Math.max(2, q.length() % 4 + 2), Math.min(size, subjects.length));
        for (int i = 0; i < n; i++) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("source", "outlook");
            m.put("sourceIcon", "📧");
            m.put("id", UUID.randomUUID().toString());
            m.put("title", subjects[i]);
            m.put("snippet", "Hi team, regarding " + q + " — please review the attached and respond by end of week…");
            m.put("mimeType", "message/rfc822");
            m.put("author", i % 2 == 0 ? "lerato@apex-nexus.io" : "muloh@apex-nexus.io");
            m.put("score", 1.8 - i * 0.2);
            m.put("url", "https://outlook.office.com/mail/inbox");
            m.put("createdAt", LocalDateTime.now().minusDays(i + 1).toString());
            out.add(m);
        }
        return out;
    }

    private List<Map<String, Object>> stubSharePoint(String q, int size) {
        String[] titles = {
                q + " — Wiki overview",
                "Runbook: " + q + " operations",
                "Policies / " + q
        };
        List<Map<String, Object>> out = new ArrayList<>();
        int n = Math.min(titles.length, size);
        for (int i = 0; i < n; i++) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("source", "sharepoint");
            m.put("sourceIcon", "🗂");
            m.put("id", UUID.randomUUID().toString());
            m.put("title", titles[i]);
            m.put("snippet", "SharePoint page covering " + q + " — owner: Operations. Last modified last week.");
            m.put("mimeType", "text/html");
            m.put("author", "operations@apex-nexus.io");
            m.put("score", 1.5 - i * 0.2);
            m.put("url", "https://apex-nexus.sharepoint.com");
            m.put("createdAt", LocalDateTime.now().minusDays(i + 3).toString());
            out.add(m);
        }
        return out;
    }

    private List<Map<String, Object>> stubGoogleDrive(String q, int size) {
        List<Map<String, Object>> out = new ArrayList<>();
        String[] kinds = {"Spreadsheet", "Doc", "Slides"};
        int n = Math.min(kinds.length, size);
        for (int i = 0; i < n; i++) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("source", "gdrive");
            m.put("sourceIcon", "🟢");
            m.put("id", UUID.randomUUID().toString());
            m.put("title", q + " — " + kinds[i]);
            m.put("snippet", "Shared Google " + kinds[i] + " from your workspace mentioning " + q + ".");
            m.put("mimeType", "application/vnd.google-apps." + kinds[i].toLowerCase());
            m.put("author", "drive@apex-nexus.io");
            m.put("score", 1.4 - i * 0.2);
            m.put("url", "https://drive.google.com");
            m.put("createdAt", LocalDateTime.now().minusDays(i + 2).toString());
            out.add(m);
        }
        return out;
    }

    private List<Map<String, Object>> stubConfluence(String q, int size) {
        List<Map<String, Object>> out = new ArrayList<>();
        String[] kinds = {"Decision record", "Architecture", "Retrospective"};
        int n = Math.min(kinds.length, size);
        for (int i = 0; i < n; i++) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("source", "confluence");
            m.put("sourceIcon", "🟦");
            m.put("id", UUID.randomUUID().toString());
            m.put("title", kinds[i] + ": " + q);
            m.put("snippet", kinds[i] + " page about " + q + " from the engineering space.");
            m.put("mimeType", "text/html");
            m.put("author", "engineering@apex-nexus.io");
            m.put("score", 1.3 - i * 0.2);
            m.put("url", "https://apex-nexus.atlassian.net/wiki");
            m.put("createdAt", LocalDateTime.now().minusDays(i + 5).toString());
            out.add(m);
        }
        return out;
    }
}
