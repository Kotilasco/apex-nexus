package com.apexnexus.search.dto;

import lombok.Data;

import java.util.List;

@Data
public class SearchRequest {
    private String query;
    private List<String> tags;
    private String mimeType;
    private String status;
    private String folderPath;
    private String authorId;
    private String projectId;
    private String dateFrom;
    private String dateTo;
    private String sortBy;
    private String sortOrder;
    private int page = 0;
    private int size = 20;
}
