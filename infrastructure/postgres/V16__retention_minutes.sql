-- V16: Add minute-based retention for testing/demo and ensure retention_expiry is populated
-- Adds retention_period_minutes column for short retention periods (demo/testing)
-- Backfills retention_expiry for all documents that have retention_start_date but no expiry

ALTER TABLE documents ADD COLUMN IF NOT EXISTS retention_period_minutes INTEGER;

-- Backfill retention_expiry for existing documents that have retention_start_date but no expiry calculated
UPDATE documents
SET retention_expiry = retention_start_date + (retention_period_years * INTERVAL '1 year')
WHERE retention_start_date IS NOT NULL
  AND retention_expiry IS NULL
  AND retention_period_years IS NOT NULL;
