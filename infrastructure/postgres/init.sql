-- ============================================================
-- Apex Nexus — Database Initialization Script
-- PostgreSQL 16 with Row-Level Security
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SCHEMA: Core Tables
-- ============================================================

-- -----------------------------------------------------------
-- Users & Authentication
-- -----------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(100) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    department      VARCHAR(100),
    is_active       BOOLEAN DEFAULT TRUE,
    is_locked       BOOLEAN DEFAULT FALSE,
    failed_attempts INT DEFAULT 0,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    resource    VARCHAR(100) NOT NULL,
    action      VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    UNIQUE(resource, action)
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- -----------------------------------------------------------
-- Projects (Workspace / Scope Boundary)
-- -----------------------------------------------------------
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL UNIQUE,
    description     TEXT,
    owner_id        UUID NOT NULL REFERENCES users(id),
    metadata_schema JSONB DEFAULT '{}',
    ai_enabled      BOOLEAN DEFAULT TRUE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_owner ON projects(owner_id);

-- -----------------------------------------------------------
-- Project Members — scoped RBAC join table
-- -----------------------------------------------------------
CREATE TABLE project_members (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id),
    permissions_mask BIGINT DEFAULT 0,           -- bitwise permissions
    joined_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_project ON project_members(project_id);

-- -----------------------------------------------------------
-- AI Governance Policies — hierarchical (global > project > user)
-- -----------------------------------------------------------
CREATE TYPE policy_scope AS ENUM ('GLOBAL', 'PROJECT', 'USER');

CREATE TABLE ai_governance_policies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope           policy_scope NOT NULL DEFAULT 'GLOBAL',
    scope_id        UUID,                       -- NULL for GLOBAL, project_id or user_id
    policy_type     VARCHAR(100) NOT NULL,       -- e.g. 'AI_CLASSIFICATION', 'AUTO_TAG', 'CONTENT_GENERATION'
    is_enabled      BOOLEAN DEFAULT TRUE,
    settings        JSONB DEFAULT '{}',          -- detailed config per policy type
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(scope, scope_id, policy_type)
);

CREATE INDEX idx_ai_policies_scope ON ai_governance_policies(scope, scope_id);
CREATE INDEX idx_ai_policies_type ON ai_governance_policies(policy_type);

-- -----------------------------------------------------------
-- Policy Audit Log — tracks who changed what policy when
-- -----------------------------------------------------------
CREATE TABLE policy_audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id       UUID NOT NULL REFERENCES ai_governance_policies(id) ON DELETE CASCADE,
    changed_by      UUID NOT NULL REFERENCES users(id),
    change_type     VARCHAR(20) NOT NULL CHECK (change_type IN ('CREATED','UPDATED','DISABLED','ENABLED','DELETED')),
    old_settings    JSONB,
    new_settings    JSONB,
    reason          TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policy_audit_policy ON policy_audit_log(policy_id);
CREATE INDEX idx_policy_audit_created ON policy_audit_log(created_at);

-- -----------------------------------------------------------
-- Folders (Cabinet Structure)
-- -----------------------------------------------------------
CREATE TABLE folders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    parent_id       UUID REFERENCES folders(id) ON DELETE CASCADE,
    owner_id        UUID NOT NULL REFERENCES users(id),
    project_id      UUID REFERENCES projects(id),
    description     TEXT,
    path            TEXT NOT NULL,
    depth           INT NOT NULL DEFAULT 0,
    is_system       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id, name)
);

CREATE INDEX idx_folders_parent ON folders(parent_id);
CREATE INDEX idx_folders_path ON folders(path);
CREATE INDEX idx_folders_owner ON folders(owner_id);

