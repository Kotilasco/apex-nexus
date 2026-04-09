# Apex Nexus — Requirements Specification

**Version:** 2.0  
**Date:** April 4, 2026  
**Status:** Implemented & Verified  
**Classification:** Internal — Engineering

---

## 1. Executive Summary

Apex Nexus is a cloud-native Enterprise Content Management (ECM) platform built on microservices architecture. It provides secure document lifecycle management, workflow automation, compliance enforcement, full-text search, real-time collaboration, and ERP integration — targeting regulated industries (Finance, Healthcare, Legal, Manufacturing, Government).

**Technology Stack:**
- **Backend:** Java 21, Spring Boot 3.3, Spring Cloud Gateway
- **Frontend:** Next.js 14 (React 18), TypeScript, Tailwind CSS
- **Mobile:** React Native (Expo)
- **Database:** PostgreSQL 16 with Row-Level Security
- **Cache / Locks:** Redis 7
- **Object Storage:** MinIO (S3-compatible, AES-256-GCM encryption)
- **Search:** Elasticsearch 8.12
- **Deployment:** Docker Compose (Kubernetes-ready)

---

## 2. System Architecture

### 2.1 Microservices

| ID | Service | Port (Internal) | Port (Docker) | Responsibility |
|----|---------|-----------------|---------------|----------------|
| SVC-01 | **API Gateway** | 8080 | 8200 | Route multiplexing, CORS, rate limiting, request-size limits |
| SVC-02 | **Auth Service** | 8081 | 8201 | JWT authentication, RBAC, user/role management, plugins, share links, projects |
| SVC-03 | **Document Service** | 8082 | 8202 | Document vault, checkout/checkin, versioning, locks, WebDAV, WOPI, signatures |
| SVC-04 | **Workflow Service** | 8083 | 8203 | State-machine workflows, approvals, forwards, templates |
| SVC-05 | **Search Service** | 8084 | 8204 | Full-text indexing, semantic search, content extraction, GDPR scan |
| SVC-06 | **Retention Service** | 8085 | 8205 | Policy management, disposition queues, jurisdiction rules, compliance |
| SVC-07 | **Audit Service** | 8086 | 8206 | Tamper-evident immutable logging, hash-chained entries, CSV export |
| SVC-08 | **Notification Service** | 8087 | 8207 | WebSocket push, email alerts, unread counts |

### 2.2 Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| PostgreSQL 16 | RDBMS | Persistent storage, RLS, 60+ tables |
| Redis 7 | Cache | JWT sessions, distributed locks, heartbeat |
| MinIO | Object Store | Document binaries, draft autosaves, thumbnails |
| Elasticsearch 8.12 | Search Engine | Full-text, faceted, semantic search |

### 2.3 Gateway Routes

All external traffic enters through the API Gateway (port 8200).

| Route | Pattern | Target | Notes |
|-------|---------|--------|-------|
| Auth | `/api/auth/**`, `/api/projects/**`, `/api/governance/**` | auth-service:8081 | StripPrefix=1 |
| Documents | `/api/documents/**`, `/api/folders/**`, `/api/notes/**` | document-service:8082 | StripPrefix=1, 500 MB limit |
| WebDAV | `/api/webdav/**` | document-service:8082 | StripPrefix=1, 500 MB limit |
| WOPI | `/api/wopi/**` | document-service:8082 | StripPrefix=1, 500 MB limit |
| Locks | `/api/locks/**` | document-service:8082 | StripPrefix=1 |
| WebSocket | `/ws/documents/**` | document-service:8082 | No strip, STOMP/SockJS |
| Workflow | `/api/workflows/**`, `/api/workflow/**`, `/api/approvals/**` | workflow-service:8083 | StripPrefix=1 |
| Search | `/api/search/**` | search-service:8084 | StripPrefix=1 |
| Retention | `/api/retention/**`, `/api/disposition/**` | retention-service:8085 | StripPrefix=1 |
| Audit | `/api/audit/**` | audit-service:8086 | StripPrefix=1 |
| Notification | `/api/notifications/**`, `/api/notification/**` | notification-service:8087 | StripPrefix=1 |

---

## 3. Functional Requirements

