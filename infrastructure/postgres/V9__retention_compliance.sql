-- V9: Retention & Compliance — Project defaults, Document privacy, Zimbabwe/Southern Africa jurisdictions

-- 1. Add retention/compliance columns to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_retention_period_years INT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS retention_document_types TEXT[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS jurisdiction_code VARCHAR(10);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS privacy_redaction_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS compliance_category VARCHAR(100);

-- 2. Add privacy redaction to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS privacy_redaction_enabled BOOLEAN DEFAULT FALSE;

-- 3. Seed Zimbabwe jurisdiction
INSERT INTO jurisdictions (id, code, name, region, is_active)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'ZW', 'Zimbabwe', 'Southern Africa', TRUE),
    ('c0000000-0000-0000-0000-000000000002', 'ZA', 'South Africa', 'Southern Africa', TRUE),
    ('c0000000-0000-0000-0000-000000000003', 'SADC', 'SADC Region', 'Southern Africa', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 4. Seed Zimbabwe legal frameworks
INSERT INTO legal_frameworks (id, jurisdiction_id, code, name, description, authority, effective_date, url, is_active)
VALUES
    (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000001', 'AIPPA', 'Access to Information and Protection of Privacy Act',
     'Regulates access to information and protects personal privacy in Zimbabwe',
     'Parliament of Zimbabwe', '2002-03-15', 'https://www.parlzim.gov.zw', TRUE),
    (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000001', 'CDPA', 'Cyber and Data Protection Act',
     'Provides for data protection, cybercrime prevention and electronic transactions in Zimbabwe',
     'Parliament of Zimbabwe', '2021-12-03', 'https://www.potraz.gov.zw', TRUE),
    (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000001', 'COMPANIES_ACT', 'Companies and Other Business Entities Act',
     'Regulates company records retention and corporate governance',
     'Ministry of Justice, Legal and Parliamentary Affairs', '2019-11-15', NULL, TRUE),
    (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000001', 'INCOME_TAX_ACT', 'Income Tax Act (Chapter 23:06)',
     'Tax records retention requirements under ZIMRA regulations',
     'Zimbabwe Revenue Authority (ZIMRA)', '1967-01-01', 'https://www.zimra.co.zw', TRUE),
    (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000002', 'POPIA', 'Protection of Personal Information Act',
     'South Africa''s data protection law governing processing of personal information',
     'Information Regulator of South Africa', '2020-07-01', 'https://www.justice.gov.za/inforeg', TRUE),
    (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000002', 'COMPANIES_ACT_71', 'Companies Act 71 of 2008',
     'South African company records retention requirements',
     'CIPC', '2011-05-01', 'https://www.cipc.co.za', TRUE)
ON CONFLICT (jurisdiction_id, code) DO NOTHING;

-- 5. Seed jurisdiction retention rules for Zimbabwe
INSERT INTO jurisdiction_retention_rules (id, jurisdiction_id, legal_framework_id, document_category, min_retention_years, max_retention_years, description, legal_citation, penalty_info, is_mandatory, is_active)
SELECT uuid_generate_v4(), j.id, f.id, 'CONTRACT', 6, NULL,
    'Business contracts must be retained for a minimum of 6 years after expiry',
    'Companies Act Chapter 24:03 Section 8', 'Non-compliance may result in fines or corporate liability', TRUE, TRUE
FROM jurisdictions j, legal_frameworks f WHERE j.code = 'ZW' AND f.code = 'COMPANIES_ACT' AND f.jurisdiction_id = j.id
ON CONFLICT DO NOTHING;

INSERT INTO jurisdiction_retention_rules (id, jurisdiction_id, legal_framework_id, document_category, min_retention_years, max_retention_years, description, legal_citation, penalty_info, is_mandatory, is_active)
SELECT uuid_generate_v4(), j.id, f.id, 'TAX', 6, NULL,
    'Tax records must be kept for at least 6 years from the end of the tax year',
    'Income Tax Act Chapter 23:06 Section 37', 'Penalties for failure to maintain records under ZIMRA enforcement', TRUE, TRUE
FROM jurisdictions j, legal_frameworks f WHERE j.code = 'ZW' AND f.code = 'INCOME_TAX_ACT' AND f.jurisdiction_id = j.id
ON CONFLICT DO NOTHING;

INSERT INTO jurisdiction_retention_rules (id, jurisdiction_id, legal_framework_id, document_category, min_retention_years, max_retention_years, description, legal_citation, penalty_info, is_mandatory, is_active)
SELECT uuid_generate_v4(), j.id, f.id, 'HR', 5, NULL,
    'Employee records must be maintained for a minimum of 5 years after termination',
    'Labour Act Chapter 28:01', 'Non-compliance may result in penalties under labor regulations', TRUE, TRUE
FROM jurisdictions j, legal_frameworks f WHERE j.code = 'ZW' AND f.code = 'COMPANIES_ACT' AND f.jurisdiction_id = j.id
ON CONFLICT DO NOTHING;

INSERT INTO jurisdiction_retention_rules (id, jurisdiction_id, legal_framework_id, document_category, min_retention_years, max_retention_years, description, legal_citation, penalty_info, is_mandatory, is_active)
SELECT uuid_generate_v4(), j.id, f.id, 'PERSONAL_DATA', 3, NULL,
    'Personal data should be retained only as long as necessary, minimum 3 years for audit purposes',
    'Cyber and Data Protection Act Section 16', 'Fines up to level 10 under the Act', TRUE, TRUE
FROM jurisdictions j, legal_frameworks f WHERE j.code = 'ZW' AND f.code = 'CDPA' AND f.jurisdiction_id = j.id
ON CONFLICT DO NOTHING;

INSERT INTO jurisdiction_retention_rules (id, jurisdiction_id, legal_framework_id, document_category, min_retention_years, max_retention_years, description, legal_citation, penalty_info, is_mandatory, is_active)
SELECT uuid_generate_v4(), j.id, f.id, 'FINANCIAL', 7, NULL,
    'Financial records including invoices, ledgers and statements retained for 7 years',
    'Companies Act Chapter 24:03 Section 173', 'Directors may face personal liability for non-compliance', TRUE, TRUE
FROM jurisdictions j, legal_frameworks f WHERE j.code = 'ZW' AND f.code = 'COMPANIES_ACT' AND f.jurisdiction_id = j.id
ON CONFLICT DO NOTHING;

INSERT INTO jurisdiction_retention_rules (id, jurisdiction_id, legal_framework_id, document_category, min_retention_years, max_retention_years, description, legal_citation, penalty_info, is_mandatory, is_active)
SELECT uuid_generate_v4(), j.id, f.id, 'MEDICAL', 10, NULL,
    'Medical and health records must be retained for a minimum of 10 years',
    'Public Health Act Chapter 15:17', 'Health facility may face suspension', TRUE, TRUE
FROM jurisdictions j, legal_frameworks f WHERE j.code = 'ZW' AND f.code = 'COMPANIES_ACT' AND f.jurisdiction_id = j.id
ON CONFLICT DO NOTHING;

-- 6. South Africa retention rules
INSERT INTO jurisdiction_retention_rules (id, jurisdiction_id, legal_framework_id, document_category, min_retention_years, max_retention_years, description, legal_citation, penalty_info, is_mandatory, is_active)
SELECT uuid_generate_v4(), j.id, f.id, 'PERSONAL_DATA', 5, NULL,
    'Personal information must be destroyed or de-identified once purpose has been achieved, minimum 5 years',
    'POPIA Section 14', 'Fines up to R10 million or imprisonment up to 10 years', TRUE, TRUE
FROM jurisdictions j, legal_frameworks f WHERE j.code = 'ZA' AND f.code = 'POPIA' AND f.jurisdiction_id = j.id
ON CONFLICT DO NOTHING;

INSERT INTO jurisdiction_retention_rules (id, jurisdiction_id, legal_framework_id, document_category, min_retention_years, max_retention_years, description, legal_citation, penalty_info, is_mandatory, is_active)
SELECT uuid_generate_v4(), j.id, f.id, 'FINANCIAL', 5, NULL,
    'Financial records must be kept for 5 years from end of financial year',
    'Companies Act 71 Section 24(3)(c)', 'Directors may face personal liability', TRUE, TRUE
FROM jurisdictions j, legal_frameworks f WHERE j.code = 'ZA' AND f.code = 'COMPANIES_ACT_71' AND f.jurisdiction_id = j.id
ON CONFLICT DO NOTHING;

INSERT INTO jurisdiction_retention_rules (id, jurisdiction_id, legal_framework_id, document_category, min_retention_years, max_retention_years, description, legal_citation, penalty_info, is_mandatory, is_active)
SELECT uuid_generate_v4(), j.id, f.id, 'TAX', 5, NULL,
    'Tax-related documents must be retained for at least 5 years from date of submission',
    'Tax Administration Act Section 29', 'SARS penalties for non-compliance', TRUE, TRUE
FROM jurisdictions j, legal_frameworks f WHERE j.code = 'ZA' AND f.code = 'COMPANIES_ACT_71' AND f.jurisdiction_id = j.id
ON CONFLICT DO NOTHING;
