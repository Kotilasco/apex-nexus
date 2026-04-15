-- V15: Add project_id to email ingestion config
ALTER TABLE email_ingestion_config ADD COLUMN IF NOT EXISTS project_id UUID;