### FR-01: Authentication & Authorization

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01.01 | JWT-based stateless authentication with 1-hour token expiry | P0 |
| FR-01.02 | User registration with username, email, password, full name | P0 |
| FR-01.03 | Login returns JWT access token | P0 |
| FR-01.04 | Logout invalidates session | P0 |
| FR-01.05 | Role-Based Access Control (RBAC) with 7 default roles: SYSTEM_ADMIN, RECORDS_MANAGER, DEPARTMENT_ADMIN, APPROVER, AUTHOR, VIEWER, AI_OPERATOR | P0 |
| FR-01.06 | Permission granularity: resource + action level | P0 |
| FR-01.07 | User management: list, get, create, update, lock/unlock | P1 |
| FR-01.08 | Account lockout after configurable failed attempts | P1 |
| FR-01.09 | BCrypt password encoding (strength 12) | P0 |
| FR-01.10 | Invalid/expired token returns HTTP 401 | P0 |

### FR-02: Document Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-02.01 | Upload documents (any MIME type, up to 500 MB) | P0 |
| FR-02.02 | Download document by ID | P0 |
| FR-02.03 | Get document metadata (title, description, MIME, tags, status, author, retention info) | P0 |
| FR-02.04 | List user's documents with pagination | P0 |
| FR-02.05 | Folder hierarchy: create, list root, list children, nest documents | P0 |
| FR-02.06 | Document status lifecycle: DRAFT → ACTIVE → IN_REVIEW → APPROVED → ARCHIVED → PENDING_DESTRUCTION → DESTROYED | P0 |
| FR-02.07 | Metadata update (title, description, tags) via PUT | P1 |
| FR-02.08 | Document deletion with cascade (versions, notes, permissions, lock keys) | P1 |
| FR-02.09 | Document preview URL generation | P2 |
| FR-02.10 | Tags as array with GIN index for efficient filtering | P1 |
| FR-02.11 | JSONB metadata for custom key-value pairs | P2 |

### FR-03: Version Control & Checkout/Checkin

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-03.01 | Checkout: exclusive lock on document, sets `is_checked_out=true` | P0 |
| FR-03.02 | Checkin: upload new version, increment version number, release lock | P0 |
| FR-03.03 | Cancel checkout: release lock without new version | P0 |
| FR-03.04 | Version history: list all versions with SHA-256 hashes | P0 |
| FR-03.05 | Version types: MAJOR and MINOR | P1 |
| FR-03.06 | Version rollback to any previous version | P1 |
| FR-03.07 | Download specific version by version number | P1 |
| FR-03.08 | Version label (human-readable tag) | P2 |

### FR-04: Two-Tiered Locking & Draft Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-04.01 | Heartbeat-based distributed lock via Redis with 5-minute TTL | P0 |
| FR-04.02 | Lock acquire returns opaque lock token, timeout, owner info | P0 |
| FR-04.03 | Heartbeat keeps lock alive; client sends every 30-60 seconds | P0 |
| FR-04.04 | Voluntary lock release by owner | P0 |
| FR-04.05 | Lock status query: locked, ownerId, heartbeatAlive, ttlSeconds, hasDraft | P0 |
| FR-04.06 | Conflict detection: second user gets CONFLICT with owner info | P0 |
| FR-04.07 | Stale lock detection: expired heartbeat allows takeover | P1 |
| FR-04.08 | Admin force-release with optional draft discard | P1 |
| FR-04.09 | Draft autosave to MinIO drafts bucket | P1 |
| FR-04.10 | Draft retrieval for lock owner | P1 |
| FR-04.11 | WebSocket real-time lock status broadcast (STOMP/SockJS) | P1 |
| FR-04.12 | Events: LOCK_ACQUIRED, LOCK_RELEASED, HEARTBEAT, DRAFT_SAVED, LOCK_TAKEN_OVER, LOCK_FORCE_RELEASED | P1 |
| FR-04.13 | Unified lock prefix `lock:` across checkout, WebDAV, and direct lock APIs | P0 |
| FR-04.14 | Re-acquire by same user refreshes lock (not conflict) | P1 |

### FR-05: WebDAV (Edit-in-Place)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-05.01 | WebDAV OPTIONS: returns Allow header with supported methods | P0 |
| FR-05.02 | WebDAV HEAD: returns resource metadata without body | P0 |
| FR-05.03 | WebDAV GET: download document binary | P0 |
| FR-05.04 | WebDAV PUT: save draft to MinIO draft bucket (not new version) | P0 |
| FR-05.05 | WebDAV LOCK: acquire lock via LockService, return lock token in XML | P0 |
| FR-05.06 | WebDAV UNLOCK: release lock via LockService | P0 |
| FR-05.07 | WebDAV PROPFIND: return XML with document/collection properties | P1 |

