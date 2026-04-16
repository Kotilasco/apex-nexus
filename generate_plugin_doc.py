"""Generate Apex Nexus Plugin Documentation Word Document."""
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime

doc = Document()

# ── Page setup ──
for section in doc.sections:
    section.top_margin = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)

# ── Style tweaks ──
style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(11)
style.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
style.paragraph_format.space_after = Pt(6)

for level in range(1, 4):
    hs = doc.styles[f'Heading {level}']
    hs.font.name = 'Calibri'
    hs.font.color.rgb = RGBColor(0x1E, 0x3A, 0x5F)

def set_cell_shading(cell, color_hex):
    shading = OxmlElement('w:shd')
    shading.set(qn('w:fill'), color_hex)
    shading.set(qn('w:val'), 'clear')
    cell._tc.get_or_add_tcPr().append(shading)

def add_table_row(table, cells, bold=False, shading=None):
    row = table.add_row()
    for i, text in enumerate(cells):
        row.cells[i].text = ''
        p = row.cells[i].paragraphs[0]
        run = p.add_run(str(text))
        run.font.size = Pt(9)
        run.font.name = 'Calibri'
        if bold:
            run.bold = True
            run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        if shading:
            set_cell_shading(row.cells[i], shading)
    return row

# ═══════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════
for _ in range(6):
    doc.add_paragraph('')

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('APEX NEXUS')
run.font.size = Pt(36)
run.bold = True
run.font.color.rgb = RGBColor(0x1E, 0x3A, 0x5F)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('Plugin Ecosystem\nTechnical Documentation')
run.font.size = Pt(20)
run.font.color.rgb = RGBColor(0x4A, 0x6C, 0x9B)

doc.add_paragraph('')

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run(f'Version 1.0  •  {datetime.date.today().strftime("%B %d, %Y")}')
run.font.size = Pt(12)
run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('Enterprise Content Management Platform')
run.font.size = Pt(11)
run.font.italic = True
run.font.color.rgb = RGBColor(0x88, 0x88, 0x88)

doc.add_page_break()

# ═══════════════════════════════════════════
# TABLE OF CONTENTS (manual)
# ═══════════════════════════════════════════
doc.add_heading('Table of Contents', level=1)
toc_items = [
    '1. Executive Summary',
    '2. Plugin Architecture Overview',
    '   2.1  Three-Tier Plugin Model',
    '   2.2  Plugin Lifecycle',
    '   2.3  Event Hook System',
    '3. Plugin Catalogue (14 Plugins)',
    '   3.1  Connectors (5)',
    '   3.2  Integrations (3)',
    '   3.3  Processors (2)',
    '   3.4  Compliance & Industry Packs (4)',
    '4. Detailed Plugin Reference',
    '   4.1  SAP ERP Connector',
    '   4.2  Salesforce CRM Connector',
    '   4.3  Microsoft 365 Integration',
    '   4.4  HL7 FHIR Healthcare Connector',
    '   4.5  PLM/CAD Connector',
    '   4.6  DocuSign Integration',
    '   4.7  eIDAS Qualified Signatures',
    '   4.8  Government Cloud Connector',
    '   4.9  Advanced OCR Engine',
    '   4.10 AI Document Classification',
    '   4.11 HIPAA Compliance Pack',
    '   4.12 SOX Compliance Pack',
    '   4.13 ISO 9001 Quality Pack',
    '   4.14 FOIA Records Pack',
    '5. Self-Hosted Deployment Guide',
    '   5.1  Which Plugins Work Out of the Box',
    '   5.2  Plugins Requiring External Services',
    '   5.3  Configuration Requirements per Plugin',
    '   5.4  Network & Infrastructure Prerequisites',
    '6. Industry Templates',
    '7. Security & Access Control',
    '8. Summary & Recommendations',
]
for item in toc_items:
    p = doc.add_paragraph(item)
    p.paragraph_format.space_after = Pt(2)
    p.runs[0].font.size = Pt(10)

doc.add_page_break()

# ═══════════════════════════════════════════
# 1. EXECUTIVE SUMMARY
# ═══════════════════════════════════════════
doc.add_heading('1. Executive Summary', level=1)
doc.add_paragraph(
    'Apex Nexus is an enterprise content management (ECM) platform built on a microservices '
    'architecture (Spring Boot 3.3 / Java 21 backend, Next.js 14 frontend, PostgreSQL, '
    'Elasticsearch, MinIO, Redis). The platform ships with a plugin marketplace containing '
    '14 official plugins that extend core functionality across five categories: '
    'Connectors, Integrations, Processors, Compliance Packs, and Industry Packs.'
)
doc.add_paragraph(
    'This document describes every plugin in the ecosystem — what it does, how it works '
    'internally, what external services it depends on, and critically, whether it will '
    'function correctly when you deploy Apex Nexus on your own server infrastructure.'
)
doc.add_paragraph(
    'Key takeaway: Of the 14 plugins, 6 work immediately on any self-hosted deployment '
    'with zero external dependencies. The remaining 8 require configuration of external '
    'service accounts (API keys, OAuth credentials, or network connectivity to third-party '
    'systems). No plugin requires internet access to Apex Nexus cloud services — the platform '
    'is fully self-contained.'
)

# ═══════════════════════════════════════════
# 2. PLUGIN ARCHITECTURE
# ═══════════════════════════════════════════
doc.add_heading('2. Plugin Architecture Overview', level=1)

doc.add_heading('2.1  Three-Tier Plugin Model', level=2)
doc.add_paragraph(
    'The Apex Nexus plugin system operates on three tiers:'
)
doc.add_paragraph('Plugin Registry (Global Marketplace): A PostgreSQL table (plugin_registry) '
    'stores all 14 available plugins with metadata — name, version, vendor, type, category, '
    'capabilities, configuration schema, and activation status. This is the "catalogue" that '
    'system administrators browse.', style='List Bullet')
doc.add_paragraph('Project-Level Activation: Each project can independently enable or disable '
    'plugins via a junction table (project_plugins). This allows different projects to use '
    'different plugin sets — e.g., a healthcare project enables HIPAA while a banking project '
    'enables SOX.', style='List Bullet')
doc.add_paragraph('Event Hooks: Plugins can register handlers for platform events '
    '(DOCUMENT_UPLOADED, WORKFLOW_TRANSITION, etc.) through the plugin_hooks table. Hooks '
    'execute in priority order when events fire.', style='List Bullet')

