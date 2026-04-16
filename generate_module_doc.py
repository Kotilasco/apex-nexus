from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
import datetime

doc = Document()

# ---------- Styles ----------
style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(11)
style.paragraph_format.space_after = Pt(6)

for lvl in range(1, 4):
    hs = doc.styles[f'Heading {lvl}']
    hs.font.color.rgb = RGBColor(0x1A, 0x3C, 0x6E)
    hs.font.name = 'Calibri'

def add_table(headers, rows):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Light Grid Accent 1'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]
        c.text = h
        for p in c.paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(10)
    for row_data in rows:
        row = t.add_row()
        for i, val in enumerate(row_data):
            row.cells[i].text = str(val)
            for p in row.cells[i].paragraphs:
                for r in p.runs:
                    r.font.size = Pt(10)
    doc.add_paragraph()

def bullet(text, level=0):
    p = doc.add_paragraph(text, style='List Bullet')
    p.paragraph_format.left_indent = Cm(1.27 + level * 1.27)

# ============================================================
# COVER PAGE
# ============================================================
for _ in range(6):
    doc.add_paragraph()

title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run('APEX NEXUS')
run.bold = True
run.font.size = Pt(36)
run.font.color.rgb = RGBColor(0x1A, 0x3C, 0x6E)

subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = subtitle.add_run('Enterprise Content Management Platform')
run.font.size = Pt(18)
run.font.color.rgb = RGBColor(0x4A, 0x6C, 0x9E)

doc.add_paragraph()

desc = doc.add_paragraph()
desc.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = desc.add_run('Module Functions & Document Lifecycle Guide')
run.font.size = Pt(16)
run.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

doc.add_paragraph()
doc.add_paragraph()

meta = doc.add_paragraph()
meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
meta.add_run(f'Version 1.0  |  {datetime.date.today().strftime("%B %d, %Y")}').font.size = Pt(12)

doc.add_page_break()

# ============================================================
# TABLE OF CONTENTS (manual)
# ============================================================
doc.add_heading('Table of Contents', level=1)
toc_items = [
    ('1.', 'Introduction'),
    ('2.', 'Platform Architecture Overview'),
    ('3.', 'Infrastructure Services'),
    ('4.', 'Module Descriptions'),
    ('4.1', 'API Gateway'),
    ('4.2', 'Authentication & Authorization Service'),
    ('4.3', 'Document Service'),
    ('4.4', 'Search Service'),
    ('4.5', 'Workflow Service'),
    ('4.6', 'Retention Service'),
    ('4.7', 'Audit Service'),
    ('4.8', 'Notification Service'),
    ('5.', 'Document Lifecycle'),
    ('5.1', 'Phase 1 – Upload & Ingestion'),
    ('5.2', 'Phase 2 – Storage & Metadata Persistence'),
    ('5.3', 'Phase 3 – Search Indexing & Content Extraction'),
    ('5.4', 'Phase 4 – PII Detection & GDPR Scanning'),
    ('5.5', 'Phase 5 – Audit Logging'),
    ('5.6', 'Phase 6 – Workflow & Approvals'),
    ('5.7', 'Phase 7 – Check-Out / Check-In'),
    ('5.8', 'Phase 8 – Retention & Disposition'),
    ('5.9', 'Phase 9 – Archival & Deletion'),
    ('6.', 'Document Lifecycle Diagram'),
    ('7.', 'Plugin Ecosystem'),
    ('8.', 'Frontend Modules'),
    ('9.', 'Entity Relationship Summary'),
]
for num, title_text in toc_items:
    p = doc.add_paragraph()
    indent = 0 if '.' not in num or num.endswith('.') else 1
    p.paragraph_format.left_indent = Cm(indent * 1.27)
    run = p.add_run(f'{num}  {title_text}')
    run.font.size = Pt(11)

doc.add_page_break()

# ============================================================
# 1. INTRODUCTION
# ============================================================
doc.add_heading('1. Introduction', level=1)
doc.add_paragraph(
    'Apex Nexus is a comprehensive Enterprise Content Management (ECM) platform designed to '
    'manage the full lifecycle of digital documents within an organisation. Built on a cloud-native '
    'microservice architecture, the platform provides document storage, versioning, full-text search, '
    'workflow automation, retention management, audit logging, real-time collaboration, and compliance '
    'enforcement.'
)
doc.add_paragraph(
    'This document describes the function of each module in the platform and traces the complete '
    'lifecycle of a document from the moment it is uploaded until its eventual archival or disposition.'
)

# ============================================================
# 2. PLATFORM ARCHITECTURE OVERVIEW
# ============================================================
doc.add_heading('2. Platform Architecture Overview', level=1)
doc.add_paragraph(
    'Apex Nexus is composed of seven backend microservices, an API gateway, and a Next.js frontend, '
    'orchestrated via Docker Compose across 14 containers. All inter-service communication uses '
    'asynchronous Redis queues for events (audit, search indexing) and synchronous REST for direct queries.'
)

