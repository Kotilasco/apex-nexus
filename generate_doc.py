"""Generate Apex Nexus Documentation Word Document."""

from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
import os

doc = Document()

# ── Style setup ──────────────────────────────────────────────────────────
style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(11)
style.paragraph_format.space_after = Pt(6)

for level in range(1, 4):
    hs = doc.styles[f"Heading {level}"]
    hs.font.color.rgb = RGBColor(0x1B, 0x3A, 0x5C)

def add_table(headers, rows):
    """Add a formatted table."""
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Light Grid Accent 1"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = h
        for p in cell.paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(10)
    for row_data in rows:
        cells = table.add_row().cells
        for i, val in enumerate(row_data):
            cells[i].text = str(val)
            for p in cells[i].paragraphs:
                for r in p.runs:
                    r.font.size = Pt(10)
    doc.add_paragraph()
    return table

# ── Title Page ───────────────────────────────────────────────────────────
for _ in range(6):
    doc.add_paragraph()

title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run("APEX NEXUS")
run.font.size = Pt(36)
run.bold = True
run.font.color.rgb = RGBColor(0x1B, 0x3A, 0x5C)

subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = subtitle.add_run("Enterprise Content Management System")
run.font.size = Pt(20)
run.font.color.rgb = RGBColor(0x4A, 0x6F, 0xA5)

doc.add_paragraph()

desc = doc.add_paragraph()
desc.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = desc.add_run("Application Documentation\nFunctions, Users, Roles & Operations Guide")
run.font.size = Pt(14)
run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

for _ in range(4):
    doc.add_paragraph()

meta = doc.add_paragraph()
meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = meta.add_run("Version 3.0\nApril 2026")
run.font.size = Pt(12)
run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)

doc.add_page_break()

# ── Table of Contents placeholder ────────────────────────────────────────
doc.add_heading("Table of Contents", level=1)
toc_items = [
    "1. Executive Overview",
    "2. System Architecture",
    "3. User Roles & Permissions",
    "4. Authentication & Security",
    "5. Document Management",
    "6. Workflow & Approval System",
    "7. Search & Discovery",
    "8. Retention & Legal Compliance",
    "9. Audit Logging & Compliance",
    "10. Notifications & Real-Time Updates",
    "11. AI Governance & Trust Framework",
    "12. Project-Scoped Features",
    "13. OCR & Content Extraction",
    "14. Automated Classification",
    "15. Semantic / Vector Search",
    "16. Document Signatures",
    "17. GDPR Privacy Scanner",
    "18. Public Link Sharing",
    "19. Real-Time Presence",
    "20. Ad-Hoc Workflow Forwarding",
    "21. Web Document Previewer",
    "22. Office Add-in Integration",
    "23. Frontend Application",
    "24. API Integration Guide",
    "25. Deployment & Infrastructure",
]
for item in toc_items:
    p = doc.add_paragraph(item)
    p.paragraph_format.space_after = Pt(2)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 1. EXECUTIVE OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("1. Executive Overview", level=1)

doc.add_paragraph(
    "Apex Nexus is a modern, cloud-native Enterprise Content Management (ECM) system "
    "built on a microservices architecture. It is designed to replace legacy document "
    "management systems such as ELO Digital Office with a scalable, secure, and "
    "feature-rich platform."
)

doc.add_paragraph(
    "The system provides comprehensive document management, workflow automation, "
    "full-text search, retention compliance, multi-level role-based access control "
    "(RBAC), and AI governance controls — all secured with AES-256-GCM encryption "
    "at rest and TLS 1.3 in transit."
)

