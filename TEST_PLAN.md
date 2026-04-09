# Apex Nexus — Complete Test Plan

> **Version:** 3.0 | **Date:** 2 April 2026
> Run `docker compose up --build -d` from the root directory, wait ~2 minutes for all 13 containers to become healthy, then start testing.

---

## Environment Quick Reference

| Service | URL |
|---------|-----|
| Frontend (Web) | http://localhost:3001 |
| API Gateway | http://localhost:8200 |
| MinIO Console | http://localhost:9001 (minioadmin / minioadmin) |
| MailHog (emails) | http://localhost:8025 |
| Elasticsearch | http://localhost:9200 |
| PostgreSQL | localhost:5432 (apex_admin / dev_password) |

### Test Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | Admin@2024! | SYSTEM_ADMIN (full access) |

> After registering a new user (step 2 below), they get the **AUTHOR** role by default. You can promote them via the admin panel.

---

## 1. AUTHENTICATION & REGISTRATION

### 1.1 Login
- [ ] Open http://localhost:3001 — should redirect to `/login`
- [ ] Enter `admin` / `Admin@2024!` — should redirect to `/dashboard`
- [ ] Toggle password visibility with the eye icon
- [ ] Enter wrong password — should show error "Login failed" / "Invalid credentials"
- [ ] Verify the sidebar shows all navigation items

### 1.2 Register
- [ ] Click "Register" link on login page
- [ ] Fill in username, email, first name, last name, password
- [ ] Submit — should create account and redirect to login
- [ ] Login with the new account
- [ ] Verify limited access (AUTHOR role — cannot see Admin pages)

### 1.3 Logout
- [ ] Click logout button (top-right) — should redirect to `/login`
- [ ] Try navigating to `/dashboard` directly — should redirect to `/login`

---

## 2. DASHBOARD (Charts & Quick Actions)

- [ ] Navigate to `/dashboard`
- [ ] Verify **Stat Cards** at the top (Total Documents, Pending Approvals, Active Workflows, etc.)
- [ ] Verify **Weekly Activity** bar chart (uploads vs approvals by day-of-week)
- [ ] Verify **Document Categories** donut/pie chart (Contracts, Invoices, Reports, HR, Technical, Other)
- [ ] Verify **6-Month Trend** area chart (documents line + workflows line)
- [ ] Click each **Quick Action** card and confirm navigation:
  - [ ] Upload → `/documents/create`
  - [ ] Approvals → `/workflow/pending-approvals`
  - [ ] Search → `/search`
  - [ ] Retention → `/retention`
  - [ ] Designer → `/workflow-designer`
  - [ ] Plugins → `/marketplace`
  - [ ] Compliance → `/compliance`
  - [ ] Industry → `/industry`

---

## 3. DOCUMENT MANAGEMENT

### 3.1 Upload Document
- [ ] Navigate to `/documents/create`
- [ ] Upload a PDF file with metadata (title, description, category, tags)
- [ ] Submit — should show success and redirect to document list
- [ ] Upload a Word document (.docx)
- [ ] Upload an image file (.png / .jpg)
- [ ] Upload a large file (>10 MB) — verify progress indicator

### 3.2 Document List
- [ ] Navigate to `/documents`
- [ ] Verify documents appear in the list with title, category, status, date
- [ ] Test **search** by document title
- [ ] Test **filter** by status (DRAFT, IN_REVIEW, etc.)
- [ ] Test **pagination** (if enough documents)
- [ ] Click a document to open its detail page

### 3.3 Document Detail
- [ ] View document metadata (title, description, category, tags, owner, dates)
- [ ] View **version history** (should show v1 after upload)
- [ ] Add a **note/comment** to the document
- [ ] View the **audit trail** for this document
- [ ] Test **checkout/checkin** flow:
  - [ ] Checkout document (locks it to you)
  - [ ] Upload new version (checkin) — version count should increment
  - [ ] Verify old version is still in version history
- [ ] Test **legal hold** toggle (if RECORDS_MANAGER role)

### 3.4 Document Preview (Web Previewer)
- [ ] Open a PDF document — should render inline in browser
- [ ] Open an image — should render inline
- [ ] Open a Word document — verify preview strategy (may show download fallback)
- [ ] Open a video file (.mp4) — should show HTML5 video player
- [ ] Open an audio file (.mp3) — should show HTML5 audio player