doc.add_heading('Technology Stack', level=2)
add_table(
    ['Layer', 'Technology', 'Version'],
    [
        ['Backend', 'Java / Spring Boot', '21 / 3.3.0'],
        ['Frontend', 'Next.js (React)', '14.2.0'],
        ['API Gateway', 'Spring Cloud Gateway', '2024.0.x'],
        ['Database', 'PostgreSQL', '16'],
        ['Cache / Queue', 'Redis', '7'],
        ['Object Storage', 'MinIO (S3-compatible)', 'Latest'],
        ['Search Engine', 'Elasticsearch', '8.12.0'],
        ['Content Extraction', 'Apache Tika', 'Embedded'],
        ['AI / ML', 'Ollama (local LLM)', 'Latest'],
        ['Containerisation', 'Docker Compose', 'V2'],
    ]
)

# ============================================================
# 3. INFRASTRUCTURE SERVICES
# ============================================================
doc.add_heading('3. Infrastructure Services', level=1)
doc.add_paragraph(
    'The following infrastructure services support the application microservices:'
)
add_table(
    ['Service', 'Port', 'Purpose'],
    [
        ['PostgreSQL 16', '5460', 'Primary relational database for all persistent state'],
        ['Redis 7', '6479', 'Caching, distributed locks, event queues, presence TTL'],
        ['MinIO', '9000 / 9001', 'S3-compatible object storage for document files'],
        ['Elasticsearch 8.12', '9200', 'Full-text search index and content analytics'],
        ['Kibana 8.12', '5601', 'Elasticsearch visualisation dashboard (optional)'],
        ['Ollama', '11434', 'Local LLM for AI classification and workflow assistance'],
    ]
)

doc.add_heading('MinIO Storage Buckets', level=2)
bullet('apex-documents – Primary document file storage')
bullet('apex-documents-encrypted – Encrypted copies of sensitive documents')
bullet('apex-thumbnails – Document preview thumbnails')

# ============================================================
# 4. MODULE DESCRIPTIONS
# ============================================================
doc.add_heading('4. Module Descriptions', level=1)

# --- 4.1 Gateway ---
doc.add_heading('4.1  API Gateway', level=2)
doc.add_paragraph(
    'The API Gateway is the single entry point for all client requests. It routes traffic to the '
    'appropriate backend microservice, enforces CORS policies, and supports file uploads up to 500 MB.'
)
add_table(
    ['Property', 'Value'],
    [
        ['Internal Port', '8080'],
        ['External Port', '9600'],
        ['Framework', 'Spring Cloud Gateway'],
        ['Max Upload Size', '500 MB'],
    ]
)
doc.add_heading('Route Table', level=3)
add_table(
    ['Path Prefix', 'Target Service', 'Description'],
    [
        ['/api/auth/**', 'Auth Service', 'Authentication, users, roles'],
        ['/api/projects/**', 'Auth Service', 'Project management'],
        ['/api/governance/**', 'Auth Service', 'AI governance policies'],
        ['/api/documents/**', 'Document Service', 'Document CRUD, check-out/in'],
        ['/api/folders/**', 'Document Service', 'Folder management'],
        ['/api/notes/**', 'Document Service', 'Document annotations'],
        ['/api/email-ingestion/**', 'Document Service', 'Email-to-document ingestion'],
        ['/api/webdav/**', 'Document Service', 'Edit-in-place (WebDAV)'],
        ['/api/wopi/**', 'Document Service', 'Office Online co-authoring'],
        ['/api/locks/**', 'Document Service', 'Distributed document locking'],
        ['/api/workflows/**', 'Workflow Service', 'Workflow instances'],
        ['/api/approvals/**', 'Workflow Service', 'Approval routing'],
        ['/api/ai/**', 'Workflow Service', 'AI assistance'],
        ['/api/search/**', 'Search Service', 'Full-text search'],
        ['/api/retention/**', 'Retention Service', 'Retention policies'],
        ['/api/disposition/**', 'Retention Service', 'Disposition queue'],
        ['/api/audit/**', 'Audit Service', 'Audit log queries'],
        ['/api/notifications/**', 'Notification Service', 'Notifications & presence'],
    ]
)