doc.add_heading('2.2  Plugin Lifecycle', level=2)
doc.add_paragraph(
    'Plugins follow a clear lifecycle:'
)
doc.add_paragraph('INACTIVE → A system administrator activates the plugin globally via '
    'the API (POST /auth/plugins/{id}/activate). This sets its status to ACTIVE in the '
    'plugin_registry table.', style='List Number')
doc.add_paragraph('ACTIVE → Project owners or admins then enable the plugin for specific '
    'projects (POST /projects/{projectId}/plugins/{pluginId}/activate). This creates a '
    'record in the project_plugins table.', style='List Number')
doc.add_paragraph('Runtime Check → When the platform processes documents, it queries the '
    'plugin_registry status in real time. For example, the search/indexing service checks '
    '"SELECT COUNT(*) FROM plugin_registry WHERE name = \'AI Document Classification\' '
    'AND status = \'ACTIVE\'" before running auto-classification.', style='List Number')
doc.add_paragraph('DEACTIVATE → Administrators can deactivate at either level. '
    'Deactivating globally immediately disables the plugin for all projects.', style='List Number')

doc.add_heading('2.3  Event Hook System', level=2)
doc.add_paragraph(
    'The plugin_hooks table lets plugins respond to platform events. Each hook record contains:'
)
tbl = doc.add_table(rows=1, cols=3)
tbl.style = 'Table Grid'
tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
for i, h in enumerate(['Field', 'Type', 'Description']):
    tbl.rows[0].cells[i].text = h
    tbl.rows[0].cells[i].paragraphs[0].runs[0].bold = True
    set_cell_shading(tbl.rows[0].cells[i], '1E3A5F')
    tbl.rows[0].cells[i].paragraphs[0].runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    tbl.rows[0].cells[i].paragraphs[0].runs[0].font.size = Pt(9)

hook_fields = [
    ('event_type', 'VARCHAR(100)', 'Event name: DOCUMENT_UPLOADED, WORKFLOW_TRANSITION, etc.'),
    ('handler_url', 'VARCHAR(500)', 'External webhook URL to call (for external plugins)'),
    ('handler_class', 'VARCHAR(500)', 'Java class name to invoke (for internal plugins)'),
    ('priority', 'INT', 'Execution order — lower numbers run first (default: 100)'),
    ('is_active', 'BOOLEAN', 'Whether this hook is currently enabled'),
    ('config', 'JSONB', 'Plugin-specific configuration for this hook'),
]
for f in hook_fields:
    add_table_row(tbl, f)

doc.add_page_break()

# ═══════════════════════════════════════════
# 3. PLUGIN CATALOGUE
# ═══════════════════════════════════════════
doc.add_heading('3. Plugin Catalogue (14 Plugins)', level=1)

doc.add_paragraph(
    'The following table summarises every plugin shipped with Apex Nexus:'
)

cat_tbl = doc.add_table(rows=1, cols=6)
cat_tbl.style = 'Table Grid'
cat_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
for i, h in enumerate(['#', 'Plugin Name', 'Type', 'Category', 'Version', 'Self-Host Ready?']):
    cat_tbl.rows[0].cells[i].text = h
    cat_tbl.rows[0].cells[i].paragraphs[0].runs[0].bold = True
    set_cell_shading(cat_tbl.rows[0].cells[i], '1E3A5F')
    cat_tbl.rows[0].cells[i].paragraphs[0].runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    cat_tbl.rows[0].cells[i].paragraphs[0].runs[0].font.size = Pt(9)

plugins_summary = [
    ('1', 'SAP ERP Connector', 'CONNECTOR', 'ERP', '1.0.0', 'Requires SAP system'),
    ('2', 'Salesforce CRM Connector', 'CONNECTOR', 'CRM', '1.0.0', 'Requires Salesforce API'),
    ('3', 'Microsoft 365 Integration', 'INTEGRATION', 'Productivity', '1.0.0', 'Requires M365 tenant'),
    ('4', 'HL7 FHIR Healthcare Connector', 'CONNECTOR', 'Healthcare', '1.0.0', 'Requires FHIR server'),
    ('5', 'PLM/CAD Connector', 'CONNECTOR', 'Engineering', '1.0.0', 'Requires PLM system'),
    ('6', 'DocuSign Integration', 'INTEGRATION', 'Signature', '1.0.0', 'Requires DocuSign account'),
    ('7', 'eIDAS Qualified Signatures', 'INTEGRATION', 'Signature', '1.0.0', 'Requires EU TSP'),
    ('8', 'Government Cloud Connector', 'CONNECTOR', 'Cloud', '1.0.0', 'Requires FedRAMP infra'),
    ('9', 'Advanced OCR Engine', 'PROCESSOR', 'OCR', '1.0.0', 'YES — fully local'),
    ('10', 'AI Document Classification', 'PROCESSOR', 'AI', '1.0.0', 'YES — fully local'),
    ('11', 'HIPAA Compliance Pack', 'INDUSTRY_PACK', 'Compliance', '1.0.0', 'YES — fully local'),
    ('12', 'SOX Compliance Pack', 'INDUSTRY_PACK', 'Compliance', '1.0.0', 'YES — fully local'),
    ('13', 'ISO 9001 Quality Pack', 'INDUSTRY_PACK', 'Quality', '1.0.0', 'YES — fully local'),
    ('14', 'FOIA Records Pack', 'INDUSTRY_PACK', 'Compliance', '1.0.0', 'YES — fully local'),
]
for p in plugins_summary:
    add_table_row(cat_tbl, p)

doc.add_paragraph('')

doc.add_heading('3.1  Connectors (5 plugins)', level=2)
doc.add_paragraph(
    'Connectors bridge Apex Nexus with external enterprise systems. They sync documents, '
    'metadata, and business objects bi-directionally. Connectors require network access to '
    'the target system and valid API credentials.'
)

doc.add_heading('3.2  Integrations (3 plugins)', level=2)
doc.add_paragraph(
    'Integrations extend platform capabilities via third-party SaaS platforms — electronic '
    'signatures (DocuSign, eIDAS) and productivity editing (Microsoft 365). They require '
    'active subscriptions and API keys for the respective services.'
)

doc.add_heading('3.3  Processors (2 plugins)', level=2)
doc.add_paragraph(
    'Processors enhance document handling within the platform itself — OCR for text extraction '
    'and AI for automatic classification. These run entirely inside the Apex Nexus infrastructure '
    'with no external dependencies.'
)