### 3.5 Real-Time Presence
- [ ] Open the same document in **two different browser tabs** (same or different users)
- [ ] Verify presence avatars appear showing who else is viewing
- [ ] Close one tab — avatar should disappear from the other tab

---

## 4. DIGITAL SIGNATURES

- [ ] Open any document's detail page
- [ ] Look for the **Signature Panel** section
- [ ] **Sign** the document — signature should show as "SIGNED" with your name and timestamp
- [ ] Open the same document as a different user — verify they can also sign
- [ ] Test **Decline** — should record a decline reason
- [ ] Verify signature status is reflected in the document metadata

---

## 5. WORKFLOW ENGINE

### 5.1 Start a Workflow
- [ ] From a document detail page, click **Start Workflow / Submit for Review**
- [ ] Select "Standard Approval" workflow definition
- [ ] Submit — document status should change to `IN_REVIEW`

### 5.2 Approve / Reject
- [ ] Navigate to `/workflow/pending-approvals`
- [ ] Verify the submitted document appears in the list
- [ ] **Approve** the document — status should change to `APPROVED`
- [ ] Start another document workflow, then **Reject** it — status should change to `REJECTED`
- [ ] From a rejected document, **Revise** it (resubmit to IN_REVIEW)

### 5.3 Workflow List
- [ ] Navigate to `/workflow`
- [ ] Verify all active and completed workflows are visible
- [ ] Click a workflow to see its full transition history

### 5.4 Ad-Hoc Forwarding
- [ ] From an active workflow, use the **Forward** action
- [ ] Select another user and add a message
- [ ] Verify the forwarded user sees it in their pending queue
- [ ] Accept/reject the forwarded task

---

## 6. SEARCH

### 6.1 Standard Search
- [ ] Navigate to `/search`
- [ ] Search by keyword — verify matching documents appear
- [ ] Test faceted filters (category, status, date range, tags)
- [ ] Click a result to navigate to document detail page

### 6.2 Semantic Search (AI/Vector)
- [ ] Switch to the **Semantic Search** tab
- [ ] Enter a natural language query (e.g. "contracts about cloud services")
- [ ] Verify results ranked by relevance score
- [ ] Test with an unrelated query — should return low or no matches

### 6.3 GDPR Scanner
- [ ] Switch to the **GDPR Scanner** tab
- [ ] Upload a document containing personal data (names, emails, phone numbers, etc.)
- [ ] Verify the scanner detects PII entities with severity levels
- [ ] Upload a clean technical document — should show minimal or no PII

---

## 7. EMAIL CLASSIFICATION (OCR + AI)

- [ ] Upload a scanned PDF (image-based, not text-selectable)
- [ ] Verify OCR extracts text from the document
- [ ] Check the auto-classification result (category suggestion)
- [ ] Verify the classification confidence is shown
- [ ] Accept or override the suggested classification

---

## 8. RETENTION MANAGEMENT

### 8.1 Retention Policies
- [ ] Navigate to `/retention`
- [ ] Verify default policies are listed (Standard 7-Year, Regulatory 20-Year, etc.)
- [ ] Assign a retention policy to a document

### 8.2 Disposition Queue
- [ ] Verify documents past their retention date appear in the disposition queue
- [ ] **Approve** destruction of a document
- [ ] **Reject** destruction (extend retention)
- [ ] Verify legal-held documents cannot be destroyed

---

## 9. COMPLIANCE & JURISDICTION RULES (NEW)

- [ ] Navigate to `/compliance`
- [ ] Verify **10 jurisdiction cards** appear (DE, AT, CH, EU, US, GB, FR, NL, IT, ES)
- [ ] Click **"All"** — should show all retention rules
- [ ] Click **"DE" (Germany)** — should filter to German rules only
- [ ] Click **"US"** — should filter to US rules (SOX, HIPAA, FOIA)
- [ ] Click **"EU"** — should filter to EU rules (GDPR, eIDAS)
- [ ] Use the **search bar** — type "tax" and verify matching rules appear
- [ ] Use the **category filter** dropdown to filter by document category
- [ ] Expand the **Legal Frameworks** section:
  - [ ] Click HGB — should show description, authority, effective date
  - [ ] Click GoBD — verify German digital archiving rules
  - [ ] Click GDPR — verify EU data protection framework
  - [ ] Click SOX — verify US financial records requirements
