-- V4: Create missing tables for document-service, workflow-service, retention-service

-- 1. document_signatures
CREATE TABLE IF NOT EXISTS document_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    version_id UUID,
    signer_id UUID NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'PENDING',
    provider VARCHAR(255) NOT NULL DEFAULT 'INTERNAL',
    certificate_data TEXT,
    signed_hash TEXT,
    signed_at TIMESTAMP,
    external_reference VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. workflow_templates
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(255),
    industry VARCHAR(255),
    states JSONB,
    transitions JSONB,
    initial_state VARCHAR(255),
    canvas_layout JSONB,
    icon VARCHAR(255),
    color VARCHAR(255),
    estimated_duration_hours INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. workflow_forwards
CREATE TABLE IF NOT EXISTS workflow_forwards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    workflow_instance_id UUID,
    forwarded_by UUID NOT NULL,
    forwarded_to UUID NOT NULL,
    message TEXT,
    action_required VARCHAR(50) DEFAULT 'REVIEW',
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    response TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. jurisdictions (must be created before legal_frameworks and jurisdiction_retention_rules)
CREATE TABLE IF NOT EXISTS jurisdictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. legal_frameworks (depends on jurisdictions)
CREATE TABLE IF NOT EXISTS legal_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction_id UUID NOT NULL REFERENCES jurisdictions(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    authority VARCHAR(255),
    effective_date DATE,
    url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. jurisdiction_retention_rules (depends on jurisdictions and legal_frameworks)
CREATE TABLE IF NOT EXISTS jurisdiction_retention_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction_id UUID NOT NULL REFERENCES jurisdictions(id),
    legal_framework_id UUID REFERENCES legal_frameworks(id),
    document_category VARCHAR(100) NOT NULL,
    min_retention_years INTEGER NOT NULL,
    max_retention_years INTEGER,
    description TEXT,
    legal_citation VARCHAR(500),
    penalty_info TEXT,
    is_mandatory BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