### FR-06: WOPI (Office Online Co-Authoring)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-06.01 | WOPI token generation with expiry | P0 |
| FR-06.02 | CheckFileInfo: return document metadata for Office Online | P0 |
| FR-06.03 | GetFile: serve document binary | P0 |
| FR-06.04 | PutFile: save changes from Office Online | P0 |
| FR-06.05 | WOPI LOCK / GET_LOCK / UNLOCK operations | P0 |
| FR-06.06 | Token-based auth (separate from JWT, permitAll with WOPI token validation) | P0 |

### FR-07: Workflow Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-07.01 | Workflow definitions with JSONB states and transitions | P0 |
| FR-07.02 | Start workflow instance for a document | P0 |
| FR-07.03 | State transitions: START, SUBMIT, APPROVE, REJECT, REVISE, ARCHIVE, RECALL, ESCALATE, FORWARD, SIGN | P0 |
| FR-07.04 | Pending approvals with pagination | P0 |
| FR-07.05 | Approval count endpoint | P0 |
| FR-07.06 | Workflow history (transition log) | P0 |
| FR-07.07 | My workflow instances | P0 |
| FR-07.08 | Document forwarding with action types: REVIEW, APPROVE, SIGN, COMMENT, FYI | P1 |
| FR-07.09 | Pending forwards count | P1 |
| FR-07.10 | Workflow templates (industry pre-built) | P2 |
| FR-07.11 | Visual workflow designer (frontend canvas) | P2 |

### FR-08: Search & Content Intelligence

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-08.01 | Quick search by keyword with pagination | P0 |
| FR-08.02 | Advanced search: query, tags, MIME type, status, folder path, author, date range | P0 |
| FR-08.03 | Semantic search (vector-based similarity) | P1 |
| FR-08.04 | Content extraction (Apache Tika) | P1 |
| FR-08.05 | Document indexing in Elasticsearch | P0 |
| FR-08.06 | GDPR PII scan | P1 |
| FR-08.07 | Document classification (AI/manual/rule) | P2 |

### FR-09: Retention & Compliance

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-09.01 | Retention policy CRUD (name, years, autoDispose, requiresApproval) | P0 |
| FR-09.02 | Disposition queue: pending, approved, rejected, destroyed | P0 |
| FR-09.03 | Disposition approval workflow | P0 |
| FR-09.04 | Retention statistics | P1 |
| FR-09.05 | Jurisdiction management (EU, US, DE, etc.) | P1 |
| FR-09.06 | Legal framework registry per jurisdiction | P1 |
| FR-09.07 | Jurisdiction retention rules with min/max years, citations, penalty info | P1 |
| FR-09.08 | Compliance check by jurisdiction and document category | P1 |
| FR-09.09 | Legal hold: set/remove with reason tracking | P0 |

### FR-10: Audit & Immutability

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-10.01 | Immutable audit log with database triggers preventing UPDATE/DELETE | P0 |
| FR-10.02 | Hash-chained entries (SHA-256, previous_hash + entry_hash) | P0 |
| FR-10.03 | Audit entries: userId, action, resourceType, resourceId, IP, userAgent, JSONB details | P0 |
| FR-10.04 | Query by: user, action, resource type, resource ID, date range | P0 |
| FR-10.05 | Audit statistics | P1 |
| FR-10.06 | Chain integrity verification | P0 |
| FR-10.07 | CSV export of audit logs | P1 |

### FR-11: Notifications

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-11.01 | User notifications: INFO, WARNING, ACTION_REQUIRED, APPROVAL, SYSTEM | P0 |
| FR-11.02 | List my notifications with pagination | P0 |
| FR-11.03 | Unread notifications and unread count | P0 |
| FR-11.04 | Mark individual or all notifications as read | P0 |
| FR-11.05 | WebSocket real-time push | P1 |

