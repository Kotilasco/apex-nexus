package com.apexnexus.search.service;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch.core.*;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.elasticsearch.core.search.HighlightField;
import co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import co.elastic.clients.elasticsearch.indices.ExistsRequest;
import com.apexnexus.common.audit.AuditEvent;
import com.apexnexus.common.audit.AuditPublisher;
import com.apexnexus.search.dto.SearchRequest;
import com.apexnexus.search.dto.SearchResponse;
import com.apexnexus.search.dto.SearchResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.StringReader;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchService {

    private final ElasticsearchClient esClient;
    private final AuditPublisher auditPublisher;
    private final EmbeddingService embeddingService;
    private final ObjectMapper objectMapper;

    @Value("${elasticsearch.index.documents}")
    private String documentsIndex;

    private static final String INDEX_MAPPING = """
        {
          "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0,
            "analysis": {
              "analyzer": {
                "document_analyzer": {
                  "type": "custom",
                  "tokenizer": "standard",
                  "filter": ["lowercase", "asciifolding", "word_delimiter_graph"]
                }
              }
            }
          },
          "mappings": {
            "properties": {
              "documentId": { "type": "keyword" },
              "title": { "type": "text", "analyzer": "document_analyzer", "fields": { "keyword": { "type": "keyword" } } },
              "description": { "type": "text", "analyzer": "document_analyzer" },
              "content": { "type": "text", "analyzer": "document_analyzer" },
              "mimeType": { "type": "keyword" },
              "status": { "type": "keyword" },
              "authorId": { "type": "keyword" },
              "authorName": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
              "folderPath": { "type": "keyword" },
              "projectId": { "type": "keyword" },
              "aiGenerated": { "type": "boolean" },
              "aiConfidence": { "type": "float" },
              "tags": { "type": "keyword" },
              "metadata": { "type": "object", "enabled": true },
              "fileSize": { "type": "long" },
              "createdAt": { "type": "date" },
              "updatedAt": { "type": "date" },
              "classificationLabel": { "type": "keyword" },
              "classificationCategory": { "type": "keyword" },
              "classificationConfidence": { "type": "float" },
              "contentVector": { "type": "dense_vector", "dims": 256, "index": true, "similarity": "cosine" }
            }
          }
        }
        """;

    @PostConstruct
    public void ensureIndex() {
        try {
            boolean exists = esClient.indices().exists(
                    ExistsRequest.of(e -> e.index(documentsIndex))).value();
            if (!exists) {
                esClient.indices().create(CreateIndexRequest.of(c -> c
                        .index(documentsIndex)
                        .withJson(new StringReader(INDEX_MAPPING))));
                log.info("Created Elasticsearch index: {}", documentsIndex);
            }
        } catch (IOException e) {
            log.error("Failed to ensure Elasticsearch index: {}", e.getMessage());
        }
    }

    // ==================== Indexing ====================

    public void indexDocument(Map<String, Object> document) {
        try {
            String docId = document.get("documentId").toString();

            // Generate embedding vector from text content for semantic search
            String textForEmbedding = buildEmbeddingText(document);
            if (!textForEmbedding.isBlank()) {
                float[] vector = embeddingService.generateEmbedding(textForEmbedding);
                document.put("contentVector", vector);
            }

            esClient.index(IndexRequest.of(i -> i
                    .index(documentsIndex)
                    .id(docId)
                    .document(document)));
            log.debug("Indexed document: {}", docId);
        } catch (IOException e) {
            log.error("Failed to index document: {}", e.getMessage());
        }
    }

    public void removeDocument(String documentId) {
        try {
            esClient.delete(DeleteRequest.of(d -> d
                    .index(documentsIndex)
                    .id(documentId)));
            log.debug("Removed document from index: {}", documentId);
        } catch (IOException e) {
            log.error("Failed to remove document from index: {}", e.getMessage());
        }
    }

    public void updateDocument(String documentId, Map<String, Object> partialDoc) {
        try {
            esClient.update(UpdateRequest.of(u -> u
                    .index(documentsIndex)
                    .id(documentId)
                    .doc(partialDoc)), Map.class);
            log.debug("Updated document in index: {}", documentId);
        } catch (IOException e) {
            log.error("Failed to update document in index: {}", e.getMessage());
        }
    }

    // ==================== Search ====================

    public SearchResponse search(SearchRequest request, UUID userId) {
        try {
            BoolQuery.Builder boolBuilder = new BoolQuery.Builder();

            // Full-text query across title, description, content
            if (request.getQuery() != null && !request.getQuery().isBlank()) {
                String queryText = request.getQuery();
                String lowerQuery = queryText.toLowerCase();
                boolBuilder.must(Query.of(outer -> outer.bool(inner -> inner
                        .should(Query.of(q -> q
                                .multiMatch(mm -> mm
                                        .query(queryText)
                                        .fields("title^3", "description^2", "content", "tags^2", "authorName")
                                        .fuzziness("AUTO")
                                        .type(co.elastic.clients.elasticsearch._types.query_dsl.TextQueryType.BestFields)
                                )))
                        .should(Query.of(q -> q
                                .wildcard(w -> w.field("title").value(lowerQuery + "*").boost(3.0f))))
                        .should(Query.of(q -> q
                                .wildcard(w -> w.field("description").value(lowerQuery + "*").boost(2.0f))))
                        .should(Query.of(q -> q
                                .wildcard(w -> w.field("content").value(lowerQuery + "*"))))
                        .minimumShouldMatch("1")
                )));
            } else {
                boolBuilder.must(Query.of(q -> q.matchAll(ma -> ma)));
            }

            // Filters
            if (request.getTags() != null && !request.getTags().isEmpty()) {
                for (String tag : request.getTags()) {
                    boolBuilder.filter(Query.of(q -> q.term(t -> t.field("tags").value(tag))));
                }
            }
            if (request.getMimeType() != null) {
                boolBuilder.filter(Query.of(q -> q.term(t -> t.field("mimeType").value(request.getMimeType()))));
            }
            if (request.getStatus() != null) {
                boolBuilder.filter(Query.of(q -> q.term(t -> t.field("status").value(request.getStatus()))));
            }
            if (request.getFolderPath() != null) {
                boolBuilder.filter(Query.of(q -> q.prefix(p -> p.field("folderPath").value(request.getFolderPath()))));
            }
            if (request.getAuthorId() != null) {
                boolBuilder.filter(Query.of(q -> q.term(t -> t.field("authorId").value(request.getAuthorId()))));
            }
            if (request.getProjectId() != null) {
                boolBuilder.filter(Query.of(q -> q.term(t -> t.field("projectId").value(request.getProjectId()))));
            }
            if (request.getDateFrom() != null || request.getDateTo() != null) {
                boolBuilder.filter(Query.of(q -> q.range(r -> {
                    var range = r.field("createdAt");
                    if (request.getDateFrom() != null) range.gte(co.elastic.clients.json.JsonData.of(request.getDateFrom()));
                    if (request.getDateTo() != null) range.lte(co.elastic.clients.json.JsonData.of(request.getDateTo()));
                    return range;
                })));
            }

            // Build search request
            int from = request.getPage() * request.getSize();
            co.elastic.clients.elasticsearch.core.SearchRequest esRequest =
                    co.elastic.clients.elasticsearch.core.SearchRequest.of(s -> {
                        s.index(documentsIndex)
                         .query(Query.of(q -> q.bool(boolBuilder.build())))
                         .from(from)
                         .size(request.getSize())
                         .highlight(h -> h
                                 .fields("title", HighlightField.of(hf -> hf.numberOfFragments(0)))
                                 .fields("description", HighlightField.of(hf -> hf.numberOfFragments(2).fragmentSize(150)))
                                 .fields("content", HighlightField.of(hf -> hf.numberOfFragments(3).fragmentSize(200)))
                                 .preTags("<mark>")
                                 .postTags("</mark>")
                         );

                        // Sort
                        String sortBy = request.getSortBy() != null ? request.getSortBy() : "_score";
                        SortOrder sortOrder = "asc".equalsIgnoreCase(request.getSortOrder())
                                ? SortOrder.Asc : SortOrder.Desc;
                        if ("title".equals(sortBy)) {
                            s.sort(so -> so.field(f -> f.field("title.keyword").order(sortOrder)));
                        } else if ("createdAt".equals(sortBy) || "updatedAt".equals(sortBy)) {
                            s.sort(so -> so.field(f -> f.field(sortBy).order(sortOrder)));
                        } else {
                            s.sort(so -> so.score(sc -> sc.order(SortOrder.Desc)));
                        }

                        // Aggregations for facets
                        s.aggregations("mimeTypes", a -> a.terms(t -> t.field("mimeType").size(20)));
                        s.aggregations("statuses", a -> a.terms(t -> t.field("status").size(10)));
                        s.aggregations("tags", a -> a.terms(t -> t.field("tags").size(50)));

                        return s;
                    });

            co.elastic.clients.elasticsearch.core.SearchResponse<Map> esResponse =
                    esClient.search(esRequest, Map.class);

            // Map results
            List<SearchResult> results = esResponse.hits().hits().stream()
                    .map(this::hitToSearchResult)
                    .collect(Collectors.toList());

            long totalHits = esResponse.hits().total() != null ? esResponse.hits().total().value() : 0;
            int totalPages = (int) Math.ceil((double) totalHits / request.getSize());

            // Extract facets
            Map<String, List<SearchResponse.FacetBucket>> facets = new HashMap<>();
            if (esResponse.aggregations() != null) {
                extractFacet(esResponse, "mimeTypes", facets);
                extractFacet(esResponse, "statuses", facets);
                extractFacet(esResponse, "tags", facets);
            }

            auditPublisher.publish(AuditEvent.builder()
                    .userId(userId)
                    .action("SEARCH")
                    .resourceType("SEARCH")
                    .details(Map.of("query", request.getQuery() != null ? request.getQuery() : "*",
                                   "totalHits", String.valueOf(totalHits)))
                    .build());

            return SearchResponse.builder()
                    .results(results)
                    .totalHits(totalHits)
                    .page(request.getPage())
                    .size(request.getSize())
                    .totalPages(totalPages)
                    .facets(facets)
                    .build();

        } catch (IOException e) {
            log.error("Search failed: {}", e.getMessage());
            throw new RuntimeException("Search service unavailable", e);
        }
    }

    /**
     * Semantic similarity search using kNN on dense_vector field.
     */
    public SearchResponse semanticSearch(String queryText, int size, UUID userId) {
        try {
            float[] queryVector = embeddingService.generateEmbedding(queryText);

            // Build kNN search JSON — ES Java client kNN support
            String knnJson = objectMapper.writeValueAsString(Map.of(
                    "knn", Map.of(
                            "field", "contentVector",
                            "query_vector", queryVector,
                            "k", size,
                            "num_candidates", size * 5
                    ),
                    "size", size,
                    "_source", Map.of("excludes", List.of("contentVector"))
            ));

            co.elastic.clients.elasticsearch.core.SearchRequest esRequest =
                    co.elastic.clients.elasticsearch.core.SearchRequest.of(s -> s
                            .index(documentsIndex)
                            .withJson(new StringReader(knnJson)));

            co.elastic.clients.elasticsearch.core.SearchResponse<Map> esResponse =
                    esClient.search(esRequest, Map.class);

            List<SearchResult> results = esResponse.hits().hits().stream()
                    .map(this::hitToSearchResult)
                    .collect(Collectors.toList());

            long totalHits = esResponse.hits().total() != null ? esResponse.hits().total().value() : 0;

            auditPublisher.publish(AuditEvent.builder()
                    .userId(userId)
                    .action("SEMANTIC_SEARCH")
                    .resourceType("SEARCH")
                    .details(Map.of("query", queryText, "totalHits", String.valueOf(totalHits)))
                    .build());

            return SearchResponse.builder()
                    .results(results)
                    .totalHits(totalHits)
                    .page(0)
                    .size(size)
                    .totalPages(1)
                    .facets(Map.of())
                    .build();

        } catch (IOException e) {
            log.error("Semantic search failed: {}", e.getMessage());
            throw new RuntimeException("Semantic search unavailable", e);
        }
    }

    private String buildEmbeddingText(Map<String, Object> document) {
        StringBuilder sb = new StringBuilder();
        appendIfPresent(sb, document, "title");
        appendIfPresent(sb, document, "description");
        appendIfPresent(sb, document, "content");
        if (document.get("tags") instanceof List<?> tags) {
            for (Object tag : tags) sb.append(' ').append(tag);
        }
        return sb.toString().trim();
    }

    private void appendIfPresent(StringBuilder sb, Map<String, Object> doc, String key) {
        Object val = doc.get(key);
        if (val instanceof String s && !s.isBlank()) {
            sb.append(' ').append(s);
        }
    }

    @SuppressWarnings("unchecked")
    private SearchResult hitToSearchResult(Hit<Map> hit) {
        Map<String, Object> source = hit.source();
        if (source == null) return SearchResult.builder().build();

        List<String> highlights = new ArrayList<>();
        if (hit.highlight() != null) {
            hit.highlight().values().forEach(highlights::addAll);
        }

        return SearchResult.builder()
                .documentId(source.get("documentId") != null ? UUID.fromString(source.get("documentId").toString()) : null)
                .title((String) source.get("title"))
                .description((String) source.get("description"))
                .mimeType((String) source.get("mimeType"))
                .status((String) source.get("status"))
                .authorName((String) source.get("authorName"))
                .authorId(source.get("authorId") != null ? UUID.fromString(source.get("authorId").toString()) : null)
                .folderPath((String) source.get("folderPath"))
                .tags(source.get("tags") != null ? (List<String>) source.get("tags") : List.of())
                .metadata(source.get("metadata") != null ? (Map<String, Object>) source.get("metadata") : Map.of())
                .score(hit.score() != null ? hit.score() : 0.0)
                .highlights(highlights)
                .build();
    }

    private void extractFacet(co.elastic.clients.elasticsearch.core.SearchResponse<Map> esResponse,
                              String aggName, Map<String, List<SearchResponse.FacetBucket>> facets) {
        try {
            var agg = esResponse.aggregations().get(aggName);
            if (agg != null && agg.isSterms()) {
                List<SearchResponse.FacetBucket> buckets = agg.sterms().buckets().array().stream()
                        .map(b -> SearchResponse.FacetBucket.builder()
                                .key(b.key().stringValue())
                                .count(b.docCount())
                                .build())
                        .collect(Collectors.toList());
                facets.put(aggName, buckets);
            }
        } catch (Exception e) {
            log.debug("Could not extract facet {}: {}", aggName, e.getMessage());
        }
    }
}
