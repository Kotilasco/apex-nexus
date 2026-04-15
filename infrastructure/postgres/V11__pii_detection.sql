-- V11: Add PII detection columns to documents table
-- Enables automatic PII scanning results to be stored directly on documents

ALTER TABLE documents ADD COLUMN IF NOT EXISTS pii_detected BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pii_severity VARCHAR(20);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pii_types TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pii_scan_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_documents_pii ON documents(pii_detected) WHERE pii_detected = TRUE;