doc.add_heading('3.4  Compliance & Industry Packs (4 plugins)', level=2)
doc.add_paragraph(
    'Industry packs bundle compliance rules, retention policies, audit controls, and automated '
    'scanning tailored to specific regulatory frameworks (HIPAA, SOX, ISO 9001, FOIA). All '
    'packs operate entirely locally using the platform\'s existing database and document store.'
)

doc.add_page_break()

# ═══════════════════════════════════════════
# 4. DETAILED PLUGIN REFERENCE
# ═══════════════════════════════════════════
doc.add_heading('4. Detailed Plugin Reference', level=1)

plugins_detail = [
    {
        'num': '4.1',
        'name': 'SAP ERP Connector',
        'key': 'apex.connector.sap',
        'type': 'CONNECTOR',
        'category': 'ERP',
        'desc': (
            'Provides bi-directional document synchronisation with SAP ERP and S/4HANA systems. '
            'When activated, documents indexed by the search service are assigned SAP document numbers '
            'based on their classification: invoices receive an "SAP-FI-" prefix (Financial Accounting), '
            'contracts get "SAP-MM-" (Materials Management), reports get "SAP-CO-" (Controlling), and '
            'all other documents get "SAP-DM-" (Document Management). These identifiers are written back '
            'to the documents table (sap_document_number column) for cross-referencing.'
        ),
        'capabilities': ['document.import', 'document.export', 'metadata.sync', 'invoice.post'],
        'how_it_works': (
            'The IndexQueueProcessor in the search service checks if this plugin is ACTIVE by querying '
            'the plugin_registry table. When active, every newly indexed document is assigned a SAP '
            'document number based on its classification label. The number is stored both in Elasticsearch '
            'and PostgreSQL. This enables SAP operators to look up Apex Nexus documents by their SAP reference.'
        ),
        'external_deps': 'SAP ERP/S4HANA system with RFC or OData API access',
        'config_needed': 'SAP host URL, SAP client number, username, password or X.509 certificate, RFC destination',
        'self_host': (
            'PARTIALLY WORKS. The SAP document number assignment (prefix generation) works locally without '
            'any SAP system — the platform assigns synthetic SAP-prefixed IDs. However, actual bi-directional '
            'sync (posting invoices to SAP, pulling PO attachments) requires a live SAP system on your network. '
            'If you do not have SAP, you can still use this plugin for document numbering/tagging.'
        ),
    },
    {
        'num': '4.2',
        'name': 'Salesforce CRM Connector',
        'key': 'apex.connector.salesforce',
        'type': 'CONNECTOR',
        'category': 'CRM',
        'desc': (
            'Links Apex Nexus documents to Salesforce CRM objects — accounts, opportunities, cases, '
            'and custom objects. Enables sales and support teams to access proposals, contracts, and '
            'case attachments directly from the ECM without switching to Salesforce.'
        ),
        'capabilities': ['document.link', 'search.external', 'metadata.sync'],
        'how_it_works': (
            'When activated, the plugin registers event hooks for DOCUMENT_UPLOADED and WORKFLOW_TRANSITION. '
            'On document upload, metadata fields (account ID, opportunity ID) can be used to create a link '
            'in Salesforce. The Salesforce REST API is called via OAuth 2.0 to attach document references '
            'to the corresponding Salesforce records.'
        ),
        'external_deps': 'Salesforce org with API access enabled, Connected App for OAuth 2.0',
        'config_needed': 'Salesforce instance URL, Client ID, Client Secret, OAuth callback URL, username',
        'self_host': (
            'REQUIRES SALESFORCE. This plugin is purely an integration bridge — without an active Salesforce '
            'organisation, there are no CRM objects to link to. Activating it without Salesforce is harmless '
            '(no errors) but provides no functionality. You need a Salesforce Developer Edition (free) or '
            'above with API access.'
        ),
    },
    {
        'num': '4.3',
        'name': 'Microsoft 365 Integration',
        'key': 'apex.connector.ms365',
        'type': 'INTEGRATION',
        'category': 'Productivity',
        'desc': (
            'Enables opening and editing Word, Excel, and PowerPoint documents directly in Microsoft 365 '
            'Online (Office for the Web). Also supports SharePoint Online sync for hybrid document management. '
            'When active, the indexing pipeline generates M365 edit/preview links for each document.'
        ),
        'capabilities': ['document.edit', 'document.preview', 'user.sync'],
        'how_it_works': (
            'The IndexQueueProcessor checks this plugin\'s status during document indexing. When ACTIVE, it '
            'generates a SharePoint-style URL for each document: '
            'https://apexnexus.sharepoint.com/sites/ecm/Shared%20Documents/{title}. This link is stored in '
            'the m365_link column of the documents table. The frontend can then offer "Open in Word Online" '
            'buttons. Note: Currently the link pattern is hardcoded to the apexnexus.sharepoint.com domain '
            'and would need configuration to point to your tenant\'s SharePoint site.'
        ),
        'external_deps': 'Microsoft 365 tenant (Business Basic or above), Azure AD app registration',
        'config_needed': 'Azure AD Tenant ID, App Client ID, Client Secret, SharePoint site URL, Graph API permissions',
        'self_host': (
            'REQUIRES MICROSOFT 365. This plugin generates SharePoint URLs — without an M365 tenant and '
            'properly configured Azure AD app, the generated links will not resolve. If you have M365, you '
            'need to update the SharePoint base URL in configuration. The WebDAV-based "Edit in Word" feature '
            '(desktop Word) works independently of this plugin via the platform\'s built-in WebDAV server.'
        ),
    },
    {
        'num': '4.4',
        'name': 'HL7 FHIR Healthcare Connector',
        'key': 'apex.connector.hl7',
        'type': 'CONNECTOR',
        'category': 'Healthcare',
        'desc': (
            'Enables exchange of clinical documents (lab reports, discharge summaries, imaging reports) '
            'using the HL7 FHIR (Fast Healthcare Interoperability Resources) standard. Documents can be '
            'linked to patient records and clinical encounters in an EHR system.'
        ),
        'capabilities': ['document.import', 'patient.link', 'fhir.sync'],
        'how_it_works': (
            'The connector implements FHIR DocumentReference resources. When a document is uploaded to '
            'a healthcare project, the plugin creates a corresponding FHIR DocumentReference pointing '
            'to the binary in MinIO. For inbound sync, the connector polls (or receives webhooks from) '
            'the FHIR server and imports new clinical documents into the appropriate project folder.'
        ),
        'external_deps': 'HL7 FHIR R4 server (e.g., HAPI FHIR, Epic, Cerner)',
        'config_needed': 'FHIR base URL, authentication credentials, SMART on FHIR client ID if applicable',
        'self_host': (
            'REQUIRES FHIR SERVER. Without a FHIR-compliant server, there is nothing to sync with. You can '
            'set up a free HAPI FHIR server Docker container on your network for testing. The plugin is '
            'harmless when activated without a FHIR server — it simply has no connectivity.'
        ),
    },
    {
        'num': '4.5',
        'name': 'PLM/CAD Connector',
        'key': 'apex.connector.plm',
        'type': 'CONNECTOR',
        'category': 'Engineering',
        'desc': (
            'Integrates with Product Lifecycle Management systems (Siemens Teamcenter, PTC Windchill, etc.) '
            'to manage engineering drawings, CAD files, and BOM (Bill of Materials) documentation. Supports '
            'version sync between PLM and Apex Nexus.'
        ),
        'capabilities': ['document.import', 'version.sync', 'bom.link'],
        'how_it_works': (
            'The connector registers hooks for document versioning events. When a new CAD file version is '
            'uploaded to the PLM system, the hook triggers an import into Apex Nexus. Similarly, when an '
            'Apex Nexus document is approved, the connector can push it to the PLM system\'s released '
            'document library. BOM linking maps each document to its associated part numbers.'
        ),
        'external_deps': 'PLM system with REST API (Teamcenter, Windchill, Aras Innovator, etc.)',
        'config_needed': 'PLM server URL, API credentials, BOM mapping rules, folder mapping',
        'self_host': (
            'REQUIRES PLM SYSTEM. Without access to a PLM server, this connector has no target system. '
            'If you have an on-premise PLM installation, ensure network connectivity between Apex Nexus '
            'Docker containers and the PLM API endpoint.'
        ),
    },
    {
        'num': '4.6',
        'name': 'DocuSign Integration',
        'key': 'apex.connector.docusign',
        'type': 'INTEGRATION',
        'category': 'Signature',
        'desc': (
            'Sends documents from Apex Nexus to DocuSign for electronic signature. Tracks envelope status '
            '(sent, delivered, completed, declined) and downloads signed copies back into the ECM automatically. '
            'Supports multi-signer workflows and signing order.'
        ),
        'capabilities': ['signature.request', 'signature.verify', 'document.download'],
        'how_it_works': (
            'When a user initiates a signature request on a document, the plugin calls the DocuSign eSignature '
            'REST API to create an envelope. The document binary is uploaded to DocuSign with signer routing. '
            'A webhook callback URL is registered so that when signing completes, DocuSign notifies Apex Nexus, '
            'which then downloads the signed PDF and creates a new version of the document. The platform also '
            'has a built-in internal signature system (SignaturePanel component) that works without DocuSign — '
            'this plugin is for cases where legally-binding DocuSign signatures are needed.'
        ),
        'external_deps': 'DocuSign account (Developer or Production), DocuSign Integration Key',
        'config_needed': 'DocuSign Base URL, Integration Key (Client ID), Secret Key, Account ID, RSA private key for JWT auth',
        'self_host': (
            'REQUIRES DOCUSIGN ACCOUNT. Without a DocuSign integration key, the plugin cannot send envelopes. '
            'You can sign up for a free DocuSign Developer Account for testing. Note: Apex Nexus has a built-in '
            'internal signature mechanism for basic approvals — DocuSign is only needed for external/legal signatures.'
        ),
    },
    {
        'num': '4.7',
        'name': 'eIDAS Qualified Signatures',
        'key': 'apex.compliance.eidas',
        'type': 'INTEGRATION',
        'category': 'Signature',
        'desc': (
            'Provides qualified electronic signatures (QES) compliant with the EU eIDAS Regulation '
            '(Regulation 910/2014). Qualified signatures have the legal equivalence of handwritten signatures '
            'across all EU member states. Includes qualified timestamp authority integration.'
        ),
        'capabilities': ['signature.qualified', 'certificate.validate', 'timestamp.authority'],
        'how_it_works': (
            'The plugin interfaces with a Qualified Trust Service Provider (QTSP) listed on the EU '
            'Trusted List. When a qualified signature is requested, the document hash is sent to the TSP '
            'for signing with a qualified certificate. The signed document includes a qualified timestamp '
            'and can be validated against the EU Trusted List. Certificate validation checks ensure the '
            'signing certificate is issued by a recognised QTSP.'
        ),
        'external_deps': 'EU Qualified Trust Service Provider (e.g., DocuSign EU, Swisscom, D-Trust, InfoCert)',
        'config_needed': 'TSP API endpoint, TSP credentials, timestamp authority URL, certificate chain',
        'self_host': (
            'REQUIRES EU TSP ACCESS. Qualified electronic signatures by definition require a Qualified Trust '
            'Service Provider. This cannot be replicated locally. If your deployment is in the EU and you need '
            'eIDAS QES, contract with a TSP and configure their API credentials.'
        ),
    },
    {
        'num': '4.8',
        'name': 'Government Cloud Connector',
        'key': 'apex.connector.govcloud',
        'type': 'CONNECTOR',
        'category': 'Cloud',
        'desc': (
            'Enforces FedRAMP-compliant storage and data residency rules for government deployments. '
            'Ensures documents are stored only in authorised geographic regions, uses FIPS 140-2 validated '
            'encryption, and maintains chain-of-custody audit logs.'
        ),
        'capabilities': ['storage.fedramp', 'residency.enforce', 'encrypt.fips'],
        'how_it_works': (
            'When activated, the connector intercepts document storage operations and enforces data '
            'residency policies. It validates that the MinIO/S3 bucket is in an approved region, applies '
            'FIPS-compliant encryption at rest, and logs every access with full audit detail. The plugin '
            'can also replicate documents to a secondary FedRAMP-authorised data centre.'
        ),
        'external_deps': 'FedRAMP-authorised cloud infrastructure (AWS GovCloud, Azure Government, etc.)',
        'config_needed': 'GovCloud region, S3-compatible endpoint URL, FIPS encryption keys, residency rules',
        'self_host': (
            'PARTIALLY WORKS. The data residency enforcement and audit logging work on any deployment. FIPS '
            'encryption requires a FIPS-validated Java runtime or BouncyCastle FIPS provider. Full FedRAMP '
            'compliance requires hosting on authorised infrastructure.'
        ),
    },
    {
        'num': '4.9',
        'name': 'Advanced OCR Engine',
        'key': 'apex.ocr.advanced',
        'type': 'PROCESSOR',
        'category': 'OCR',
        'desc': (
            'GPU-accelerated optical character recognition with support for handwriting recognition, '
            'table extraction, and multi-language document processing. Converts scanned documents, '
            'photographs, and PDFs into searchable text indexed in Elasticsearch.'
        ),
        'capabilities': ['ocr.handwriting', 'ocr.table', 'ocr.multilingual'],
        'how_it_works': (
            'The OCR engine runs within the search service\'s content extraction pipeline. When a document '
            '(PDF, TIFF, PNG, JPEG) is uploaded, the ContentExtractorService detects that it contains images '
            'and invokes the OCR processor. Extracted text is stored in the Elasticsearch index alongside '
            'the document metadata, making scanned documents fully searchable. The advanced engine adds '
            'handwriting recognition (for forms) and table structure extraction (for invoices/reports) '
            'beyond the basic Apache Tika extraction already built into the platform.'
        ),
        'external_deps': 'None — runs locally within the platform',
        'config_needed': 'Optional: GPU device mapping in Docker for acceleration, language model packs',
        'self_host': (
            'YES — FULLY WORKS. This plugin runs entirely within the Apex Nexus Docker infrastructure. '
            'Basic OCR via Apache Tika is already built in. This plugin enhances it with handwriting and '
            'table extraction. For GPU acceleration, map an NVIDIA GPU to the search service container. '
            'Without a GPU, it falls back to CPU processing (slower but functional).'
        ),
    },
    {
        'num': '4.10',
        'name': 'AI Document Classification',
        'key': 'apex.ai.classification',
        'type': 'PROCESSOR',
        'category': 'AI',
        'desc': (
            'Machine learning-powered automatic document classification using transformer models. '
            'Analyses document content after extraction and assigns a classification label (Invoice, '
            'Contract, Report, Letter, etc.) with a confidence score. Classifications are stored in '
            'PostgreSQL and Elasticsearch for filtering and analytics.'
        ),
        'capabilities': ['classify.ml', 'classify.train', 'classify.batch'],
        'how_it_works': (
            'This is one of the most actively used plugins. The IndexQueueProcessor queries the plugin_registry '
            'to check if this plugin is ACTIVE. When it is, every newly indexed document goes through the '
            'ClassificationService after content extraction. The classifier analyses the filename, MIME type, '
            'extracted text, and metadata to determine a label and category. Results with confidence >= 0.2 '
            'are stored: classificationLabel, classificationCategory, and classificationConfidence are written '
            'to both Elasticsearch (for search) and PostgreSQL (UPDATE documents SET classification_label = ?). '
            'When inactive, the indexer logs "AI Document Classification plugin is not active — skipping '
            'classification" and proceeds without classifying.'
        ),
        'external_deps': 'None — runs locally using built-in classification models',
        'config_needed': 'None required. Optional: custom classification model path, confidence threshold override',
        'self_host': (
            'YES — FULLY WORKS. This is the most production-ready plugin. The classification service runs '
            'entirely within the search service container using built-in rule-based and ML models. No external '
            'API calls, no cloud dependencies. Simply activate it via the admin API or UI and all new documents '
            'will be auto-classified. This plugin is highly recommended for all deployments.'
        ),
    },
    {
        'num': '4.11',
        'name': 'HIPAA Compliance Pack',
        'key': 'apex.compliance.hipaa',
        'type': 'INDUSTRY_PACK',
        'category': 'Compliance',
        'desc': (
            'Automated HIPAA (Health Insurance Portability and Accountability Act) compliance for healthcare '
            'organisations. Includes PHI (Protected Health Information) detection in uploaded documents, '
            'HIPAA-specific audit logging, and 6-year retention enforcement for medical records.'
        ),
        'capabilities': ['scan.phi', 'audit.hipaa', 'retention.enforce'],
        'how_it_works': (
            'When activated, the plugin enables three features: (1) PHI Scanner — analyses uploaded document '
            'text for patterns matching Social Security numbers, medical record numbers, date of birth, and '
            'other PHI identifiers, flagging documents that contain PHI; (2) HIPAA Audit Trail — extends the '
            'existing audit log with HIPAA-specific fields (access reason, minimum necessary justification); '
            '(3) Retention Enforcement — applies the jurisdiction retention rule for MEDICAL_RECORDS (6 years '
            'per 45 CFR 164.530(j)) automatically to documents in healthcare projects.'
        ),
        'external_deps': 'None — all processing is local',
        'config_needed': 'None required. Optional: custom PHI pattern definitions, retention period override',
        'self_host': (
            'YES — FULLY WORKS. All HIPAA compliance features operate within the platform using built-in '
            'pattern matching and retention rules seeded in the database. The jurisdiction_retention_rules '
            'table already contains the HIPAA 6-year rule. No external service needed.'
        ),
    },
    {
        'num': '4.12',
        'name': 'SOX Compliance Pack',
        'key': 'apex.compliance.sox',
        'type': 'INDUSTRY_PACK',
        'category': 'Compliance',
        'desc': (
            'Sarbanes-Oxley Act compliance monitoring for financial organisations. Provides financial '
            'document controls, 7-year audit work paper retention, corporate email retention (5 years), '
            'and tamper-evident audit trails for documents subject to SOX Section 802.'
        ),
        'capabilities': ['audit.sox', 'retention.enforce', 'control.monitor'],
        'how_it_works': (
            'The pack enforces two retention rules from the seeded database: FINANCIAL_AUDIT (7 years per '
            'SOX Section 802) and CORPORATE_EMAIL (5 years). It extends the document audit trail with '
            'SOX-specific controls: who accessed the document, when, from where, and whether any modifications '
            'were made. The pack integrates with the workflow system to require multi-level approval for '
            'financial documents — the Invoice Processing workflow template is designed to pair with this plugin.'
        ),
        'external_deps': 'None — all processing is local',
        'config_needed': 'None required. Optional: custom retention periods, approval thresholds',
        'self_host': (
            'YES — FULLY WORKS. All SOX controls, retention enforcement, and audit logging run locally. '
            'The retention rules are already seeded in the jurisdiction_retention_rules table. Pair with '
            'the Banking & Financial Services industry template for a complete SOX-ready setup.'
        ),
    },
    {
        'num': '4.13',
        'name': 'ISO 9001 Quality Pack',
        'key': 'apex.compliance.iso9001',
        'type': 'INDUSTRY_PACK',
        'category': 'Quality',
        'desc': (
            'ISO 9001 Quality Management System (QMS) document control for manufacturing and quality-driven '
            'organisations. Includes CAPA (Corrective and Preventive Action) workflow support, audit scheduling, '
            'and controlled document distribution with read-receipt tracking.'
        ),
        'capabilities': ['workflow.qms', 'audit.iso', 'document.control'],
        'how_it_works': (
            'The pack adds QMS-specific fields to document metadata: document control number, revision status, '
            'effective date, and review date. It hooks into the workflow system to enforce review cycles — '
            'documents approaching their review date trigger automatic workflow transitions. CAPA workflows '
            'are supported via the Standard Document Approval workflow template with additional correction '
            'loop states. Audit scheduling creates periodic review tasks for quality managers.'
        ),
        'external_deps': 'None — all processing is local',
        'config_needed': 'None required. Optional: review cycle frequency, CAPA category definitions',
        'self_host': (
            'YES — FULLY WORKS. All QMS features — document control, CAPA workflows, audit scheduling — '
            'run entirely within the platform. Pair with the Manufacturing & Engineering industry template '
            'for a pre-configured ISO 9001 environment.'
        ),
    },
    {
        'num': '4.14',
        'name': 'FOIA Records Pack',
        'key': 'apex.compliance.foia',
        'type': 'INDUSTRY_PACK',
        'category': 'Compliance',
        'desc': (
            'Freedom of Information Act compliance for government agencies. Provides automated redaction '
            'of sensitive information (PII, classified content), FOIA request tracking, release workflow '
            'management, and public records retention enforcement.'
        ),
        'capabilities': ['redact.auto', 'release.track', 'retention.enforce'],
        'how_it_works': (
            'The pack includes: (1) Auto-Redaction Engine — scans document text for PII patterns (SSN, '
            'addresses, phone numbers) and creates redacted copies with black bars over sensitive content; '
            '(2) Release Tracker — manages FOIA request lifecycle from receipt to response, tracking which '
            'documents are responsive and their release/withhold status; (3) Retention Enforcement — applies '
            'federal records retention schedules from NARA (National Archives and Records Administration).'
        ),
        'external_deps': 'None — all processing is local',
        'config_needed': 'None required. Optional: custom redaction patterns, NARA schedule mappings',
        'self_host': (
            'YES — FULLY WORKS. All FOIA compliance features operate locally. The redaction engine uses '
            'built-in pattern matching, and retention rules are stored in the database. Pair with the '
            'Government & Public Sector industry template for a complete FOIA-ready deployment.'
        ),
    },
]

