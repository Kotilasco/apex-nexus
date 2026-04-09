-- ============================================================
-- V2: ELO Gap Features — Database Migrations
-- Adds: Share Links, Document Signatures, Content Extraction
--        Tracking, Presence Tracking, GDPR Scan Results,
--        Ad-hoc Forwarding, Classification Labels
-- ============================================================

-- -----------------------------------------------------------
-- 1. Public Share Links (time-limited, password-protected)
-- -----------------------------------------------------------
CREATE TABLE document_share_links (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    token           VARCHAR(128) NOT NULL UNIQUE,
    created_by      UUID NOT NULL REFERENCES users(id),
    expires_at      TIMESTAMPTZ NOT NULL,
    password_hash   VARCHAR(255),              -- bcrypt hash, NULL = no password
    max_downloads   INT,                        -- NULL = unlimited
    download_count  INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    allow_preview   BOOLEAN DEFAULT TRUE,
    allow_download  BOOLEAN DEFAULT TRUE,
    ip_whitelist    TEXT[],                      -- optional IP restriction
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_share_links_token ON document_share_links(token);
CREATE INDEX idx_share_links_document ON document_share_links(document_id);
CREATE INDEX idx_share_links_expiry ON document_share_links(expires_at);

-- -----------------------------------------------------------
-- 2. Document Signatures (eIDAS / DocuSign integration)
-- -----------------------------------------------------------
CREATE TYPE signature_status AS ENUM ('PENDING','SIGNED','REJECTED','EXPIRED','REVOKED');
CREATE TYPE signature_provider AS ENUM ('INTERNAL','DOCUSIGN','EIDAS','ADOBE_SIGN');

CREATE TABLE document_signatures (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    signer_id       UUID NOT NULL REFERENCES users(id),
    status          signature_status DEFAULT 'PENDING',
    provider        signature_provider DEFAULT 'INTERNAL',
    provider_ref    VARCHAR(500),               -- external envelope/transaction ID
    signature_data  BYTEA,                      -- embedded signature blob
    certificate     TEXT,                        -- X.509 cert (PEM)
    signed_hash     VARCHAR(128),               -- SHA-256 of signed content
    reason          TEXT,
    location        VARCHAR(255),
    signed_at       TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signatures_document ON document_signatures(document_id);
CREATE INDEX idx_signatures_signer ON document_signatures(signer_id);
CREATE INDEX idx_signatures_status ON document_signatures(status);

-- -----------------------------------------------------------
-- 3. Content Extraction Tracking (OCR/Tika pipeline)
-- -----------------------------------------------------------
CREATE TYPE extraction_status AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED','SKIPPED');

CREATE TABLE content_extractions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    status          extraction_status DEFAULT 'PENDING',
    extracted_text  TEXT,                        -- full extracted text
    content_length  INT,                        -- char count
    language        VARCHAR(10),                -- detected language (ISO 639-1)
    ocr_applied     BOOLEAN DEFAULT FALSE,      -- was OCR needed (scanned PDF/image)?
    extraction_time_ms INT,                     -- processing duration
    tika_metadata   JSONB DEFAULT '{}',         -- raw Tika metadata
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, version_number)
);

CREATE INDEX idx_extractions_document ON content_extractions(document_id);
CREATE INDEX idx_extractions_status ON content_extractions(status);

-- -----------------------------------------------------------
-- 4. GDPR Privacy Scan Results
-- -----------------------------------------------------------
CREATE TYPE gdpr_scan_status AS ENUM ('PENDING','SCANNING','COMPLETED','FAILED');
CREATE TYPE pii_severity AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');

CREATE TABLE gdpr_scans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    status          gdpr_scan_status DEFAULT 'PENDING',
    pii_found       BOOLEAN DEFAULT FALSE,
    pii_count       INT DEFAULT 0,
    severity        pii_severity,
    findings        JSONB DEFAULT '[]',         -- [{type, value_masked, offset, length}]
    scan_time_ms    INT,
    scanned_by      UUID REFERENCES users(id),  -- NULL = automated
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, version_number)
);

CREATE INDEX idx_gdpr_scans_document ON gdpr_scans(document_id);
CREATE INDEX idx_gdpr_scans_pii ON gdpr_scans(pii_found) WHERE pii_found = TRUE;