- [ ] In the **Retention Rules** table, verify:
  - [ ] Min/Max years are colour-coded (red = 10yr, amber = 6yr, yellow = 3yr, green = <3yr)
  - [ ] Legal citations are displayed (e.g. "§ 257 Abs. 4 HGB")
  - [ ] Mandatory rules show a warning triangle icon
  - [ ] Framework code is shown per rule

---

## 10. VISUAL WORKFLOW DESIGNER (NEW)

- [ ] Navigate to `/workflow-designer`
- [ ] Verify the **Template Gallery** loads with 5 templates:
  - [ ] Standard Document Approval
  - [ ] Invoice Processing
  - [ ] Contract Lifecycle
  - [ ] Employee Onboarding
  - [ ] Patient Record Management
- [ ] **Load a template** (e.g. "Standard Document Approval"):
  - [ ] Nodes should appear on the canvas (DRAFT, REVIEW, APPROVED, REJECTED, etc.)
  - [ ] Edges should connect the nodes with labelled transitions
- [ ] **Drag a node** — verify it moves on the canvas
- [ ] **Add a new node** — click "Add Node" button:
  - [ ] Enter a state name (e.g. "FINAL_CHECK")
  - [ ] Verify node appears on canvas
- [ ] **Connect nodes** — click "Add Edge":
  - [ ] Select source and target nodes
  - [ ] Enter a transition action label
  - [ ] Verify edge renders with arrow
- [ ] **Select a node** — verify Properties Panel opens on the right:
  - [ ] Change node name
  - [ ] Change node colour
  - [ ] Verify changes reflect on the canvas
- [ ] **Zoom controls**:
  - [ ] Click + to zoom in
  - [ ] Click − to zoom out
  - [ ] Click "Reset" to reset zoom
- [ ] **Save workflow** — click Save and verify success message
- [ ] Load a different template — canvas should update
- [ ] **Start from blank** — clear the canvas and build a custom workflow

---

## 11. PLUGIN MARKETPLACE (NEW)

- [ ] Navigate to `/marketplace`
- [ ] Verify **header** shows active/total plugin count
- [ ] Verify **13 plugin cards** are displayed:
  - [ ] SAP Connector
  - [ ] Salesforce Connector
  - [ ] DocuSign Integration
  - [ ] Microsoft 365
  - [ ] HL7 FHIR Connector
  - [ ] HIPAA Compliance Pack
  - [ ] SOX Compliance Pack
  - [ ] ISO 9001 Quality Pack
  - [ ] PLM Connector
  - [ ] Advanced OCR Engine
  - [ ] AI Classification Engine
  - [ ] eIDAS Signature Pack
  - [ ] FOIA Compliance Pack
- [ ] Verify each card shows: display name, vendor, version, description, type badge, status badge
- [ ] **Premium badge** — verify star icon on premium plugins
- [ ] **Search** — type "SAP" → only SAP Connector should show
- [ ] **Filter by Type** — select "CONNECTOR" → only connectors shown
- [ ] **Filter by Category** — select "healthcare" → only healthcare plugins shown
- [ ] **Activate a plugin**: click "Activate" on an INACTIVE plugin → status should change to ACTIVE (green)
- [ ] **Deactivate a plugin**: click "Deactivate" on an ACTIVE plugin → status should change to INACTIVE
- [ ] Verify loading spinner during activate/deactivate operations
- [ ] **Docs link** — if a plugin has documentation URL, verify the external link icon appears

---

## 12. INDUSTRY SOLUTIONS (NEW)

- [ ] Navigate to `/industry`
- [ ] Verify **5 industry template cards** appear:
  - [ ] **Healthcare** (pink theme, heart icon)
  - [ ] **Banking & Finance** (blue theme, landmark icon)
  - [ ] **Legal** (amber theme, scale icon)
  - [ ] **Manufacturing** (slate theme, wrench icon)
  - [ ] **Public Sector** (emerald theme, building icon)
- [ ] Verify each card shows:
  - [ ] Display name and description
  - [ ] Plugin count, Workflow count, Framework count, Retention Rule count
- [ ] **Expand Healthcare** — click "Show details":
  - [ ] Verify included plugins (e.g. HL7 FHIR, HIPAA Pack)
  - [ ] Verify default workflows (e.g. Patient Record Management)
  - [ ] Verify compliance frameworks (e.g. HIPAA)
  - [ ] Verify retention rules listed
