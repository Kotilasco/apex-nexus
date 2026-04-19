DO $$
DECLARE
    zw_id UUID;
BEGIN
    SELECT id INTO zw_id FROM jurisdictions WHERE code = 'ZW';
    IF zw_id IS NOT NULL THEN
        INSERT INTO jurisdiction_retention_rules (
            id, jurisdiction_id, document_category, min_retention_years, legal_citation, description, is_mandatory
        )
        SELECT uuid_generate_v4(), zw_id, c, y, cit, d, true
        FROM (VALUES
            ('PERSONAL_DATA',       5, 'Zimbabwe DPA s.14',   'Personal data retained only as long as necessary; max 5 years default.'),
            ('HEALTH_RECORDS',     10, 'Zimbabwe DPA s.15',   'Health-related personal data - 10 years minimum.'),
            ('FINANCIAL_RECORDS',   6, 'Income Tax Act s.37',  'Accounting and tax records - 6 years.'),
            ('EMPLOYMENT_RECORDS',  7, 'Labour Act s.17',      'Employment and payroll records - 7 years.'),
            ('TELECOM_LOGS',        3, 'POTRAZ Reg 2014 s.12', 'Electronic communication metadata - 3 years.'),
            ('CONSENT_RECORDS',     7, 'Zimbabwe DPA s.11',    'Records of consent - 7 years after withdrawal.'),
            ('BREACH_RECORDS',     10, 'Zimbabwe DPA s.21',    'Data breach register - 10 years.'),
            ('DIGITAL_TAX',         7, 'Finance Act 2023 s.9', 'Digital services tax records - 7 years.')
        ) AS t(c, y, cit, d)
        WHERE NOT EXISTS (
            SELECT 1 FROM jurisdiction_retention_rules
            WHERE jurisdiction_id = zw_id AND document_category = t.c
        );
    END IF;
END $$;
SELECT document_category, min_retention_years, legal_citation FROM jurisdiction_retention_rules WHERE jurisdiction_id = (SELECT id FROM jurisdictions WHERE code='ZW');
