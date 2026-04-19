-- =========================================================================
-- V19__agentic_federated_vendor_predictions.sql
--
-- Four 2026-era capabilities in one migration:
--   1. Agentic Intent Suggestions
--   2. Federated Search Sources + cache
--   3. Vendor Portals (secured data rooms)
--   4. Workflow Predictions (predictive bottlenecks)
-- =========================================================================

-- ---------- 1. Agentic Intent Suggestions ----------
CREATE TABLE IF NOT EXISTS agentic_suggestions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id      UUID REFERENCES documents(id) ON DELETE CASCADE,
    workflow_id      UUID,
    intent_type      VARCHAR(60) NOT NULL, -- INVOICE_ANOMALY, CONTRACT_EXPIRY, COMPLIANCE_ISSUE, METER_ANOMALY, POLICY_UPDATE, REROUTE, ...
    title            VARCHAR(255) NOT NULL,
    rationale        TEXT,
    proposed_action  JSONB NOT NULL,        -- {type: CREATE_DOC|START_WF|SEND_NOTICE|REROUTE, params:{...}}
    confidence       NUMERIC(4,3) DEFAULT 0.8,
    status           VARCHAR(20) DEFAULT 'PROPOSED',  -- PROPOSED | ACCEPTED | DISMISSED | EXECUTED | FAILED
    result           JSONB,
    created_at       TIMESTAMPTZ DEFAULT now(),
    acted_at         TIMESTAMPTZ,
    acted_by         UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_agentic_status ON agentic_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_agentic_document ON agentic_suggestions(document_id);
CREATE INDEX IF NOT EXISTS idx_agentic_created ON agentic_suggestions(created_at DESC);

-- ---------- 2. Federated Search ----------
CREATE TABLE IF NOT EXISTS federated_sources (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             VARCHAR(120) NOT NULL,
    source_type      VARCHAR(30) NOT NULL,  -- EXCHANGE | SHAREPOINT | NETWORK_SHARE | LEGACY_ECM | GOOGLE_DRIVE
    endpoint_url     TEXT,
    config           JSONB,
    enabled          BOOLEAN DEFAULT true,
    last_indexed_at  TIMESTAMPTZ,
    doc_count_estimate INTEGER DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT now()
);