# --- 4.2 Auth Service ---
doc.add_heading('4.2  Authentication & Authorisation Service', level=2)
doc.add_paragraph(
    'The Auth Service manages user identity, JWT-based authentication, role-based access control (RBAC), '
    'project management, plugin registration, industry compliance templates, AI governance policies, '
    'and secure share link generation.'
)
doc.add_heading('Key Functions', level=3)
bullet('User Authentication – Issue and validate JSON Web Tokens (JWT)')
bullet('Role-Based Access Control – Define roles with fine-grained permissions')
bullet('Project Management – Hierarchical projects with retention and privacy defaults')
bullet('Plugin Registry – Install, enable, and configure plugins per project')
bullet('Industry Templates – Pre-built compliance templates for regulated industries')
bullet('AI Governance – Define policies controlling AI usage within projects')
bullet('Share Links – Generate time-limited, permission-scoped links for external sharing')
bullet('Permission Management – Granular per-user, per-project permissions')

doc.add_heading('Key Entities', level=3)
add_table(
    ['Entity', 'Description'],
    [
        ['User', 'User account with username, email, enabled flag, and role assignments'],
        ['Role', 'Named permission set (e.g., ADMIN, EDITOR, VIEWER)'],
        ['Project', 'Workspace with retention defaults, privacy settings, jurisdiction code'],
        ['AiGovernancePolicy', 'Rules governing AI feature usage within a project'],
        ['ProjectPlugin', 'Junction: links plugins to projects with configuration'],
        ['ShareLink', 'Secure, time-limited document share with permission scope'],
    ]
)

# --- 4.3 Document Service ---
doc.add_heading('4.3  Document Service', level=2)
doc.add_paragraph(
    'The Document Service is the core of the platform. It handles document upload, storage, versioning, '
    'check-out/check-in, locking, notes, signatures, email ingestion, WebDAV, WOPI, and integration '
    'with search indexing, audit logging, PII detection, and anomaly detection.'
)
doc.add_heading('Key Functions', level=3)
bullet('Document Upload & Download – Multipart upload, SHA-256 integrity, MinIO storage')
bullet('Version Management – Major/minor version types with full history')
bullet('Check-Out / Check-In – Optimistic locking via Redis + database flag')
bullet('Distributed Locking – Redis SETEX-based locks with TTL and heartbeat')
bullet('Folder Organisation – Hierarchical folder tree with project association')
bullet('Document Notes – Annotations, comments, and discussion threads')
bullet('Digital Signatures – eSignature workflow (request, sign, verify)')
bullet('Email Ingestion – IMAP and EWS (Exchange) protocols for email-to-document conversion')
bullet('WebDAV Support – Edit-in-place from file explorers and desktop apps')
bullet('WOPI Integration – Microsoft Office Online co-authoring')
bullet('Legal Hold – Prevent modification or disposition of held documents')
bullet('Retention Inheritance – Inherit retention period from project and jurisdiction')
bullet('Search Index Publishing – Publish INDEX/REINDEX/UPDATE/DELETE events to Redis')
bullet('Audit Event Publishing – Publish CREATE/UPDATE/DELETE/DOWNLOAD/CHECKOUT/CHECKIN events')
bullet('PII Redaction – Apply regex-based redaction when privacy mode enabled')
bullet('Anomaly Detection – AI-powered version comparison for suspicious changes')

doc.add_heading('Key Entities', level=3)
add_table(
    ['Entity', 'Description'],
    [
        ['Document', 'Primary entity: metadata, status, retention, PII flags, storage pointer'],
        ['DocumentVersion', 'Version history: versionNumber, SHA-256, storageKey, changeSummary'],
        ['DocumentNote', 'Annotation or comment attached to a document'],
        ['DocumentSignature', 'eSignature record with status (PENDING, SIGNED, REJECTED)'],
        ['Folder', 'Hierarchical folder with parent reference and project association'],
        ['EmailIngestionConfig', 'IMAP/EWS mail server configuration for email ingestion'],
        ['EmailIngestionRule', 'Filter rules (from, subject, attachment) for email routing'],
        ['WopiAccessToken', 'Temporary session token for Office Online editing'],
    ]
)

# --- 4.4 Search Service ---
doc.add_heading('4.4  Search Service', level=2)
doc.add_paragraph(
    'The Search Service provides full-text search over all documents. It consumes indexing events from '
    'a Redis queue, extracts content using Apache Tika, scans for PII (GDPR compliance), optionally '
    'classifies documents using AI, and indexes everything into Elasticsearch.'
)
doc.add_heading('Key Functions', level=3)
bullet('Redis Queue Consumer – Processes INDEX, REINDEX, UPDATE, DELETE, EXTRACT_CONTENT events')
bullet('Content Extraction – Tika-based extraction from PDF, Office, images, and archives')
bullet('Full-Text Indexing – Stores extracted text and metadata in Elasticsearch')
bullet('GDPR / PII Scanning – Detects email, phone, IBAN, credit card, SSN, DOB, passport, etc.')
bullet('PII Severity Classification – NONE, LOW, MEDIUM, HIGH, CRITICAL based on finding types')
bullet('AI Document Classification – Machine-learning category assignment (when plugin active)')
bullet('Microsoft 365 Link Generation – SharePoint link creation (when M365 plugin active)')
bullet('Semantic Embeddings – Vector embeddings for similarity search')

