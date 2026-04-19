package com.apexnexus.document.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateDocumentLinkRequest {
    @NotNull
    private UUID targetDocumentId;

    /** One of: RELATED, SUPERSEDES, AMENDMENT, ATTACHMENT, REVISION_OF. Defaults to RELATED. */
    private String linkType;

    private String note;
}