- [ ] **Expand Banking** — verify SOX-related plugins and workflows
- [ ] **Expand Legal** — verify DocuSign, eIDAS, Contract Lifecycle
- [ ] **Expand Manufacturing** — verify ISO 9001, PLM
- [ ] **Expand Public Sector** — verify FOIA, Government records
- [ ] **Collapse** — click "Hide details" to collapse an expanded card

---

## 13. NOTIFICATIONS

- [ ] Navigate to `/notifications`
- [ ] Verify notification list loads
- [ ] Trigger a notification by:
  - [ ] Submitting a document for approval (should notify approvers)
  - [ ] Getting a document approved/rejected (should notify author)
- [ ] Check MailHog at http://localhost:8025 for email notifications
- [ ] Filter notifications by type
- [ ] Mark a notification as read

---

## 14. TRUST CENTER

- [ ] Navigate to `/trust-center`
- [ ] Verify your activity log / recent actions
- [ ] Test **data export** — verify your personal data can be exported
- [ ] Verify security information is displayed (encryption, access policies)

---

## 15. AUDIT LOG

- [ ] Navigate to `/audit`
- [ ] Verify log entries for your recent actions (login, document create, workflow actions)
- [ ] **Filter** by date range
- [ ] **Filter** by action type (LOGIN, DOCUMENT_CREATE, WORKFLOW_TRANSITION, etc.)
- [ ] **Filter** by user
- [ ] **Export** audit log (if export button available)
- [ ] Verify entries include: timestamp, user, action, resource, details

---

## 16. ANALYTICS

- [ ] Navigate to `/analytics`
- [ ] Verify dashboards / graphs load:
  - [ ] Document creation rate over time
  - [ ] Approval times / SLA metrics
  - [ ] User activity statistics
  - [ ] Category distribution

---

## 17. ADMIN: USER MANAGEMENT

- [ ] Navigate to `/admin/users` (requires SYSTEM_ADMIN role)
- [ ] Verify user list loads with all registered users
- [ ] **Create** a new user (or edit an existing one)
- [ ] **Assign roles**: change a user from AUTHOR to APPROVER
- [ ] **Disable** a user account — verify they cannot log in
- [ ] **Re-enable** a disabled user account
- [ ] **Unlock** a locked account (if applicable)

---

## 18. ADMIN: SETTINGS

- [ ] Navigate to `/admin/settings` (requires SYSTEM_ADMIN role)
- [ ] Verify system configuration options are displayed
- [ ] Test any configurable settings

---

## 19. ADMIN: ROLES & PERMISSIONS

- [ ] Navigate to `/admin/roles`
- [ ] Verify the 6 default roles are listed:
  - SYSTEM_ADMIN, RECORDS_MANAGER, DEPARTMENT_ADMIN, APPROVER, AUTHOR, VIEWER
- [ ] View permissions for each role
- [ ] Test role editing (add/remove permissions)

---

## 20. ADMIN: AI GOVERNANCE

- [ ] Navigate to `/admin/governance`
- [ ] Verify AI policy management interface
- [ ] View audit trail for AI decisions (classification, OCR)

---

## 21. PUBLIC SHARE LINKS

- [ ] From a document detail page, create a **public share link**
- [ ] Set an expiration date
- [ ] Optionally set a password
- [ ] Copy the share link
- [ ] Open the link in an **incognito/private window** (no login required)
- [ ] Verify the shared document is viewable
- [ ] If password was set, verify password prompt appears
- [ ] After expiration date, verify the link no longer works

---

## 22. PROJECT MANAGEMENT

### 22.1 Create Projects
- [ ] Navigate to **Projects** (project switcher in sidebar or navbar)
- [ ] Click **Create Project** → fill in name (e.g. "Finance Records"), description
- [ ] Toggle **AI Enabled** on/off
- [ ] Click **Create** → project appears in list
- [ ] Verify creator is auto-added as project admin with full permissions
- [ ] Try creating a project with a **duplicate name** → should show conflict error
- [ ] Create a second project (e.g. "HR Documents") for multi-project testing

### 22.2 View & Update Projects
- [ ] List all active projects via the **project list / switcher**
- [ ] Click a project to view details
- [ ] Click **My Projects** → verify only projects the user belongs to are shown
- [ ] Edit project name, description, or AI-enabled flag → save → verify updated

