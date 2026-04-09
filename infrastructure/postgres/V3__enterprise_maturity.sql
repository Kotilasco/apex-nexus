-- ============================================================
-- V3: Enterprise Maturity — Database Migrations
-- Adds: Jurisdiction Retention Rules, Visual Workflow Designer
--       storage, Plugin/Extension Registry, Industry Templates
-- ============================================================

-- -----------------------------------------------------------
-- 1. Jurisdiction-Specific Retention Rules
-- -----------------------------------------------------------
CREATE TABLE jurisdictions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(10) NOT NULL UNIQUE,     -- ISO 3166-1 (DE, US, GB, FR, EU…)
    name            VARCHAR(200) NOT NULL,
    region          VARCHAR(100),                     -- e.g. Europe, North America
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE legal_frameworks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jurisdiction_id UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,
    code            VARCHAR(50) NOT NULL,             -- e.g. GDPR, HGB, SOX, HIPAA
    name            VARCHAR(300) NOT NULL,
    description     TEXT,
    authority       VARCHAR(300),                     -- issuing body
    effective_date  DATE,
    url             TEXT,                              -- reference URL
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(jurisdiction_id, code)
);

CREATE TABLE jurisdiction_retention_rules (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jurisdiction_id     UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,
    legal_framework_id  UUID REFERENCES legal_frameworks(id) ON DELETE SET NULL,
    document_category   VARCHAR(100) NOT NULL,         -- CONTRACT, INVOICE, HR, TAX, MEDICAL…
    min_retention_years INT NOT NULL,
    max_retention_years INT,
    description         TEXT,
    legal_citation      VARCHAR(500),                  -- e.g. "§ 257 HGB", "Art. 17 GDPR"
    penalty_info        TEXT,                           -- non-compliance consequences
    is_mandatory        BOOLEAN DEFAULT TRUE,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jrr_jurisdiction ON jurisdiction_retention_rules(jurisdiction_id);
CREATE INDEX idx_jrr_category ON jurisdiction_retention_rules(document_category);

-- Link retention policies to jurisdictions
ALTER TABLE retention_policies ADD COLUMN IF NOT EXISTS jurisdiction_id UUID REFERENCES jurisdictions(id);
ALTER TABLE retention_policies ADD COLUMN IF NOT EXISTS legal_framework_id UUID REFERENCES legal_frameworks(id);
ALTER TABLE retention_policies ADD COLUMN IF NOT EXISTS document_category VARCHAR(100);
ALTER TABLE retention_policies ADD COLUMN IF NOT EXISTS legal_citation VARCHAR(500);
ALTER TABLE retention_policies ADD COLUMN IF NOT EXISTS compliance_notes TEXT;

-- -----------------------------------------------------------
-- 2. Visual Workflow Designer storage
-- -----------------------------------------------------------
ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS canvas_layout JSONB DEFAULT '{}';
-- canvas_layout stores node positions, connections, visual metadata for the designer:
-- { "nodes": [{ "id": "state_1", "x": 100, "y": 200, "width": 180, "height": 80 }],
--   "edges": [{ "source": "state_1", "target": "state_2", "label": "APPROVE" }] }

ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS template_id UUID;
ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS icon VARCHAR(50);
ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3B82F6';
ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS estimated_duration_hours INT;

-- Workflow templates (prebuilt industry workflows)
CREATE TABLE workflow_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    display_name    VARCHAR(200) NOT NULL DEFAULT '',
    description     TEXT,
    category        VARCHAR(100),                     -- LEGAL, HR, FINANCE, GENERAL
    industry        VARCHAR(100),                     -- HEALTHCARE, BANKING, MANUFACTURING…
    states          JSONB NOT NULL,
    transitions     JSONB NOT NULL,
    initial_state   VARCHAR(100) NOT NULL,
    canvas_layout   JSONB DEFAULT '{}',
    required_roles  JSONB,
    icon            VARCHAR(50),
    color           VARCHAR(7) DEFAULT '#3B82F6',
    estimated_duration_hours INT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 3. Plugin/Extension Registry
-- -----------------------------------------------------------
CREATE TYPE plugin_status AS ENUM ('ACTIVE','INACTIVE','ERROR','INSTALLING');
CREATE TYPE plugin_type   AS ENUM ('CONNECTOR','PROCESSOR','UI_EXTENSION','INDUSTRY_PACK','INTEGRATION');

CREATE TABLE plugin_registry (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plugin_key      VARCHAR(200) NOT NULL UNIQUE,     -- e.g. "apex.connector.sap"
    name            VARCHAR(300) NOT NULL,
    description     TEXT,
    version         VARCHAR(50) NOT NULL,
    author          VARCHAR(200),
    type            plugin_type NOT NULL,
    category        VARCHAR(100),                     -- ERP, CRM, COMPLIANCE, STORAGE…
    status          plugin_status DEFAULT 'INACTIVE',
    config          JSONB DEFAULT '{}',               -- plugin-specific configuration
    capabilities    JSONB DEFAULT '[]',               -- list of capability keys
    icon_url        VARCHAR(500),
    documentation_url VARCHAR(500),
    entry_point     VARCHAR(500),                     -- class name or webhook URL
    requires        JSONB DEFAULT '[]',               -- dependency plugin_keys
    installed_by    UUID REFERENCES users(id),
    installed_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plugin_type ON plugin_registry(type);
CREATE INDEX idx_plugin_status ON plugin_registry(status);
CREATE INDEX idx_plugin_category ON plugin_registry(category);

-- Plugin event hooks
CREATE TABLE plugin_hooks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plugin_id       UUID NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
    event_type      VARCHAR(100) NOT NULL,            -- DOCUMENT_UPLOADED, WORKFLOW_TRANSITION, etc.
    handler_url     VARCHAR(500),                     -- webhook or internal handler
    handler_class   VARCHAR(500),                     -- Java class if internal
    priority        INT DEFAULT 100,
    is_active       BOOLEAN DEFAULT TRUE,
    config          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plugin_hooks_event ON plugin_hooks(event_type);
CREATE INDEX idx_plugin_hooks_plugin ON plugin_hooks(plugin_id);

-- -----------------------------------------------------------
-- 4. Industry Solution Templates
-- -----------------------------------------------------------
CREATE TABLE industry_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    industry        VARCHAR(100) NOT NULL,            -- HEALTHCARE, BANKING, LEGAL, MANUFACTURING, PUBLIC_SECTOR
    name            VARCHAR(300) NOT NULL,
    description     TEXT,
    includes        JSONB NOT NULL DEFAULT '{}',      -- { "workflows": [...], "retention_rules": [...], "labels": [...], "plugins": [...] }
    config_defaults JSONB DEFAULT '{}',               -- default settings for this industry
    icon            VARCHAR(50),
    color           VARCHAR(7),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_industry_templates_industry ON industry_templates(industry);

-- -----------------------------------------------------------
-- 5. Seed Jurisdictions & Legal Frameworks
-- -----------------------------------------------------------
INSERT INTO jurisdictions (code, name, region) VALUES
    ('DE', 'Germany', 'Europe'),
    ('AT', 'Austria', 'Europe'),
    ('CH', 'Switzerland', 'Europe'),
    ('EU', 'European Union', 'Europe'),
    ('US', 'United States', 'North America'),
    ('GB', 'United Kingdom', 'Europe'),
    ('FR', 'France', 'Europe'),
    ('NL', 'Netherlands', 'Europe'),
    ('IT', 'Italy', 'Europe'),
    ('ES', 'Spain', 'Europe')
ON CONFLICT (code) DO NOTHING;

-- German legal frameworks
INSERT INTO legal_frameworks (jurisdiction_id, code, name, description, authority, effective_date) VALUES
    ((SELECT id FROM jurisdictions WHERE code='DE'), 'HGB', 'Handelsgesetzbuch', 'German Commercial Code — retention of commercial records', 'Bundesministerium der Justiz', '1897-05-10'),
    ((SELECT id FROM jurisdictions WHERE code='DE'), 'AO', 'Abgabenordnung', 'German Tax Code — retention of tax-relevant documents', 'Bundesministerium der Finanzen', '1977-03-16'),
    ((SELECT id FROM jurisdictions WHERE code='DE'), 'GoBD', 'GoBD', 'Principles for proper management & storage of books, records and documents in electronic form', 'Bundesministerium der Finanzen', '2014-11-14'),
    ((SELECT id FROM jurisdictions WHERE code='DE'), 'BDSG', 'Bundesdatenschutzgesetz', 'Federal Data Protection Act — personal data handling', 'BfDI', '2018-05-25')
ON CONFLICT (jurisdiction_id, code) DO NOTHING;

-- EU frameworks
INSERT INTO legal_frameworks (jurisdiction_id, code, name, description, authority, effective_date) VALUES
    ((SELECT id FROM jurisdictions WHERE code='EU'), 'GDPR', 'General Data Protection Regulation', 'EU-wide data protection and privacy regulation', 'European Commission', '2018-05-25'),
    ((SELECT id FROM jurisdictions WHERE code='EU'), 'EIDAS', 'eIDAS Regulation', 'Electronic identification and trust services', 'European Commission', '2016-07-01')
ON CONFLICT (jurisdiction_id, code) DO NOTHING;

-- US frameworks
INSERT INTO legal_frameworks (jurisdiction_id, code, name, description, authority, effective_date) VALUES
    ((SELECT id FROM jurisdictions WHERE code='US'), 'SOX', 'Sarbanes-Oxley Act', 'Financial record keeping and reporting', 'SEC', '2002-07-30'),
    ((SELECT id FROM jurisdictions WHERE code='US'), 'HIPAA', 'HIPAA', 'Health Insurance Portability and Accountability Act', 'HHS', '1996-08-21'),
    ((SELECT id FROM jurisdictions WHERE code='US'), 'FOIA', 'Freedom of Information Act', 'Federal records access and retention', 'NARA', '1967-07-04')
ON CONFLICT (jurisdiction_id, code) DO NOTHING;

-- UK frameworks
INSERT INTO legal_frameworks (jurisdiction_id, code, name, description, authority, effective_date) VALUES
    ((SELECT id FROM jurisdictions WHERE code='GB'), 'UK_GDPR', 'UK GDPR', 'UK General Data Protection Regulation (post-Brexit)', 'ICO', '2021-01-01'),
    ((SELECT id FROM jurisdictions WHERE code='GB'), 'CA2006', 'Companies Act 2006', 'Company records retention requirements', 'Companies House', '2006-11-08')
ON CONFLICT (jurisdiction_id, code) DO NOTHING;

-- -----------------------------------------------------------
-- 6. Seed Jurisdiction Retention Rules (Germany focus)
-- -----------------------------------------------------------
INSERT INTO jurisdiction_retention_rules (jurisdiction_id, legal_framework_id, document_category, min_retention_years, description, legal_citation, is_mandatory) VALUES
    -- Germany / HGB
    ((SELECT id FROM jurisdictions WHERE code='DE'),
     (SELECT id FROM legal_frameworks WHERE code='HGB' AND jurisdiction_id=(SELECT id FROM jurisdictions WHERE code='DE')),
     'COMMERCIAL_LETTER', 6, 'Commercial letters (sent and received)', '§ 257 Abs. 1 Nr. 2 HGB', TRUE),
    ((SELECT id FROM jurisdictions WHERE code='DE'),
     (SELECT id FROM legal_frameworks WHERE code='HGB' AND jurisdiction_id=(SELECT id FROM jurisdictions WHERE code='DE')),
     'ANNUAL_ACCOUNTS', 10, 'Annual accounts, balance sheets, management reports', '§ 257 Abs. 1 Nr. 1 HGB', TRUE),
    ((SELECT id FROM jurisdictions WHERE code='DE'),
     (SELECT id FROM legal_frameworks WHERE code='HGB' AND jurisdiction_id=(SELECT id FROM jurisdictions WHERE code='DE')),
     'BOOKING_RECORDS', 10, 'Booking vouchers and accounting records', '§ 257 Abs. 1 Nr. 4 HGB', TRUE),
    -- Germany / AO
    ((SELECT id FROM jurisdictions WHERE code='DE'),
     (SELECT id FROM legal_frameworks WHERE code='AO' AND jurisdiction_id=(SELECT id FROM jurisdictions WHERE code='DE')),
     'TAX_RECORDS', 10, 'Tax-relevant documents and records', '§ 147 Abs. 1 AO', TRUE),
    ((SELECT id FROM jurisdictions WHERE code='DE'),
     (SELECT id FROM legal_frameworks WHERE code='AO' AND jurisdiction_id=(SELECT id FROM jurisdictions WHERE code='DE')),
     'INVOICE', 10, 'Invoices (sent and received)', '§ 14b UStG', TRUE),
    -- EU / GDPR
    ((SELECT id FROM jurisdictions WHERE code='EU'),
     (SELECT id FROM legal_frameworks WHERE code='GDPR' AND jurisdiction_id=(SELECT id FROM jurisdictions WHERE code='EU')),
     'PERSONAL_DATA', 0, 'Personal data — delete when purpose fulfilled (Art. 17)', 'Art. 5(1)(e), Art. 17 GDPR', TRUE),
    ((SELECT id FROM jurisdictions WHERE code='EU'),
     (SELECT id FROM legal_frameworks WHERE code='GDPR' AND jurisdiction_id=(SELECT id FROM jurisdictions WHERE code='EU')),
     'CONSENT_RECORDS', 3, 'Records of consent for data processing', 'Art. 7(1) GDPR', TRUE),
    -- US / SOX
    ((SELECT id FROM jurisdictions WHERE code='US'),
     (SELECT id FROM legal_frameworks WHERE code='SOX' AND jurisdiction_id=(SELECT id FROM jurisdictions WHERE code='US')),
     'FINANCIAL_AUDIT', 7, 'Audit work papers and financial records', 'SOX Section 802', TRUE),
    ((SELECT id FROM jurisdictions WHERE code='US'),
     (SELECT id FROM legal_frameworks WHERE code='SOX' AND jurisdiction_id=(SELECT id FROM jurisdictions WHERE code='US')),
     'CORPORATE_EMAIL', 5, 'Corporate communications relating to financials', 'SOX Section 802', TRUE),
    -- US / HIPAA
    ((SELECT id FROM jurisdictions WHERE code='US'),
     (SELECT id FROM legal_frameworks WHERE code='HIPAA' AND jurisdiction_id=(SELECT id FROM jurisdictions WHERE code='US')),
     'MEDICAL_RECORDS', 6, 'Patient health information and medical records', 'HIPAA 45 CFR 164.530(j)', TRUE)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------
-- 7. Seed Workflow Templates
-- -----------------------------------------------------------
INSERT INTO workflow_templates (name, display_name, description, category, industry, states, transitions, initial_state, canvas_layout, icon, color) VALUES
    ('Standard Document Approval',
     'Standard Document Approval',
     'General-purpose document review and approval workflow with correction loop',
     'GENERAL', NULL,
     '{"DRAFT":{"label":"Draft","type":"initial"},"REVIEW":{"label":"Under Review","type":"intermediate"},"PENDING_APPROVAL":{"label":"Pending Approval","type":"intermediate"},"APPROVED":{"label":"Approved","type":"final"},"ARCHIVED":{"label":"Archived","type":"final"},"CORRECTION":{"label":"Correction","type":"intermediate"},"CANCELLED":{"label":"Cancelled","type":"terminal"}}',
     '{"SUBMIT":{"from":"DRAFT","to":"REVIEW"},"SEND_FOR_APPROVAL":{"from":"REVIEW","to":"PENDING_APPROVAL"},"APPROVE":{"from":"PENDING_APPROVAL","to":"APPROVED"},"REJECT":{"from":"PENDING_APPROVAL","to":"CORRECTION"},"REVISE":{"from":"CORRECTION","to":"REVIEW"},"ARCHIVE":{"from":"APPROVED","to":"ARCHIVED"},"CANCEL":{"from":"*","to":"CANCELLED"}}',
     'DRAFT',
     '{"nodes":[{"id":"DRAFT","x":80,"y":250,"w":160,"h":70},{"id":"REVIEW","x":320,"y":250,"w":160,"h":70},{"id":"PENDING_APPROVAL","x":560,"y":250,"w":180,"h":70},{"id":"APPROVED","x":820,"y":200,"w":160,"h":70},{"id":"ARCHIVED","x":1060,"y":200,"w":160,"h":70},{"id":"CORRECTION","x":560,"y":400,"w":160,"h":70},{"id":"CANCELLED","x":820,"y":400,"w":160,"h":70}]}',
     'FileCheck', '#3B82F6'),

    ('Invoice Processing',
     'Invoice Processing',
     'Three-way matching for invoices: receive → verify → approve → post',
     'FINANCE', 'BANKING',
     '{"RECEIVED":{"label":"Received","type":"initial"},"VERIFIED":{"label":"Verified","type":"intermediate"},"PENDING_APPROVAL":{"label":"Pending Approval","type":"intermediate"},"APPROVED":{"label":"Approved","type":"intermediate"},"POSTED":{"label":"Posted to ERP","type":"final"},"DISPUTED":{"label":"Disputed","type":"intermediate"},"CANCELLED":{"label":"Cancelled","type":"terminal"}}',
     '{"VERIFY":{"from":"RECEIVED","to":"VERIFIED"},"SEND_FOR_APPROVAL":{"from":"VERIFIED","to":"PENDING_APPROVAL"},"APPROVE":{"from":"PENDING_APPROVAL","to":"APPROVED"},"POST":{"from":"APPROVED","to":"POSTED"},"DISPUTE":{"from":"VERIFIED","to":"DISPUTED"},"RESOLVE":{"from":"DISPUTED","to":"VERIFIED"},"CANCEL":{"from":"*","to":"CANCELLED"}}',
     'RECEIVED',
     '{"nodes":[{"id":"RECEIVED","x":80,"y":250,"w":160,"h":70},{"id":"VERIFIED","x":320,"y":250,"w":160,"h":70},{"id":"PENDING_APPROVAL","x":560,"y":250,"w":180,"h":70},{"id":"APPROVED","x":800,"y":250,"w":160,"h":70},{"id":"POSTED","x":1040,"y":250,"w":160,"h":70},{"id":"DISPUTED","x":320,"y":400,"w":160,"h":70},{"id":"CANCELLED","x":800,"y":400,"w":160,"h":70}]}',
     'Receipt', '#F59E0B'),

    ('Contract Lifecycle',
     'Contract Lifecycle',
     'Full contract lifecycle from draft to execution and renewal tracking',
     'LEGAL', 'LEGAL',
     '{"DRAFT":{"label":"Draft","type":"initial"},"LEGAL_REVIEW":{"label":"Legal Review","type":"intermediate"},"NEGOTIATION":{"label":"Negotiation","type":"intermediate"},"PENDING_SIGNATURE":{"label":"Pending Signature","type":"intermediate"},"EXECUTED":{"label":"Executed","type":"intermediate"},"ACTIVE":{"label":"Active","type":"intermediate"},"RENEWAL":{"label":"Up for Renewal","type":"intermediate"},"EXPIRED":{"label":"Expired","type":"final"},"TERMINATED":{"label":"Terminated","type":"terminal"}}',
     '{"SUBMIT_FOR_REVIEW":{"from":"DRAFT","to":"LEGAL_REVIEW"},"NEGOTIATE":{"from":"LEGAL_REVIEW","to":"NEGOTIATION"},"SEND_FOR_SIGNATURE":{"from":"NEGOTIATION","to":"PENDING_SIGNATURE"},"EXECUTE":{"from":"PENDING_SIGNATURE","to":"EXECUTED"},"ACTIVATE":{"from":"EXECUTED","to":"ACTIVE"},"FLAG_RENEWAL":{"from":"ACTIVE","to":"RENEWAL"},"RENEW":{"from":"RENEWAL","to":"DRAFT"},"EXPIRE":{"from":"RENEWAL","to":"EXPIRED"},"TERMINATE":{"from":"*","to":"TERMINATED"}}',
     'DRAFT',
     '{"nodes":[{"id":"DRAFT","x":80,"y":250,"w":160,"h":70},{"id":"LEGAL_REVIEW","x":320,"y":250,"w":160,"h":70},{"id":"NEGOTIATION","x":560,"y":250,"w":160,"h":70},{"id":"PENDING_SIGNATURE","x":800,"y":250,"w":180,"h":70},{"id":"EXECUTED","x":1040,"y":250,"w":160,"h":70},{"id":"ACTIVE","x":1040,"y":120,"w":160,"h":70},{"id":"RENEWAL","x":800,"y":120,"w":160,"h":70},{"id":"EXPIRED","x":560,"y":120,"w":160,"h":70},{"id":"TERMINATED","x":320,"y":120,"w":160,"h":70}]}',
     'FileSignature', '#8B5CF6'),

    ('Employee Onboarding',
     'Employee Onboarding',
     'HR onboarding document collection and verification workflow',
     'HR', 'GENERAL',
     '{"PENDING":{"label":"Pending Documents","type":"initial"},"DOCUMENTS_RECEIVED":{"label":"Documents Received","type":"intermediate"},"HR_REVIEW":{"label":"HR Review","type":"intermediate"},"VERIFIED":{"label":"Verified","type":"intermediate"},"COMPLETE":{"label":"Onboarding Complete","type":"final"},"INCOMPLETE":{"label":"Incomplete — Action Required","type":"intermediate"}}',
     '{"RECEIVE":{"from":"PENDING","to":"DOCUMENTS_RECEIVED"},"REVIEW":{"from":"DOCUMENTS_RECEIVED","to":"HR_REVIEW"},"VERIFY":{"from":"HR_REVIEW","to":"VERIFIED"},"COMPLETE":{"from":"VERIFIED","to":"COMPLETE"},"REQUEST_MORE":{"from":"HR_REVIEW","to":"INCOMPLETE"},"RESUBMIT":{"from":"INCOMPLETE","to":"DOCUMENTS_RECEIVED"}}',
     'PENDING',
     '{"nodes":[{"id":"PENDING","x":80,"y":250,"w":180,"h":70},{"id":"DOCUMENTS_RECEIVED","x":340,"y":250,"w":180,"h":70},{"id":"HR_REVIEW","x":600,"y":250,"w":160,"h":70},{"id":"VERIFIED","x":840,"y":250,"w":160,"h":70},{"id":"COMPLETE","x":1080,"y":250,"w":180,"h":70},{"id":"INCOMPLETE","x":600,"y":400,"w":200,"h":70}]}',
     'Users', '#EC4899'),

    ('Patient Record Management',
     'Patient Record Management',
     'Healthcare document intake, review, and archival with HIPAA compliance',
     'COMPLIANCE', 'HEALTHCARE',
     '{"INTAKE":{"label":"Intake","type":"initial"},"CLINICAL_REVIEW":{"label":"Clinical Review","type":"intermediate"},"CODING":{"label":"Medical Coding","type":"intermediate"},"APPROVED":{"label":"Approved","type":"intermediate"},"ARCHIVED":{"label":"Archived (HIPAA)","type":"final"},"FLAGGED":{"label":"Flagged for Review","type":"intermediate"}}',
     '{"SUBMIT":{"from":"INTAKE","to":"CLINICAL_REVIEW"},"CODE":{"from":"CLINICAL_REVIEW","to":"CODING"},"APPROVE":{"from":"CODING","to":"APPROVED"},"ARCHIVE":{"from":"APPROVED","to":"ARCHIVED"},"FLAG":{"from":"CLINICAL_REVIEW","to":"FLAGGED"},"RESOLVE":{"from":"FLAGGED","to":"CLINICAL_REVIEW"}}',
     'INTAKE',
     '{"nodes":[{"id":"INTAKE","x":80,"y":250,"w":160,"h":70},{"id":"CLINICAL_REVIEW","x":320,"y":250,"w":180,"h":70},{"id":"CODING","x":580,"y":250,"w":180,"h":70},{"id":"APPROVED","x":840,"y":250,"w":160,"h":70},{"id":"ARCHIVED","x":1080,"y":250,"w":180,"h":70},{"id":"FLAGGED","x":320,"y":400,"w":180,"h":70}]}',
     'Heart', '#EF4444')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------
-- 8. Seed Industry Templates
-- -----------------------------------------------------------
INSERT INTO industry_templates (industry, name, description, includes, icon, color) VALUES
    ('HEALTHCARE', 'Healthcare & Life Sciences',
     'HIPAA-compliant document management with patient record workflows, medical coding, and 6-year retention policies',
     '{"workflows":["Patient Record Management"],"retention_rules":["MEDICAL_RECORDS"],"labels":["Medical Record","Lab Report","Prescription","Insurance Claim"],"plugins":["apex.connector.hl7","apex.compliance.hipaa"]}',
     'Heart', '#EF4444'),

    ('BANKING', 'Banking & Financial Services',
     'SOX-compliant document management with invoice processing, 7-year financial retention, and audit trail',
     '{"workflows":["Invoice Processing","Standard Document Approval"],"retention_rules":["FINANCIAL_AUDIT","CORPORATE_EMAIL","INVOICE"],"labels":["Financial Report","Audit Paper","Compliance Document","KYC Document"],"plugins":["apex.connector.sap","apex.compliance.sox"]}',
     'Landmark', '#F59E0B'),

    ('LEGAL', 'Legal & Professional Services',
     'Contract lifecycle management with eIDAS signatures, configurable retention by jurisdiction',
     '{"workflows":["Contract Lifecycle","Standard Document Approval"],"retention_rules":["COMMERCIAL_LETTER","CONTRACT"],"labels":["Contract","Legal Opinion","Court Filing","NDA","Power of Attorney"],"plugins":["apex.connector.docusign","apex.compliance.eidas"]}',
     'Scale', '#8B5CF6'),

    ('MANUFACTURING', 'Manufacturing & Engineering',
     'Technical documentation management with quality control workflows and ISO 9001 compliance',
     '{"workflows":["Standard Document Approval"],"retention_rules":["BOOKING_RECORDS","TAX_RECORDS"],"labels":["Technical Spec","Quality Report","Safety Data Sheet","Work Instruction","CAD Drawing"],"plugins":["apex.connector.plm","apex.compliance.iso9001"]}',
     'Factory', '#6366F1'),

    ('PUBLIC_SECTOR', 'Government & Public Sector',
     'Records management with FOIA compliance, strict retention schedules, and multi-level approval workflows',
     '{"workflows":["Standard Document Approval"],"retention_rules":["COMMERCIAL_LETTER","ANNUAL_ACCOUNTS"],"labels":["Public Record","Internal Memo","Policy Document","Citizen Request","Procurement"],"plugins":["apex.compliance.foia","apex.connector.govcloud"]}',
     'Building', '#0EA5E9')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------
-- 9. Seed Default Plugins (marketplace catalog)
-- -----------------------------------------------------------
INSERT INTO plugin_registry (plugin_key, name, description, version, author, type, category, status, capabilities, documentation_url) VALUES
    ('apex.connector.sap', 'SAP ERP Connector', 'Bi-directional document sync with SAP ERP/S4HANA — invoice posting, purchase order attachment, master data linking', '1.0.0', 'Apex Nexus', 'CONNECTOR', 'ERP', 'INACTIVE',
     '["document.import","document.export","metadata.sync","invoice.post"]', '/docs/plugins/sap'),
    ('apex.connector.salesforce', 'Salesforce CRM Connector', 'Attach documents to Salesforce accounts, opportunities, and cases', '1.0.0', 'Apex Nexus', 'CONNECTOR', 'CRM', 'INACTIVE',
     '["document.link","search.external","metadata.sync"]', '/docs/plugins/salesforce'),
    ('apex.connector.docusign', 'DocuSign Integration', 'Send documents for electronic signature via DocuSign', '1.0.0', 'Apex Nexus', 'INTEGRATION', 'SIGNATURE', 'INACTIVE',
     '["signature.request","signature.verify","document.download"]', '/docs/plugins/docusign'),
    ('apex.connector.ms365', 'Microsoft 365 Integration', 'Open and edit documents in Word/Excel/PowerPoint Online, sync with SharePoint', '1.0.0', 'Apex Nexus', 'INTEGRATION', 'PRODUCTIVITY', 'INACTIVE',
     '["document.edit","document.preview","user.sync"]', '/docs/plugins/ms365'),
    ('apex.connector.hl7', 'HL7 FHIR Healthcare Connector', 'Exchange clinical documents via HL7 FHIR standard', '1.0.0', 'Apex Nexus', 'CONNECTOR', 'HEALTHCARE', 'INACTIVE',
     '["document.import","patient.link","fhir.sync"]', '/docs/plugins/hl7'),
    ('apex.compliance.hipaa', 'HIPAA Compliance Pack', 'Automated HIPAA compliance checks, PHI detection, access logging', '1.0.0', 'Apex Nexus', 'INDUSTRY_PACK', 'COMPLIANCE', 'INACTIVE',
     '["scan.phi","audit.hipaa","retention.enforce"]', '/docs/plugins/hipaa'),
    ('apex.compliance.sox', 'SOX Compliance Pack', 'Sarbanes-Oxley compliance monitoring, financial controls, retention enforcement', '1.0.0', 'Apex Nexus', 'INDUSTRY_PACK', 'COMPLIANCE', 'INACTIVE',
     '["audit.sox","retention.enforce","control.monitor"]', '/docs/plugins/sox'),
    ('apex.compliance.iso9001', 'ISO 9001 Quality Pack', 'ISO 9001 QMS document control, CAPA workflows, audit scheduling', '1.0.0', 'Apex Nexus', 'INDUSTRY_PACK', 'QUALITY', 'INACTIVE',
     '["workflow.qms","audit.iso","document.control"]', '/docs/plugins/iso9001'),
    ('apex.connector.plm', 'PLM/CAD Connector', 'Integrate with product lifecycle management systems for engineering drawings', '1.0.0', 'Apex Nexus', 'CONNECTOR', 'ENGINEERING', 'INACTIVE',
     '["document.import","version.sync","bom.link"]', '/docs/plugins/plm'),
    ('apex.ocr.advanced', 'Advanced OCR Engine', 'GPU-accelerated OCR with handwriting recognition and table extraction', '1.0.0', 'Apex Nexus', 'PROCESSOR', 'OCR', 'INACTIVE',
     '["ocr.handwriting","ocr.table","ocr.multilingual"]', '/docs/plugins/advanced-ocr'),
    ('apex.ai.classification', 'AI Document Classification', 'ML-powered document classification using transformer models', '1.0.0', 'Apex Nexus', 'PROCESSOR', 'AI', 'INACTIVE',
     '["classify.ml","classify.train","classify.batch"]', '/docs/plugins/ai-classification'),
    ('apex.compliance.eidas', 'eIDAS Qualified Signatures', 'Qualified electronic signatures compliant with EU eIDAS regulation', '1.0.0', 'Apex Nexus', 'INTEGRATION', 'SIGNATURE', 'INACTIVE',
     '["signature.qualified","certificate.validate","timestamp.authority"]', '/docs/plugins/eidas'),
    ('apex.compliance.foia', 'FOIA Records Pack', 'Freedom of Information Act compliance with automated redaction and release tracking', '1.0.0', 'Apex Nexus', 'INDUSTRY_PACK', 'COMPLIANCE', 'INACTIVE',
     '["redact.auto","release.track","retention.enforce"]', '/docs/plugins/foia'),
    ('apex.connector.govcloud', 'Government Cloud Connector', 'FedRAMP-compliant storage and data residency enforcement', '1.0.0', 'Apex Nexus', 'CONNECTOR', 'CLOUD', 'INACTIVE',
     '["storage.fedramp","residency.enforce","encrypt.fips"]', '/docs/plugins/govcloud')
ON CONFLICT (plugin_key) DO NOTHING;