doc.add_heading('PII Detection Patterns', level=3)
add_table(
    ['Pattern', 'Description', 'Severity'],
    [
        ['EMAIL', 'Email addresses', 'LOW'],
        ['PHONE', 'International, DE, US, UK phone numbers', 'LOW'],
        ['IP_ADDRESS', 'IPv4 addresses', 'LOW'],
        ['DOB', 'Dates of birth', 'MEDIUM'],
        ['IBAN', 'Bank account numbers (IBAN format)', 'HIGH'],
        ['CREDIT_CARD', 'Visa, MasterCard, Amex numbers', 'HIGH'],
        ['SSN_DE', 'German social insurance number', 'CRITICAL'],
        ['TAX_ID_DE', 'German tax identification number', 'CRITICAL'],
        ['PASSPORT', 'Passport document numbers', 'HIGH'],
        ['HEALTH_ID_DE', 'German health insurance number', 'HIGH'],
    ]
)

# --- 4.5 Workflow Service ---
doc.add_heading('4.5  Workflow Service', level=2)
doc.add_paragraph(
    'The Workflow Service provides document workflow orchestration with a configurable state machine. '
    'It supports multi-step approval routing, escalation rules, delegation, and AI-powered workflow '
    'assistance.'
)
doc.add_heading('Key Functions', level=3)
bullet('Workflow Definitions – Define states, transitions, and escalation rules as structured data')
bullet('Workflow Instances – Execute workflows against documents with state tracking')
bullet('Approval Routing – Route approvals to groups or individuals')
bullet('Escalation Rules – Automatic escalation after configurable timeout periods')
bullet('Delegation / Forwarding – Forward approval tasks to delegates')
bullet('Workflow Templates – Reusable workflow patterns for common processes')
bullet('AI Assistance – AI-powered recommendations for workflow configuration')

doc.add_heading('Workflow States', level=3)
doc.add_paragraph(
    'Documents progress through a defined state machine:'
)
bullet('DRAFT → Initial state after creation')
bullet('REVIEW → Document submitted for review')
bullet('PENDING_APPROVAL → Awaiting approver decision')
bullet('APPROVED → All approvals granted')
bullet('ARCHIVED → Document archived after approval')
bullet('CORRECTION → Returned for changes (from REVIEW or PENDING_APPROVAL)')
bullet('REJECTED → Approval denied')
bullet('CANCELLED → Workflow cancelled by initiator')

# --- 4.6 Retention Service ---
doc.add_heading('4.6  Retention Service', level=2)
doc.add_paragraph(
    'The Retention Service manages document retention policies and automated disposition. It enforces '
    'jurisdiction-specific minimum retention periods and processes expired documents through a '
    'disposition queue with approval requirements.'
)
doc.add_heading('Key Functions', level=3)
bullet('Retention Policy Management – Define retention periods (years), auto-dispose, approval flags')
bullet('Jurisdiction Rules – Country/region-specific minimum retention periods')
bullet('Retention Inheritance – Documents inherit retention from their project and jurisdiction')
bullet('Expiration Scanning – Daily scheduled job (2:00 AM) identifies documents past retention')
bullet('Disposition Queue – Expired documents queued with 30-day grace period')
bullet('Disposition Approval – Optional approval workflow before final disposition')
bullet('Legal Hold Enforcement – Documents under legal hold are excluded from disposition')

doc.add_heading('Disposition Item States', level=3)
add_table(
    ['State', 'Description'],
    [
        ['PENDING', 'Queued for disposition, within 30-day grace period'],
        ['APPROVED', 'Disposition approved (if approval required)'],
        ['DISPOSED', 'Document permanently deleted from storage'],
        ['CANCELLED', 'Disposition cancelled (e.g., legal hold applied)'],
    ]
)

# --- 4.7 Audit Service ---
doc.add_heading('4.7  Audit Service', level=2)
doc.add_paragraph(
    'The Audit Service maintains an immutable, tamper-evident audit log of all actions performed on the '
    'platform. It consumes audit events from a Redis queue and persists them with SHA-256 hash chaining '
    'to detect any post-hoc tampering.'
)
doc.add_heading('Key Functions', level=3)
bullet('Redis Queue Consumer – Batch consumes audit events (batch size: 100, poll: 2 seconds)')
bullet('Tamper-Evident Hash Chain – Each entry: entryHash = SHA-256(previousHash + entryData)')
bullet('Sequence Numbering – Monotonically increasing sequence for continuity verification')
bullet('Event Tracking – Tracks userId, action, resourceType, resourceId, IP, User-Agent')
bullet('Audit Querying – Filter by user, action, resource, date range')
bullet('Audit Reports – Generate compliance reports for regulators')

