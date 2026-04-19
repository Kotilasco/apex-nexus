package com.apexnexus.document.dto;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentLinkDto {
    private UUID id;
    private UUID sourceDocumentId;
    private UUID targetDocumentId;
    /** Direction relative to the requesting document: OUTGOING (this doc is source) or INCOMING (this doc is target). */
    private String direction;
    /** Title of the "other" document (i.e. the one that is NOT the requesting document). */
    private String relatedDocumentId;
    private String relatedDocumentTitle;
    private String linkType;
    private String note;
    private UUID createdBy;
    private Instant createdAt;
}