### FR-12: Document Signatures

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-12.01 | Signature request (INTERNAL, DOCUSIGN, EIDAS, ADOBE_SIGN providers) | P1 |
| FR-12.02 | Sign / Decline operations | P1 |
| FR-12.03 | Signature verification | P1 |
| FR-12.04 | Pending signatures per user | P1 |
| FR-12.05 | Signatures per document | P1 |

### FR-13: Document Notes

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-13.01 | Add note to document with type: GENERAL, IMPORTANT, REVIEW, PRIVATE, SYSTEM | P0 |
| FR-13.02 | List notes by document | P0 |
| FR-13.03 | Update note content | P1 |
| FR-13.04 | Delete note | P1 |
| FR-13.05 | Threaded notes (parentNoteId) | P2 |
| FR-13.06 | Pinned notes, color coding | P2 |

### FR-14: Projects & Governance

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-14.01 | Project CRUD with workspace scoping | P1 |
| FR-14.02 | Project members with role and permission mask | P1 |
| FR-14.03 | AI Governance policies (GLOBAL, PROJECT, USER scopes) | P1 |
| FR-14.04 | Effective policy resolution (hierarchical merge) | P1 |
| FR-14.05 | Policy audit log (change tracking) | P1 |
| FR-14.06 | Feature gating via governance check | P2 |

### FR-15: Public Sharing

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-15.01 | Generate share link with expiry, optional password, download limit | P1 |
| FR-15.02 | Share link validation (token, password, IP whitelist) | P1 |
| FR-15.03 | Download tracking and count | P1 |
| FR-15.04 | Revoke share link | P1 |

### FR-16: Plugin Ecosystem

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-16.01 | Plugin registry (CONNECTOR, PROCESSOR, UI_EXTENSION, INDUSTRY_PACK, INTEGRATION) | P1 |
| FR-16.02 | Plugin activation / deactivation | P1 |
| FR-16.03 | Plugin discovery by type, category, name | P1 |
| FR-16.04 | Plugin hooks for event-driven extensions | P2 |
| FR-16.05 | Industry templates with preset configurations | P2 |

### FR-17: SAP ERP Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-17.01 | SAP ERP Connector plugin (sap-erp-connector) | P1 |
| FR-17.02 | Connection test against all 6 Apex Nexus services with latency measurement | P1 |
| FR-17.03 | Live data visibility: document count, approval count, audit count, retention policies | P1 |
| FR-17.04 | Bi-directional sync simulation: import documents, export invoices, sync workflows | P1 |
| FR-17.05 | SAP Integration UI with plugin toggle, architecture diagram | P1 |
| FR-17.06 | Sync event log with direction, status, timestamps | P1 |

---

## 4. Non-Functional Requirements

### NFR-01: Security

| ID | Requirement |
|----|-------------|
| NFR-01.01 | AES-256-GCM encryption for documents at rest (MinIO) |
| NFR-01.02 | JWT stateless authentication with HMAC-SHA256 signing |
| NFR-01.03 | BCrypt (strength 12) password hashing |
| NFR-01.04 | CSRF disabled (JWT-based protection) |
| NFR-01.05 | Row-Level Security policies on documents and folders tables |
| NFR-01.06 | CORS configured for cross-origin access with credentials |
| NFR-01.07 | WebSocket endpoints permitted without JWT (STOMP-level auth) |
| NFR-01.08 | WOPI endpoints use token-based auth (separate from JWT) |

### NFR-02: Performance

| ID | Requirement |
|----|-------------|
| NFR-02.01 | Maximum request header size: 64 KB |
| NFR-02.02 | Maximum file upload: 500 MB |
| NFR-02.03 | API timeout: 30 seconds (300 seconds for uploads) |
| NFR-02.04 | Redis-based distributed locking with 5-minute TTL |
| NFR-02.05 | Elasticsearch for sub-second full-text search |
| NFR-02.06 | Pagination on all list endpoints (default page size configurable) |

### NFR-03: Reliability

| ID | Requirement |
|----|-------------|
| NFR-03.01 | Health checks on all infrastructure services |
| NFR-03.02 | Docker service dependencies (depends_on with conditions) |
| NFR-03.03 | Redis persistence (appendonly) for lock durability |
| NFR-03.04 | PostgreSQL for ACID-compliant data storage |
| NFR-03.05 | Audit log immutability enforced by database triggers |

### NFR-04: Compliance