### 22.3 Project Member Management
- [ ] Open a project → navigate to **Members** tab
- [ ] **Add a member** — select user, assign role (e.g. AUTHOR), set permissions (READ, WRITE)
- [ ] Verify the new member appears in the member list
- [ ] **Add member with different permissions** — e.g. VIEWER with READ, EXPORT only
- [ ] Try adding a user who is **already a member** → should show conflict error
- [ ] **Remove a member** → confirm member is deleted from list
- [ ] Verify the member's JWT (after re-login) includes project-scoped permissions

### 22.4 Project-Scoped Permissions
- [ ] Login as the **added member** (not creator)
- [ ] Verify the user can only perform actions matching their project permissions
- [ ] User with READ only → cannot upload or delete documents in the project
- [ ] User with WRITE → can upload documents
- [ ] User with ADMIN → can add/remove other members
- [ ] User with AI_INVOKE → can use AI features; without it → AI buttons disabled/blocked
- [ ] User with APPROVE → can approve workflow items; without → action denied

### 22.5 Project API (curl)
```bash
# Create a project
curl -X POST http://localhost:8200/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","description":"For testing","aiEnabled":true}'

# List all projects
curl http://localhost:8200/api/projects -H "Authorization: Bearer $TOKEN"

# Get my projects
curl http://localhost:8200/api/projects/mine -H "Authorization: Bearer $TOKEN"

# Add member to project
curl -X POST http://localhost:8200/api/projects/<project-id>/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<user-id>","roleId":"<role-id>","permissions":["READ","WRITE","APPROVE"]}'

# List project members
curl http://localhost:8200/api/projects/<project-id>/members \
  -H "Authorization: Bearer $TOKEN"

# Remove member
curl -X DELETE http://localhost:8200/api/projects/<project-id>/members/<user-id> \
  -H "Authorization: Bearer $TOKEN"
```

---

## 23. USER ROLE ASSIGNMENT & MULTI-USER TESTING

### 23.1 Register Additional Users
- [ ] Via **Admin → Users** page or the registration API, create the following test users:

| Username | Password | Role to Assign | Department |
|----------|----------|---------------|------------|
| records_mgr | Records@2024! | RECORDS_MANAGER | Legal |
| dept_admin | DeptAdmin@2024! | DEPARTMENT_ADMIN | Finance |
| approver1 | Approver@2024! | APPROVER | Operations |
| author1 | Author@2024! | AUTHOR | Marketing |
| viewer1 | Viewer@2024! | VIEWER | External |

```bash
# Register a user
curl -X POST http://localhost:8200/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"author1","email":"author1@apex.com","password":"Author@2024!","firstName":"Test","lastName":"Author","department":"Marketing"}'
```

### 23.2 Assign Roles to Users
- [ ] Login as **admin**
- [ ] Navigate to **Admin → Users** → select a user
- [ ] Assign appropriate role from the table above
- [ ] Verify role appears on the user profile
- [ ] Verify the `roles` claim in the JWT after the user logs in

### 23.3 Role-Based Access Control (RBAC) Verification

**SYSTEM_ADMIN (admin)**
- [ ] Full access to all features: documents, workflows, retention, compliance, admin pages, AI governance
- [ ] Can manage users, roles, and system settings

**RECORDS_MANAGER (records_mgr)**
- [ ] Can manage retention policies and disposition
- [ ] Can approve document destruction
- [ ] Can view all documents
- [ ] Cannot change system settings or manage users

**DEPARTMENT_ADMIN (dept_admin)**
- [ ] Can manage documents and folders within their department
- [ ] Can manage workflows
- [ ] Cannot access system-wide admin settings

**APPROVER (approver1)**
- [ ] Can view assigned documents
- [ ] Can approve/reject workflow items
- [ ] Cannot create or delete documents they don't own
- [ ] Cannot access admin pages

**AUTHOR (author1)**
- [ ] Can create, edit, and check out documents
- [ ] Can create folders
- [ ] Cannot approve workflows
- [ ] Cannot manage retention or access admin pages

**VIEWER (viewer1)**
- [ ] Read-only access to assigned documents
- [ ] Cannot create, edit, or delete documents
- [ ] Cannot access any admin functionality
- [ ] Cannot approve workflows

