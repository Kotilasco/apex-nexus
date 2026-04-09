-- V6: Version Anomaly Detection
-- Adds AI-powered anomaly detection fields to document_versions

ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS anomaly_flagged BOOLEAN DEFAULT false;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS anomaly_score DECIMAL(5,4) DEFAULT 0;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS similarity_score DECIMAL(5,4);
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS anomaly_reasons TEXT;
