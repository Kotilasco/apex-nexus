-- V21: Saved Q&A conversations on documents and document versions

CREATE TABLE document_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_id UUID REFERENCES document_versions(id) ON DELETE CASCADE,
    title VARCHAR(200),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    asked_by UUID REFERENCES users(id),
    asked_by_name VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_conv_document ON document_conversations (document_id, created_at DESC);
CREATE INDEX idx_doc_conv_version  ON document_conversations (version_id, created_at DESC);