-- -----------------------------------------------------------
-- Documents (The Vault)
-- -----------------------------------------------------------
CREATE TABLE documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    object_guid         VARCHAR(64) NOT NULL UNIQUE,
    folder_id           UUID REFERENCES folders(id),
    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    mime_type           VARCHAR(255),
    file_extension      VARCHAR(20),
    current_version     INT DEFAULT 1,
    sha256_hash         VARCHAR(64) NOT NULL,
    file_size_bytes     BIGINT NOT NULL,
    storage_key         VARCHAR(500) NOT NULL,
    author_id           UUID NOT NULL REFERENCES users(id),
    status              VARCHAR(30) DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','ARCHIVED',
                                          'PENDING_DESTRUCTION','DESTROYED','LEGAL_HOLD')),
    is_checked_out      BOOLEAN DEFAULT FALSE,
    checked_out_by      UUID REFERENCES users(id),
    checked_out_at      TIMESTAMPTZ,
    retention_start_date TIMESTAMPTZ,
    retention_period_years INT DEFAULT 20,
    retention_expiry    TIMESTAMPTZ,
    legal_hold          BOOLEAN DEFAULT FALSE,
    legal_hold_reason   TEXT,
    legal_hold_by       UUID REFERENCES users(id),
    legal_hold_at       TIMESTAMPTZ,
    tags                TEXT[],
    metadata_json       JSONB DEFAULT '{}',
    project_id          UUID REFERENCES projects(id),
    ai_generated        BOOLEAN DEFAULT FALSE,
    ai_confidence       NUMERIC(5,4),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_folder ON documents(folder_id);
CREATE INDEX idx_documents_author ON documents(author_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_retention ON documents(retention_expiry);
CREATE INDEX idx_documents_legal_hold ON documents(legal_hold) WHERE legal_hold = TRUE;
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX idx_documents_metadata ON documents USING GIN(metadata_json);
CREATE INDEX idx_documents_object_guid ON documents(object_guid);
CREATE INDEX idx_documents_checked_out ON documents(is_checked_out) WHERE is_checked_out = TRUE;

-- -----------------------------------------------------------
-- Document Versions
-- -----------------------------------------------------------
CREATE TABLE document_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    sha256_hash     VARCHAR(64) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    storage_key     VARCHAR(500) NOT NULL,
    author_id       UUID NOT NULL REFERENCES users(id),
    change_summary  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, version_number)
);

CREATE INDEX idx_doc_versions_document ON document_versions(document_id);

-- -----------------------------------------------------------
-- Document Notes (like ELO sticky notes)
-- -----------------------------------------------------------
CREATE TABLE document_notes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    note_type       VARCHAR(30) DEFAULT 'GENERAL'
                    CHECK (note_type IN ('GENERAL','IMPORTANT','REVIEW','PRIVATE','SYSTEM')),
    is_pinned       BOOLEAN DEFAULT FALSE,
    color           VARCHAR(7) DEFAULT '#FFEB3B',
    parent_note_id  UUID REFERENCES document_notes(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_notes_document ON document_notes(document_id);
CREATE INDEX idx_doc_notes_author ON document_notes(author_id);

-- -----------------------------------------------------------
-- Document Links (Related Documents)
-- -----------------------------------------------------------
CREATE TABLE document_links (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_doc_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    target_doc_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    link_type       VARCHAR(30) DEFAULT 'RELATED'
                    CHECK (link_type IN ('RELATED','SUPERSEDES','AMENDMENT','ATTACHMENT','REVISION_OF')),
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_doc_id, target_doc_id, link_type)
);

-- -----------------------------------------------------------
-- Folder & Document Permissions (RBAC at item level)
-- -----------------------------------------------------------
CREATE TABLE folder_permissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_id   UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    grantee_id  UUID NOT NULL,
    grantee_type VARCHAR(10) NOT NULL CHECK (grantee_type IN ('USER','ROLE')),
    permission  VARCHAR(20) NOT NULL CHECK (permission IN ('READ','WRITE','DELETE','MANAGE')),
    granted_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(folder_id, grantee_id, grantee_type, permission)
);

CREATE TABLE document_permissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    grantee_id  UUID NOT NULL,
    grantee_type VARCHAR(10) NOT NULL CHECK (grantee_type IN ('USER','ROLE')),
    permission  VARCHAR(20) NOT NULL CHECK (permission IN ('READ','WRITE','DELETE','MANAGE')),
    granted_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, grantee_id, grantee_type, permission)
);

