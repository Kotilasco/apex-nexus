package com.apexnexus.document.service;

import com.apexnexus.common.exception.BusinessException;
import com.apexnexus.common.exception.ResourceNotFoundException;
import com.apexnexus.document.dto.CreateDocumentLinkRequest;
import com.apexnexus.document.dto.DocumentLinkDto;
import com.apexnexus.document.model.Document;
import com.apexnexus.document.model.DocumentLink;
import com.apexnexus.document.repository.DocumentLinkRepository;
import com.apexnexus.document.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentLinkService {

    private static final Set<String> VALID_TYPES = Set.of(
            "RELATED", "SUPERSEDES", "AMENDMENT", "ATTACHMENT", "REVISION_OF");

    private final DocumentLinkRepository linkRepository;
    private final DocumentRepository documentRepository;

    @Transactional
    public DocumentLinkDto createLink(UUID sourceDocumentId, CreateDocumentLinkRequest request, UUID userId) {
        if (request.getTargetDocumentId() == null) {
            throw new BusinessException("targetDocumentId is required");
        }
        if (sourceDocumentId.equals(request.getTargetDocumentId())) {
            throw new BusinessException("A document cannot be linked to itself");
        }
        String type = request.getLinkType() == null ? "RELATED" : request.getLinkType().trim().toUpperCase();
        if (!VALID_TYPES.contains(type)) {
            throw new BusinessException("Invalid linkType. Allowed: " + String.join(", ", VALID_TYPES));
        }

        Document source = documentRepository.findById(sourceDocumentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", sourceDocumentId));
        Document target = documentRepository.findById(request.getTargetDocumentId())
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", request.getTargetDocumentId()));

        if (linkRepository.existsBySourceDocumentIdAndTargetDocumentIdAndLinkType(
                sourceDocumentId, request.getTargetDocumentId(), type)) {
            throw new BusinessException("This link already exists");
        }

        DocumentLink link = DocumentLink.builder()
                .sourceDocumentId(sourceDocumentId)
                .targetDocumentId(request.getTargetDocumentId())
                .linkType(type)
                .note(request.getNote())
                .createdBy(userId)
                .build();
        link = linkRepository.save(link);
        log.info("Created document link {} → {} ({}) by {}", sourceDocumentId, target.getId(), type, userId);

        return toDto(link, sourceDocumentId, target.getTitle(), source.getTitle());
    }

    @Transactional(readOnly = true)
    public List<DocumentLinkDto> getLinksForDocument(UUID docId) {
        List<DocumentLink> links = linkRepository.findAllByDocument(docId);
        if (links.isEmpty()) return List.of();

        // Resolve related doc titles in bulk
        Set<UUID> otherIds = new HashSet<>();
        for (DocumentLink l : links) {
            otherIds.add(l.getSourceDocumentId().equals(docId) ? l.getTargetDocumentId() : l.getSourceDocumentId());
        }
        Map<UUID, String> titles = new HashMap<>();
        documentRepository.findAllById(otherIds)
                .forEach(d -> titles.put(d.getId(), d.getTitle()));

        List<DocumentLinkDto> out = new ArrayList<>(links.size());
        for (DocumentLink l : links) {
            boolean outgoing = l.getSourceDocumentId().equals(docId);
            UUID otherId = outgoing ? l.getTargetDocumentId() : l.getSourceDocumentId();
            out.add(DocumentLinkDto.builder()
                    .id(l.getId())
                    .sourceDocumentId(l.getSourceDocumentId())
                    .targetDocumentId(l.getTargetDocumentId())
                    .direction(outgoing ? "OUTGOING" : "INCOMING")
                    .relatedDocumentId(otherId.toString())
                    .relatedDocumentTitle(titles.getOrDefault(otherId, "(deleted)"))
                    .linkType(l.getLinkType())
                    .note(l.getNote())
                    .createdBy(l.getCreatedBy())
                    .createdAt(l.getCreatedAt())
                    .build());
        }
        return out;
    }

    @Transactional
    public void deleteLink(UUID docId, UUID linkId, UUID userId) {
        DocumentLink link = linkRepository.findById(linkId)
                .orElseThrow(() -> new ResourceNotFoundException("DocumentLink", "id", linkId));
        if (!link.getSourceDocumentId().equals(docId) && !link.getTargetDocumentId().equals(docId)) {
            throw new BusinessException("Link does not belong to this document");
        }
        linkRepository.delete(link);
        log.info("Deleted document link {} by {}", linkId, userId);
    }

    private DocumentLinkDto toDto(DocumentLink l, UUID viewerDocId, String targetTitle, String sourceTitle) {
        boolean outgoing = l.getSourceDocumentId().equals(viewerDocId);
        UUID otherId = outgoing ? l.getTargetDocumentId() : l.getSourceDocumentId();
        return DocumentLinkDto.builder()
                .id(l.getId())
                .sourceDocumentId(l.getSourceDocumentId())
                .targetDocumentId(l.getTargetDocumentId())
                .direction(outgoing ? "OUTGOING" : "INCOMING")
                .relatedDocumentId(otherId.toString())
                .relatedDocumentTitle(outgoing ? targetTitle : sourceTitle)
                .linkType(l.getLinkType())
                .note(l.getNote())
                .createdBy(l.getCreatedBy())
                .createdAt(l.getCreatedAt())
                .build();
    }
}
