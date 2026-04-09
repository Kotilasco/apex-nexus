package com.apexnexus.document.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document_notes")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class DocumentNote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private Document document;

    @Column(name = "author_id", nullable = false)
    private UUID authorId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "note_type", length = 30)
    @Builder.Default
    private String noteType = "GENERAL";

    @Column(name = "is_pinned")
    @Builder.Default
    private Boolean isPinned = false;

    @Column(length = 7)
    @Builder.Default
    private String color = "#FFEB3B";

    @Column(name = "parent_note_id")
    private UUID parentNoteId;

    @CreationTimestamp
    @Column(name = "created_at")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
