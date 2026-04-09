-- V5: ECM Feature Enhancements
-- Adds minor/major versioning, tamper-evident audit chain, WOPI tokens

-- 1. Add version_type to document_versions (MINOR/MAJOR)
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS version_type VARCHAR(10) DEFAULT 'MAJOR' NOT NULL;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS version_label VARCHAR(50);

-- 2. Tamper-evident audit chain columns
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS sequence_number BIGINT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64);

-- Create sequence for audit chain ordering
CREATE SEQUENCE IF NOT EXISTS audit_chain_seq START WITH 1 INCREMENT BY 1;

-- Index for chain integrity verification
CREATE INDEX IF NOT EXISTS idx_audit_chain_sequence ON audit_log (sequence_number) WHERE sequence_number IS NOT NULL;

-- 3. WOPI access tokens table
CREATE TABLE IF NOT EXISTS wopi_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(128) NOT NULL UNIQUE,
    document_id UUID NOT NULL REFERENCES documents(id),
    user_id UUID NOT NULL REFERENCES users(id),
    permissions VARCHAR(20) NOT NULL DEFAULT 'VIEW', -- VIEW, EDIT
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_wopi_permissions CHECK (permissions IN ('VIEW', 'EDIT'))
);

CREATE INDEX IF NOT EXISTS idx_wopi_token ON wopi_access_tokens (token);
CREATE INDEX IF NOT EXISTS idx_wopi_expires ON wopi_access_tokens (expires_at);

-- 4. WebDAV lock tokens table (complements Redis locks for persistence)
CREATE TABLE IF NOT EXISTS webdav_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    user_id UUID NOT NULL REFERENCES users(id),
    lock_token VARCHAR(128) NOT NULL UNIQUE,
    lock_scope VARCHAR(20) NOT NULL DEFAULT 'exclusive',
    lock_depth VARCHAR(10) NOT NULL DEFAULT '0',
    timeout_seconds INTEGER DEFAULT 3600,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webdav_lock_doc ON webdav_locks (document_id);
CREATE INDEX IF NOT EXISTS idx_webdav_lock_token ON webdav_locks (lock_token);
CREATE INDEX IF NOT EXISTS idx_webdav_lock_expires ON webdav_locks (expires_at);