doc.add_heading('Tracked Actions', level=3)
add_table(
    ['Action', 'Description'],
    [
        ['CREATE', 'Document or resource created'],
        ['UPDATE', 'Metadata or content updated'],
        ['DELETE', 'Document or resource deleted'],
        ['DOWNLOAD', 'Document file downloaded'],
        ['CHECKOUT', 'Document checked out for editing'],
        ['CHECKIN', 'Document checked in with new version'],
        ['VIEW', 'Document viewed or previewed'],
        ['SHARE', 'Share link created'],
        ['WORKFLOW_START', 'Workflow instance started'],
        ['WORKFLOW_APPROVE', 'Workflow approval granted'],
        ['WORKFLOW_REJECT', 'Workflow approval rejected'],
        ['LEGAL_HOLD', 'Legal hold applied to document'],
        ['DISPOSITION', 'Document disposed after retention expiry'],
    ]
)

# --- 4.8 Notification Service ---
doc.add_heading('4.8  Notification Service', level=2)
doc.add_paragraph(
    'The Notification Service provides real-time communication via WebSocket connections. It tracks '
    'which users are actively viewing documents (presence) and delivers instant notifications for '
    'events such as approvals, comments, and workflow transitions.'
)
doc.add_heading('Key Functions', level=3)
bullet('WebSocket Connections – Persistent bidirectional connections for real-time updates')
bullet('Presence Tracking – Track which users are viewing which documents (5-minute TTL)')
bullet('Heartbeat Mechanism – 30-second heartbeat to maintain presence state')
bullet('Real-Time Notifications – Instant alerts for workflow, approval, and comment events')
bullet('Redis-Backed State – Presence data stored in Redis for cross-instance consistency')

# ============================================================
# 5. DOCUMENT LIFECYCLE
# ============================================================
doc.add_heading('5. Document Lifecycle', level=1)
doc.add_paragraph(
    'This section traces the complete lifecycle of a document from upload through to eventual '
    'disposition. Each phase involves one or more microservices working together.'
)

# --- 5.1 Upload ---
doc.add_heading('5.1  Phase 1 – Upload & Ingestion', level=2)
doc.add_paragraph(
    'A document enters the system through one of two paths:'
)
doc.add_heading('Manual Upload', level=3)
doc.add_paragraph(
    'The user uploads a file via the web UI or API. The request is a multipart form containing '
    'the file binary and metadata (title, description, folder ID, project ID, custom metadata).'
)
bullet('Client sends HTTP POST to /api/documents with multipart/form-data')
bullet('API Gateway routes the request to the Document Service')
bullet('DocumentController receives the file and metadata payload')

doc.add_heading('Email Ingestion', level=3)
doc.add_paragraph(
    'Alternatively, documents arrive via configured email servers:'
)
bullet('EmailIngestionService connects to IMAP or EWS (Exchange) mail servers on a polling schedule')
bullet('Emails matching configured rules (sender, subject, attachments) are converted to documents')
bullet('Attachments are extracted and stored as individual documents')
bullet('The source email metadata is preserved in the document record')

# --- 5.2 Storage ---
doc.add_heading('5.2  Phase 2 – Storage & Metadata Persistence', level=2)
doc.add_paragraph('Once the Document Service receives the file, the following steps execute within a single database transaction:')

doc.add_heading('Step 1: File Processing', level=3)
bullet('Calculate SHA-256 cryptographic hash of the file bytes for integrity verification')
bullet('Generate a unique objectGuid (UUID) as the immutable document identifier')
bullet('Determine MIME type and file extension')
bullet('Construct storage key: documents/{objectGuid}/v1/{filename}')

doc.add_heading('Step 2: Retention Inheritance', level=3)
bullet('Resolve the project (from explicit projectId or parent folder\'s projectId)')
bullet('Query the project for default_retention_period_years, privacy_redaction_enabled, and jurisdiction_code')
bullet('Query jurisdiction rules for jurisdiction-specific minimum retention periods')
bullet('Apply the maximum of: explicit retention, project default, and jurisdiction minimum')
bullet('Set retentionStartDate = current timestamp')

doc.add_heading('Step 3: MinIO Storage', level=3)
bullet('StorageService encrypts the file and uploads it to the MinIO apex-documents bucket via S3 API')
bullet('The storage key serves as the pointer for future retrieval')

doc.add_heading('Step 4: Database Records', level=3)
doc.add_paragraph('Two records are created in PostgreSQL:')
bullet('Document record – Contains all metadata: title, description, folder, project, MIME type, '
       'SHA-256 hash, file size, storage key, author, status (DRAFT), version (1), retention period, '
       'PII flags, and custom metadata JSON')
