-- SAP Integration + Mock SAP Service
-- This migration adds the tables needed to demo the SAP ↔ Apex Nexus "Power Couple".
-- In production these tables are replaced by real SAP calls (OData/RFC/BAPI).
-- For the POC the mock tables simulate an SAP S/4HANA system end-to-end.

-- ─────────────────────────────────────────────────────────────
-- MOCK SAP SIDE (pretends to be inside SAP)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sap_purchase_orders (
    po_number        VARCHAR(32) PRIMARY KEY,
    vendor_code      VARCHAR(32) NOT NULL,
    vendor_name      VARCHAR(200) NOT NULL,
    description      VARCHAR(500),
    amount           NUMERIC(14,2) NOT NULL,
    currency         VARCHAR(3) DEFAULT 'USD',
    status           VARCHAR(32) DEFAULT 'OPEN',   -- OPEN | CLOSED | CANCELLED
    delivery_date    DATE,
    created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sap_invoices (
    invoice_id       VARCHAR(32) PRIMARY KEY,
    po_number        VARCHAR(32) REFERENCES sap_purchase_orders(po_number),
    apex_document_id UUID,                         -- pointer back to Apex doc (the PDF)
    vendor_name      VARCHAR(200),
    amount           NUMERIC(14,2),
    currency         VARCHAR(3) DEFAULT 'USD',
    status           VARCHAR(32) DEFAULT 'SUBMITTED', -- SUBMITTED | MATCHED | PARKED | POSTED | DISPUTED
    match_details    JSONB,
    posted_at        TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sap_invoices_doc ON sap_invoices(apex_document_id);
CREATE INDEX IF NOT EXISTS idx_sap_invoices_po  ON sap_invoices(po_number);

CREATE TABLE IF NOT EXISTS sap_assets (
    equipment_id         VARCHAR(32) PRIMARY KEY,  -- SAP PM "Equipment"
    functional_location  VARCHAR(64) NOT NULL,     -- SAP PM "Functional Location"
    name                 VARCHAR(200) NOT NULL,
    asset_type           VARCHAR(64),              -- METER | TRANSFORMER | SUBSTATION | VEHICLE
    site                 VARCHAR(200),
    status               VARCHAR(32) DEFAULT 'IN_SERVICE',
    installed_on         DATE,
    created_at           TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- APEX SIDE (the link table — ArchiveLink equivalent)
-- ─────────────────────────────────────────────────────────────
-- Generic SAP object linkage: SAP BOR object type + key ↔ Apex document
-- Examples:
--   ar_object=BUS2081 key=5105600123 (FI invoice)
--   ar_object=EQUI    key=10000042   (Equipment)
--   ar_object=IFLOT   key=NGZ-SUB-001 (Functional Location)

CREATE TABLE IF NOT EXISTS sap_object_links (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    sap_system     VARCHAR(32) DEFAULT 'MOCK-S4H',
    ar_object      VARCHAR(32) NOT NULL,           -- SAP BOR object type
    object_key     VARCHAR(128) NOT NULL,          -- the SAP document/equipment id
    link_type      VARCHAR(32) DEFAULT 'ATTACHMENT', -- ATTACHMENT | ORIGINAL | RENDITION
    document_class VARCHAR(10) DEFAULT 'PDF',      -- PDF | JPG | ...
    archive_id     VARCHAR(10) DEFAULT 'APX',      -- ArchiveLink archive id
    linked_by      UUID,
    linked_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sap_links_obj ON sap_object_links(ar_object, object_key);
CREATE INDEX IF NOT EXISTS idx_sap_links_doc ON sap_object_links(document_id);

-- ─────────────────────────────────────────────────────────────
-- MOCK SEED DATA (ZETDC-flavoured)
-- ─────────────────────────────────────────────────────────────
INSERT INTO sap_purchase_orders (po_number, vendor_code, vendor_name, description, amount, currency, status, delivery_date) VALUES
 ('4500012001', 'V-ACME-01', 'Acme Power Systems Ltd', '33kV Distribution Transformer — 500 kVA',  42500.00, 'USD', 'OPEN', CURRENT_DATE + 14),
 ('4500012002', 'V-ELEC-11', 'ElectroMax Zimbabwe',     'Pole-mount transformers (batch of 12)',  78200.00, 'USD', 'OPEN', CURRENT_DATE + 21),
 ('4500012003', 'V-SMRT-07', 'SmartGrid Meters SA',     'Smart meters — AMI 3G, 2000 units',     156000.00, 'USD', 'OPEN', CURRENT_DATE + 30),
 ('4500012004', 'V-BETA-22', 'Beta Cables & Conductors','Aluminium conductor ACSR 120mm²',         31875.50, 'USD', 'OPEN', CURRENT_DATE + 10),
 ('4500012005', 'V-SIEM-01', 'Siemens Energy SA',       'SCADA RTU upgrade kits',                 98400.00, 'USD', 'OPEN', CURRENT_DATE + 45)
ON CONFLICT (po_number) DO NOTHING;

INSERT INTO sap_assets (equipment_id, functional_location, name, asset_type, site, status, installed_on) VALUES
 ('EQ-10000042', 'NGZ-SUB-001', 'Substation Transformer T1', 'TRANSFORMER', 'Ngezi Substation',    'IN_SERVICE', '2019-03-15'),
 ('EQ-10000043', 'NGZ-SUB-001', 'Substation Transformer T2', 'TRANSFORMER', 'Ngezi Substation',    'IN_SERVICE', '2019-03-15'),
 ('EQ-10000099', 'HRE-DIST-14', 'Pole-mount Xfmr Warren Park','TRANSFORMER', 'Harare Warren Park', 'FAULT',      '2021-07-22'),
 ('EQ-10000200', 'BUL-METER-A', 'Smart Meter Bulawayo A',    'METER',       'Bulawayo West',       'IN_SERVICE', '2023-01-10'),
 ('EQ-10000201', 'BUL-METER-A', 'Smart Meter Bulawayo B',    'METER',       'Bulawayo West',       'IN_SERVICE', '2023-01-10'),
 ('EQ-10000500', 'MUT-SUB-003', 'SCADA RTU Mutare',          'RTU',         'Mutare Substation',   'IN_SERVICE', '2020-11-05')
ON CONFLICT (equipment_id) DO NOTHING;
