-- V7: Fix missing columns between JPA entities and SQL schema
-- Adds columns that exist in JPA entities but were missing from earlier migrations

-- 1. industry_templates: V3 created with different shape than JPA entity
ALTER TABLE industry_templates ADD COLUMN IF NOT EXISTS display_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE industry_templates ADD COLUMN IF NOT EXISTS included_plugins JSONB;
ALTER TABLE industry_templates ADD COLUMN IF NOT EXISTS default_workflows JSONB;
ALTER TABLE industry_templates ADD COLUMN IF NOT EXISTS retention_rules JSONB;
ALTER TABLE industry_templates ADD COLUMN IF NOT EXISTS compliance_frameworks JSONB;
ALTER TABLE industry_templates ADD COLUMN IF NOT EXISTS icon_url VARCHAR(255);

-- 2. document_signatures: V2 created table, V4 CREATE IF NOT EXISTS was no-op
ALTER TABLE document_signatures ADD COLUMN IF NOT EXISTS certificate_data TEXT;
ALTER TABLE document_signatures ADD COLUMN IF NOT EXISTS version_id UUID;
ALTER TABLE document_signatures ADD COLUMN IF NOT EXISTS external_reference VARCHAR(255);
ALTER TABLE document_signatures ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 3. plugin_registry: V3 SQL uses different column names than JPA entity
ALTER TABLE plugin_registry ADD COLUMN IF NOT EXISTS display_name VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE plugin_registry ADD COLUMN IF NOT EXISTS vendor VARCHAR(200);
ALTER TABLE plugin_registry ADD COLUMN IF NOT EXISTS plugin_type VARCHAR(50);
ALTER TABLE plugin_registry ADD COLUMN IF NOT EXISTS config_schema JSONB DEFAULT '{}';
ALTER TABLE plugin_registry ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE plugin_registry ADD COLUMN IF NOT EXISTS installed_count INT DEFAULT 0;
-- Backfill plugin_type from the enum 'type' column
UPDATE plugin_registry SET plugin_type = type::text WHERE plugin_type IS NULL OR plugin_type = '';
UPDATE plugin_registry SET vendor = author WHERE vendor IS NULL;
UPDATE plugin_registry SET display_name = name WHERE display_name = '';

-- 4. plugin_hooks: V3 SQL uses different column names than JPA entity
ALTER TABLE plugin_hooks ADD COLUMN IF NOT EXISTS hook_type VARCHAR(100);
ALTER TABLE plugin_hooks ADD COLUMN IF NOT EXISTS event_name VARCHAR(100);
ALTER TABLE plugin_hooks ADD COLUMN IF NOT EXISTS handler_config JSONB DEFAULT '{}';
ALTER TABLE plugin_hooks ADD COLUMN IF NOT EXISTS execution_order INT DEFAULT 100;
-- Backfill from existing columns
UPDATE plugin_hooks SET event_name = event_type WHERE event_name IS NULL;