for plugin in plugins_detail:
    doc.add_heading(f'{plugin["num"]}  {plugin["name"]}', level=2)

    # Info box
    info_tbl = doc.add_table(rows=5, cols=2)
    info_tbl.style = 'Table Grid'
    info_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    labels = ['Plugin Key', 'Type', 'Category', 'Version', 'Capabilities']
    values = [plugin['key'], plugin['type'], plugin['category'], '1.0.0',
              ', '.join(plugin['capabilities'])]
    for i, (lbl, val) in enumerate(zip(labels, values)):
        info_tbl.rows[i].cells[0].text = ''
        p0 = info_tbl.rows[i].cells[0].paragraphs[0]
        r0 = p0.add_run(lbl)
        r0.bold = True
        r0.font.size = Pt(9)
        set_cell_shading(info_tbl.rows[i].cells[0], 'E8EDF3')
        info_tbl.rows[i].cells[1].text = ''
        p1 = info_tbl.rows[i].cells[1].paragraphs[0]
        r1 = p1.add_run(val)
        r1.font.size = Pt(9)

    doc.add_paragraph('')
    doc.add_paragraph(plugin['desc'])

    doc.add_heading('How It Works', level=3)
    doc.add_paragraph(plugin['how_it_works'])

    doc.add_heading('External Dependencies', level=3)
    doc.add_paragraph(plugin['external_deps'])

    doc.add_heading('Configuration Required', level=3)
    doc.add_paragraph(plugin['config_needed'])

    doc.add_heading('Self-Hosted Deployment Assessment', level=3)
    p = doc.add_paragraph()
    # Color-code the verdict
    verdict = plugin['self_host']
    if verdict.startswith('YES'):
        run = p.add_run('✅ ')
        run.font.color.rgb = RGBColor(0x16, 0xA3, 0x4A)
    elif verdict.startswith('PARTIALLY'):
        run = p.add_run('⚠️ ')
        run.font.color.rgb = RGBColor(0xD9, 0x77, 0x06)
    else:
        run = p.add_run('🔧 ')
        run.font.color.rgb = RGBColor(0xDC, 0x26, 0x26)
    run = p.add_run(verdict)
    run.font.size = Pt(11)

    doc.add_paragraph('')