-- Small cache so the demo is deterministic. A real source adapter would query live.
CREATE TABLE IF NOT EXISTS federated_index (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id        UUID REFERENCES federated_sources(id) ON DELETE CASCADE,
    external_id      VARCHAR(255) NOT NULL,
    title            VARCHAR(255) NOT NULL,
    snippet          TEXT,
    author           VARCHAR(120),
    modified_at      TIMESTAMPTZ,
    external_url     TEXT,
    search_tokens    TSVECTOR,
    created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fed_tokens ON federated_index USING gin(search_tokens);
CREATE INDEX IF NOT EXISTS idx_fed_source ON federated_index(source_id);

-- ---------- 3. Vendor Portals ----------
CREATE TABLE IF NOT EXISTS vendor_portals (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_code      VARCHAR(50) NOT NULL,
    vendor_name      VARCHAR(255) NOT NULL,
    contact_email    VARCHAR(255),
    project_id       UUID REFERENCES projects(id),
    access_token     VARCHAR(128) UNIQUE NOT NULL,
    status           VARCHAR(20) DEFAULT 'ACTIVE',  -- ACTIVE | EXPIRED | REVOKED
    required_docs    TEXT[] DEFAULT ARRAY[]::TEXT[], -- e.g. ['CONTRACT','SAFETY_CERT','ISO_9001']
    expires_at       TIMESTAMPTZ,
    created_by       UUID REFERENCES users(id),
    created_at       TIMESTAMPTZ DEFAULT now(),
    last_accessed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_vendor_portal_token ON vendor_portals(access_token);
CREATE INDEX IF NOT EXISTS idx_vendor_portal_status ON vendor_portals(status);

CREATE TABLE IF NOT EXISTS vendor_portal_uploads (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portal_id        UUID REFERENCES vendor_portals(id) ON DELETE CASCADE,
    filename         VARCHAR(255),
    mime_type        VARCHAR(120),
    file_size        BIGINT,
    document_id      UUID REFERENCES documents(id),
    pii_findings     JSONB,
    compliance_findings JSONB,
    classification   VARCHAR(60),
    status           VARCHAR(30) DEFAULT 'RECEIVED',  -- RECEIVED | QUARANTINED | APPROVED | REJECTED
    reviewer_notes   TEXT,
    uploaded_at      TIMESTAMPTZ DEFAULT now(),
    reviewed_at      TIMESTAMPTZ,
    reviewed_by      UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_vendor_upload_portal ON vendor_portal_uploads(portal_id);
CREATE INDEX IF NOT EXISTS idx_vendor_upload_status ON vendor_portal_uploads(status);

-- ---------- 4. Workflow Predictions ----------
CREATE TABLE IF NOT EXISTS workflow_step_history (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    definition_id    UUID,
    from_state       VARCHAR(50),
    to_state         VARCHAR(50),
    assignee         UUID,
    dwell_hours      NUMERIC(10,2),
    completed_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wf_history_def ON workflow_step_history(definition_id, to_state);
CREATE INDEX IF NOT EXISTS idx_wf_history_assignee ON workflow_step_history(assignee);

CREATE TABLE IF NOT EXISTS workflow_predictions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_instance_id    UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
    predicted_completion    TIMESTAMPTZ,
    predicted_delay_hours   NUMERIC(10,2),
    risk_level              VARCHAR(10),  -- LOW | MEDIUM | HIGH
    bottleneck_assignee     UUID REFERENCES users(id),
    bottleneck_reason       TEXT,
    suggested_reassignee    UUID REFERENCES users(id),
    confidence              NUMERIC(4,3) DEFAULT 0.75,
    computed_at             TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wf_pred_instance ON workflow_predictions(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_wf_pred_risk ON workflow_predictions(risk_level);

-- =========================================================================
-- Seed: federated sources + mock index rows for the demo
-- =========================================================================
INSERT INTO federated_sources (id, name, source_type, endpoint_url, enabled, doc_count_estimate) VALUES
  ('b0000011-0000-0000-0000-00000000f001','Corporate Exchange (Outlook)','EXCHANGE','https://outlook.office365.com/ews', true, 48000),
  ('b0000011-0000-0000-0000-00000000f002','Finance SharePoint','SHAREPOINT','https://contoso.sharepoint.com/sites/finance', true, 12500),
  ('b0000011-0000-0000-0000-00000000f003','Legal Network Drive','NETWORK_SHARE','\\\\legal-nas\\archives', true, 3600),
  ('b0000011-0000-0000-0000-00000000f004','Legacy ELO Archive (read-only)','LEGACY_ECM','https://legacy-elo.internal/api', true, 22000)
ON CONFLICT DO NOTHING;

-- Seed a realistic federated corpus (small but pitch-worthy)
INSERT INTO federated_index (source_id, external_id, title, snippet, author, modified_at, external_url) VALUES
  ('b0000011-0000-0000-0000-00000000f001','msg-alpha-001','Re: Project Alpha kickoff','Confirming Monday 09:00 kickoff for Project Alpha with ZETDC stakeholders. Agenda attached.','Finance Director','2026-04-12 10:15+00','https://outlook.office365.com/mail/id/msg-alpha-001'),
  ('b0000011-0000-0000-0000-00000000f001','msg-po-4500012001','FW: PO 4500012001 confirmation — Acme Power','Acme Power confirms PO 4500012001 for 1x 33kV transformer, delivery 8 weeks.','Procurement','2026-04-09 08:42+00','https://outlook.office365.com/mail/id/msg-po-4500012001'),
  ('b0000011-0000-0000-0000-00000000f001','msg-zetdc-tariff','ZETDC tariff increase notice','Notice: tariff adjustment 15% effective May 1. Plan budget impact.','ZETDC','2026-04-14 06:00+00','https://outlook.office365.com/mail/id/msg-zetdc-tariff'),
  ('b0000011-0000-0000-0000-00000000f002','sp-alpha-charter','Project Alpha — Business Case.docx','Project Alpha expands metering capacity at Harare substations...','PMO','2026-03-22 15:00+00','https://contoso.sharepoint.com/sites/finance/Docs/ProjectAlphaCharter.docx'),
  ('b0000011-0000-0000-0000-00000000f002','sp-budget-2026','Operating Budget FY2026.xlsx','Consolidated operating budget, includes utility line items for ZETDC.','Finance','2026-01-12 09:00+00','https://contoso.sharepoint.com/sites/finance/Docs/Budget2026.xlsx'),
  ('b0000011-0000-0000-0000-00000000f003','nas-legal-master-ssa','Master Services Agreement — Acme Power.pdf','Five-year master services agreement with Acme Power Systems Ltd.','Legal','2024-06-01 00:00+00','file:///\\legal-nas/archives/msa/acme-power-2024.pdf'),
  ('b0000011-0000-0000-0000-00000000f003','nas-legal-nda','NDA — SmartGrid Meters SA.pdf','Mutual NDA executed with SmartGrid Meters SA.','Legal','2025-11-04 00:00+00','file:///\\legal-nas/archives/nda/smartgrid-2025.pdf'),
  ('b0000011-0000-0000-0000-00000000f004','elo-2019-alpha','Alpha Feasibility Study (2019)','Original feasibility study for Project Alpha, archived 2019.','Engineering','2019-08-15 00:00+00','https://legacy-elo.internal/doc/elo-2019-alpha'),
  ('b0000011-0000-0000-0000-00000000f004','elo-fin-policy-2020','Finance Retention Policy (2020)','Legacy finance retention policy, superseded but retained for audit.','Records','2020-01-02 00:00+00','https://legacy-elo.internal/doc/elo-fin-policy-2020')
ON CONFLICT DO NOTHING;

-- Build the tsvector
UPDATE federated_index
   SET search_tokens = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(snippet,'') || ' ' || coalesce(author,''))
 WHERE search_tokens IS NULL;

-- =========================================================================
-- Seed: synthetic workflow step history (powers predictions)
-- =========================================================================
DO $$
DECLARE
    def_id UUID;
    user_ap UUID := 'b0000000-0000-0000-0000-000000000001'; -- admin as proxy
    i INTEGER;
BEGIN
    SELECT id INTO def_id FROM workflow_definitions LIMIT 1;
    IF def_id IS NOT NULL THEN
        FOR i IN 1..40 LOOP
            INSERT INTO workflow_step_history (definition_id, from_state, to_state, assignee, dwell_hours, completed_at)
            VALUES (def_id, 'SUBMITTED','APPROVED', user_ap,
                    (20 + (random()*40))::numeric(10,2),
                    now() - (random()*30 || ' days')::interval);
        END LOOP;
    END IF;
END $$;