-- -----------------------------------------------------------
-- 5. Ad-hoc Workflow Forwards
-- -----------------------------------------------------------
CREATE TABLE workflow_forwards (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    workflow_instance_id UUID REFERENCES workflow_instances(id),
    forwarded_by    UUID NOT NULL REFERENCES users(id),
    forwarded_to    UUID NOT NULL REFERENCES users(id),
    message         TEXT,
    action_required VARCHAR(50) DEFAULT 'REVIEW'
                    CHECK (action_required IN ('REVIEW','APPROVE','SIGN','COMMENT','FYI')),
    is_completed    BOOLEAN DEFAULT FALSE,
    completed_at    TIMESTAMPTZ,
    response        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forwards_document ON workflow_forwards(document_id);
CREATE INDEX idx_forwards_to ON workflow_forwards(forwarded_to);
CREATE INDEX idx_forwards_pending ON workflow_forwards(forwarded_to, is_completed) WHERE is_completed = FALSE;

-- -----------------------------------------------------------
-- 6. Document Classification Labels
-- -----------------------------------------------------------
CREATE TABLE classification_labels (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    category        VARCHAR(100),               -- e.g. 'CONTRACT', 'INVOICE', 'CORRESPONDENCE'
    description     TEXT,
    color           VARCHAR(7) DEFAULT '#4CAF50',
    is_system       BOOLEAN DEFAULT FALSE,      -- system-generated vs user-created
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_classifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    label_id        UUID NOT NULL REFERENCES classification_labels(id),
    confidence      NUMERIC(5,4),               -- 0.0000 to 1.0000
    source          VARCHAR(20) DEFAULT 'AI'
                    CHECK (source IN ('AI','MANUAL','RULE')),
    classified_by   UUID REFERENCES users(id),  -- NULL = AI
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, label_id)
);

CREATE INDEX idx_classifications_document ON document_classifications(document_id);
CREATE INDEX idx_classifications_label ON document_classifications(label_id);

-- -----------------------------------------------------------
-- 7. Add FORWARD to workflow_transitions action constraint
-- -----------------------------------------------------------
ALTER TABLE workflow_transitions
    DROP CONSTRAINT IF EXISTS workflow_transitions_action_check;

ALTER TABLE workflow_transitions
    ADD CONSTRAINT workflow_transitions_action_check
    CHECK (upper(action::text) = ANY (ARRAY['START','SUBMIT','APPROVE','REJECT','REVISE','ARCHIVE','RECALL','ESCALATE','FORWARD','SIGN','CANCEL','RESUBMIT']));

-- -----------------------------------------------------------
-- 8. Add content_extracted flag to documents
-- -----------------------------------------------------------
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_extracted BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS classification_label VARCHAR(100);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS gdpr_scanned BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS has_signatures BOOLEAN DEFAULT FALSE;

-- -----------------------------------------------------------
-- 9. Seed default classification labels
-- -----------------------------------------------------------
INSERT INTO classification_labels (name, category, description, color, is_system) VALUES
    ('Contract', 'LEGAL', 'Legal contracts and agreements', '#F44336', TRUE),
    ('Invoice', 'FINANCIAL', 'Invoices and billing documents', '#FF9800', TRUE),
    ('Correspondence', 'COMMUNICATION', 'Letters, emails, memos', '#2196F3', TRUE),
    ('Report', 'ANALYSIS', 'Reports and analytical documents', '#4CAF50', TRUE),
    ('Policy', 'GOVERNANCE', 'Policies and procedures', '#9C27B0', TRUE),
    ('Technical', 'ENGINEERING', 'Technical specifications and manuals', '#607D8B', TRUE),
    ('HR Document', 'HUMAN_RESOURCES', 'HR-related documents', '#E91E63', TRUE),
    ('Meeting Minutes', 'COMMUNICATION', 'Meeting notes and minutes', '#00BCD4', TRUE),
    ('Presentation', 'COMMUNICATION', 'Slide decks and presentations', '#FF5722', TRUE),
    ('Spreadsheet', 'DATA', 'Data sheets and spreadsheets', '#8BC34A', TRUE),
    ('Image', 'MEDIA', 'Photographs and images', '#795548', TRUE),
    ('Other', 'GENERAL', 'Uncategorized documents', '#9E9E9E', TRUE)
ON CONFLICT (name) DO NOTHING;
