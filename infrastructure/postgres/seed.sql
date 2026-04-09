-- ============================================================
-- Apex Nexus — Seed Data for Development
-- ============================================================

-- Default Roles
INSERT INTO roles (id, name, description) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'SYSTEM_ADMIN', 'Full system administration access'),
    ('a0000000-0000-0000-0000-000000000002', 'RECORDS_MANAGER', 'Manages retention policies and disposition'),
    ('a0000000-0000-0000-0000-000000000003', 'DEPARTMENT_ADMIN', 'Department-level administration'),
    ('a0000000-0000-0000-0000-000000000004', 'APPROVER', 'Can approve/reject documents in workflows'),
    ('a0000000-0000-0000-0000-000000000005', 'AUTHOR', 'Can create and edit documents'),
    ('a0000000-0000-0000-0000-000000000006', 'VIEWER', 'Read-only access to assigned documents');

-- Default Permissions
INSERT INTO permissions (id, name, resource, action, description) VALUES
    (uuid_generate_v4(), 'document.create', 'DOCUMENT', 'CREATE', 'Create new documents'),
    (uuid_generate_v4(), 'document.read', 'DOCUMENT', 'READ', 'Read assigned documents'),
    (uuid_generate_v4(), 'document.read_all', 'DOCUMENT', 'READ_ALL', 'Read all documents'),
    (uuid_generate_v4(), 'document.update', 'DOCUMENT', 'UPDATE', 'Edit assigned documents'),
    (uuid_generate_v4(), 'document.delete', 'DOCUMENT', 'DELETE', 'Delete documents'),
    (uuid_generate_v4(), 'document.checkout', 'DOCUMENT', 'CHECKOUT', 'Check-out documents'),
    (uuid_generate_v4(), 'document.approve', 'DOCUMENT', 'APPROVE', 'Approve documents in workflow'),
    (uuid_generate_v4(), 'folder.create', 'FOLDER', 'CREATE', 'Create folders'),
    (uuid_generate_v4(), 'folder.read', 'FOLDER', 'READ', 'Read assigned folders'),
    (uuid_generate_v4(), 'folder.read_all', 'FOLDER', 'READ_ALL', 'Read all folders'),
    (uuid_generate_v4(), 'folder.update', 'FOLDER', 'UPDATE', 'Edit folder properties'),
    (uuid_generate_v4(), 'folder.delete', 'FOLDER', 'DELETE', 'Delete folders'),
    (uuid_generate_v4(), 'retention.manage', 'RETENTION', 'MANAGE', 'Manage retention policies'),
    (uuid_generate_v4(), 'retention.approve_destruction', 'RETENTION', 'APPROVE_DESTRUCTION', 'Approve document destruction'),
    (uuid_generate_v4(), 'workflow.manage', 'WORKFLOW', 'MANAGE', 'Manage workflow definitions'),
    (uuid_generate_v4(), 'admin.users', 'ADMIN', 'MANAGE_USERS', 'Manage user accounts'),
    (uuid_generate_v4(), 'admin.audit', 'ADMIN', 'VIEW_AUDIT', 'View audit logs'),
    (uuid_generate_v4(), 'admin.system', 'ADMIN', 'SYSTEM_CONFIG', 'System configuration');

-- Assign all permissions to SYSTEM_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000001', id FROM permissions;

-- Default admin user (password: Admin@2024! — bcrypt hash)
INSERT INTO users (id, username, email, password_hash, first_name, last_name, department) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'admin', 'admin@apexnexus.local',
     '$2a$12$zfVPlEpmf8MtxQNLSkdwbumo0j5B.2Fb3bDX2a5yHYuURENh2z3b6',
     'System', 'Administrator', 'IT');

INSERT INTO user_roles (user_id, role_id) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001');

-- Default folder structure
INSERT INTO folders (id, name, parent_id, owner_id, description, path, depth, is_system) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Root', NULL,
     'b0000000-0000-0000-0000-000000000001', 'Root folder', '/Root', 0, TRUE),
    ('c0000000-0000-0000-0000-000000000002', 'Shared Documents', 'c0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000001', 'Company shared documents', '/Root/Shared Documents', 1, TRUE),
    ('c0000000-0000-0000-0000-000000000003', 'Templates', 'c0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000001', 'Document templates', '/Root/Templates', 1, TRUE),
    ('c0000000-0000-0000-0000-000000000004', 'Archive', 'c0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000001', 'Archived documents', '/Root/Archive', 1, TRUE);