bullet('DocumentVersion record (v1) – Links to the document with version number 1, SHA-256 hash, '
       'file size, storage key, author, and change summary "Initial upload"')

# --- 5.3 Search Indexing ---
doc.add_heading('5.3  Phase 3 – Search Indexing & Content Extraction', level=2)
doc.add_paragraph(
    'After the database transaction commits, an INDEX event is published to the Redis queue '
    '(apex:search:index-queue). The Search Service processes this asynchronously:'
)
bullet('IndexQueueProcessor polls the Redis queue every 5 seconds')
bullet('ContentExtractorService uses Apache Tika to extract text from the file '
       '(supports PDF, DOCX, XLSX, PPTX, images with OCR, and more)')
bullet('The extracted text is added to the document\'s search record as the "content" field')
bullet('If the AI Classification plugin is active, ClassificationService categorises the document '
       'using machine learning and writes the classification label back to PostgreSQL')
bullet('If the Microsoft 365 plugin is active, a SharePoint link is generated and stored')
bullet('SearchService indexes the enriched document into Elasticsearch for full-text search')

# --- 5.4 PII Detection ---
doc.add_heading('5.4  Phase 4 – PII Detection & GDPR Scanning', level=2)
doc.add_paragraph(
    'During the search indexing phase, GdprScannerService scans the extracted text content for '
    'personally identifiable information (PII):'
)
bullet('Regex patterns detect email addresses, phone numbers, IBAN, credit cards, SSNs, dates of birth, '
       'tax IDs, passport numbers, IP addresses, and health insurance numbers')
bullet('Each finding is categorised with a severity level (NONE, LOW, MEDIUM, HIGH, CRITICAL)')
bullet('The overall PII severity is the maximum of all individual findings')
bullet('The Document entity is updated: piiDetected = true/false, piiFindingsJson = detailed results, '
       'piiSeverity = maximum severity')
bullet('If the document\'s project has privacy_redaction_enabled = true, PiiRedactionService replaces '
       'detected PII with redaction blocks (e.g., [REDACTED-EMAIL], [REDACTED-IBAN])')

# --- 5.5 Audit ---
doc.add_heading('5.5  Phase 5 – Audit Logging', level=2)
doc.add_paragraph(
    'Simultaneously with the search indexing, a CREATE audit event is published to the Redis '
    'audit queue (apex:audit:events):'
)
bullet('AuditPublisher sends the event with userId, action (CREATE), resourceType (DOCUMENT), '
       'resourceId, resourceName, and details (SHA-256, file size)')
bullet('AuditConsumerService in the Audit Service consumes the event in batches')
bullet('Each entry receives a monotonically increasing sequence number')
bullet('A tamper-evident hash chain is maintained: entryHash = SHA-256(previousHash + entryData)')
bullet('The first entry in the chain uses "GENESIS" as the previous hash')
bullet('The entry is persisted to the audit_log table in PostgreSQL')

# --- 5.6 Workflow ---
doc.add_heading('5.6  Phase 6 – Workflow & Approvals', level=2)
doc.add_paragraph(
    'Once a document is created, it can be submitted to a workflow for review and approval:'
)
bullet('A user (or automated rule) starts a WorkflowInstance against the document')
bullet('The document status changes from DRAFT to REVIEW')
bullet('The workflow engine evaluates the first transition and routes to the appropriate approval group')
bullet('Approvers receive real-time notifications via WebSocket')
bullet('Each approver can APPROVE, REJECT, or FORWARD the task')
bullet('If all required approvals are granted, the document moves to APPROVED')
bullet('If rejected, the document moves to CORRECTION and the author is notified')
bullet('Escalation rules auto-escalate unresolved approvals after the configured timeout')
bullet('The final approved document can be moved to ARCHIVED status')

# --- 5.7 Check-Out / Check-In ---
doc.add_heading('5.7  Phase 7 – Check-Out / Check-In (Versioning)', level=2)
doc.add_paragraph(
    'When a user needs to edit a document, the check-out/check-in mechanism ensures only one user '
    'can modify the document at a time:'
)
doc.add_heading('Check-Out', level=3)
bullet('User requests check-out via the UI or API')
bullet('LockService attempts a Redis SETEX lock: key = lock:{documentId}, value = userId, TTL = 30 minutes')
bullet('If the lock is acquired, the Document record is updated: isCheckedOut = true, checkedOutBy = userId')
bullet('The user downloads the current version for editing')
bullet('The UI starts a heartbeat (every 30 seconds) to maintain the lock')
bullet('A CHECKOUT audit event is published')