### 23.4 Multi-User Workflow Test
- [ ] Login as **author1** → upload a document
- [ ] Submit document to **Standard Approval** workflow
- [ ] Login as **approver1** → verify the pending approval appears
- [ ] Approve the document → verify status changes to "Approved"
- [ ] Login as **viewer1** → verify the document is visible (read-only)
- [ ] Login as **records_mgr** → assign a retention policy to the document
- [ ] Login as **admin** → verify all actions appear in the **Audit Log**

### 23.5 Permission Denial Tests
- [ ] Login as **viewer1** → try to upload a document → should be denied (403)
- [ ] Login as **author1** → try to access Admin → Users page → should be denied
- [ ] Login as **approver1** → try to delete a document → should be denied
- [ ] Login as **viewer1** → try to create a share link → should be denied
- [ ] Login as **author1** → try to manage retention policies → should be denied

---

## 24. SIDEBAR NAVIGATION

- [ ] Verify all sidebar items are present:
  - [ ] Dashboard
  - [ ] Documents
  - [ ] Workflow
  - [ ] Search
  - [ ] Retention
  - [ ] **Compliance** (new — Globe icon)
  - [ ] **Designer** (new — Paintbrush icon)
  - [ ] **Marketplace** (new — Plug icon)
  - [ ] **Industry** (new — Factory icon)
  - [ ] Trust Center
  - [ ] Analytics
  - [ ] Audit Log
  - [ ] Notifications
  - [ ] Users
  - [ ] Settings
- [ ] **Collapse sidebar** — click the chevron button at bottom → sidebar collapses to icons only
- [ ] **Expand sidebar** — click again → sidebar expands with labels
- [ ] Verify the **active page** is highlighted in the sidebar
- [ ] Verify navigation works for every single item

---

## 25. API ENDPOINTS (Direct Gateway Testing)

Use **curl**, **Postman**, or any HTTP client against `http://localhost:8200`.

### 25.1 Auth
```bash
# Login
curl -X POST http://localhost:8200/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@2024!"}'

# Save the token from the response for subsequent requests
TOKEN="<paste-jwt-here>"

# Get current user profile
curl http://localhost:8200/api/auth/me -H "Authorization: Bearer $TOKEN"
```

### 25.2 Documents
```bash
# List documents
curl http://localhost:8200/api/documents -H "Authorization: Bearer $TOKEN"

# Upload document (multipart)
curl -X POST http://localhost:8200/api/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@testfile.pdf" \
  -F "title=Test Document" \
  -F "category=REPORT"
```

### 25.3 Compliance / Jurisdictions
```bash
# List jurisdictions
curl http://localhost:8200/api/retention/jurisdictions -H "Authorization: Bearer $TOKEN"

# Get German retention rules
curl http://localhost:8200/api/retention/jurisdictions/<DE-jurisdiction-id>/rules \
  -H "Authorization: Bearer $TOKEN"

# List all legal frameworks
curl http://localhost:8200/api/retention/jurisdictions/frameworks \
  -H "Authorization: Bearer $TOKEN"

# Check compliance for a jurisdiction + category
curl http://localhost:8200/api/retention/jurisdictions/<id>/rules/check/TAX_DOCUMENTS \
  -H "Authorization: Bearer $TOKEN"
```

### 25.4 Plugins
```bash
# List all plugins
curl http://localhost:8200/api/auth/plugins -H "Authorization: Bearer $TOKEN"

# Activate a plugin
curl -X POST http://localhost:8200/api/auth/plugins/<plugin-id>/activate \
  -H "Authorization: Bearer $TOKEN"

# Deactivate a plugin
curl -X POST http://localhost:8200/api/auth/plugins/<plugin-id>/deactivate \
  -H "Authorization: Bearer $TOKEN"
```

### 25.5 Industry Templates
```bash
# List all industry templates
curl http://localhost:8200/api/auth/industry-templates -H "Authorization: Bearer $TOKEN"

# Filter by industry
curl http://localhost:8200/api/auth/industry-templates/by-industry/healthcare \
  -H "Authorization: Bearer $TOKEN"
```

### 25.6 Workflow Templates
```bash
# List all workflow templates
curl http://localhost:8200/api/workflows/templates -H "Authorization: Bearer $TOKEN"

# Get by category
curl http://localhost:8200/api/workflows/templates/by-category/finance \
  -H "Authorization: Bearer $TOKEN"
```

---

## 26. INFRASTRUCTURE CHECKS