-- Default workflow definition (Standard Approval)
INSERT INTO workflow_definitions (id, name, description, states, transitions, initial_state, escalation_rules, is_active, created_by) VALUES
    ('d0000000-0000-0000-0000-000000000001',
     'Standard Approval',
     'Standard document review and approval workflow with escalation',
     '["DRAFT","REVIEW","PENDING_APPROVAL","APPROVED","CORRECTION","ARCHIVED","CANCELLED"]'::JSONB,
     '[
        {"from":"DRAFT","to":"REVIEW","action":"submit","requiredRole":"AUTHOR"},
        {"from":"REVIEW","to":"PENDING_APPROVAL","action":"approve","requiredRole":"REVIEWER"},
        {"from":"REVIEW","to":"CORRECTION","action":"reject","requiredRole":"REVIEWER"},
        {"from":"PENDING_APPROVAL","to":"APPROVED","action":"approve","requiredRole":"APPROVER"},
        {"from":"PENDING_APPROVAL","to":"CORRECTION","action":"reject","requiredRole":"APPROVER"},
        {"from":"CORRECTION","to":"REVIEW","action":"resubmit","requiredRole":"AUTHOR"},
        {"from":"APPROVED","to":"ARCHIVED","action":"archive","requiredRole":"RECORDS_MANAGER"}
     ]'::JSONB,
     'DRAFT',
     '[
        {"state":"REVIEW","slaHours":48,"maxLevel":3,"notifyRole":"MANAGER"},
        {"state":"PENDING_APPROVAL","slaHours":72,"maxLevel":2,"notifyRole":"DIRECTOR"}
     ]'::JSONB,
     TRUE,
     'b0000000-0000-0000-0000-000000000001');

-- Fast Track Approval (simplified 2-step workflow)
INSERT INTO workflow_definitions (id, name, description, states, transitions, initial_state, escalation_rules, is_active, created_by) VALUES
    ('d0000000-0000-0000-0000-000000000002',
     'Fast Track Approval',
     'Expedited approval for low-risk documents — skip multi-stage review',
     '["DRAFT","REVIEW","APPROVED","CORRECTION","ARCHIVED","CANCELLED"]'::JSONB,
     '[
        {"from":"DRAFT","to":"REVIEW","action":"submit","requiredRole":"AUTHOR"},
        {"from":"REVIEW","to":"APPROVED","action":"approve","requiredRole":"APPROVER"},
        {"from":"REVIEW","to":"CORRECTION","action":"reject","requiredRole":"APPROVER"},
        {"from":"CORRECTION","to":"REVIEW","action":"resubmit","requiredRole":"AUTHOR"},
        {"from":"APPROVED","to":"ARCHIVED","action":"archive","requiredRole":"RECORDS_MANAGER"}
     ]'::JSONB,
     'DRAFT',
     '[
        {"state":"REVIEW","slaHours":24,"maxLevel":2,"notifyRole":"MANAGER"}
     ]'::JSONB,
     TRUE,
     'b0000000-0000-0000-0000-000000000001');

-- Multi-Stage Review (4-level approval chain)
INSERT INTO workflow_definitions (id, name, description, states, transitions, initial_state, escalation_rules, is_active, created_by) VALUES
    ('d0000000-0000-0000-0000-000000000003',
     'Multi-Stage Review',
     'Comprehensive review with peer review, manager approval, and compliance sign-off',
     '["DRAFT","REVIEW","PENDING_APPROVAL","APPROVED","CORRECTION","ARCHIVED","CANCELLED"]'::JSONB,
     '[
        {"from":"DRAFT","to":"REVIEW","action":"submit","requiredRole":"AUTHOR"},
        {"from":"REVIEW","to":"PENDING_APPROVAL","action":"approve","requiredRole":"PEER_REVIEWER"},
        {"from":"REVIEW","to":"CORRECTION","action":"reject","requiredRole":"PEER_REVIEWER"},
        {"from":"PENDING_APPROVAL","to":"APPROVED","action":"approve","requiredRole":"COMPLIANCE_OFFICER"},
        {"from":"PENDING_APPROVAL","to":"CORRECTION","action":"reject","requiredRole":"COMPLIANCE_OFFICER"},
        {"from":"CORRECTION","to":"REVIEW","action":"resubmit","requiredRole":"AUTHOR"},
        {"from":"APPROVED","to":"ARCHIVED","action":"archive","requiredRole":"RECORDS_MANAGER"}
     ]'::JSONB,
     'DRAFT',
     '[
        {"state":"REVIEW","slaHours":48,"maxLevel":3,"notifyRole":"TEAM_LEAD"},
        {"state":"PENDING_APPROVAL","slaHours":96,"maxLevel":2,"notifyRole":"DEPARTMENT_HEAD"}
     ]'::JSONB,
     TRUE,
     'b0000000-0000-0000-0000-000000000001');

