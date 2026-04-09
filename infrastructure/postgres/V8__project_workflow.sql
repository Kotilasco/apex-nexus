-- V8: Add default workflow support to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_workflow_definition_id UUID;