### 26.1 Docker Containers
```bash
# All 13 containers should be running and healthy
docker compose ps

# Expected containers:
# apex-postgres, apex-redis, apex-elasticsearch, apex-minio,
# apex-gateway, apex-auth-service, apex-document-service,
# apex-workflow-service, apex-search-service, apex-retention-service,
# apex-audit-service, apex-notification-service, apex-frontend-web
```

### 26.2 Database (V3 Migration)
```bash
# Connect to postgres and verify V3 tables exist
docker exec -it apex-postgres psql -U apex_admin -d apex_nexus -c "\dt"

# Verify new tables:
#   jurisdictions, legal_frameworks, jurisdiction_retention_rules,
#   workflow_templates, plugin_registry, plugin_hooks, industry_templates

# Verify seed data:
docker exec -it apex-postgres psql -U apex_admin -d apex_nexus \
  -c "SELECT code, name FROM jurisdictions ORDER BY code;"
# Expected: AT, CH, DE, ES, EU, FR, GB, IT, NL, US

docker exec -it apex-postgres psql -U apex_admin -d apex_nexus \
  -c "SELECT name, plugin_type, status FROM plugin_registry ORDER BY name;"
# Expected: 13 plugins

docker exec -it apex-postgres psql -U apex_admin -d apex_nexus \
  -c "SELECT name, industry FROM industry_templates ORDER BY name;"
# Expected: 5 industry templates
```

### 26.3 MinIO Storage
- [ ] Open http://localhost:9001
- [ ] Login with `minioadmin` / `minioadmin`
- [ ] Verify `apex-documents` bucket exists
- [ ] Upload a document through the app, then verify the file appears in MinIO

### 26.4 Elasticsearch
```bash
# Check cluster health
curl http://localhost:9200/_cluster/health?pretty

# List indices
curl http://localhost:9200/_cat/indices?v

# Verify document index has mappings for dense_vector and classification
curl http://localhost:9200/documents/_mapping?pretty
```

### 26.5 Redis
```bash
docker exec -it apex-redis redis-cli -a dev_redis_password ping
# Expected: PONG
```

### 26.6 Email (MailHog)
- [ ] Open http://localhost:8025
- [ ] Trigger a notification (approve/reject a workflow)
- [ ] Verify email appears in MailHog inbox

---

## 27. CROSS-CUTTING CONCERNS

### 27.1 Responsive Design
- [ ] Resize browser to mobile width (~375px) — verify layout adapts
- [ ] Test sidebar collapse/expand on narrow screens
- [ ] Verify tables scroll horizontally on mobile
- [ ] Test on tablet width (~768px)

### 27.2 Error Handling
- [ ] Stop a backend service → verify frontend shows graceful error / loading state
- [ ] Submit a form with missing required fields → verify validation messages
- [ ] Try accessing a non-existent document ID → verify 404 handling

### 27.3 Security
- [ ] Verify all API calls require Authorization header
- [ ] Try an expired JWT → should get 401
- [ ] Try accessing admin endpoints as AUTHOR role → should get 403
- [ ] Verify passwords are never returned in API responses
- [ ] Check that CORS is properly configured

---

## Test Results Summary

| Area | Total Tests | Passed | Failed | Notes |
|------|------------|--------|--------|-------|
| Authentication | 6 | | | |
| Dashboard | 12 | | | |
| Documents | 17 | | | |
| Signatures | 5 | | | |
| Workflows | 9 | | | |
| Search (Standard + Semantic + GDPR) | 9 | | | |
| OCR / Classification | 5 | | | |
| Retention | 5 | | | |
| Compliance / Jurisdictions | 14 | | | |
| Workflow Designer | 14 | | | |
| Plugin Marketplace | 13 | | | |
| Industry Solutions | 10 | | | |
| Notifications | 5 | | | |
| Trust Center | 3 | | | |
| Audit Log | 6 | | | |
| Analytics | 4 | | | |
| Admin (Users/Settings/Roles/AI) | 10 | | | |
| Public Share Links | 6 | | | |
| **Project Management** | **19** | | | |
| **User Roles & Multi-User** | **28** | | | |
| Sidebar Navigation | 5 | | | |
| API Endpoints | 12 | | | |
| Infrastructure | 6 | | | |
| Cross-Cutting | 7 | | | |
| **TOTAL** | **~228** | | | |