-- Default retention policies
INSERT INTO retention_policies (id, name, description, retention_years, is_active) VALUES
    (uuid_generate_v4(), 'Standard 7-Year', 'Standard business document retention', 7, TRUE),
    (uuid_generate_v4(), 'Regulatory 20-Year', 'Regulatory compliance documents', 20, TRUE),
    (uuid_generate_v4(), 'Permanent', 'Permanent retention — never auto-dispose', 999, TRUE);

-- Default tags
INSERT INTO tags (name, color) VALUES
    ('Confidential', '#F44336'),
    ('Urgent', '#FF9800'),
    ('Contract', '#4CAF50'),
    ('Policy', '#2196F3'),
    ('Invoice', '#9C27B0'),
    ('Report', '#00BCD4'),
    ('Template', '#795548'),
    ('Legal', '#F44336'),
    ('HR', '#E91E63'),
    ('Finance', '#FF5722');

-- ==========================================================
-- Governance & AI Trust Seed Data
-- ==========================================================

-- Default project
INSERT INTO projects (id, name, description, owner_id, ai_enabled) VALUES
    ('e0000000-0000-0000-0000-000000000001', 'Default Project',
     'Default workspace for all documents',
     'b0000000-0000-0000-0000-000000000001', TRUE);

-- Admin as project member
INSERT INTO project_members (project_id, user_id, role_id, permissions_mask) VALUES
    ('e0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     9223372036854775807);  -- all bits set

-- Global AI Governance Policies
INSERT INTO ai_governance_policies (id, scope, scope_id, policy_type, is_enabled, settings, created_by) VALUES
    ('f0000000-0000-0000-0000-000000000001', 'GLOBAL', NULL, 'AI_CLASSIFICATION',
     TRUE, '{"confidence_threshold": 0.85, "auto_apply": false, "require_human_review": true}'::JSONB,
     'b0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000002', 'GLOBAL', NULL, 'AUTO_TAG',
     TRUE, '{"max_tags": 5, "confidence_threshold": 0.80, "require_human_review": false}'::JSONB,
     'b0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000003', 'GLOBAL', NULL, 'CONTENT_GENERATION',
     FALSE, '{"allowed_models": ["gpt-4"], "max_tokens": 2000, "audit_all": true}'::JSONB,
     'b0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000004', 'GLOBAL', NULL, 'AI_SEARCH_ASSIST',
     TRUE, '{"semantic_search": true, "summarization": false, "explain_results": true}'::JSONB,
     'b0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000005', 'GLOBAL', NULL, 'WORKFLOW_AI_ROUTING',
     TRUE, '{"auto_assign": true, "suggest_approvers": true, "human_override_required": true}'::JSONB,
     'b0000000-0000-0000-0000-000000000001');

-- Project-level override example: disable content generation for default project
INSERT INTO ai_governance_policies (scope, scope_id, policy_type, is_enabled, settings, created_by) VALUES
    ('PROJECT', 'e0000000-0000-0000-0000-000000000001', 'CONTENT_GENERATION',
     FALSE, '{"reason": "Project policy: no AI content generation allowed"}'::JSONB,
     'b0000000-0000-0000-0000-000000000001');

-- New permissions for governance features
INSERT INTO permissions (id, name, resource, action, description) VALUES
    (uuid_generate_v4(), 'project.create', 'PROJECT', 'CREATE', 'Create projects'),
    (uuid_generate_v4(), 'project.manage', 'PROJECT', 'MANAGE', 'Manage project settings and members'),
    (uuid_generate_v4(), 'governance.view', 'GOVERNANCE', 'VIEW', 'View AI governance policies'),
    (uuid_generate_v4(), 'governance.manage', 'GOVERNANCE', 'MANAGE', 'Create and modify governance policies'),
    (uuid_generate_v4(), 'governance.audit', 'GOVERNANCE', 'AUDIT', 'View policy audit trail');

-- Assign new permissions to SYSTEM_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000001', id FROM permissions
WHERE name IN ('project.create','project.manage','governance.view','governance.manage','governance.audit');

-- New role: AI_OPERATOR — can trigger AI features but results need human review
INSERT INTO roles (id, name, description) VALUES
    ('a0000000-0000-0000-0000-000000000007', 'AI_OPERATOR', 'Can invoke AI features under governance controls');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000007', id FROM permissions
WHERE name IN ('document.read','document.create','governance.view');
