-- V22__adaptive_cases_green_it_multiagent.sql
-- Adds:
--   1) Adaptive Case Management (cases, tasks, participants, attachments, events)
--   2) Green IT / Sustainability metrics (daily snapshots)
--   3) Multi-agent orchestration metadata (agent_name on agentic_suggestions)
--   4) Multilingual documents (language column on documents)
--
-- Safe to re-run: every DDL uses IF NOT EXISTS.

------------------------------------------------------------
-- 1. Multi-agent metadata
------------------------------------------------------------
ALTER TABLE agentic_suggestions
    ADD COLUMN IF NOT EXISTS agent_name TEXT;

-- Backfill any existing rows so the UI can group them.
UPDATE agentic_suggestions
   SET agent_name = 'Intake Agent'
 WHERE agent_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_agentic_suggestions_agent_name
    ON agentic_suggestions(agent_name);

------------------------------------------------------------
-- 2. Multilingual support
------------------------------------------------------------
ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

CREATE INDEX IF NOT EXISTS idx_documents_language ON documents(language);

------------------------------------------------------------
-- 3. Adaptive Case Management
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,                 -- ASSET_REPAIR|DISPUTE|INVESTIGATION|COMPLAINT|PROJECT
    priority TEXT NOT NULL DEFAULT 'MEDIUM', -- LOW|MEDIUM|HIGH|CRITICAL
    status TEXT NOT NULL DEFAULT 'OPEN',     -- OPEN|IN_PROGRESS|ON_HOLD|CLOSED
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    opened_by UUID REFERENCES users(id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id),
    outcome TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_category ON cases(category);
CREATE INDEX IF NOT EXISTS idx_cases_priority ON cases(priority);
CREATE INDEX IF NOT EXISTS idx_cases_project ON cases(project_id);
CREATE INDEX IF NOT EXISTS idx_cases_opened_at ON cases(opened_at DESC);

CREATE TABLE IF NOT EXISTS case_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assignee_id UUID REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING|IN_PROGRESS|DONE|CANCELLED
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_tasks_case ON case_tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_case_tasks_assignee ON case_tasks(assignee_id);

CREATE TABLE IF NOT EXISTS case_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),         -- nullable for external experts
    external_email TEXT,                       -- set when user_id IS NULL
    role TEXT NOT NULL DEFAULT 'COLLABORATOR', -- OWNER|COLLABORATOR|EXPERT|OBSERVER
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    invited_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_case_participants_case ON case_participants(case_id);

CREATE TABLE IF NOT EXISTS case_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    note TEXT,
    attached_by UUID REFERENCES users(id),
    attached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(case_id, document_id)
);
CREATE INDEX IF NOT EXISTS idx_case_attachments_case ON case_attachments(case_id);

CREATE TABLE IF NOT EXISTS case_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id),
    event_type TEXT NOT NULL,               -- OPENED|TASK_ADDED|TASK_COMPLETED|DOC_ATTACHED|PARTICIPANT_INVITED|NOTE|STATUS_CHANGED|CLOSED
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_events_case ON case_events(case_id, created_at DESC);

------------------------------------------------------------
-- 4. Green IT / Sustainability
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sustainability_metrics (
    id BIGSERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL UNIQUE,
    bytes_stored BIGINT NOT NULL DEFAULT 0,
    bytes_deduped BIGINT NOT NULL DEFAULT 0,
    bytes_archived BIGINT NOT NULL DEFAULT 0,
    kwh_saved NUMERIC(12,3) NOT NULL DEFAULT 0,
    co2_kg_avoided NUMERIC(12,3) NOT NULL DEFAULT 0,
    jobs_deferred INT NOT NULL DEFAULT 0,
    green_index INT NOT NULL DEFAULT 0,      -- composite score 0-100
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sustainability_date ON sustainability_metrics(snapshot_date DESC);

-- Seed today's snapshot with zeros so the dashboard isn't empty before the first scheduled run.
INSERT INTO sustainability_metrics (snapshot_date, bytes_stored, bytes_deduped, bytes_archived, kwh_saved, co2_kg_avoided, jobs_deferred, green_index)
VALUES (CURRENT_DATE, 0, 0, 0, 0, 0, 0, 50)
ON CONFLICT (snapshot_date) DO NOTHING;