doc.add_page_break()

# ═══════════════════════════════════════════
# 5. SELF-HOSTED DEPLOYMENT GUIDE
# ═══════════════════════════════════════════
doc.add_heading('5. Self-Hosted Deployment Guide', level=1)

doc.add_heading('5.1  Plugins That Work Out of the Box', level=2)
doc.add_paragraph(
    'The following 6 plugins require ZERO external services and function immediately on any '
    'self-hosted Apex Nexus deployment:'
)

works_tbl = doc.add_table(rows=1, cols=3)
works_tbl.style = 'Table Grid'
for i, h in enumerate(['Plugin', 'What It Does', 'How to Activate']):
    works_tbl.rows[0].cells[i].text = h
    works_tbl.rows[0].cells[i].paragraphs[0].runs[0].bold = True
    set_cell_shading(works_tbl.rows[0].cells[i], '166534')
    works_tbl.rows[0].cells[i].paragraphs[0].runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    works_tbl.rows[0].cells[i].paragraphs[0].runs[0].font.size = Pt(9)

works_data = [
    ('AI Document Classification', 'Auto-classifies every uploaded document', 'Activate globally → enable per project'),
    ('Advanced OCR Engine', 'Extracts text from scanned docs/images', 'Activate globally → enable per project'),
    ('HIPAA Compliance Pack', 'PHI detection, 6-year retention', 'Activate globally → enable on healthcare projects'),
    ('SOX Compliance Pack', 'Financial controls, 7-year retention', 'Activate globally → enable on finance projects'),
    ('ISO 9001 Quality Pack', 'QMS workflows, CAPA, audit scheduling', 'Activate globally → enable on manufacturing projects'),
    ('FOIA Records Pack', 'Auto-redaction, FOIA request tracking', 'Activate globally → enable on government projects'),
]
for d in works_data:
    add_table_row(works_tbl, d)

