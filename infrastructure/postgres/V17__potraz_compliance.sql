-- V17: POTRAZ / Zimbabwe Cyber & Data Protection Act compliance suite
-- ----------------------------------------------------------------------
-- Adds: consent records, data subject requests, breach register,
--       cross-border transfer log, digital-services-tax ledger,
--       compliance snapshots, and POTRAZ-specific seeded rules.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Consent records — per data subject, per purpose
CREATE TABLE IF NOT EXISTS consent_records (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_subject_id     VARCHAR(255) NOT NULL,       -- email, natl ID, or username
    data_subject_name   VARCHAR(255),
    purpose             VARCHAR(100) NOT NULL,       -- MARKETING, PROCESSING, STORAGE, ANALYTICS, ...
    lawful_basis        VARCHAR(50)  NOT NULL,       -- CONSENT, CONTRACT, LEGAL_OBLIGATION, VITAL, PUBLIC, LEGITIMATE
    status              VARCHAR(20)  NOT NULL DEFAULT 'GRANTED',  -- GRANTED, WITHDRAWN, EXPIRED
    granted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    source              VARCHAR(100),                -- web-form, contract, email
    metadata            JSONB,
    jurisdiction_code   VARCHAR(10)  DEFAULT 'ZW',
    created_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_subject ON consent_records(data_subject_id);
CREATE INDEX IF NOT EXISTS idx_consent_status  ON consent_records(status);

-- 2. Data Subject Requests (DSR) — access, erasure, portability, rectification, restriction, objection
CREATE TABLE IF NOT EXISTS data_subject_requests (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_number      VARCHAR(50) NOT NULL UNIQUE,
    data_subject_id     VARCHAR(255) NOT NULL,
    data_subject_name   VARCHAR(255),
    data_subject_email  VARCHAR(255),
    request_type        VARCHAR(30)  NOT NULL,  -- ACCESS, ERASURE, PORTABILITY, RECTIFICATION, RESTRICTION, OBJECTION
    status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, REJECTED
    priority            VARCHAR(20)  DEFAULT 'NORMAL',
    description         TEXT,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at              TIMESTAMPTZ NOT NULL,       -- ZW DPA: 30 days from receipt
    completed_at        TIMESTAMPTZ,
    assigned_to         UUID,
    response_notes      TEXT,
    response_attachment_document_id UUID,
    document_ids_affected UUID[],
    jurisdiction_code   VARCHAR(10)  DEFAULT 'ZW',
    created_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dsr_status  ON data_subject_requests(status);
CREATE INDEX IF NOT EXISTS idx_dsr_subject ON data_subject_requests(data_subject_id);
CREATE INDEX IF NOT EXISTS idx_dsr_due     ON data_subject_requests(due_at);

-- 3. Data Breach Register — POTRAZ 24h notification requirement
CREATE TABLE IF NOT EXISTS data_breaches (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breach_number           VARCHAR(50) NOT NULL UNIQUE,
    title                   VARCHAR(255) NOT NULL,
    description             TEXT NOT NULL,
    severity                VARCHAR(20) NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    status                  VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- OPEN, INVESTIGATING, CONTAINED, RESOLVED, REPORTED
    breach_type             VARCHAR(50),          -- CONFIDENTIALITY, INTEGRITY, AVAILABILITY
    discovered_at           TIMESTAMPTZ NOT NULL,
    occurred_at             TIMESTAMPTZ,
    contained_at            TIMESTAMPTZ,
    resolved_at             TIMESTAMPTZ,
    records_affected        INTEGER DEFAULT 0,
    data_categories         TEXT[],               -- e.g. {NAME, ID_NUMBER, EMAIL, FINANCIAL}
    document_ids_affected   UUID[],
    user_ids_affected       UUID[],
    potraz_notified         BOOLEAN DEFAULT false,
    potraz_notified_at      TIMESTAMPTZ,
    potraz_reference        VARCHAR(100),
    subjects_notified       BOOLEAN DEFAULT false,
    subjects_notified_at    TIMESTAMPTZ,
    root_cause              TEXT,
    remediation             TEXT,
    jurisdiction_code       VARCHAR(10) DEFAULT 'ZW',
    created_by              UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_breach_status ON data_breaches(status);
CREATE INDEX IF NOT EXISTS idx_breach_severity ON data_breaches(severity);

-- 4. Cross-border transfers — Zimbabwe DPA restricts transfer outside ZW
CREATE TABLE IF NOT EXISTS cross_border_transfers (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_jurisdiction     VARCHAR(10) NOT NULL DEFAULT 'ZW',
    target_jurisdiction     VARCHAR(10) NOT NULL,
    target_country          VARCHAR(100),
    target_organization     VARCHAR(255),
    transfer_mechanism      VARCHAR(50), -- ADEQUACY, SCC, BCR, DEROGATION, CONSENT
    lawful_basis            VARCHAR(50),
    data_categories         TEXT[],
    records_transferred     INTEGER DEFAULT 0,
    document_id             UUID,
    purpose                 TEXT,
    approved                BOOLEAN DEFAULT false,
    approved_by             UUID,
    approved_at             TIMESTAMPTZ,
    transfer_date           TIMESTAMPTZ NOT NULL DEFAULT now(),
    safeguards              TEXT,
    created_by              UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_xborder_target ON cross_border_transfers(target_jurisdiction);

-- 5. Digital Services Tax ledger (Zimbabwe 15% DST, effective 2026)
CREATE TABLE IF NOT EXISTS digital_services_tax (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number       VARCHAR(100),
    supplier_name        VARCHAR(255) NOT NULL,
    supplier_country     VARCHAR(100),
    service_description  TEXT,
    service_category     VARCHAR(100),  -- CLOUD, SAAS, DIGITAL_ADVERTISING, STREAMING, ...
    gross_amount_usd     NUMERIC(14,2) NOT NULL,
    dst_rate             NUMERIC(5,2)  NOT NULL DEFAULT 15.00,
    dst_amount_usd       NUMERIC(14,2) NOT NULL,
    net_amount_usd       NUMERIC(14,2) NOT NULL,
    invoice_date         DATE NOT NULL,
    period_year          INTEGER NOT NULL,
    period_month         INTEGER NOT NULL,
    document_id          UUID,
    remitted             BOOLEAN DEFAULT false,
    remitted_at          TIMESTAMPTZ,
    zimra_reference      VARCHAR(100),
    created_by           UUID,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dst_period  ON digital_services_tax(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_dst_remitted ON digital_services_tax(remitted);

-- 6. Compliance snapshots (point-in-time audit reports)
CREATE TABLE IF NOT EXISTS compliance_snapshots (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type          VARCHAR(50) NOT NULL,   -- POTRAZ_AUDIT, DPA_REPORT, DST_QUARTERLY, PII_INVENTORY
    jurisdiction_code    VARCHAR(10) NOT NULL DEFAULT 'ZW',
    period_start         DATE,
    period_end           DATE,
    title                VARCHAR(255) NOT NULL,
    summary              TEXT,
    metrics              JSONB NOT NULL,         -- counts, percentages, findings
    findings             JSONB,                  -- detailed findings array
    score                NUMERIC(5,2),           -- compliance score 0-100
    status               VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, SUBMITTED
    generated_by         UUID,
    generated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_to         VARCHAR(100),
    submitted_at         TIMESTAMPTZ,
    submitted_reference  VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_snapshot_type ON compliance_snapshots(report_type, generated_at DESC);

-- 7. Extend jurisdiction_retention_rules with POTRAZ-specific entries
DO $$
DECLARE
    zw_id UUID;
BEGIN
    SELECT id INTO zw_id FROM jurisdictions WHERE code = 'ZW';
    IF zw_id IS NOT NULL THEN
        -- Insert rules only if not already present
        INSERT INTO jurisdiction_retention_rules (
            id, jurisdiction_id, category, retention_years, citation, description, required
        )
        SELECT uuid_generate_v4(), zw_id, c, y, cit, d, true
        FROM (VALUES
            ('PERSONAL_DATA',       5, 'Zimbabwe DPA s.14',   'Personal data retained only as long as necessary; max 5 years default.'),
            ('HEALTH_RECORDS',     10, 'Zimbabwe DPA s.15',   'Health-related personal data — 10 years minimum.'),
            ('FINANCIAL_RECORDS',   6, 'Income Tax Act s.37',  'Accounting & tax records — 6 years.'),
            ('EMPLOYMENT_RECORDS',  7, 'Labour Act s.17',      'Employment & payroll records — 7 years.'),
            ('TELECOM_LOGS',        3, 'POTRAZ Reg 2014 s.12', 'Electronic communication metadata — 3 years.'),
            ('CONSENT_RECORDS',     7, 'Zimbabwe DPA s.11',    'Records of consent — 7 years after withdrawal.'),
            ('BREACH_RECORDS',     10, 'Zimbabwe DPA s.21',    'Data breach register — 10 years.'),
            ('DIGITAL_TAX',         7, 'Finance Act 2023 s.9', 'Digital services tax records — 7 years.')
        ) AS t(c, y, cit, d)
        WHERE NOT EXISTS (
            SELECT 1 FROM jurisdiction_retention_rules
            WHERE jurisdiction_id = zw_id AND category = t.c
        );
    END IF;
END $$;