doc.add_heading('Check-In', level=3)
bullet('User uploads the modified file with a change summary and version type (MAJOR or MINOR)')
bullet('Validations: document must be checked out by the same user; legal hold must not be active')
bullet('A new DocumentVersion record is created with the next version number')
bullet('The file is stored in MinIO with key: documents/{objectGuid}/v{n}/{filename}')
bullet('The Document record is updated with the new version, hash, size, and storage key')
bullet('The Redis lock is released and all associated keys are deleted')
bullet('A REINDEX event is published to re-extract content and update the Elasticsearch index')
bullet('Anomaly detection runs asynchronously: the AI compares the new version to previous versions '
       'to detect suspicious changes (large deletions, format changes, unexpected insertions)')
bullet('A CHECKIN audit event is published')

# --- 5.8 Retention ---
doc.add_heading('5.8  Phase 8 – Retention & Disposition', level=2)
doc.add_paragraph(
    'The Retention Service enforces document lifecycle policies:'
)
bullet('Each document has a retentionStartDate and retentionPeriodYears')
bullet('A scheduled job runs daily at 2:00 AM to scan for expired documents')
bullet('Expired documents (where retentionStartDate + retentionPeriodYears < now) are identified')
bullet('Documents under legal hold are excluded from disposition')
bullet('Eligible documents are added to the disposition queue with a 30-day grace period')
bullet('If the retention policy requires approval, a disposition approval workflow is triggered')
bullet('After approval (or automatic expiry of the grace period), the document is marked for disposition')

# --- 5.9 Archival & Deletion ---
doc.add_heading('5.9  Phase 9 – Archival & Deletion', level=2)
doc.add_paragraph(
    'The final phase of the document lifecycle:'
)
bullet('Approved disposition items are processed by the Retention Service')
bullet('The document file is deleted from MinIO storage (all versions)')
bullet('The Elasticsearch index entry is removed via a DELETE event')
bullet('The document record in PostgreSQL is marked as DISPOSED')
bullet('A DISPOSITION audit event is published for compliance records')
bullet('The audit log entry for this action is permanent and cannot be deleted')

# ============================================================
# 6. DOCUMENT LIFECYCLE DIAGRAM
# ============================================================
doc.add_heading('6. Document Lifecycle Diagram', level=1)
doc.add_paragraph(
    'The following diagram summarises the document lifecycle from upload to disposition:'
)
doc.add_paragraph()

flow_text = (
    '┌──────────────────────────────────────────────────────────────────────┐\n'
    '│                        DOCUMENT LIFECYCLE                           │\n'
    '├──────────────────────────────────────────────────────────────────────┤\n'
    '│                                                                     │\n'
    '│   ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐  │\n'
    '│   │ UPLOAD  │────▶│  STORE   │────▶│  INDEX   │────▶│  SCAN    │  │\n'
    '│   │ (API/   │     │ (MinIO + │     │ (Tika +  │     │ (GDPR    │  │\n'
    '│   │  Email) │     │  Postgres)│    │  ES)     │     │  PII)    │  │\n'
    '│   └─────────┘     └──────────┘     └──────────┘     └────┬─────┘  │\n'
    '│                                                          │         │\n'
    '│        ┌─────────────────────────────────────────────────┘         │\n'
    '│        ▼                                                           │\n'
    '│   ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐  │\n'
    '│   │  AUDIT  │     │ WORKFLOW │────▶│ APPROVAL │────▶│ APPROVED │  │\n'
    '│   │ (Hash   │     │ (State   │     │ (Route / │     │          │  │\n'
    '│   │  Chain) │     │  Machine)│     │  Escalate│     │          │  │\n'
    '│   └─────────┘     └──────────┘     └──────────┘     └────┬─────┘  │\n'
    '│                                                          │         │\n'
    '│        ┌─────────────────────────────────────────────────┘         │\n'
    '│        ▼                                                           │\n'
    '│   ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐  │\n'
    '│   │CHECK-OUT│────▶│  EDIT    │────▶│CHECK-IN  │────▶│ REINDEX  │  │\n'
    '│   │(Lock)   │     │(Download)│     │(Version) │     │(+Anomaly)│  │\n'
    '│   └─────────┘     └──────────┘     └──────────┘     └──────────┘  │\n'
    '│                                                                    │\n'
    '│   ┌──────────────────────────────────────────────────────────────┐ │\n'
    '│   │ RETENTION: Daily scan → Disposition Queue → Grace Period    │ │\n'
    '│   │            → Approval (optional) → DISPOSE / ARCHIVE       │ │\n'
    '│   └──────────────────────────────────────────────────────────────┘ │\n'
    '└──────────────────────────────────────────────────────────────────────┘\n'
)

p = doc.add_paragraph()
run = p.add_run(flow_text)
run.font.name = 'Consolas'
run.font.size = Pt(8)

