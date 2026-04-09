CREATE TABLE IF NOT EXISTS document_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    created_by UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    password_hash VARCHAR(255),
    max_downloads INTEGER,
    download_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    allow_preview BOOLEAN DEFAULT true,
    allow_download BOOLEAN DEFAULT true,
    ip_whitelist TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS industry_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    industry VARCHAR(255),
    included_plugins JSONB,
    default_workflows JSONB,
    retention_rules JSONB,
    compliance_frameworks JSONB,
    icon_url VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);
