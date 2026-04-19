package com.apexnexus.document.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document_links")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentLink {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "id")
    private UUID id;

    @Column(name = "source_doc_id", nullable = false)
    private UUID sourceDocumentId;

    @Column(name = "target_doc_id", nullable = false)
    private UUID targetDocumentId;

    @Column(name = "link_type", length = 30)
    private String linkType;

    @Column(name = "note", columnDefinition = "text")
    private String note;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