doc.add_paragraph('')

doc.add_heading('5.2  Plugins Requiring External Services', level=2)
doc.add_paragraph(
    'The following 8 plugins need external service accounts to function fully:'
)

ext_tbl = doc.add_table(rows=1, cols=3)
ext_tbl.style = 'Table Grid'
for i, h in enumerate(['Plugin', 'External Service Required', 'Free Tier Available?']):
    ext_tbl.rows[0].cells[i].text = h
    ext_tbl.rows[0].cells[i].paragraphs[0].runs[0].bold = True
    set_cell_shading(ext_tbl.rows[0].cells[i], '9A3412')
    ext_tbl.rows[0].cells[i].paragraphs[0].runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    ext_tbl.rows[0].cells[i].paragraphs[0].runs[0].font.size = Pt(9)

ext_data = [
    ('SAP ERP Connector', 'SAP ERP/S4HANA system', 'No (SAP license required). Number assignment works locally.'),
    ('Salesforce CRM Connector', 'Salesforce organisation', 'Yes — Salesforce Developer Edition is free'),
    ('Microsoft 365 Integration', 'M365 tenant + Azure AD', 'Partial — M365 Developer Program offers free tenant'),
    ('HL7 FHIR Connector', 'HL7 FHIR R4 server', 'Yes — HAPI FHIR server is free and open source'),
    ('PLM/CAD Connector', 'PLM system (Teamcenter, etc.)', 'No (commercial PLM license required)'),
    ('DocuSign Integration', 'DocuSign account', 'Yes — DocuSign Developer Account is free'),
    ('eIDAS Qualified Signatures', 'EU Qualified Trust Service Provider', 'No (TSP contract required)'),
    ('Government Cloud Connector', 'FedRAMP-authorised infrastructure', 'No (FedRAMP certification required)'),
]
for d in ext_data:
    add_table_row(ext_tbl, d)

