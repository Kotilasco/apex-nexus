package com.apexnexus.document.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentDto {
    private UUID id;
    private String objectGuid;
    private UUID folderId;
    private UUID projectId;
    private String title;
    private String description;
    private String mimeType;
    private String fileExtension;
    private Integer currentVersion;
    private String sha256Hash;
    private Long fileSizeBytes;
    private UUID authorId;
    private String authorName;
    private String status;
    private Boolean isCheckedOut;
    private UUID checkedOutBy;
    private String checkedOutByName;
    private Instant checkedOutAt;
    private Instant retentionStartDate;
    private Integer retentionPeriodYears;
    private Instant retentionExpiry;
    private Boolean legalHold;
    private String legalHoldReason;
    private Boolean privacyRedactionEnabled;
    private String classificationLabel;
    private String m365Link;
    private String docusignEnvelopeId;
    private String sapDocumentNumber;
    private Boolean aiGenerated;
    private BigDecimal aiConfidence;
    private String[] tags;
    private Map<String, Object> metadata;
    private List<DocumentVersionDto> versions;
    private List<DocumentNoteDto> notes;
    private Instant createdAt;
    private Instant updatedAt;
}