-- -----------------------------------------------------------
-- Workflows
-- -----------------------------------------------------------
CREATE TABLE workflow_definitions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    states          JSONB NOT NULL,
    transitions     JSONB NOT NULL,
    required_roles  JSONB DEFAULT '[]',          -- role-based quorum config
    initial_state   VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    human_review_required BOOLEAN DEFAULT FALSE, -- AI actions need human sign-off
    escalation_rules JSONB DEFAULT '[]',          -- SLA/escalation config per state
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_instances (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    definition_id       UUID NOT NULL REFERENCES workflow_definitions(id),
    document_id         UUID NOT NULL REFERENCES documents(id),
    project_id          UUID REFERENCES projects(id),
    current_state       VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    initiated_by        UUID NOT NULL REFERENCES users(id),
    actor_type          VARCHAR(10) DEFAULT 'HUMAN' CHECK (actor_type IN ('HUMAN','AI_SERVICE')),
    assigned_to         UUID REFERENCES users(id),
    assigned_group      UUID,
    required_approvals  INT DEFAULT 1,
    current_approvals   INT DEFAULT 0,
    priority            INT DEFAULT 0,
    due_date            TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    correction_count    INT DEFAULT 0,
    rejected_document_hash VARCHAR(64),
    rejection_comments  TEXT,
    parent_instance_id  UUID,
    escalation_level    INT DEFAULT 0,
    escalated_at        TIMESTAMPTZ,
    sla_deadline        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wf_instances_document ON workflow_instances(document_id);
CREATE INDEX idx_wf_instances_state ON workflow_instances(current_state);
CREATE INDEX idx_wf_instances_assigned ON workflow_instances(assigned_to);

CREATE TABLE workflow_transitions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id     UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    from_state      VARCHAR(50) NOT NULL,
    to_state        VARCHAR(50) NOT NULL,
    action          VARCHAR(50) NOT NULL,
    performed_by    UUID NOT NULL REFERENCES users(id),
    comments        TEXT,
    version_at_transition INT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wf_transitions_instance ON workflow_transitions(instance_id);

-- Parallel approval tracking
CREATE TABLE workflow_approvals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id     UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    approver_id     UUID NOT NULL REFERENCES users(id),
    approval_order  INT DEFAULT 0,
    is_parallel     BOOLEAN DEFAULT FALSE,
    group_id        UUID,
    decision        VARCHAR(20) CHECK (decision IN ('PENDING','APPROVED','REJECTED')),
    comments        TEXT,
    decided_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(instance_id, approver_id)
);

-- -----------------------------------------------------------
-- Approval Groups
-- -----------------------------------------------------------
CREATE TABLE approval_groups (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    required_approvals INT DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE approval_group_members (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id    UUID NOT NULL REFERENCES approval_groups(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (group_id, user_id)
);

-- -----------------------------------------------------------
-- Retention Policies
-- -----------------------------------------------------------
CREATE TABLE retention_policies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL UNIQUE,
    description     TEXT,
    retention_years INT NOT NULL,
    auto_dispose    BOOLEAN DEFAULT FALSE,
    requires_approval BOOLEAN DEFAULT TRUE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE disposition_queue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id),
    document_title  VARCHAR(500),
    policy_id       UUID REFERENCES retention_policies(id),
    retention_expires_at TIMESTAMPTZ,
    scheduled_destruction_date TIMESTAMPTZ,
    status          VARCHAR(30) DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','APPROVED','REJECTED','DESTROYED')),
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    destroyed_at    TIMESTAMPTZ,
    reason          TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disposition_status ON disposition_queue(status);

-- -----------------------------------------------------------
-- Audit Log (Immutable)
-- -----------------------------------------------------------
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    actor_type      VARCHAR(10) DEFAULT 'HUMAN' CHECK (actor_type IN ('HUMAN','AI_SERVICE')),
    action          VARCHAR(50) NOT NULL,
    resource_type   VARCHAR(50) NOT NULL,
    resource_id     UUID,
    resource_name   VARCHAR(500),
    project_id      UUID REFERENCES projects(id),
    details         JSONB,
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    session_id      VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_actor_type ON audit_log(actor_type);
CREATE INDEX idx_audit_project ON audit_log(project_id);
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_folders_project ON folders(project_id);
CREATE INDEX idx_wf_instances_project ON workflow_instances(project_id);

-- Make audit_log append-only (no UPDATE or DELETE)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log records cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable_update
    BEFORE UPDATE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER audit_log_immutable_delete
    BEFORE DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- -----------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    type            VARCHAR(30) DEFAULT 'INFO'
                    CHECK (type IN ('INFO','WARNING','ACTION_REQUIRED','APPROVAL','SYSTEM')),
    resource_type   VARCHAR(50),
    resource_id     UUID,
    is_read         BOOLEAN DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    email_sent      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- -----------------------------------------------------------
-- Bookmarks / Favorites
-- -----------------------------------------------------------
CREATE TABLE bookmarks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    folder_id   UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CHECK (document_id IS NOT NULL OR folder_id IS NOT NULL)
);

