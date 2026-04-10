-- V10: Populate industry_templates display_name and JSONB detail columns
-- The V3 seed stored all data in the 'includes' JSON column, but the JPA entity
-- expects display_name, included_plugins, default_workflows, retention_rules, compliance_frameworks.

-- Set display_name from name (they should match)
UPDATE industry_templates SET display_name = name WHERE display_name = '' OR display_name IS NULL;

-- Populate included_plugins from includes->'plugins'
UPDATE industry_templates
SET included_plugins = includes::jsonb->'plugins'
WHERE includes IS NOT NULL AND includes::jsonb ? 'plugins';

-- Populate default_workflows from includes->'workflows'
UPDATE industry_templates
SET default_workflows = includes::jsonb->'workflows'
WHERE includes IS NOT NULL AND includes::jsonb ? 'workflows';

-- Populate retention_rules from includes->'retention_rules'
UPDATE industry_templates
SET retention_rules = includes::jsonb->'retention_rules'
WHERE includes IS NOT NULL AND includes::jsonb ? 'retention_rules';

-- Populate compliance_frameworks from includes->'labels' (these are the framework/label tags)
UPDATE industry_templates
SET compliance_frameworks = includes::jsonb->'labels'
WHERE includes IS NOT NULL AND includes::jsonb ? 'labels';