doc.add_paragraph('')

doc.add_heading('5.3  Configuration Requirements per Plugin', level=2)
doc.add_paragraph(
    'Plugin configuration is stored in the config JSONB column of the plugin_registry table. '
    'Currently, configuration is set via direct database update or API call. Each plugin that '
    'requires external services needs the following environment variables or config entries:'
)

doc.add_paragraph('SAP ERP: SAP_HOST, SAP_CLIENT, SAP_USERNAME, SAP_PASSWORD, SAP_RFC_DEST', style='List Bullet')
doc.add_paragraph('Salesforce: SF_INSTANCE_URL, SF_CLIENT_ID, SF_CLIENT_SECRET, SF_USERNAME', style='List Bullet')
doc.add_paragraph('Microsoft 365: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, SHAREPOINT_SITE_URL', style='List Bullet')
doc.add_paragraph('HL7 FHIR: FHIR_BASE_URL, FHIR_AUTH_TOKEN (or SMART on FHIR credentials)', style='List Bullet')
doc.add_paragraph('PLM/CAD: PLM_API_URL, PLM_USERNAME, PLM_PASSWORD, PLM_PROJECT_MAPPING', style='List Bullet')
doc.add_paragraph('DocuSign: DOCUSIGN_BASE_URL, DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_SECRET, DOCUSIGN_ACCOUNT_ID', style='List Bullet')
doc.add_paragraph('eIDAS: EIDAS_TSP_URL, EIDAS_TSP_CREDENTIALS, EIDAS_TIMESTAMP_URL', style='List Bullet')
doc.add_paragraph('GovCloud: GOVCLOUD_REGION, GOVCLOUD_S3_ENDPOINT, GOVCLOUD_FIPS_KEYSTORE', style='List Bullet')

doc.add_heading('5.4  Network & Infrastructure Prerequisites', level=2)
doc.add_paragraph(
    'The core Apex Nexus deployment requires the following Docker containers (all included in '
    'docker-compose.yml):'
)
doc.add_paragraph('PostgreSQL 15 — primary data store', style='List Bullet')
doc.add_paragraph('Redis 7 — caching and session store', style='List Bullet')
doc.add_paragraph('MinIO — S3-compatible object storage for document binaries', style='List Bullet')
doc.add_paragraph('Elasticsearch 8 — full-text search and document indexing', style='List Bullet')
doc.add_paragraph('apex-auth-service — authentication, user management, plugin registry', style='List Bullet')
doc.add_paragraph('apex-document-service — document CRUD, checkout/checkin, versioning', style='List Bullet')
doc.add_paragraph('apex-search-service — indexing, OCR, classification, content extraction', style='List Bullet')
doc.add_paragraph('apex-gateway — API gateway (port 9600)', style='List Bullet')
doc.add_paragraph('apex-web — Next.js frontend (port 3000)', style='List Bullet')

doc.add_paragraph('')
doc.add_paragraph(
    'For plugins that connect to external systems, ensure your server has outbound network '
    'access to the respective endpoints. If running behind a corporate firewall, whitelist '
    'the required domains.'
)

doc.add_page_break()

# ═══════════════════════════════════════════
# 6. INDUSTRY TEMPLATES
# ═══════════════════════════════════════════
doc.add_heading('6. Industry Templates', level=1)
doc.add_paragraph(
    'Apex Nexus ships with 5 pre-built industry templates that bundle specific plugins, '
    'workflows, retention rules, and document labels into ready-to-use configurations:'
)

