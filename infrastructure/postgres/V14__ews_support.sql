-- V14: EWS (Exchange Web Services) protocol support

ALTER TABLE email_ingestion_config ADD COLUMN IF NOT EXISTS protocol VARCHAR(10) NOT NULL DEFAULT 'IMAP';
ALTER TABLE email_ingestion_config ADD COLUMN IF NOT EXISTS ews_url VARCHAR(500);

-- Make IMAP-specific fields nullable (not needed for EWS)
ALTER TABLE email_ingestion_config ALTER COLUMN imap_host DROP NOT NULL;
ALTER TABLE email_ingestion_config ALTER COLUMN imap_port DROP NOT NULL;
ALTER TABLE email_ingestion_config ALTER COLUMN use_ssl DROP NOT NULL;
