-- V12: Add extracted_content column for PII redaction preview
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_content TEXT;