# ============================================================
# 7. PLUGIN ECOSYSTEM
# ============================================================
doc.add_heading('7. Plugin Ecosystem', level=1)
doc.add_paragraph(
    'Apex Nexus supports a marketplace-based plugin system that extends platform functionality. '
    'Plugins are registered in the Auth Service and activated per project.'
)
add_table(
    ['Plugin', 'Description', 'Integration Point'],
    [
        ['AI Document Classification', 'ML-based automatic document categorisation',
         'Search Service: triggered during indexing, writes classification_label to DB'],
        ['Microsoft 365 Integration', 'SharePoint link generation and Office Online co-authoring',
         'Search Service: generates M365 link; Document Service: WOPI tokens'],
        ['AI Governance', 'Policy enforcement for AI feature usage',
         'Auth Service: per-project policy; Workflow Service: AI assistance restrictions'],
        ['SAP Integration', 'Bidirectional data sync with SAP systems',
         'Auth Service: plugin hooks; dedicated /sap frontend page'],
        ['Digital Signatures', 'eSignature workflow with request/sign/verify',
         'Document Service: SignatureController and SignatureService'],
    ]
)

# ============================================================
# 8. FRONTEND MODULES
# ============================================================
doc.add_heading('8. Frontend Modules', level=1)
doc.add_paragraph(
    'The Next.js 14 frontend provides the following protected pages (requires authentication):'
)
add_table(
    ['Page', 'Path', 'Description'],
    [
        ['Documents', '/documents', 'Browse, upload, preview, check-out/in, versions, notes, signatures'],
        ['Folders', '/folders', 'Create and navigate the folder hierarchy'],
        ['Projects', '/projects', 'Create and manage projects with team members'],
        ['Search', '/search', 'Full-text search across all documents'],
        ['Audit Log', '/audit', 'View immutable audit trail with tamper verification'],
        ['Workflow', '/workflow', 'Track workflow instances and approval status'],
        ['Workflow Designer', '/workflow-designer', 'Visual editor for workflow state machines'],
        ['Retention', '/retention', 'Manage retention policies and disposition queue'],
        ['Compliance', '/compliance', 'Compliance dashboard with policy adherence metrics'],
        ['Notifications', '/notifications', 'Real-time notification center'],
        ['Analytics', '/analytics', 'Document metrics, usage statistics, and trends'],
        ['User Management', '/admin/users', 'Create, enable/disable users, assign roles'],
        ['System Settings', '/admin/settings', 'Global platform configuration'],
        ['Marketplace', '/marketplace', 'Browse, install, and configure plugins'],
        ['Industry Templates', '/industry', 'Pre-built compliance templates by industry vertical'],
        ['Email Ingestion', '/email-ingestion', 'Configure IMAP/EWS email servers for document import'],
        ['Trust Center', '/trust-center', 'Privacy policy, security posture, audit reports'],
        ['SAP Integration', '/sap', 'SAP data synchronisation and workflow triggers'],
    ]
)

# ============================================================
# 9. ENTITY RELATIONSHIP SUMMARY
# ============================================================
doc.add_heading('9. Entity Relationship Summary', level=1)
doc.add_paragraph(
    'The following table summarises the key entities and their relationships across services:'
)
add_table(
    ['Entity', 'Service', 'Key Relationships'],
    [
        ['User', 'Auth', 'Has many: Documents (author), WorkflowInstances, AuditEntries; Belongs to: Roles (M:N), Projects (M:N)'],
        ['Project', 'Auth', 'Has many: Documents, Folders, Members; Belongs to: Parent Project (self-ref); Has one: Owner (User)'],
        ['Document', 'Document', 'Has many: Versions, Notes, Signatures; Belongs to: Folder, Project, Author (User)'],
        ['DocumentVersion', 'Document', 'Belongs to: Document, Author (User)'],
        ['Folder', 'Document', 'Has many: Documents, Child Folders; Belongs to: Parent Folder (self-ref), Project'],
        ['WorkflowDefinition', 'Workflow', 'Has many: Instances; Created by: User'],
        ['WorkflowInstance', 'Workflow', 'Has many: Approvals; Belongs to: Definition, Initiator (User)'],
        ['RetentionPolicy', 'Retention', 'Has many: DispositionItems'],
        ['AuditLogEntry', 'Audit', 'Belongs to: User; Chain-linked to: Previous Entry (hash)'],
        ['EmailIngestionConfig', 'Document', 'Has many: Rules; Belongs to: Project'],
    ]
)

# ============================================================
# SAVE
# ============================================================
output_path = r'c:\Users\ze9167867\Desktop\Apex Nexus\Apex_Nexus_Module_Functions_and_Document_Lifecycle.docx'
doc.save(output_path)
print(f'Document saved to: {output_path}')
