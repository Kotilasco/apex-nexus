-- ============================================================================
-- V20: Vendor Portal — compliance documents, access audit, and source auth
-- ----------------------------------------------------------------------------
-- Adds:
--   * vendor_compliance_docs  — per-vendor eligibility documents (Tax, PRAZ,
--     ISO, BEE, Insurance, etc.) with expiry tracking.
--   * vendor_portal_access_log — tracks every view/download from a vendor
--     portal, feeding the watermarking + leak-prevention story.
--   * federated_source_tokens — safe token storage for source connectors
--     (Gmail app password / MS Graph client secret etc.).
-- ============================================================================

-- ---------- Vendor eligibility / compliance documents ----------
CREATE TABLE IF NOT EXISTS vendor_compliance_docs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portal_id        UUID REFERENCES vendor_portals(id) ON DELETE CASCADE,
    doc_type         VARCHAR(60) NOT NULL,
        -- TAX_CLEARANCE | PRAZ | BEE | ISO_9001 | ISO_27001 | INSURANCE
        -- | COMPANY_REGISTRATION | VAT | OTHER
    label            VARCHAR(120),
    upload_id        UUID REFERENCES vendor_portal_uploads(id),
    valid_from       DATE,
    expires_on       DATE NOT NULL,
    status           VARCHAR(20) DEFAULT 'VALID',
        -- VALID | EXPIRING_SOON | EXPIRED | REJECTED
    last_checked_at  TIMESTAMPTZ DEFAULT now(),
    created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendor_cd_portal ON vendor_compliance_docs(portal_id);
CREATE INDEX IF NOT EXISTS idx_vendor_cd_type   ON vendor_compliance_docs(doc_type);
CREATE INDEX IF NOT EXISTS idx_vendor_cd_exp    ON vendor_compliance_docs(expires_on);

-- ---------- Portal access audit (watermark / leak prevention) ----------
CREATE TABLE IF NOT EXISTS vendor_portal_access_log (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portal_id        UUID REFERENCES vendor_portals(id) ON DELETE CASCADE,
    upload_id        UUID REFERENCES vendor_portal_uploads(id),
    action           VARCHAR(30) NOT NULL,  -- VIEW | DOWNLOAD | UPLOAD | REJECTED | BLOCKED
    remote_ip        VARCHAR(64),
    user_agent       TEXT,
    watermark        VARCHAR(200),  -- vendor + ts + ip that was stamped on the doc
    details          JSONB,
    created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vpal_portal ON vendor_portal_access_log(portal_id);
CREATE INDEX IF NOT EXISTS idx_vpal_action ON vendor_portal_access_log(action);

-- Keep portal-level summary fresh
ALTER TABLE vendor_portals
    ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(20) DEFAULT 'UNKNOWN';
        -- COMPLIANT | EXPIRING | NON_COMPLIANT | UNKNOWN
ALTER TABLE vendor_portals
    ADD COLUMN IF NOT EXISTS blocked_reason VARCHAR(200);