doc.add_heading("Technology Stack", level=2)
add_table(
    ["Component", "Technology", "Version"],
    [
        ["Backend", "Java / Spring Boot", "Java 21 / Spring Boot 3.3"],
        ["Frontend (Web)", "Next.js / React / TypeScript", "Next.js 14 / React 18"],
        ["Frontend (Mobile)", "React Native / Expo", "React Native 0.74"],
        ["Database", "PostgreSQL", "16"],
        ["Search Engine", "Elasticsearch", "8.12"],
        ["Object Storage", "MinIO (S3-compatible)", "Latest"],
        ["Cache / Message Queue", "Redis", "7"],
        ["API Gateway", "Spring Cloud Gateway", "2023.0.2"],
        ["Authentication", "JWT (HS512)", "Stateless tokens"],
        ["Encryption", "AES-256-GCM", "Per-file IV"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 2. SYSTEM ARCHITECTURE
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("2. System Architecture", level=1)

doc.add_paragraph(
    "Apex Nexus follows a microservices architecture with 8 independent backend "
    "services, each responsible for a specific domain. All client traffic flows "
    "through a centralised API Gateway which handles routing, rate limiting, and "
    "CORS configuration."
)

doc.add_heading("2.1 Microservices Overview", level=2)
add_table(
    ["Service", "Internal Port", "Responsibility"],
    [
        ["API Gateway", "8080", "Centralised routing, rate limiting, CORS, load balancing"],
        ["Auth Service", "8081", "Authentication, user management, RBAC, AI governance, public share links"],
        ["Document Service", "8082", "Document upload, versioning, check-out/in, notes, legal holds, signatures, preview"],
        ["Workflow Service", "8083", "State-machine workflows, approvals, transitions, ad-hoc forwarding"],
        ["Search Service", "8084", "Full-text & semantic search, OCR/content extraction, classification, GDPR scanning"],
        ["Retention Service", "8085", "Retention policies, automated scans, disposition management"],
        ["Audit Service", "8086", "Immutable compliance logging, statistics, reporting"],
        ["Notification Service", "8087", "Real-time WebSocket + email notifications, document presence tracking"],
    ],
)

doc.add_heading("2.2 Infrastructure Components", level=2)
add_table(
    ["Component", "Purpose", "Notes"],
    [
        ["PostgreSQL 16", "Primary relational database", "Row-Level Security, immutable audit triggers"],
        ["Elasticsearch 8.12", "Full-text search index", "Custom analysers, fuzzy matching, faceting"],
        ["MinIO", "S3-compatible object storage", "Encrypted file storage, versioned buckets"],
        ["Redis 7", "Caching, session tracking, distributed locks", "JWT blacklist, document checkout locks"],
        ["MailHog (Dev)", "SMTP test server", "Captures outbound email in development"],
    ],
)

doc.add_heading("2.3 API Gateway Routing", level=2)
doc.add_paragraph(
    "The API Gateway routes requests based on URL path prefixes. Each route strips "
    "the /api prefix before forwarding to the target microservice."
)
add_table(
    ["Route Pattern", "Target Service", "Example"],
    [
        ["/api/auth/**", "Auth Service", "/api/auth/login → /auth/login"],
        ["/api/documents/**", "Document Service", "/api/documents/upload → /documents/upload"],
        ["/api/workflows/**", "Workflow Service", "/api/workflows/instances → /workflow/instances"],
        ["/api/search/**", "Search Service", "/api/search?q=term → /search?q=term"],
        ["/api/retention/**", "Retention Service", "/api/retention/policies → /retention/policies"],
        ["/api/audit/**", "Audit Service", "/api/audit/logs → /audit/logs"],
        ["/api/notifications/**", "Notification Service", "/api/notifications/my → /notification/my"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 3. USER ROLES & PERMISSIONS
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("3. User Roles & Permissions", level=1)

doc.add_paragraph(
    "Apex Nexus implements a comprehensive Role-Based Access Control (RBAC) system "
    "with both global platform roles and project-scoped permissions. Every user is "
    "assigned one or more global roles, and may additionally have project-specific "
    "permissions via project membership."
)

doc.add_heading("3.1 Global Roles", level=2)
doc.add_paragraph(
    "The following platform-wide roles define baseline access levels:"
)
add_table(
    ["Role", "Description", "Typical User"],
    [
        ["SYSTEM_ADMIN", "Full system access to all resources and settings", "IT Administrator"],
        ["RECORDS_MANAGER", "Manage retention policies, approve dispositions, legal holds", "Compliance Officer"],
        ["DEPARTMENT_ADMIN", "Administer users and documents within a department", "Team Lead / Department Head"],
        ["APPROVER", "Approve or reject documents in workflow processes", "Manager, Director"],
        ["AUTHOR", "Create, edit, and check-out/check-in documents", "Regular User / Employee"],
        ["VIEWER", "Read-only access to assigned documents", "Consultant, Guest, Auditor"],
        ["AI_OPERATOR", "Invoke AI features under governance controls", "Analyst (with oversight)"],
    ],
)

doc.add_heading("3.2 Permission Categories", level=2)

doc.add_heading("Document Permissions", level=3)
add_table(
    ["Permission", "Roles Granted", "Conditions"],
    [
        ["document.create", "AUTHOR, SYSTEM_ADMIN", "Always allowed"],
        ["document.read", "AUTHOR, VIEWER, SYSTEM_ADMIN", "User in ACL or document owner"],
        ["document.read_all", "SYSTEM_ADMIN", "Unrestricted (superuser)"],
        ["document.update", "AUTHOR, APPROVER, SYSTEM_ADMIN", "Document checked out by user"],
        ["document.delete", "AUTHOR, SYSTEM_ADMIN", "Only when status = DRAFT"],
        ["document.checkout", "AUTHOR, APPROVER, SYSTEM_ADMIN", "Document not currently locked"],
        ["document.approve", "APPROVER, SYSTEM_ADMIN", "User in workflow approval list"],
    ],
)

doc.add_heading("Folder Permissions", level=3)
add_table(
    ["Permission", "Roles Granted"],
    [
        ["folder.create", "AUTHOR, DEPARTMENT_ADMIN"],
        ["folder.read", "AUTHOR, VIEWER (recursive children)"],
        ["folder.delete", "DEPARTMENT_ADMIN, SYSTEM_ADMIN (non-system folders only)"],
    ],
)

doc.add_heading("Workflow Permissions", level=3)
add_table(
    ["Permission", "Roles Granted"],
    [
        ["workflow.manage", "SYSTEM_ADMIN, DEPARTMENT_ADMIN"],
    ],
)

doc.add_heading("Retention & Compliance Permissions", level=3)
add_table(
    ["Permission", "Roles Granted"],
    [
        ["retention.manage", "RECORDS_MANAGER, SYSTEM_ADMIN"],
        ["retention.approve_destruction", "RECORDS_MANAGER, SYSTEM_ADMIN"],
    ],
)

doc.add_heading("Administration & Governance", level=3)
add_table(
    ["Permission", "Roles Granted"],
    [
        ["admin.users", "SYSTEM_ADMIN"],
        ["admin.audit", "SYSTEM_ADMIN"],
        ["governance.view", "SYSTEM_ADMIN"],
        ["governance.manage", "SYSTEM_ADMIN"],
        ["project.create", "SYSTEM_ADMIN"],
        ["project.manage", "SYSTEM_ADMIN, Project Owner"],
    ],
)

doc.add_heading("3.3 Project-Scoped RBAC", level=2)
doc.add_paragraph(
    "In addition to global roles, users can be assigned project-specific permissions "
    "through project membership. These permissions use a bitwise mask for fine-grained "
    "control within each project."
)
add_table(
    ["Permission Bit", "Name", "Description"],
    [
        ["Bit 0", "PERM_READ", "Read documents in the project"],
        ["Bit 1", "PERM_WRITE", "Create and edit documents"],
        ["Bit 2", "PERM_DELETE", "Delete documents"],
        ["Bit 3", "PERM_MANAGE", "Manage folders and structure"],
        ["Bit 4", "PERM_APPROVE", "Approve workflows"],
        ["Bit 5", "PERM_AI_INVOKE", "Trigger AI features"],
        ["Bit 6", "PERM_AI_CONFIGURE", "Configure AI governance"],
        ["Bit 7", "PERM_RETENTION", "Manage retention policies"],
        ["Bit 8", "PERM_EXPORT", "Export documents"],
        ["Bit 9", "PERM_ADMIN", "Full project administration"],
    ],
)

doc.add_paragraph(
    "Permission evaluation flow:\n"
    "1. User logs in — Auth Service resolves global roles and permissions.\n"
    "2. JWT token includes a projectPermissions map: {projectId: [permissions]}.\n"
    "3. Each microservice checks hasPermission(projectId, requiredPermission).\n"
    "4. Project owners automatically receive PERM_ADMIN with all permission bits set."
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 4. AUTHENTICATION & SECURITY
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("4. Authentication & Security", level=1)

doc.add_heading("4.1 Login Flow", level=2)
doc.add_paragraph(
    "Users authenticate by submitting their username and password to the Auth Service. "
    "On success, the system returns a JWT access token (1-hour expiry) and a refresh "
    "token (7-day expiry)."
)
doc.add_paragraph(
    "Login request: POST /auth/login with {username, password}\n\n"
    "Successful response includes:\n"
    "• accessToken — JWT signed with HS512 (HMAC SHA-512)\n"
    "• refreshToken — Used to obtain new access tokens without re-login\n"
    "• userId, username, fullName — User identity\n"
    "• roles — Array of global role names\n"
    "• permissions — Array of permission strings\n"
    "• projectPermissions — Map of project IDs to permission arrays"
)

doc.add_heading("4.2 Token Details", level=2)
add_table(
    ["Token Type", "Expiry", "Algorithm", "Contents"],
    [
        ["Access Token", "1 hour", "HS512", "userId (sub), username, roles, projectPermissions"],
        ["Refresh Token", "7 days", "HS512", "Used to obtain new access tokens"],
    ],
)

doc.add_heading("4.3 Session Management", level=2)
doc.add_paragraph(
    "• Active sessions tracked in Redis: session:{userId} → access token (1-hour TTL)\n"
    "• Enables device/browser detection and parallel session tracking\n"
    "• On logout, token added to Redis blacklist: jwt:blacklist:{token_hash}\n"
    "• JWT authentication filter checks blacklist on every subsequent request"
)

doc.add_heading("4.4 Account Security", level=2)
doc.add_paragraph(
    "Account Lockout:\n"
    "• Failed login attempts are tracked on the User entity\n"
    "• After 5 consecutive failed attempts, the account is locked (is_locked = true)\n"
    "• Only a SYSTEM_ADMIN can unlock the account\n\n"
    "Password Requirements:\n"
    "• Minimum 8 characters\n"
    "• Must include uppercase, lowercase, digits, and special characters\n"
    "• All passwords hashed with bcrypt ($2a$12$...)\n"
    "• Plain-text passwords are never stored or logged"
)

doc.add_heading("4.5 Encryption", level=2)
doc.add_paragraph(
    "• All documents encrypted at rest with AES-256-GCM (Galois/Counter Mode)\n"
    "• Random initialisation vector (IV) generated per file\n"
    "• Encryption key sourced from ENCRYPTION_KEY environment variable\n"
    "• Decryption is transparent to the client on download\n"
    "• Transport security: TLS 1.3 for all network communication"
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 5. DOCUMENT MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("5. Document Management", level=1)

doc.add_heading("5.1 Document Lifecycle", level=2)
doc.add_paragraph(
    "Documents progress through the following status states:\n\n"
    "DRAFT → IN_REVIEW → APPROVED → ARCHIVED\n"
    "       ↘ REJECTED → CORRECTION → IN_REVIEW (loop)\n\n"
    "After the retention period expires:\n"
    "PENDING_DESTRUCTION → Approved → DESTROYED\n"
    "                    → Rejected → ACTIVE (restored)\n"
    "                    → Legal Hold → LEGAL_HOLD (frozen)"
)

doc.add_heading("5.2 Document Upload & Storage", level=2)
doc.add_paragraph(
    "The upload process works as follows:\n"
    "1. Client uploads multipart form-data containing metadata and the file.\n"
    "2. Document Service calculates a SHA256 hash for integrity verification.\n"
    "3. File is encrypted with AES-256-GCM (unique IV per file).\n"
    "4. Encrypted blob stored in MinIO at: documents/{objectGuid}/v1/{filename}.\n"
    "5. Document record created with UUID, storage key, hash, metadata, and tags.\n"
    "6. Initial DocumentVersion record created (version = 1).\n"
    "7. Search Service is notified to index the new document."
)

doc.add_heading("5.3 Versioning & Check-out / Check-in", level=2)
doc.add_paragraph(
    "Check-out (Locking):\n"
    "• POST /documents/{id}/checkout\n"
    "• Marks document as checked out by the requesting user\n"
    "• Acquires a Redis distributed lock (8-hour TTL) to prevent concurrent edits\n"
    "• Other users can view but cannot edit the document while locked\n\n"
    "Check-in (New Version):\n"
    "• POST /documents/{id}/checkin with new file and change summary\n"
    "• Validates the user is the current check-out holder\n"
    "• Processes new file: SHA256 hash, encrypt, store in MinIO\n"
    "• Increments version number, creates DocumentVersion record\n"
    "• Releases Redis lock and updates document metadata\n\n"
    "Cancel Check-out:\n"
    "• POST /documents/{id}/cancel-checkout\n"
    "• Releases lock without saving changes\n"
    "• Restores document to its previous state"
)

doc.add_heading("5.4 Document Notes (Sticky Notes)", level=2)
doc.add_paragraph(
    "Users can annotate documents with sticky-note style comments:\n\n"
    "• Note Types: GENERAL, IMPORTANT, REVIEW, PRIVATE, SYSTEM\n"
    "• Color-coded with customisable hex colours (default: yellow #FFEB3B)\n"
    "• Parent-child threading enables comment replies\n"
    "• Notes can be pinned to stay visible at the top\n"
    "• API: POST /documents/{id}/notes and GET /documents/{id}/notes"
)

doc.add_heading("5.5 Legal Hold", level=2)
doc.add_paragraph(
    "Legal holds freeze documents from automatic destruction:\n\n"
    "• Apply: POST /documents/{id}/legal-hold?reason=...\n"
    "  Sets legal_hold=true, records reason, user, and timestamp\n"
    "• Effect: Document is skipped in all retention scans, regardless of policy\n"
    "• Remove: DELETE /documents/{id}/legal-hold\n"
    "  Only RECORDS_MANAGER or SYSTEM_ADMIN can remove holds\n"
    "• All legal hold actions are logged to the immutable audit trail"
)

doc.add_heading("5.6 Metadata & Tagging", level=2)
doc.add_paragraph(
    "• metadata_json (JSONB): Free-form extensible metadata supporting project-specific schemas\n"
    "  Example: {department: 'Finance', cost_center: 'CC-001', contract_value: '50000'}\n\n"
    "• tags (TEXT array): Searchable string tags for categorisation\n"
    "  Pre-seeded tags: Confidential, Urgent, Contract, Policy, Invoice, Report, "
    "Template, Legal, HR, Finance\n\n"
    "• AI Metadata: ai_generated flag (boolean) and ai_confidence score (0.0–1.0) "
    "for documents created or classified by AI services"
)

doc.add_heading("5.7 Folder Hierarchy", level=2)
doc.add_paragraph(
    "Documents are organised in a recursive folder tree:\n\n"
    "• Recursive parent-child relationships with computed paths (e.g. /Root/Shared/2024)\n"
    "• Depth tracked for UI tree rendering\n"
    "• System folders (Root, Shared Documents, Templates, Archive) cannot be deleted\n"
    "• Folders can be scoped to projects for multi-tenant isolation"
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 6. WORKFLOW & APPROVAL SYSTEM
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("6. Workflow & Approval System", level=1)

doc.add_heading("6.1 Workflow Definitions", level=2)
doc.add_paragraph(
    "Workflows are defined as state machines with named states and transitions. "
    "Each definition specifies:\n\n"
    "• Name and description\n"
    "• States: e.g. DRAFT, IN_REVIEW, APPROVED, REJECTED, ARCHIVED\n"
    "• Transitions: from/to state pairs with required actions and roles\n"
    "• Initial state (starting point)\n"
    "• Required roles for participation\n"
    "• Whether human review is mandatory (for AI-driven workflows)"
)

doc.add_heading("6.2 State Machine Flow", level=2)
doc.add_paragraph(
    "Standard Approval Workflow:\n\n"
    "DRAFT → (SUBMIT by AUTHOR) → IN_REVIEW\n"
    "IN_REVIEW → (APPROVE by APPROVER) → APPROVED\n"
    "IN_REVIEW → (REJECT by APPROVER) → REJECTED\n"
    "REJECTED → (REVISE by AUTHOR) → IN_REVIEW (correction loop)\n"
    "APPROVED → (ARCHIVE by RECORDS_MANAGER) → ARCHIVED"
)

doc.add_heading("6.3 Starting a Workflow", level=2)
doc.add_paragraph(
    "To start a workflow, users submit a POST request with:\n\n"
    "• documentId — The document to process\n"
    "• definitionId — Which workflow template to use\n"
    "• projectId — The project context\n"
    "• assignedTo — Primary assignee (optional)\n"
    "• priority — 0 to 100 (for escalation)\n"
    "• dueDate — Deadline for completion\n"
    "• approvers — List of approvers with order and parallel/sequential flag"
)

doc.add_heading("6.4 Parallel Approvals", level=2)
doc.add_paragraph(
    "For scenarios requiring multiple independent approvals (e.g. a contract "
    "needing both Finance AND Legal sign-off), approvers can be configured as "
    "parallel within an approval group. All approvers receive notifications "
    "simultaneously, and the workflow remains in REVIEW until all have approved."
)

doc.add_heading("6.5 Correction Loops", level=2)
doc.add_paragraph(
    "When an approver rejects a document:\n\n"
    "1. Document returns to REJECTED state with reviewer comments.\n"
    "2. Author corrects the document and resubmits (REVISE action).\n"
    "3. correction_count is incremented for tracking.\n"
    "4. Document returns to IN_REVIEW for re-evaluation.\n"
    "5. Process repeats until approved or cancelled."
)

doc.add_heading("6.6 Workflow Queries", level=2)
doc.add_paragraph(
    "Key queries available:\n\n"
    "• GET /workflow/instances/pending-approvals — Workflows awaiting the current user's decision\n"
    "• GET /workflow/instances/my — Workflows initiated by the current user\n"
    "• GET /workflow/instances/by-document/{id} — All workflows for a specific document\n"
    "• GET /workflow/instances/{id}/history — Full transition audit trail with timestamps"
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 7. SEARCH & DISCOVERY
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("7. Search & Discovery", level=1)

doc.add_heading("7.1 Search Capabilities", level=2)
doc.add_paragraph(
    "Apex Nexus provides full-text search powered by Elasticsearch 8.12 with:\n\n"
    "• Multi-field matching: title (3× boost), description (2× boost), content, tags (2× boost)\n"
    "• Fuzzy matching for typo tolerance\n"
    "• Custom analysers with lowercase, ASCII folding, and word delimiter tokenisation\n"
    "• Faceted filtering by status, MIME type, date range, folder path, and tags\n"
    "• Result highlighting with query terms emphasised\n"
    "• Access control filtering — results are filtered by the user's document read permissions"
)

doc.add_heading("7.2 Quick Search", level=2)
doc.add_paragraph(
    "GET /search?q=annual%20report&page=0&size=20&tags=finance&mimeType=application/pdf\n\n"
    "Supports pagination, tag filtering, MIME type filtering, and status filtering."
)

doc.add_heading("7.3 Advanced Search", level=2)
doc.add_paragraph(
    "POST /search with JSON body supporting:\n"
    "• query — Free-text search terms\n"
    "• tags — Array of required tags\n"
    "• mimeType — Filter by file type\n"
    "• status — Filter by document status\n"
    "• dateFrom / dateTo — Date range\n"
    "• authorId — Filter by author\n"
    "• folderPath — Scope to specific folder"
)

doc.add_heading("7.4 Index Synchronisation", level=2)
doc.add_paragraph(
    "The search index stays in sync through an event-driven pipeline:\n\n"
    "1. Document created/updated → Document Service publishes event to Redis.\n"
    "2. Search Service async consumer receives the event.\n"
    "3. Document is indexed (or updated) in Elasticsearch.\n"
    "4. On delete: document is removed from the search index."
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 8. RETENTION & LEGAL COMPLIANCE
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("8. Retention & Legal Compliance", level=1)

doc.add_heading("8.1 Retention Policies", level=2)
doc.add_paragraph("Three pre-configured retention policies are provided:")
add_table(
    ["Policy Name", "Retention Period", "Auto-Dispose", "Requires Approval", "Use Case"],
    [
        ["Standard 7-Year", "7 years", "No", "Yes", "General business documents"],
        ["Regulatory 20-Year", "20 years", "No", "Yes", "Financial and legal records"],
        ["Permanent", "999 years", "No", "No", "Corporate governance, foundational documents"],
    ],
)

doc.add_heading("8.2 Automated Retention Scan", level=2)
doc.add_paragraph(
    "A scheduled job runs nightly at 2:00 AM to identify expired documents:\n\n"
    "1. Queries all documents where retention_expiry ≤ NOW(), not already destroyed, "
    "not on legal hold, and not already in the disposition queue.\n"
    "2. Creates a DispositionItem with status PENDING and scheduled destruction date "
    "(NOW + 30-day grace period).\n"
    "3. Notifies RECORDS_MANAGER role via the Notification Service.\n"
    "4. Event logged to audit trail."
)

doc.add_heading("8.3 Disposition Approval Workflow", level=2)
doc.add_paragraph(
    "Before any document is destroyed, a Records Manager must review and approve:\n\n"
    "• GET /retention/dispositions/pending — View all documents pending destruction\n"
    "• POST /retention/dispositions/{id}/approve — Approve destruction (with reason)\n"
    "• POST /retention/dispositions/{id}/reject — Reject, document remains active\n"
    "• POST /retention/dispositions/{id}/hold — Place additional legal hold\n\n"
    "Once destroyed, the document record is marked DESTROYED but never deleted "
    "from the database for audit purposes."
)

doc.add_heading("8.4 Legal Hold Workflow", level=2)
doc.add_paragraph(
    "Example litigation hold scenario:\n\n"
    "1. Counsel notifies Records Manager of anticipated litigation.\n"
    "2. Records Manager applies legal hold: POST /documents/{id}/legal-hold?reason=...\n"
    "3. Document is frozen — retention scan skips it regardless of expiry.\n"
    "4. Months later, when litigation resolves: DELETE /documents/{id}/legal-hold\n"
    "5. Next retention scan includes the document again if its retention has expired."
)

doc.add_heading("8.5 Retention Statistics", level=2)
doc.add_paragraph(
    "GET /retention/stats provides:\n"
    "• Total document count\n"
    "• Breakdown by status (ACTIVE, ARCHIVED, PENDING_DESTRUCTION, LEGAL_HOLD)\n"
    "• Breakdown by policy (Standard, Regulatory, Permanent)\n"
    "• Documents expiring next month\n"
    "• Current legal hold count"
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 9. AUDIT LOGGING & COMPLIANCE
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("9. Audit Logging & Compliance", level=1)

doc.add_heading("9.1 Immutable Audit Trail", level=2)
doc.add_paragraph(
    "The audit_log table is protected by PostgreSQL database triggers that prevent "
    "any UPDATE or DELETE operations. Any attempt to modify or remove an audit record "
    "raises an exception, enforcing strict append-only semantics for regulatory compliance."
)

doc.add_heading("9.2 Logged Actions", level=2)

doc.add_heading("Authentication & User Management", level=3)
doc.add_paragraph(
    "LOGIN, LOGOUT, REGISTER, USER_CREATED, USER_UPDATED, USER_DELETED, "
    "PASSWORD_CHANGED, PASSWORD_RESET, ACCOUNT_LOCKED, ACCOUNT_UNLOCKED\n"
    "Includes: username, IP address, user agent, session ID"
)

doc.add_heading("Document Lifecycle", level=3)
doc.add_paragraph(
    "CREATE, READ, UPDATE, DELETE, DOWNLOAD, CHECKOUT, CHECKIN, CANCEL_CHECKOUT, "
    "LEGAL_HOLD_APPLIED, LEGAL_HOLD_REMOVED\n"
    "Includes: document title, file size, hash, version number"
)

doc.add_heading("Workflow Events", level=3)
doc.add_paragraph(
    "WORKFLOW_STARTED, WORKFLOW_TRANSITIONED, APPROVAL_SUBMITTED, "
    "WORKFLOW_APPROVED, WORKFLOW_REJECTED, CORRECTION_SUBMITTED, WORKFLOW_CANCELLED\n"
    "Includes: workflow definition name, approver identity, decision"
)

doc.add_heading("Compliance & Retention", level=3)
doc.add_paragraph(
    "RETENTION_POLICY_CREATED, RETENTION_POLICY_UPDATED, RETENTION_SCAN, "
    "DISPOSITION_APPROVED, DISPOSITION_REJECTED, DISPOSITION_DESTROYED\n"
    "Includes: policy name, document count"
)

doc.add_heading("AI Governance", level=3)
doc.add_paragraph(
    "AI_CLASSIFICATION, AUTO_TAG, CONTENT_GENERATION, POLICY_CHANGED\n"
    "Includes: policy scope, old/new settings, who changed it"
)

doc.add_heading("9.3 Audit Queries", level=2)
add_table(
    ["Query", "Endpoint", "Use Case"],
    [
        ["By User", "GET /audit/logs/by-user/{userId}", "GDPR data subject access request"],
        ["By Action", "GET /audit/logs/by-action/{action}", "E.g. all DOWNLOAD events"],
        ["By Resource", "GET /audit/logs/by-resource/{type}/{id}", "Full history of a document"],
        ["By Date Range", "GET /audit/logs/by-date?from=...&to=...", "Compliance reporting period"],
        ["By Actor Type", "GET /audit/logs/by-actor/{actorType}", "Track AI vs human actions"],
        ["Statistics", "GET /audit/stats?days=30", "Dashboard: action counts, active users"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 10. NOTIFICATIONS & REAL-TIME UPDATES
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("10. Notifications & Real-Time Updates", level=1)

doc.add_heading("10.1 Notification Types", level=2)
add_table(
    ["Type", "Purpose", "Example Trigger"],
    [
        ["INFO", "General information", "Document checked out by another user"],
        ["WARNING", "Configuration or system alerts", "Retention expiry approaching (7 days)"],
        ["ACTION_REQUIRED", "User must take action", "Document requires your approval"],
        ["APPROVAL", "Workflow approval requests", "New document submitted for review"],
        ["SYSTEM", "Critical system events", "Elasticsearch cluster unhealthy"],
    ],
)

doc.add_heading("10.2 Delivery Channels", level=2)
doc.add_paragraph(
    "WebSocket (Real-Time):\n"
    "• SockJS + STOMP protocol over WebSocket\n"
    "• Connect with JWT token in header\n"
    "• Subscribe to /user/{userId}/queue/notifications\n"
    "• Notifications delivered instantly while user is online\n\n"
    "Email:\n"
    "• Optional email delivery when sendEmail=true in notification request\n"
    "• Subject: [Apex Nexus] {notification.title}\n"
    "• Configurable SMTP provider (MailHog in development, production SMTP in deployment)"
)

doc.add_heading("10.3 Notification Management", level=2)
doc.add_paragraph(
    "• GET /notification/my — List all notifications (paginated)\n"
    "• GET /notification/my/unread — Only unread notifications\n"
    "• GET /notification/my/unread/count — Badge count for UI\n"
    "• POST /notification/{id}/read — Mark single notification as read\n"
    "• POST /notification/my/read-all — Mark all notifications as read"
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 11. AI GOVERNANCE & TRUST FRAMEWORK
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("11. AI Governance & Trust Framework", level=1)

doc.add_heading("11.1 Policy Hierarchy", level=2)
doc.add_paragraph(
    "AI governance policies follow a hierarchical structure where more specific "
    "scopes take precedence:\n\n"
    "1. GLOBAL — Organisation-wide defaults\n"
    "2. PROJECT — Project-specific overrides (take precedence over GLOBAL)\n"
    "3. USER — Individual user restrictions (most restrictive, highest precedence)"
)

doc.add_heading("11.2 Policy Types", level=2)
add_table(
    ["Policy Type", "Description", "Key Settings"],
    [
        ["AI_CLASSIFICATION", "Auto-classify documents by content",
         "confidence_threshold, auto_apply, require_human_review, allowed_categories"],
        ["AUTO_TAG", "Auto-suggest tags from document content",
         "max_tags, confidence_threshold, require_human_review"],
        ["CONTENT_GENERATION", "Control AI content creation",
         "enabled/disabled per scope, audit_all, reason for restriction"],
        ["AI_SEARCH_ASSIST", "AI-enhanced search capabilities",
         "semantic_search, summarisation, explain_results, max_summary_tokens"],
        ["WORKFLOW_AI_ROUTING", "AI-suggested workflow routing",
         "auto_assign, suggest_approvers, human_override_required, routing_model"],
    ],
)

doc.add_heading("11.3 Governance Examples", level=2)
doc.add_paragraph(
    "Example 1 — AI Classification (Global):\n"
    "• Enabled globally with 85% confidence threshold\n"
    "• Auto-apply disabled; requires human review before committing\n"
    "• Allowed categories: CONFIDENTIAL, PUBLIC, RESTRICTED\n\n"
    "Example 2 — Content Generation (Project Override):\n"
    "• Global policy: enabled for most teams\n"
    "• Legal project override: disabled entirely\n"
    "• Reason: 'Legal team must not use AI-generated content'\n\n"
    "Example 3 — Workflow AI Routing:\n"
    "• AI suggests next approver based on document type\n"
    "• Multiple candidates suggested (human selects)\n"
    "• Human must always confirm before auto-routing proceeds"
)

doc.add_heading("11.4 Policy Audit Trail", level=2)
doc.add_paragraph(
    "All governance policy changes are tracked with:\n"
    "• Who made the change (changed_by user ID)\n"
    "• Change type: CREATED, UPDATED, DISABLED, ENABLED, DELETED\n"
    "• Old and new settings (JSON diff)\n"
    "• Reason for the change\n"
    "• Timestamp"
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 12. PROJECT-SCOPED FEATURES
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("12. Project-Scoped Features", level=1)

doc.add_heading("12.1 Projects as Workspaces", level=2)
doc.add_paragraph(
    "Projects serve as multi-tenant workspaces within the platform. Each project "
    "has its own:\n\n"
    "• Member list with project-specific roles and permissions\n"
    "• Document collection scoped to the project\n"
    "• Custom metadata schema (JSONB) for project-specific fields\n"
    "• AI governance policies (project-level overrides)\n"
    "• Retention policies\n"
    "• Workflow definitions"
)

doc.add_paragraph(
    "Example organisational structure:\n\n"
    "Organisation: Acme Corp\n"
    "  ├─ Project: Finance (owner: CFO)\n"
    "  │   ├─ 50 members (AUTHOR, APPROVER roles)\n"
    "  │   ├─ 10,000 documents\n"
    "  │   └─ Retention: 20-year regulatory policy\n"
    "  ├─ Project: HR (owner: CHRO)\n"
    "  │   ├─ 30 members\n"
    "  │   ├─ 5,000 employee files\n"
    "  │   └─ Retention: 7-year after termination\n"
    "  └─ Project: Legal (owner: General Counsel)\n"
    "      ├─ 20 members\n"
    "      ├─ 2,000 documents\n"
    "      └─ AI Policy: Content generation disabled"
)

doc.add_heading("12.2 Project Management", level=2)
doc.add_paragraph(
    "Create Project: POST /auth/projects\n"
    "  • name, description, metadataSchema (JSONB), aiEnabled flag\n"
    "  • Creator automatically becomes project owner with PERM_ADMIN\n\n"
    "Add Member: POST /auth/projects/{projectId}/members\n"
    "  • userId, roleId, permissions array\n"
    "  • Permissions converted to bitwise mask for efficient storage\n\n"
    "All document and workflow queries can be scoped to a project:\n"
    "  • GET /documents/my?projectId={id}\n"
    "  • GET /workflow/instances/my?projectId={id}"
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 13. OCR & CONTENT EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("13. OCR & Content Extraction", level=1)

doc.add_heading("13.1 Overview", level=2)
doc.add_paragraph(
    "Apex Nexus integrates Apache Tika for server-side content extraction and "
    "OCR, enabling full-text search indexing of binary document formats such as "
    "PDF, Microsoft Office, images, and scanned documents. Extracted text is "
    "automatically indexed in Elasticsearch alongside document metadata."
)

doc.add_heading("13.2 Supported Formats", level=2)
add_table(
    ["Format Category", "Extensions", "Extraction Capability"],
    [
        ["PDF", ".pdf", "Text extraction + embedded image OCR"],
        ["Word Processing", ".docx, .doc, .odt, .rtf", "Full text with formatting metadata"],
        ["Spreadsheets", ".xlsx, .xls, .ods, .csv", "Cell values, sheet names, formulae"],
        ["Presentations", ".pptx, .ppt, .odp", "Slide text, speaker notes"],
        ["Images", ".png, .jpg, .tiff, .bmp", "OCR via Tesseract (when available)"],
        ["Email", ".eml, .msg", "Subject, body, attachment metadata"],
        ["Plain Text", ".txt, .md, .json, .xml", "Direct text extraction"],
    ],
)

doc.add_heading("13.3 Architecture", level=2)
doc.add_paragraph(
    "ContentExtractorService (Search Service)\n"
    "  • Uses Apache Tika AutoDetect parser with BodyContentHandler\n"
    "  • Extracts MIME type, language (via Tika LanguageIdentifier), and full text\n"
    "  • Returns ContentExtractionResult: extractedText, detectedLanguage, mimeType, metadata map\n"
    "  • Content length limited to 100 000 characters per document\n\n"
    "Integration with Indexing:\n"
    "  • IndexQueueProcessor polls Redis queue (search:index:queue) for new documents\n"
    "  • Downloads file bytes from MinIO, passes to ContentExtractorService\n"
    "  • Extracted text stored in 'content' field of Elasticsearch index\n"
    "  • Language stored in 'language' field for locale-aware search"
)

doc.add_heading("13.4 API Endpoint", level=2)
add_table(
    ["Method", "Endpoint", "Description"],
    [
        ["POST", "/search/extract", "Upload a file and receive extracted text, language, and metadata"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 14. AUTOMATED CLASSIFICATION
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("14. Automated Classification", level=1)

doc.add_heading("14.1 Overview", level=2)
doc.add_paragraph(
    "Documents uploaded to Apex Nexus are automatically classified into "
    "business categories using a rule-based classification engine. Classification "
    "runs during indexing and the results are stored in Elasticsearch for "
    "faceted filtering and reporting."
)

doc.add_heading("14.2 Classification Categories", level=2)
add_table(
    ["Label", "Category", "Keyword Signals"],
    [
        ["Contract", "LEGAL", "contract, agreement, NDA, terms, clause, liability"],
        ["Invoice", "FINANCIAL", "invoice, billing, payment, amount due, purchase order"],
        ["Report", "ANALYSIS", "report, analysis, summary, findings, quarterly, annual"],
        ["Policy", "GOVERNANCE", "policy, guideline, compliance, regulation, standard"],
        ["HR Document", "HUMAN_RESOURCES", "employee, HR, payroll, benefits, onboarding"],
        ["Meeting Minutes", "COMMUNICATION", "minutes, meeting, attendees, agenda, action items"],
        ["Correspondence", "COMMUNICATION", "dear, regards, RE:, FW:, sincerely"],
        ["Technical", "ENGINEERING", "architecture, API, database, deployment, configuration"],
        ["Presentation", "COMMUNICATION", "slide, presentation, deck, agenda, overview"],
        ["Spreadsheet", "DATA", "spreadsheet, worksheet, pivot, chart"],
        ["Image", "MEDIA", "photo, image, screenshot, diagram, scan"],
    ],
)

doc.add_heading("14.3 Scoring Algorithm", level=2)
doc.add_paragraph(
    "Each classification rule contributes a score based on four signal types:\n\n"
    "  • Filename keyword match — weight 0.30\n"
    "  • MIME type match — weight 0.20\n"
    "  • File extension match — weight 0.15\n"
    "  • Content keyword matches — up to 0.50 (0.10 per keyword, max 5)\n\n"
    "The rule with the highest aggregate score wins. Documents are only assigned "
    "a classification if the confidence score is ≥ 0.20. Results include the "
    "winning label, category, confidence, and a list of all category scores."
)

doc.add_heading("14.4 API Endpoint", level=2)
add_table(
    ["Method", "Endpoint", "Description"],
    [
        ["POST", "/search/classify", "Upload a file for immediate classification (returns label, category, confidence)"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 15. SEMANTIC / VECTOR SEARCH
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("15. Semantic / Vector Search", level=1)

doc.add_heading("15.1 Overview", level=2)
doc.add_paragraph(
    "Beyond traditional keyword search, Apex Nexus supports semantic similarity "
    "search via dense vector embeddings stored in Elasticsearch. Users can enter "
    "natural-language queries and the system finds documents with similar meaning, "
    "even when exact keywords do not appear."
)

doc.add_heading("15.2 Embedding Architecture", level=2)
doc.add_paragraph(
    "EmbeddingService generates lightweight 256-dimensional feature-hash vectors:\n\n"
    "  • Text is lower-cased and split into tokens\n"
    "  • Unigram hashes contribute +1 / −1 to a random vector dimension\n"
    "  • Bigram hashes contribute at 0.5 weight\n"
    "  • Final vector is L2-normalised to unit length\n"
    "  • MurmurHash-inspired hashing ensures uniform distribution\n\n"
    "This zero-dependency approach provides a working baseline. For production, "
    "swap-in OpenAI, Cohere, or HuggingFace embedding models with minimal code change."
)

doc.add_heading("15.3 Elasticsearch Configuration", level=2)
doc.add_paragraph(
    "The Elasticsearch index mapping includes:\n\n"
    "  • contentVector: dense_vector, dims = 256, index = true, similarity = cosine\n"
    "  • classificationLabel: keyword\n"
    "  • classificationCategory: keyword\n"
    "  • classificationConfidence: float\n\n"
    "kNN search is performed via the Elasticsearch kNN query using cosine similarity. "
    "Source filtering ensures only relevant fields (documentId, title, description, "
    "tags, classificationLabel) are returned."
)

doc.add_heading("15.4 API Endpoint", level=2)
add_table(
    ["Method", "Endpoint", "Parameters", "Description"],
    [
        ["GET", "/search/semantic", "q (query text), size (default 10)", "Returns documents ranked by cosine similarity"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 16. DOCUMENT SIGNATURES
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("16. Document Signatures", level=1)

doc.add_heading("16.1 Overview", level=2)
doc.add_paragraph(
    "Apex Nexus provides a built-in digital signature framework that supports "
    "internal hash-based signing as well as integration points for external "
    "providers such as DocuSign, Adobe Sign, and Qualified EU signatures (eIDAS)."
)

doc.add_heading("16.2 Signature Lifecycle", level=2)
doc.add_paragraph(
    "1. Request — An authorised user requests a signature on a specific document version.\n"
    "   Duplicate pending requests for the same signer are prevented.\n\n"
    "2. Sign — The signer triggers the signing action. The system computes a SHA-256\n"
    "   hash of the current file content and stores the hex-encoded hash.\n\n"
    "3. Decline — Alternatively, the signer may decline with a reason.\n\n"
    "4. Verify — Anyone with read access can verify: the system re-hashes the file\n"
    "   and compares it against the stored signed hash. If the file has been\n"
    "   modified since signing, verification fails.\n"
)

doc.add_heading("16.3 Signature Statuses", level=2)
add_table(
    ["Status", "Description"],
    [
        ["PENDING", "Signature requested but not yet completed"],
        ["SIGNED", "Document signed, SHA-256 hash stored"],
        ["DECLINED", "Signer declined the signature request"],
        ["EXPIRED", "Signature request expired (configurable TTL)"],
        ["REVOKED", "Signature revoked after signing"],
    ],
)

doc.add_heading("16.4 API Endpoints", level=2)
add_table(
    ["Method", "Endpoint", "Description"],
    [
        ["POST", "/documents/signatures/request", "Request a signature (documentId, versionId, signerId, provider)"],
        ["POST", "/documents/signatures/{id}/sign", "Sign a document (generates SHA-256 hash)"],
        ["POST", "/documents/signatures/{id}/decline", "Decline with optional reason"],
        ["GET", "/documents/signatures/{id}/verify", "Verify signature integrity"],
        ["GET", "/documents/signatures/document/{docId}", "List all signatures for a document"],
        ["GET", "/documents/signatures/pending", "List pending signatures for current user"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 17. GDPR PRIVACY SCANNER
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("17. GDPR Privacy Scanner", level=1)

doc.add_heading("17.1 Overview", level=2)
doc.add_paragraph(
    "The GDPR Privacy Scanner detects Personally Identifiable Information (PII) "
    "within document content. It uses regex-based pattern matching to identify "
    "10 categories of PII and assigns a severity level. This supports GDPR "
    "compliance by highlighting documents that may require special handling, "
    "anonymisation, or restricted access."
)

doc.add_heading("17.2 PII Detection Patterns", level=2)
add_table(
    ["PII Type", "Severity", "Pattern Description"],
    [
        ["Email Address", "MEDIUM", "Standard email pattern (user@domain.tld)"],
        ["Phone Number", "MEDIUM", "International format with + prefix or local formats"],
        ["IBAN", "HIGH", "International Bank Account Number (2-letter country + 2 check digits + up to 30 alphanumeric)"],
        ["Credit Card", "CRITICAL", "13-19 digit card numbers with optional separators"],
        ["German SSN (Sozialversicherungsnr.)", "HIGH", "12-digit German social security numbers"],
        ["Date of Birth", "MEDIUM", "Common date formats (DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD)"],
        ["German Tax ID (Steuer-IdNr.)", "HIGH", "11-digit German tax identification numbers"],
        ["IP Address", "LOW", "IPv4 addresses (four octets)"],
        ["Passport Number", "HIGH", "European passport number formats"],
        ["German Health ID (Krankenversicherungsnr.)", "HIGH", "German health insurance numbers (letter + 9 digits)"],
    ],
)

doc.add_heading("17.3 Severity Levels", level=2)
doc.add_paragraph(
    "  • NONE — No PII detected\n"
    "  • LOW — Minor PII (e.g., IP addresses)\n"
    "  • MEDIUM — Personal contact information\n"
    "  • HIGH — Sensitive identifiers (IBAN, SSN, passport)\n"
    "  • CRITICAL — Financial data (credit card numbers)\n\n"
    "Privacy by design: the scanner stores only PII type and character positions, "
    "never the actual PII values."
)

doc.add_heading("17.4 API Endpoints", level=2)
add_table(
    ["Method", "Endpoint", "Description"],
    [
        ["POST", "/search/gdpr-scan", "Upload a file for PII scanning"],
        ["POST", "/search/gdpr-scan/{documentId}", "Scan a stored document by ID"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 18. PUBLIC LINK SHARING
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("18. Public Link Sharing", level=1)

doc.add_heading("18.1 Overview", level=2)
doc.add_paragraph(
    "Users can generate secure, time-limited public links to share documents "
    "with external parties who do not have an Apex Nexus account. Links can be "
    "optionally protected with a password, restricted by IP whitelist, and "
    "limited to a maximum number of downloads."
)

doc.add_heading("18.2 Share Link Properties", level=2)
add_table(
    ["Property", "Type", "Description"],
    [
        ["token", "UUID", "Unique, cryptographically random share token (used in URL)"],
        ["documentId", "UUID", "The document being shared"],
        ["createdBy", "UUID", "User who created the link"],
        ["expiresAt", "Timestamp", "Link expiration date/time (mandatory)"],
        ["passwordHash", "String", "BCrypt hash of optional access password"],
        ["maxDownloads", "Integer", "Maximum number of downloads allowed (null = unlimited)"],
        ["downloadCount", "Integer", "Current download count (incremented on each access)"],
        ["ipWhitelist", "String", "Comma-separated list of allowed IP addresses/ranges"],
        ["active", "Boolean", "Whether the link is currently active (can be revoked)"],
    ],
)

doc.add_heading("18.3 Security Features", level=2)
doc.add_paragraph(
    "  • Token-based access — no authentication required, token serves as credential\n"
    "  • Password protection — optional BCrypt-hashed password challenge\n"
    "  • IP whitelisting — restrict access to specific IP addresses or ranges\n"
    "  • Download limits — auto-deactivate after N downloads\n"
    "  • Time expiry — links automatically expire at the set date\n"
    "  • Revocation — link creator or admin can immediately revoke a link\n"
    "  • Audit trail — every download is logged with IP, timestamp, and user-agent"
)

doc.add_heading("18.4 API Endpoints", level=2)
add_table(
    ["Method", "Endpoint", "Description"],
    [
        ["POST", "/auth/share-links", "Create a new share link"],
        ["GET", "/auth/share-links/document/{docId}", "List all share links for a document"],
        ["DELETE", "/auth/share-links/{id}", "Revoke a share link"],
        ["POST", "/auth/share-links/validate", "Validate a share token (+ optional password)"],
        ["POST", "/auth/share-links/{id}/download", "Record a download event"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 19. REAL-TIME PRESENCE
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("19. Real-Time Presence", level=1)

doc.add_heading("19.1 Overview", level=2)
doc.add_paragraph(
    "Apex Nexus tracks which users are currently viewing a document in real time. "
    "This prevents conflicting edits and improves collaboration awareness, similar "
    "to co-editing indicators in Google Docs or Microsoft 365."
)

doc.add_heading("19.2 Architecture", level=2)
doc.add_paragraph(
    "PresenceService (Notification Service)\n"
    "  • Backed by Redis sorted sets with key pattern presence:doc:{documentId}\n"
    "  • Each viewer stored as member = userId, score = timestamp (epoch millis)\n"
    "  • Viewers auto-expire after the TTL (default: 5 minutes without heartbeat)\n"
    "  • Cleanup runs periodically via @Scheduled to remove stale entries\n\n"
    "Transport:\n"
    "  • WebSocket STOMP endpoint: /ws (SockJS fallback)\n"
    "  • Subscribe to: /topic/presence/{documentId} for live updates\n"
    "  • Send heartbeats: /app/presence.heartbeat with documentId payload\n"
    "  • Session connect/disconnect events automatically join/leave presence\n\n"
    "REST Fallback:\n"
    "  • GET /notifications/presence/{documentId}/viewers — returns list of active viewers\n"
    "  • Used by PresenceIndicator component for polling-based fallback"
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 20. AD-HOC WORKFLOW FORWARDING
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("20. Ad-Hoc Workflow Forwarding", level=1)

doc.add_heading("20.1 Overview", level=2)
doc.add_paragraph(
    "Beyond the formal state-machine workflow, Apex Nexus supports ad-hoc "
    "forwarding of documents for review, approval, acknowledgment, or "
    "informational purposes. This covers the common ELO use case of '\"Weiterleitung\"' "
    "(forwarding) where a user sends a document to a colleague outside the "
    "predefined workflow."
)

doc.add_heading("20.2 Forward Actions", level=2)
add_table(
    ["Action", "Description"],
    [
        ["REVIEW", "Request the target user to review and provide feedback"],
        ["APPROVE", "Request formal approval from the target user"],
        ["ACKNOWLEDGE", "Request the target user to acknowledge receipt"],
        ["FYI", "Send for information only, no action required"],
    ],
)

doc.add_heading("20.3 Lifecycle", level=2)
doc.add_paragraph(
    "1. A user forwards a document (POST /workflows/forwards) specifying:\n"
    "   targetUserId, documentId, action, optional comment, optional dueDate\n\n"
    "2. The target user sees the forward in their pending list\n"
    "   (GET /workflows/forwards/pending)\n\n"
    "3. The target user completes the forward with an optional response\n"
    "   (POST /workflows/forwards/{id}/complete)\n\n"
    "4. Both parties can view the forward history for any document\n"
    "   (GET /workflows/forwards/document/{docId})"
)

doc.add_heading("20.4 API Endpoints", level=2)
add_table(
    ["Method", "Endpoint", "Description"],
    [
        ["POST", "/workflows/forwards", "Create a forward request"],
        ["GET", "/workflows/forwards/pending", "List pending forwards for current user"],
        ["GET", "/workflows/forwards/pending/count", "Count of pending forwards"],
        ["GET", "/workflows/forwards/document/{docId}", "Forward history for a document"],
        ["POST", "/workflows/forwards/{id}/complete", "Complete a forward with response"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 21. WEB DOCUMENT PREVIEWER
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("21. Web Document Previewer", level=1)

doc.add_heading("21.1 Overview", level=2)
doc.add_paragraph(
    "Apex Nexus provides in-browser document preview without requiring the user "
    "to download files. PDF, images, and text-based formats render directly in "
    "the browser; Office documents use configurable preview services."
)

doc.add_heading("21.2 Preview Strategies", level=2)
add_table(
    ["Format", "Strategy", "Details"],
    [
        ["PDF", "Native <iframe>", "Browser's built-in PDF renderer via object URL"],
        ["Images (png, jpg, gif, svg, webp)", "Native <img>", "Direct image rendering"],
        ["Office (docx, xlsx, pptx)", "Office Online / LibreOffice", "Configurable external preview service URL"],
        ["Text / Code (txt, md, json, xml, csv)", "Syntax-highlighted <pre>", "Client-side rendering with Tailwind typography"],
        ["Video (mp4, webm)", "Native <video>", "Browser's built-in video player"],
        ["Audio (mp3, wav, ogg)", "Native <audio>", "Browser's built-in audio player"],
    ],
)

doc.add_heading("21.3 Frontend Component", level=2)
doc.add_paragraph(
    "DocumentPreviewer.tsx renders a full-screen modal with:\n"
    "  • Format-aware viewer selection based on MIME type / file extension\n"
    "  • Download fallback button for unsupported formats\n"
    "  • Zoom controls for PDF and image previews\n"
    "  • PresenceIndicator integration showing who else is viewing the document"
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 22. OFFICE ADD-IN INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("22. Office Add-in Integration", level=1)

doc.add_heading("22.1 Overview", level=2)
doc.add_paragraph(
    "Apex Nexus provides an Office Add-in integration specification that allows "
    "Microsoft Outlook, Word, Excel, and PowerPoint users to interact with the "
    "ECM directly from their Office applications. The add-in follows the "
    "Office Web Add-in (OfficeJS) architecture."
)

doc.add_heading("22.2 Capabilities", level=2)
add_table(
    ["Application", "Capability", "API Endpoint Used"],
    [
        ["Outlook", "Save email + attachments to ECM", "POST /documents/upload"],
        ["Outlook", "Search documents from sidebar", "GET /search?q=..."],
        ["Outlook", "Attach ECM document to new email", "GET /documents/{id}/download"],
        ["Outlook", "Share public link via email", "POST /auth/share-links"],
        ["Word / Excel / PPT", "Browse & open ECM documents", "GET /documents/my"],
        ["Word / Excel / PPT", "Check-out for editing", "POST /documents/{id}/checkout"],
        ["Word / Excel / PPT", "Check-in new version", "POST /documents/{id}/checkin"],
        ["Word / Excel / PPT", "Inline document preview", "GET /documents/{id}/preview"],
    ],
)

doc.add_heading("22.3 Authentication Flow", level=2)
doc.add_paragraph(
    "1. User clicks 'Log in to Apex Nexus' in the task pane\n"
    "2. OAuth2 / JWT login dialog opens via Office.context.ui.displayDialogAsync\n"
    "3. Token stored in Office.context.roamingSettings for persistence\n"
    "4. All subsequent API calls include Authorization: Bearer <token>\n"
    "5. Token refresh handled automatically before expiry"
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 23. FRONTEND APPLICATION
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("23. Frontend Application", level=1)

doc.add_heading("23.1 Web Application (Next.js 14)", level=2)
doc.add_paragraph(
    "The web frontend is built with Next.js 14, React 18, TypeScript 5.4, "
    "and Tailwind CSS for responsive design."
)

doc.add_heading("Key Frontend Components (v2.0)", level=3)
add_table(
    ["Component", "File", "Purpose"],
    [
        ["DocumentPreviewer", "components/documents/DocumentPreviewer.tsx", "In-browser document preview (PDF, images, Office, video, audio)"],
        ["PresenceIndicator", "components/documents/PresenceIndicator.tsx", "Real-time viewer avatars for active document viewers"],
        ["SignaturePanel", "components/documents/SignaturePanel.tsx", "Signature status, sign/decline actions per document"],
        ["SemanticSearch", "components/search/SemanticSearch.tsx", "Natural-language vector similarity search"],
        ["GdprScanner", "components/search/GdprScanner.tsx", "Upload-based PII scanner with severity display"],
    ],
)

doc.add_heading("Protected Pages", level=3)
add_table(
    ["Page", "Path", "Description"],
    [
        ["Dashboard", "/dashboard", "Overview: pending approvals, recent documents, statistics"],
        ["Documents", "/documents", "Document list with search, filter, pagination"],
        ["Document Detail", "/documents/[id]", "Metadata, versions, notes, legal hold, workflow status, signatures, presence"],
        ["Upload", "/documents/create", "Upload new document with metadata"],
        ["Workflows", "/workflow", "Active workflow list"],
        ["Pending Approvals", "/workflow/pending-approvals", "Workflows awaiting user's decision"],
        ["Search", "/search", "Advanced search with faceted filters"],
        ["Semantic Search", "/search (tab)", "Natural-language similarity search powered by vector embeddings"],
        ["GDPR Scanner", "/search (tab)", "Upload files to scan for PII / GDPR-sensitive data"],
        ["Retention", "/retention", "Disposition queue, approve/reject, legal holds"],
        ["Audit", "/audit", "Compliance log viewer with filters and export"],
        ["Analytics", "/analytics", "BI dashboards: creation rates, approval times, trends"],
        ["Admin Settings", "/admin/settings", "System configuration"],
        ["User Management", "/admin/users", "Enable/disable, assign roles, unlock accounts"],
        ["Role Management", "/admin/roles", "Role and permission management"],
        ["AI Governance", "/admin/governance", "Policy management with audit trail"],
        ["Trust Centre", "/trust-center", "User activity log, data export, security info"],
        ["Notifications", "/notifications", "Notification centre with type filters"],
        ["Workflow Designer", "/workflow-designer", "Visual drag-drop workflow canvas with template gallery"],
        ["Plugin Marketplace", "/marketplace", "Browse, activate/deactivate plugins and connectors"],
        ["Compliance Rules", "/compliance", "Jurisdiction-specific retention rules and legal frameworks"],
        ["Industry Solutions", "/industry", "Pre-built industry templates with bundled plugins/workflows"],
    ],
)

doc.add_heading("Public Pages", level=3)
add_table(
    ["Page", "Path", "Description"],
    [
        ["Login", "/login", "Username/password authentication form"],
        ["Register", "/register", "Self-registration (default role: AUTHOR)"],
        ["Shared Document", "/share/[token]", "Public share-link access with optional password"],
    ],
)

doc.add_heading("23.2 Mobile Application (React Native)", level=2)
doc.add_paragraph(
    "A companion mobile application built with React Native and Expo provides:\n\n"
    "• Document browsing and viewing on mobile devices\n"
    "• Push notifications for approval requests\n"
    "• Quick approval/rejection from mobile\n"
    "• Offline document viewing capabilities"
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 24. API INTEGRATION GUIDE
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("24. API Integration Guide", level=1)

doc.add_paragraph(
    "Apex Nexus exposes a RESTful API that can be integrated with external "
    "enterprise systems. All API calls require a valid JWT Bearer token."
)

doc.add_heading("24.1 Document Ingestion (ERP Integration)", level=2)
doc.add_paragraph(
    "External systems (e.g. SAP) can upload documents programmatically:\n\n"
    "1. Authenticate via POST /api/auth/login to obtain a JWT token.\n"
    "2. Prepare multipart form-data with metadata JSON and file blob.\n"
    "3. POST /api/documents with the Authorization: Bearer {token} header.\n"
    "4. Store the returned Apex document UUID back in the source system.\n\n"
    "Metadata can include custom fields (vendor_id, PO amount, cost centre) "
    "and retention period."
)

doc.add_heading("24.2 Workflow Integration (HRIS)", level=2)
doc.add_paragraph(
    "HR systems (e.g. Workday) can trigger workflows for document collection:\n\n"
    "1. POST /api/workflow/instances with document ID, workflow definition, and approvers.\n"
    "2. Assign HR Business Partner as the first approver.\n"
    "3. Link the returned workflow instance ID back to the HRIS record.\n"
    "4. Monitor workflow status via GET /api/workflow/instances/{id}."
)

doc.add_heading("24.3 Search Integration (CRM)", level=2)
doc.add_paragraph(
    "CRM systems (e.g. Salesforce) can embed document search:\n\n"
    "1. GET /api/search?q={searchTerm}&mimeType=application/pdf&size=10\n"
    "2. Display results in an embedded widget.\n"
    "3. Deep-link to Apex Nexus web UI for document details."
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 25. JURISDICTION-SPECIFIC COMPLIANCE & RECORDS MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("25. Jurisdiction-Specific Compliance & Records Management", level=1)

doc.add_heading("25.1 Overview", level=2)
doc.add_paragraph(
    "Apex Nexus supports country-specific records management with legally-binding "
    "retention rules, jurisdiction metadata, and mapped legal frameworks. Organisations "
    "operating across borders can enforce per-jurisdiction retention policies."
)

doc.add_heading("25.2 Supported Jurisdictions", level=2)
add_table(
    ["Code", "Country / Region", "Legal Frameworks"],
    [
        ["DE", "Germany", "HGB, AO, GoBD, BDSG"],
        ["AT", "Austria", "UGB, BAO"],
        ["CH", "Switzerland", "OR, DSG"],
        ["EU", "European Union", "GDPR, eIDAS"],
        ["US", "United States", "SOX, HIPAA, FOIA"],
        ["GB", "United Kingdom", "UK GDPR, CA2006"],
        ["FR", "France", "Code de Commerce"],
        ["NL", "Netherlands", "WBTR"],
        ["IT", "Italy", "Codice Civile"],
        ["ES", "Spain", "LOPD-GDD"],
    ],
)

doc.add_heading("25.3 Legal Frameworks", level=2)
doc.add_paragraph(
    "Each jurisdiction references one or more legal frameworks that define "
    "document retention obligations:\n\n"
    "• HGB (Germany) – Commercial records must be kept 6–10 years\n"
    "• AO (Germany) – Tax-relevant documents: 10 years\n"
    "• GoBD (Germany) – Principles for digital record-keeping, audit-proof archiving\n"
    "• BDSG (Germany) – Data protection: personal data deletion after 3 years max\n"
    "• GDPR (EU) – Data minimisation; personal data not longer than processing purpose\n"
    "• eIDAS (EU) – Electronic signatures and trust services\n"
    "• SOX (US) – Financial/audit records: 7 years\n"
    "• HIPAA (US) – Medical records: 6 years minimum\n"
    "• FOIA (US) – Government records\n"
    "• UK GDPR (UK) – UK-specific data protection post-Brexit\n"
    "• CA2006 (UK) – Companies Act: corporate records 6 years"
)

doc.add_heading("25.4 Retention Rules Engine", level=2)
doc.add_paragraph(
    "Rules link jurisdiction + legal framework + document category to minimum/maximum "
    "retention years. Each rule specifies:\n\n"
    "• Document Category (e.g. COMMERCIAL_RECORDS, TAX_DOCUMENTS, MEDICAL_RECORDS)\n"
    "• Minimum and maximum retention years\n"
    "• Legal citation (e.g. § 257 Abs. 4 HGB)\n"
    "• Whether the rule is mandatory\n"
    "• Penalty information for non-compliance"
)

doc.add_heading("25.5 Compliance API Endpoints", level=2)
add_table(
    ["Method", "Endpoint", "Description"],
    [
        ["GET", "/retention/jurisdictions", "List all active jurisdictions"],
        ["GET", "/retention/jurisdictions/{code}", "Get jurisdiction by ISO code"],
        ["GET", "/retention/jurisdictions/{id}/frameworks", "List frameworks for a jurisdiction"],
        ["GET", "/retention/jurisdictions/frameworks", "List all active legal frameworks"],
        ["GET", "/retention/jurisdictions/{id}/rules", "Get retention rules by jurisdiction"],
        ["GET", "/retention/jurisdictions/rules", "Get all active retention rules"],
        ["GET", "/retention/jurisdictions/rules/by-category/{cat}", "Filter rules by document category"],
        ["GET", "/retention/jurisdictions/{id}/rules/check/{cat}", "Check compliance for jurisdiction + category"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 26. VISUAL WORKFLOW DESIGNER
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("26. Visual Workflow Designer", level=1)

doc.add_heading("26.1 Overview", level=2)
doc.add_paragraph(
    "The drag-and-drop workflow designer provides a visual canvas for authoring "
    "and editing workflow definitions. Users select from pre-built templates or "
    "create workflows from scratch."
)

doc.add_heading("26.2 Template Gallery", level=2)
add_table(
    ["Template", "Category", "Industry", "States"],
    [
        ["Standard Document Approval", "general", "All", "DRAFT → REVIEW → APPROVED / REJECTED → PUBLISHED / ARCHIVED"],
        ["Invoice Processing", "finance", "Finance", "RECEIVED → VERIFIED → APPROVED / DISPUTED → PAID → ARCHIVED"],
        ["Contract Lifecycle", "legal", "Legal", "DRAFT → REVIEW → NEGOTIATION → EXECUTED → ACTIVE → EXPIRED / TERMINATED"],
        ["Employee Onboarding", "hr", "HR", "INITIATED → DOCUMENTS_COLLECTED → REVIEWED → COMPLETED → ARCHIVED"],
        ["Patient Record Management", "healthcare", "Healthcare", "CREATED → ACTIVE → UNDER_REVIEW → RELEASED → RETENTION → DISPOSED"],
    ],
)

doc.add_heading("26.3 Designer Features", level=2)
doc.add_paragraph(
    "• Drag-and-drop state nodes on a pannable, zoomable SVG canvas\n"
    "• Click-to-connect edges between nodes\n"
    "• Properties panel: edit name, colour, position of selected elements\n"
    "• Load from template gallery or start blank\n"
    "• Save workflow to backend (creates a WorkflowDefinition)\n"
    "• Zoom controls (+/−/reset) and grid snapping\n"
    "• Custom edge labels and routing"
)

doc.add_heading("26.4 Workflow Template API", level=2)
add_table(
    ["Method", "Endpoint", "Description"],
    [
        ["GET", "/workflows/templates", "List all workflow templates"],
        ["GET", "/workflows/templates/{id}", "Get template by ID"],
        ["GET", "/workflows/templates/by-name/{name}", "Get template by name"],
        ["GET", "/workflows/templates/by-category/{cat}", "Filter by category"],
        ["GET", "/workflows/templates/by-industry/{industry}", "Filter by industry"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 27. PLUGIN MARKETPLACE & EXTENSION ARCHITECTURE
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("27. Plugin Marketplace & Extension Architecture", level=1)

doc.add_heading("27.1 Overview", level=2)
doc.add_paragraph(
    "Apex Nexus includes a plugin marketplace with connectors, compliance packs, "
    "and AI extensions. Plugins can be activated or deactivated per tenant."
)

doc.add_heading("27.2 Plugin Types", level=2)
add_table(
    ["Type", "Description", "Examples"],
    [
        ["CONNECTOR", "Integrates with external systems", "SAP, Salesforce, MS 365, HL7 FHIR"],
        ["PROCESSOR", "AI/ML document processing", "Advanced OCR, AI Classification"],
        ["INDUSTRY_PACK", "Compliance & industry bundles", "HIPAA Pack, SOX Pack, ISO 9001, FOIA"],
        ["INTEGRATION", "Digital-trust integrations", "DocuSign, eIDAS Signatures"],
        ["UI_EXTENSION", "Frontend plug-in panels", "PLM Connector for manufacturing"],
    ],
)

doc.add_heading("27.3 Pre-Built Plugins (13)", level=2)
add_table(
    ["Plugin", "Vendor", "Type", "Category"],
    [
        ["SAP Connector", "Apex Nexus", "CONNECTOR", "erp"],
        ["Salesforce Connector", "Apex Nexus", "CONNECTOR", "crm"],
        ["DocuSign Integration", "Apex Nexus", "INTEGRATION", "signatures"],
        ["Microsoft 365", "Apex Nexus", "CONNECTOR", "productivity"],
        ["HL7 FHIR Connector", "Apex Nexus", "CONNECTOR", "healthcare"],
        ["HIPAA Compliance Pack", "Apex Nexus", "INDUSTRY_PACK", "healthcare"],
        ["SOX Compliance Pack", "Apex Nexus", "INDUSTRY_PACK", "finance"],
        ["ISO 9001 Quality Pack", "Apex Nexus", "INDUSTRY_PACK", "manufacturing"],
        ["PLM Connector", "Apex Nexus", "CONNECTOR", "manufacturing"],
        ["Advanced OCR Engine", "Apex Nexus", "PROCESSOR", "ai"],
        ["AI Classification Engine", "Apex Nexus", "PROCESSOR", "ai"],
        ["eIDAS Signature Pack", "Apex Nexus", "INDUSTRY_PACK", "legal"],
        ["FOIA Compliance Pack", "Apex Nexus", "INDUSTRY_PACK", "government"],
    ],
)

doc.add_heading("27.4 Plugin Hook System", level=2)
doc.add_paragraph(
    "Plugins register hooks that fire on system events:\n\n"
    "• PRE_UPLOAD / POST_UPLOAD – trigger processing before/after document upload\n"
    "• PRE_APPROVE / POST_APPROVE – intercept or react to approval actions\n"
    "• SCHEDULED – periodic batch processing\n"
    "• ON_CLASSIFY – fire after AI classification\n"
    "• ON_RETENTION_CHECK – fire during retention compliance evaluation"
)

doc.add_heading("27.5 Plugin API Endpoints", level=2)
add_table(
    ["Method", "Endpoint", "Description"],
    [
        ["GET", "/auth/plugins", "List all plugins"],
        ["GET", "/auth/plugins/active", "List active plugins only"],
        ["GET", "/auth/plugins/{id}", "Get plugin by ID"],
        ["GET", "/auth/plugins/by-name/{name}", "Get plugin by unique name"],
        ["GET", "/auth/plugins/by-type/{type}", "Filter by plugin type"],
        ["GET", "/auth/plugins/by-category/{cat}", "Filter by category"],
        ["POST", "/auth/plugins/{id}/activate", "Activate a plugin"],
        ["POST", "/auth/plugins/{id}/deactivate", "Deactivate a plugin"],
        ["GET", "/auth/plugins/hooks/{eventName}", "Get hooks for an event"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 28. INDUSTRY SOLUTION TEMPLATES
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("28. Industry Solution Templates", level=1)

doc.add_heading("28.1 Overview", level=2)
doc.add_paragraph(
    "Industry templates bundle plugins, workflows, retention rules, and compliance "
    "frameworks into one-click deployment packages for specific verticals."
)

doc.add_heading("28.2 Available Templates", level=2)
add_table(
    ["Industry", "Plugins", "Workflows", "Compliance"],
    [
        ["Healthcare", "HL7 FHIR, HIPAA Pack", "Patient Record Management", "HIPAA"],
        ["Banking & Finance", "SAP, SOX Pack", "Invoice Processing", "SOX, AML"],
        ["Legal", "DocuSign, eIDAS Pack", "Contract Lifecycle", "eIDAS, GDPR"],
        ["Manufacturing", "PLM, ISO 9001 Pack", "Quality Document Control", "ISO 9001"],
        ["Public Sector", "FOIA Pack", "Document Request Processing", "FOIA, GDPR"],
    ],
)

doc.add_heading("28.3 Template Contents", level=2)
doc.add_paragraph(
    "Each industry template includes:\n\n"
    "• includedPlugins – list of plugin keys auto-activated on deployment\n"
    "• defaultWorkflows – workflow template names provisioned for the tenant\n"
    "• retentionRules – jurisdiction-aware document retention configurations\n"
    "• complianceFrameworks – legal framework codes that the template satisfies\n"
    "• Icon and display metadata for the UI catalogue"
)

doc.add_heading("28.4 Industry Template API", level=2)
add_table(
    ["Method", "Endpoint", "Description"],
    [
        ["GET", "/auth/industry-templates", "List all active templates"],
        ["GET", "/auth/industry-templates/{id}", "Get template by ID"],
        ["GET", "/auth/industry-templates/by-name/{name}", "Get template by name"],
        ["GET", "/auth/industry-templates/by-industry/{industry}", "Filter by industry"],
    ],
)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════
# 29. DEPLOYMENT & INFRASTRUCTURE
# ═══════════════════════════════════════════════════════════════════════════
doc.add_heading("29. Deployment & Infrastructure", level=1)

doc.add_heading("29.1 Development Environment (Docker Compose)", level=2)
doc.add_paragraph(
    "All components run locally via Docker Compose with a single command:\n\n"
    "docker-compose up -d\n\n"
    "This starts 13 containers:\n"
    "• 4 infrastructure services (PostgreSQL, Redis, Elasticsearch, MinIO)\n"
    "• 8 backend microservices + API Gateway\n"
    "• Development tools (MailHog for email testing)"
)

doc.add_heading("25.2 Container Port Mappings", level=2)
add_table(
    ["Service", "Host Port", "Container Port"],
    [
        ["API Gateway", "8200", "8080"],
        ["Auth Service", "8201", "8081"],
        ["Document Service", "8202", "8082"],
        ["Workflow Service", "8203", "8083"],
        ["Search Service", "8204", "8084"],
        ["Retention Service", "8205", "8085"],
        ["Audit Service", "8206", "8086"],
        ["Notification Service", "8207", "8087"],
        ["PostgreSQL", "5432", "5432"],
        ["Redis", "6579", "6379"],
        ["Elasticsearch", "9200", "9200"],
        ["MinIO (API)", "9000", "9000"],
        ["MinIO (Console)", "9001", "9001"],
        ["MailHog (SMTP)", "1025", "1025"],
        ["MailHog (Web UI)", "8025", "8025"],
        ["Frontend (Web)", "3001", "3000"],
    ],
)

doc.add_heading("29.3 Production Recommendations", level=2)
doc.add_paragraph(
    "For production deployment:\n\n"
    "• Managed PostgreSQL (AWS RDS, Azure Database, or CrunchyData operator)\n"
    "• Managed Elasticsearch (Elastic Cloud or 3+ node self-hosted cluster)\n"
    "• Managed Redis (ElastiCache / Azure Cache or Redis with Sentinel)\n"
    "• MinIO distributed erasure-coded cluster (or replace with S3/Azure Blob)\n"
    "• Each microservice deployed as a Kubernetes pod with Helm charts\n"
    "• Horizontal pod autoscaling based on CPU/memory utilisation\n"
    "• TLS 1.3 termination at ingress controller\n"
    "• Centralised logging (ELK/Fluentd) and monitoring (Prometheus/Grafana)"
)

# ── Save ─────────────────────────────────────────────────────────────────
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Apex_Nexus_Documentation.docx")
doc.save(output_path)
print(f"Document saved to: {output_path}")