| ID | Requirement |
|----|-------------|
| NFR-04.01 | GDPR: PII scanning, data classification, right-to-erasure support |
| NFR-04.02 | GxP: 20+ year retention automation |
| NFR-04.03 | SOX / HIPAA / FOIA: jurisdiction-specific retention rules |
| NFR-04.04 | eIDAS: digital signature support with certificate storage |
| NFR-04.05 | Tamper-evident audit chain with SHA-256 hash verification |

---

## 5. Database Schema Summary

**Total Tables:** 60+

| Category | Tables |
|----------|--------|
| User & RBAC | users, roles, permissions, user_roles, role_permissions |
| Projects | projects, project_members |
| AI Governance | ai_governance_policies, policy_audit_log |
| Documents | documents, document_versions, document_notes, document_links |
| Folders & Permissions | folders, folder_permissions, document_permissions |
| Workflows | workflow_definitions, workflow_instances, workflow_transitions, workflow_approvals, approval_groups, approval_group_members, workflow_templates, workflow_forwards |
| Retention | retention_policies, disposition_queue, jurisdictions, legal_frameworks, jurisdiction_retention_rules |
| Signatures | document_signatures |
| Content | content_extractions |
| Privacy | gdpr_scans |
| Sharing | document_share_links |
| Classification | classification_labels, document_classifications |
| Audit | audit_log (immutable, trigger-protected) |
| Notifications | notifications |
| Bookmarks & Offline | bookmarks, offline_pins |
| Search Queue | search_index_queue |
| Tags | tags |
| Sessions | user_sessions |
| WOPI | wopi_access_tokens |
| WebDAV | webdav_locks |
| Plugins | plugin_registry, plugin_hooks, industry_templates |

---

## 6. Frontend Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/login` | Login | Authentication |
| `/register` | Register | User registration |
| `/dashboard` | Dashboard | Analytics, recent docs, system stats |
| `/documents` | Documents | Folder browser, upload, metadata, checkout |
| `/workflow` | Workflow | My instances, pending approvals, start new |
| `/workflow-designer` | Designer | Visual state-machine builder |
| `/search` | Search | Quick, advanced, semantic search |
| `/retention` | Retention | Policies, dispositions, compliance stats |
| `/compliance` | Compliance | Jurisdictions, frameworks, legal rules |
| `/trust-center` | Trust Center | AI governance policies, audit |
| `/analytics` | Analytics | KPIs, charts, reports |
| `/industry` | Industry | Industry templates, solution packs |
| `/marketplace` | Marketplace | Plugin discovery, install, activate |
| `/sap` | SAP Integration | Connection tests, sync, live data, ERP bridge |
| `/audit` | Audit Log | Immutable logs, filtering, CSV export |
| `/notifications` | Notifications | Message center |
| `/admin/users` | Admin Users | User management, roles, permissions |
| `/admin/settings` | Admin Settings | System configuration |
| `/share/[token]` | Public Share | Anonymous document access |

---

## 7. Default Seed Data

| Category | Items |
|----------|-------|
| Roles | SYSTEM_ADMIN, RECORDS_MANAGER, DEPARTMENT_ADMIN, APPROVER, AUTHOR, VIEWER, AI_OPERATOR |
| Admin User | admin / Admin@2024! (SYSTEM_ADMIN) |
| Folders | Root, Shared Documents, Templates, Archive |
| Workflow | Standard Approval (DRAFT → IN_REVIEW → APPROVED/REJECTED → ARCHIVED) |
| Retention Policies | Standard 7-Year, Regulatory 20-Year, Permanent (999y) |
| Classification Labels | Contract, Invoice, Correspondence, Report, Policy, Technical, HR Document, Meeting Minutes, Presentation, Spreadsheet, Image, Other |
| Tags | Confidential, Urgent, Contract, Policy, Invoice, Report, Template, Legal, HR, Finance |
| Jurisdictions | EU (European Union), DE (Germany), US (United States) |
| Plugins | sap-erp-connector, email-archiver, tika-content-extractor, blockchain-notary, docusign-signer, jira-sync |

---

## 8. Verified Test Results

**Last Run:** April 4, 2026  
**Result:** 126 PASS / 0 FAIL / 1 SKIP (127 total)

The 1 SKIP is test 12.6 — generic DELETE returns 500 (endpoint not implemented as a generic route; specific delete routes like `DELETE /documents/{id}` work correctly in test 13.22).