-- -----------------------------------------------------------
-- Offline Sync Tracking
-- -----------------------------------------------------------
CREATE TABLE offline_pins (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    folder_id   UUID REFERENCES folders(id) ON DELETE CASCADE,
    last_synced_at TIMESTAMPTZ,
    sync_version INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CHECK (document_id IS NOT NULL OR folder_id IS NOT NULL)
);

-- -----------------------------------------------------------
-- Full-Text Search Sync Tracking
-- -----------------------------------------------------------
CREATE TABLE search_index_queue (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    action      VARCHAR(10) NOT NULL CHECK (action IN ('INDEX','UPDATE','DELETE')),
    status      VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
    attempts    INT DEFAULT 0,
    error       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_queue_status ON search_index_queue(status);

-- -----------------------------------------------------------
-- Tags
-- -----------------------------------------------------------
CREATE TABLE tags (
    id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name    VARCHAR(100) NOT NULL UNIQUE,
    color   VARCHAR(7) DEFAULT '#2196F3',
    usage_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- User Sessions (for Redis backup)
-- -----------------------------------------------------------
CREATE TABLE user_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(64) NOT NULL,
    device_info     JSONB,
    ip_address      INET,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_expiry ON user_sessions(expires_at);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see documents they have permissions to
CREATE POLICY documents_select_policy ON documents
    FOR SELECT
    USING (
        author_id = current_setting('app.current_user_id')::UUID
        OR EXISTS (
            SELECT 1 FROM document_permissions dp
            WHERE dp.document_id = documents.id
            AND dp.grantee_id = current_setting('app.current_user_id')::UUID
        )
        OR EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = current_setting('app.current_user_id')::UUID
            AND p.resource = 'DOCUMENT' AND p.action = 'READ_ALL'
        )
    );

-- Policy: Folder visibility
CREATE POLICY folders_select_policy ON folders
    FOR SELECT
    USING (
        owner_id = current_setting('app.current_user_id')::UUID
        OR EXISTS (
            SELECT 1 FROM folder_permissions fp
            WHERE fp.folder_id = folders.id
            AND fp.grantee_id = current_setting('app.current_user_id')::UUID
        )
        OR EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = current_setting('app.current_user_id')::UUID
            AND p.resource = 'FOLDER' AND p.action = 'READ_ALL'
        )
    );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at
    BEFORE UPDATE ON folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON document_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-calculate retention_expiry
CREATE OR REPLACE FUNCTION calculate_retention_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.retention_start_date IS NOT NULL AND NEW.retention_period_years IS NOT NULL THEN
        NEW.retention_expiry = NEW.retention_start_date + (NEW.retention_period_years || ' years')::INTERVAL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_retention_expiry
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION calculate_retention_expiry();

-- ============================================================
-- VIEWS
-- ============================================================

CREATE VIEW v_documents_with_author AS
SELECT
    d.*,
    u.first_name || ' ' || u.last_name AS author_name,
    u.email AS author_email
FROM documents d
JOIN users u ON d.author_id = u.id;

CREATE VIEW v_pending_dispositions AS
SELECT
    dq.*,
    d.object_guid,
    d.author_id,
    d.file_size_bytes,
    u.first_name || ' ' || u.last_name AS author_name
FROM disposition_queue dq
JOIN documents d ON dq.document_id = d.id
JOIN users u ON d.author_id = u.id
WHERE dq.status = 'PENDING';

CREATE VIEW v_active_workflows AS
SELECT
    wi.*,
    wd.name AS workflow_name,
    d.title AS document_title,
    u_init.first_name || ' ' || u_init.last_name AS initiated_by_name,
    u_assign.first_name || ' ' || u_assign.last_name AS assigned_to_name
FROM workflow_instances wi
JOIN workflow_definitions wd ON wi.definition_id = wd.id
JOIN documents d ON wi.document_id = d.id
JOIN users u_init ON wi.initiated_by = u_init.id
LEFT JOIN users u_assign ON wi.assigned_to = u_assign.id
WHERE wi.completed_at IS NULL;
