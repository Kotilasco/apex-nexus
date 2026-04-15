-- V13: Email Ingestion — IMAP config + rules

CREATE TABLE IF NOT EXISTS email_ingestion_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    imap_host       VARCHAR(255) NOT NULL,
    imap_port       INTEGER NOT NULL DEFAULT 993,
    username        VARCHAR(255) NOT NULL,
    password        VARCHAR(512) NOT NULL,
    folder_name     VARCHAR(255) NOT NULL DEFAULT 'INBOX',
    use_ssl         BOOLEAN NOT NULL DEFAULT TRUE,
    poll_interval   INTEGER NOT NULL DEFAULT 5,          -- minutes
    enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    target_folder_id UUID,                                -- default ECM folder for ingested docs
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_ingestion_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id       UUID NOT NULL REFERENCES email_ingestion_config(id) ON DELETE CASCADE,
    rule_name       VARCHAR(255) NOT NULL,
    rule_type       VARCHAR(50) NOT NULL,                 -- FROM_CONTAINS, FROM_EQUALS, SUBJECT_CONTAINS, SUBJECT_EQUALS, HAS_ATTACHMENT
    rule_value      VARCHAR(500),                         -- match value (null for HAS_ATTACHMENT)
    target_folder_id UUID,                                -- override folder per rule
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_rules_config ON email_ingestion_rules(config_id);
CREATE INDEX idx_email_config_enabled ON email_ingestion_config(enabled);
