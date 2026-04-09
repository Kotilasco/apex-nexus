package com.apexnexus.search.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class SearchResponse {
    private List<SearchResult> results;
    private long totalHits;
    private int page;
    private int size;
    private int totalPages;
    private Map<String, List<FacetBucket>> facets;

    @Data
    @Builder
    public static class FacetBucket {
        private String key;
        private long count;
    }
}