templates = [
    ('Healthcare & Life Sciences', 'Heart', '#EF4444',
     'HL7 FHIR Connector + HIPAA Compliance Pack',
     'Patient Record Management workflow',
     '6-year medical records retention (HIPAA 45 CFR 164.530(j))'),
    ('Banking & Financial Services', 'Landmark', '#F59E0B',
     'SAP ERP Connector + SOX Compliance Pack',
     'Invoice Processing + Standard Document Approval workflows',
     '7-year financial audit + 5-year corporate email retention (SOX Section 802)'),
    ('Legal & Professional Services', 'Scale', '#8B5CF6',
     'DocuSign Integration + eIDAS Qualified Signatures',
     'Contract Lifecycle + Standard Document Approval workflows',
     'Jurisdiction-based retention (commercial letters, contracts)'),
    ('Manufacturing & Engineering', 'Factory', '#6366F1',
     'PLM/CAD Connector + ISO 9001 Quality Pack',
     'Standard Document Approval workflow (with QMS extensions)',
     'Booking records + tax records retention (HGB/AO)'),
    ('Government & Public Sector', 'Building', '#0EA5E9',
     'FOIA Records Pack + Government Cloud Connector',
     'Standard Document Approval workflow',
     'NARA federal records retention schedules'),
]

for name, icon, color, plugins, workflows, retention in templates:
    doc.add_heading(name, level=2)
    doc.add_paragraph(f'Included Plugins: {plugins}', style='List Bullet')
    doc.add_paragraph(f'Workflows: {workflows}', style='List Bullet')
    doc.add_paragraph(f'Retention Rules: {retention}', style='List Bullet')
    doc.add_paragraph('')

doc.add_page_break()

# ═══════════════════════════════════════════
# 7. SECURITY & ACCESS CONTROL
# ═══════════════════════════════════════════
doc.add_heading('7. Security & Access Control', level=1)
doc.add_paragraph(
    'The plugin system enforces strict access control at two levels:'
)

doc.add_heading('Global Plugin Management', level=2)
doc.add_paragraph('Only users with the SYSTEM_ADMIN role can activate or deactivate plugins globally.', style='List Bullet')
doc.add_paragraph('Global activation makes the plugin available for project-level enablement but does not automatically enable it in any project.', style='List Bullet')
doc.add_paragraph('Every activation/deactivation is logged in the platform audit trail with user ID and timestamp.', style='List Bullet')

doc.add_heading('Project-Level Plugin Management', level=2)
doc.add_paragraph('Only project owners and users with the ADMIN permission on a project can enable/disable plugins for that project.', style='List Bullet')
doc.add_paragraph('Each project maintains its own set of active plugins via the project_plugins junction table.', style='List Bullet')
doc.add_paragraph('Plugin state changes trigger audit events published via the event system.', style='List Bullet')

doc.add_heading('API Endpoints', level=2)
api_tbl = doc.add_table(rows=1, cols=4)
api_tbl.style = 'Table Grid'
for i, h in enumerate(['Method', 'Endpoint', 'Purpose', 'Required Role']):
    api_tbl.rows[0].cells[i].text = h
    api_tbl.rows[0].cells[i].paragraphs[0].runs[0].bold = True
    set_cell_shading(api_tbl.rows[0].cells[i], '1E3A5F')
    api_tbl.rows[0].cells[i].paragraphs[0].runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    api_tbl.rows[0].cells[i].paragraphs[0].runs[0].font.size = Pt(9)

api_rows = [
    ('GET', '/auth/plugins', 'List all plugins (marketplace)', 'Any authenticated'),
    ('GET', '/auth/plugins/{id}', 'Get plugin details with hooks', 'Any authenticated'),
    ('POST', '/auth/plugins/{id}/activate', 'Activate plugin globally', 'SYSTEM_ADMIN'),
    ('POST', '/auth/plugins/{id}/deactivate', 'Deactivate plugin globally', 'SYSTEM_ADMIN'),
    ('GET', '/auth/plugins/by-type/{type}', 'Filter by type', 'Any authenticated'),
    ('GET', '/auth/plugins/by-category/{cat}', 'Filter by category', 'Any authenticated'),
    ('GET', '/projects/{id}/plugins', 'List project plugins', 'Project member'),
    ('POST', '/projects/{id}/plugins/{pid}/activate', 'Enable plugin for project', 'Project ADMIN'),
    ('POST', '/projects/{id}/plugins/{pid}/deactivate', 'Disable plugin for project', 'Project ADMIN'),
]
for r in api_rows:
    add_table_row(api_tbl, r)

doc.add_page_break()

# ═══════════════════════════════════════════
# 8. SUMMARY & RECOMMENDATIONS
# ═══════════════════════════════════════════
doc.add_heading('8. Summary & Recommendations', level=1)

doc.add_heading('For Immediate Self-Hosted Deployment', level=2)
doc.add_paragraph(
    'If you are deploying Apex Nexus on your own server today, we recommend activating these '
    'plugins immediately — they require no configuration and provide significant value:'
)
doc.add_paragraph('AI Document Classification — automatically categorises every document you upload, making search and organisation dramatically better.', style='List Number')
doc.add_paragraph('Advanced OCR Engine — makes scanned PDFs and images searchable, essential for any organisation dealing with paper-to-digital workflows.', style='List Number')
doc.add_paragraph('One compliance pack matching your industry — HIPAA for healthcare, SOX for finance, ISO 9001 for manufacturing, FOIA for government.', style='List Number')

doc.add_heading('For Organisations with External Systems', level=2)
doc.add_paragraph(
    'If your organisation already uses SAP, Salesforce, Microsoft 365, or DocuSign, the '
    'corresponding connectors/integrations provide immediate value by eliminating duplicate '
    'document storage and manual cross-referencing. Budget time for API credential setup '
    'and initial configuration.'
)

doc.add_heading('Plugin Activation Checklist', level=2)
check_items = [
    'Deploy Apex Nexus via docker-compose up -d',
    'Log in as admin (SYSTEM_ADMIN role)',
    'Navigate to Administration → Plugin registry (or use API)',
    'Activate desired plugins globally',
    'Create or open a project',
    'Go to project Plugins tab',
    'Enable the required plugins for that project',
    'Upload a test document to verify plugin functionality',
    'Check search results for classification labels (AI plugin)',
    'Check document detail for OCR-extracted text (OCR plugin)',
]
for item in check_items:
    doc.add_paragraph(item, style='List Number')

doc.add_paragraph('')
p = doc.add_paragraph()
run = p.add_run('End of Document')
run.bold = True
run.font.size = Pt(12)
run.font.color.rgb = RGBColor(0x1E, 0x3A, 0x5F)
p.alignment = WD_ALIGN_PARAGRAPH.CENTER

# ── Save ──
output_path = r'c:\Users\ze9167867\Desktop\Apex Nexus\Apex_Nexus_Plugin_Documentation.docx'
doc.save(output_path)
print(f'Document saved to: {output_path}')
