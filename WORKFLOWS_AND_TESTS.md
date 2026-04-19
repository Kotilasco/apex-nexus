# Apex Nexus — Module Workflows & End-to-End Test Guide
*Last updated: April 2026*

This guide documents **how each advanced module actually works in code** (backend service → REST endpoint → UI → DB tables) and provides copy-pasteable **end-to-end test scripts** you can run against a live deployment to prove it.

---

## Conventions

- **API gateway** is at `http://localhost:9600/api` (proxied to the services).
- All examples assume you have a JWT — obtain via UI login, then copy from DevTools (localStorage key `apex_token`) or use:
  ```bash
  TOKEN=$(curl -s -X POST http://localhost:9600/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"<your-password>"}' | jq -r .data.accessToken)
  ```
- Postgres access: `docker exec -it apex-postgres psql -U apex_admin -d apex_nexus`
- To find a test document id: `SELECT id,title FROM documents ORDER BY created_at DESC LIMIT 5;`

---

## 1. Blockchain Notarization

**Pitch**: *"Every contract, every medical record, every compliance report gets an immutable fingerprint that proves it wasn't tampered with — without paying gas fees to Ethereum."*

### Workflow (what happens in the system)

```
Upload document
   │
   ▼
sha256_hash stored in documents.sha256_hash (done at intake)
   │
   ▼
User clicks "Notarize"  ──►  POST /api/documents/{id}/notarize
   │
   ▼
NotarizationService.notarize():
   1. Read current doc hash + version
   2. Look up previous block (tip of chain)
   3. Build payload: docId|version|contentHash|prevBlockHash|userId|ts|blockNumber
   4. SHA-256 the payload → blockHash
   5. INSERT INTO document_notarizations (…)
   │
   ▼
Anyone later calls GET /api/documents/{id}/verify
   │
   ▼
NotarizationService.verify():
   1. Fetch all blocks ordered by block_number
   2. Check latest block.content_hash == documents.sha256_hash → currentHashMatches
   3. Walk the chain, recompute each block hash → chainValid
   4. Return { verified, chainValid, currentHashMatches, tamperedBlock, blocks[] }
```

### Key files
- Backend service: [backend/apex-document-service/src/main/java/com/apexnexus/document/service/NotarizationService.java](backend/apex-document-service/src/main/java/com/apexnexus/document/service/NotarizationService.java)
- Controller endpoints in [DocumentController.java](backend/apex-document-service/src/main/java/com/apexnexus/document/controller/DocumentController.java)
- Frontend: badge + modal component embedded in [documents/page.tsx](frontend/web/src/app/(protected)/documents/page.tsx)

### Table
```sql
document_notarizations (
  id UUID PK, document_id UUID FK, version INT,
  content_hash TEXT,           -- the doc's SHA-256 at notarization time
  previous_block_hash TEXT,    -- link to prior block
  block_hash TEXT UNIQUE,      -- SHA-256 of payload = this block's id
  block_number BIGINT,
  notarized_by UUID FK users,
  notarized_at TIMESTAMPTZ,
  network TEXT DEFAULT 'apex-chain-v1'
)
```

### End-to-End Test

**Happy path — verify chain is valid:**
```bash
DOC_ID=<paste a real doc UUID>

# 1. Notarize (or re-notarize after edit)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/documents/$DOC_ID/notarize | jq

# 2. Verify
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/documents/$DOC_ID/verify | jq

# Expected: { "verified": true, "chainValid": true, "currentHashMatches": true, "blocks": [...] }
```

**Tamper test — prove the chain detects forgery:**
```bash
# 1. Notarize a fresh doc
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/documents/$DOC_ID/notarize

# 2. Tamper with the hash directly in the DB
docker exec apex-postgres psql -U apex_admin -d apex_nexus -c \
  "UPDATE documents SET sha256_hash='0000000000000000000000000000000000000000000000000000000000000000' WHERE id='$DOC_ID';"

# 3. Verify again — should now return verified=false
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/documents/$DOC_ID/verify | jq '.data | {verified, chainValid, currentHashMatches, tamperedBlock}'

# Expected: verified=false, currentHashMatches=false (chain is still valid, but current content doesn't match last notarised hash)
```

**UI test:**
1. Go to **Documents** page → open any document.
2. Click the **shield** icon → "Notarize" → check the Block # / hash appear.
3. Click the shield again → "Verify" → green ✓ with block history.
4. Edit the document content, save new version → click Verify → should show "tamper suspected" until you re-notarize.

---

## 2. SAP Integration

**Pitch**: *"Apex Nexus is a pre-built ArchiveLink adapter + intelligent P2P/M2C automation layer for SAP — without a SAP-certified consultant costing $2,000/day."*

### Two workflows in one module

#### 2.1 Procure-to-Pay (P2P)
```
User captures invoice (drag-drop or Email Ingestion)
   │
   ▼
Intake classifies it → "Invoice"   (ML classifier, V10 seeded labels)
   │
   ▼
AgenticIntentService detects PO number 4500012001  (regex)
   │
   ▼
Agentic suggestion "INVOICE_AUTOMATCH" appears in /agents  (confidence 0.92)
   │
   ▼  (user accepts, OR direct call)
POST /api/sap/invoices/process/{documentId}
   │
   ▼
SapIntegrationService.processInvoice():
   1. Extract PO/amount/vendor from extracted_content (regex)
   2. POST /sap-mock/invoices/match (3-way match, 2% tolerance)
   3a. If MATCHED → POST /sap-mock/invoices/park  (invoice "parked" for payment)
       + INSERT sap_object_links(ar_object='BUS2081', object_key=sapInvoiceId)
       + UPDATE sap_invoices status='PARKED'
   3b. If NOT MATCHED → INSERT sap_invoices status='DISPUTED' (stays in Apex)
```

#### 2.2 Meter-to-Cash / Asset linkage (M2C)
```
Field technician uploads photo tagged "EQ-10000042"  (mobile or intake)
   │
   ▼
POST /api/sap/assets/EQ-10000042/link/{documentId}
   │
   ▼
SapIntegrationService.linkToAsset():
   1. Validate equipment exists in sap_assets
   2. INSERT sap_object_links(ar_object='EQUI', object_key='EQ-10000042', document_id=…)
   │
   ▼
SAP PM users open EQ-10000042 in S/4HANA
   │
   ▼
ArchiveLink GET /sap-mock/archivelink/get?arObject=EQUI&objectKey=EQ-10000042
   → returns [{documentId, downloadUrl, filename}]
```

### Key files
- Backend: [SapIntegrationService.java](backend/apex-document-service/src/main/java/com/apexnexus/document/service/SapIntegrationService.java), [SapIntegrationController.java](backend/apex-document-service/src/main/java/com/apexnexus/document/controller/SapIntegrationController.java), [SapMockController.java](backend/apex-document-service/src/main/java/com/apexnexus/document/controller/SapMockController.java)
- Frontend: [sap/page.tsx](frontend/web/src/app/(protected)/sap/page.tsx) (4 tabs: Summary, P2P, M2C, ArchiveLink)
- Migration: [V18__sap_integration.sql](infrastructure/postgres/V18__sap_integration.sql) — seeds ZETDC-context POs and assets

### Tables
- `sap_purchase_orders` (pre-seeded with Acme Power, ElectroMax, etc.)
- `sap_invoices` (status: SUBMITTED → MATCHED → PARKED → POSTED, or DISPUTED)
- `sap_assets` (meters, transformers, RTUs — equipment_id like `EQ-10000042`)
- `sap_object_links` (ArchiveLink bridge: ar_object `BUS2081` or `EQUI` or `IFLOT` → document_id)

### End-to-End Test

**P2P happy path:**
```bash
# 1. See a pre-seeded PO
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/sap-mock/purchase-orders | jq '.data[0]'

# Note a PO number, e.g. 4500012001, and its amount.

# 2. Upload an invoice that mentions that PO number and amount.
#    Quick version: create a synthetic doc.
docker exec apex-postgres psql -U apex_admin -d apex_nexus <<SQL
INSERT INTO documents (id,title,mime_type,file_size,sha256_hash,extracted_content,classification_label,created_by)
SELECT gen_random_uuid(),
       'Invoice INV-2026-TEST',
       'text/plain', 512,
       'deadbeef'||repeat('0',56),
       'Invoice for PO 4500012001. Total amount: USD 15750.00. Vendor: Acme Power.',
       'Invoice',
       (SELECT id FROM users ORDER BY created_at LIMIT 1);
SQL

DOC_ID=$(docker exec apex-postgres psql -U apex_admin -d apex_nexus -t -c \
  "SELECT id FROM documents WHERE title='Invoice INV-2026-TEST' LIMIT 1;" | xargs)

# 3. Run P2P
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/sap/invoices/process/$DOC_ID | jq

# Expected: { "status":"PARKED_IN_SAP", "matched":true, "sapInvoiceId":"5105..." }

# 4. Confirm ArchiveLink back-ref
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9600/api/sap/transactions/BUS2081/5105601234/documents" | jq
```

**M2C happy path:**
```bash
# 1. See a pre-seeded asset
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/sap-mock/assets | jq '.data[0]'
# e.g. equipment_id = "EQ-10000042"

# 2. Upload any photo/PDF via UI (document_id). Then:
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9600/api/sap/assets/EQ-10000042/link/$DOC_ID?linkType=ATTACHMENT" | jq

# 3. Confirm the doc is now visible under the equipment
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9600/api/sap-mock/archivelink/get?arObject=EQUI&objectKey=EQ-10000042" | jq
```

**Dispute negative path:**
Upload an invoice mentioning `PO 4500099999` (non-existent) → processInvoice returns `status=DISPUTED` with reason `PO not found`. Document stays in Apex with a `DISPUTED` workflow entry.

**UI test:**
1. **SAP Integration** page → **Overview** tab shows totals.
2. **P2P** tab → click a PO → upload invoice → watch status transition.
3. **Asset / M2C** tab → pick an equipment → attach photo → visible instantly.
4. **ArchiveLink** tab → confirms both directions work.

---

## 3. Vendor Portals

**Pitch**: *"We extend your compliance perimeter to your vendors. They upload through your tenant, your PII scanner, your audit log — before anything touches your corpus."*

### Workflow

```
ADMIN side:
─────────────
POST /api/vendor-portals  { vendorCode, contactEmail, requiredDocs, expiryDays }
   │
   ▼
Portal row created with unique access_token (UUID, 64-char)
   │
   ▼
Admin emails the link:  https://app.apexnexus.com/public/vendor-portal/<token>

VENDOR side (no login, just the link):
────────────────────────────────────────
GET  /api/public/vendor-portal/{token}          ← verifyToken(), returns portal view
POST /api/public/vendor-portal/{token}/upload   ← file → VendorPortalService.acceptUpload()
   │
   ▼  Two scanners run synchronously:
   ├─ PiiRedactionService.scan() → pii_findings JSONB
   ├─ Compliance keyword scanner → compliance_findings JSONB
   │
   ▼
Decision:
   - PII found OR suspicious → status=QUARANTINED
   - Clean → status=RECEIVED (awaiting approval)
   - Doc inserted as SYSTEM-owned until admin approves

ADMIN review:
─────────────
GET  /api/vendor-portals/{id}              ← full portal view (uploads + compliance + access log)
POST /api/vendor-portals/uploads/{uploadId}/approve  ← assigns real owner + makes visible
POST /api/vendor-portals/uploads/{uploadId}/reject   ← rejects with reason

Compliance tracking:
────────────────────
POST /api/vendor-portals/{id}/compliance-docs
     { docType: "TAX_CLEARANCE" | "INSURANCE" | "ISO_9001" | "BEE" | "PRAZ" | …,
       expiresOn: "2026-12-31" }
   │
   ▼
Scheduled refreshComplianceStatus() marks:
   VALID  (> 30d left)  │  EXPIRING_SOON (≤ 30d)  │  EXPIRED
   │
   ▼
Portal.compliance_status rolls up to: COMPLIANT | EXPIRING | NON_COMPLIANT
   If NON_COMPLIANT → portal blocked, vendor sees "Access restricted" on next upload attempt.

Watermark / leak audit:
───────────────────────
Every view and download → vendor_portal_access_log row with IP, UA, watermark string.
```

### Key files
- Backend: [VendorPortalService.java](backend/apex-document-service/src/main/java/com/apexnexus/document/service/VendorPortalService.java), [VendorPortalController.java](backend/apex-document-service/src/main/java/com/apexnexus/document/controller/VendorPortalController.java)
- Frontend: [vendor-portals/page.tsx](frontend/web/src/app/(protected)/vendor-portals/page.tsx)
- Migrations: [V19__agentic_federated_vendor_predictions.sql](infrastructure/postgres/V19__agentic_federated_vendor_predictions.sql), [V20__vendor_compliance_and_audit.sql](infrastructure/postgres/V20__vendor_compliance_and_audit.sql)

### Tables
- `vendor_portals` (id, access_token UNIQUE, status, required_docs[], compliance_status, blocked_reason, …)
- `vendor_portal_uploads` (id, portal_id, filename, document_id, pii_findings, compliance_findings, status)
- `vendor_compliance_docs` (doc_type, valid_from, expires_on, status)
- `vendor_portal_access_log` (action VIEW|DOWNLOAD|UPLOAD, remote_ip, watermark)

### End-to-End Test

```bash
# 1. Admin creates a portal
PORTAL=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  http://localhost:9600/api/vendor-portals \
  -d '{"vendorCode":"ACME-001","vendorName":"Acme Power","contactEmail":"ops@acme.test","requiredDocs":["TAX_CLEARANCE","INSURANCE"],"expiryDays":30}')
echo "$PORTAL" | jq
TOKEN_V=$(echo "$PORTAL" | jq -r .data.accessToken)
PORTAL_ID=$(echo "$PORTAL" | jq -r .data.id)

# 2. Vendor fetches portal view (no JWT)
curl -s http://localhost:9600/api/public/vendor-portal/$TOKEN_V | jq

# 3. Vendor uploads a doc (no JWT)
echo "Test contract. Tax ID 12-3456789. Employee SSN: 123-45-6789." > /tmp/vendor.txt
curl -s -X POST \
  -F "file=@/tmp/vendor.txt" \
  http://localhost:9600/api/public/vendor-portal/$TOKEN_V/upload | jq
# Expected: status=QUARANTINED (SSN triggered PII)

# 4. Admin sees the upload in quarantine
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/vendor-portals/$PORTAL_ID | jq '.data.uploads'

# 5. Admin approves it
UPLOAD_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/vendor-portals/$PORTAL_ID | jq -r '.data.uploads[0].id')
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  http://localhost:9600/api/vendor-portals/uploads/$UPLOAD_ID/approve \
  -d '{"notes":"Reviewed - PII redacted manually."}' | jq

# 6. Revoke the portal
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/vendor-portals/$PORTAL_ID/revoke | jq
# Further uploads now return 403
```

**UI test:**
1. **Vendor Portals** → **+ New Portal** → fill in vendor code, email, required docs, expiry.
2. Copy the **portal link** → open in an incognito window → upload a file with a fake SSN → see the "quarantined / under review" banner.
3. Back in admin UI → see the upload → approve → vendor now sees the doc as accepted.
4. Go to compliance tab → add "INSURANCE" expiring next week → status flips to EXPIRING_SOON.

---

## 4. Agents (current: proactive suggestions)

**Pitch**: *"Our AI doesn't wait to be asked. Every ingested document is inspected by a team of specialised agents who proactively propose actions."*

### Current workflow (single-detector version)

```
Document ingested / classified
   │
   ▼
IntakeService calls AgenticIntentService.detectForDocument(docId)  [fire-and-forget]
   │
   ▼
5 regex-based intent detectors run against title + extracted_content:
   ┌───────────────────────────┬──────────────────────────────────────────────┐
   │ INVOICE_AUTOMATCH  (0.92) │ PO number like 45xxxxxxxx or 47xxxxxxxx      │
   │ BUDGET_VARIANCE    (0.85) │ "15% increase" / "tariff uplift"             │
   │ CONTRACT_RENEWAL   (0.88) │ "expires 2026-…" + contract/agreement/MSA    │
   │ METER_ANOMALY      (0.78) │ "meter … anomaly/bypass/tamper/spike/zero"   │
   │ COMPLIANCE_REVIEW  (0.82) │ GDPR / POPIA / HIPAA / POTRAZ / PII / PI     │
   └───────────────────────────┴──────────────────────────────────────────────┘
   │
   ▼
INSERT INTO agentic_suggestions status='PROPOSED'
   │
   ▼
User opens /agents  →  GET /api/agentic/suggestions
   │
   ▼
Accept → runs minimal executor, emits a `next` hint, status='ACCEPTED'
Dismiss → status='DISMISSED'
```

### Key files
- [AgenticIntentService.java](backend/apex-document-service/src/main/java/com/apexnexus/document/service/AgenticIntentService.java)
- [AgenticController.java](backend/apex-document-service/src/main/java/com/apexnexus/document/controller/AgenticController.java)
- Frontend: [agents/page.tsx](frontend/web/src/app/(protected)/agents/page.tsx)

### Table
```sql
agentic_suggestions (
  id, document_id, intent_type, title, rationale,
  proposed_action JSONB, confidence NUMERIC,
  status (PROPOSED|ACCEPTED|DISMISSED|EXECUTED|FAILED),
  result JSONB, created_at, acted_at, acted_by
)
```

### End-to-End Test

```bash
# 1. Trigger detection on any existing doc
DOC_ID=<doc-that-has-content>
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/agentic/detect/$DOC_ID | jq

# 2. List pending
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/agentic/suggestions | jq

# 3. Accept one
SUGG=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/agentic/suggestions | jq -r '.data[0].id')
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/agentic/suggestions/$SUGG/accept | jq

# 4. Confirm status
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/agentic/summary | jq
```

**Force a specific intent in a test doc:**
```sql
-- Create a doc that will trigger all 5 intents
INSERT INTO documents (id,title,mime_type,file_size,sha256_hash,extracted_content,classification_label,created_by)
SELECT gen_random_uuid(),
       'MSA 2026 Renewal — Acme Power',
       'text/plain', 1024,
       repeat('a',64),
       'Master Service Agreement between ZETDC and Acme Power. Contract expires 2026-12-31. '
       || 'Purchase Order 4500012999 for USD 15000. Tariff increase of 22% notified. '
       || 'Meter EQ-10000042 reports anomaly: bypass detected near substation. '
       || 'This document contains POPIA-regulated personal information.',
       'Contract',
       (SELECT id FROM users LIMIT 1)
RETURNING id;
```
Then `POST /api/agentic/detect/<that id>` → all 5 intents fire.

---

# 2026 GAP ANALYSIS & NEWLY-ADDED MODULES

The sections below describe features that **did not exist** when you asked, and have now been **implemented in V22**. Test scripts assume the V22 migration has been applied and `apex-document-service` + `apex-web` have been redeployed.

---

## 5. Multi-Agent System (Agent Team)   *(NEW in V22)*

**Pitch**: *"While ELO gives you a search bar, Apex Nexus gives you a digital workforce that works 24/7 without being asked."*

The single `AgenticIntentService` is now wrapped by a named **Multi-Agent Orchestrator**. Each suggestion now carries an `agent_name`:

| Agent | Runs | What it does |
|-------|------|--------------|
| **Auditor Agent**    | on every document intake + every 15 min | Scans new content for PII/compliance risks, emits `COMPLIANCE_REVIEW` with evidence |
| **Archivist Agent**  | every 30 min | Finds inactive docs (no access in 180d) tagged with a retention policy — suggests `ARCHIVE_NOW` |
| **Bridge Agent**     | on every new Contract classification | Drafts SAP PO + looks up vendor score in Mock SAP, emits `DRAFT_SAP_ENTRY` ready-to-send package |
| **Intake Agent**     | on every intake | The original 5 regex intents (kept) |

All suggestions share one table (`agentic_suggestions`) and one UI (`/agents`), but the UI now groups them by `agent_name` so the "team" is visible.

### Workflow example — Contract expires + Bridge Agent kicks in

```
1. User uploads Acme_MSA_2027.pdf
2. Intake classifies → "Contract"
3. IntakeAgent emits CONTRACT_RENEWAL
4. AuditorAgent scans → finds no PII → no suggestion
5. BridgeAgent notices it's a Contract with a vendor name:
   - Looks up vendor in sap_purchase_orders (last amount, delivery_date → performance score)
   - Drafts a renewal email body
   - Emits DRAFT_SAP_ENTRY with proposed_action = { subject, body, vendorScore, poDraft }
6. User opens /agents → sees 2 cards grouped under "Bridge Agent" and "Intake Agent"
7. Clicks "Approve draft" on the Bridge Agent card → renewal email is copied to clipboard + SAP PO draft posted to /sap-mock/purchase-orders/draft
```

### End-to-End Test

```bash
# 1. Trigger all agents for a doc that has contract + PO + PII
DOC_ID=<uuid>
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/agentic/detect/$DOC_ID | jq

# 2. Kick the Bridge Agent directly
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/agents/bridge/run | jq

# 3. Kick the Archivist Agent
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/agents/archivist/run | jq

# 4. List suggestions grouped by agent
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/agentic/suggestions | jq '.data | group_by(.agent_name) | map({agent: .[0].agent_name, count: length})'
```

---

## 6. Adaptive Case Management (ACM)   *(NEW in V22)*

**Pitch**: *"We manage the exceptions, not just the rules. When your Asset Repair goes sideways, Apex gives you a living Case Folder — not a stalled workflow."*

Unlike workflows (linear: Step A → Step B), a **Case** is an adaptive folder where knowledge workers add ad-hoc tasks, invite experts, and pivot.

### Workflow

```
Open a Case
   │
   ▼
POST /api/cases  { title, category: "ASSET_REPAIR"|"DISPUTE"|"INVESTIGATION"|…, priority, projectId? }
   │
   ▼
Case folder appears in /cases with initial attendees = creator
   │
   ▼
User attaches documents (ad-hoc): POST /cases/{id}/documents/{docId}
User adds tasks on the fly:        POST /cases/{id}/tasks { title, dueAt, assigneeId? }
User invites external expert:      POST /cases/{id}/participants { email, role: "EXPERT" }
   │
   ▼
Integrates with Federated Search: a case has its own federated search scope.
   │
   ▼
Case closes:  POST /cases/{id}/close { outcome }  →  cases.status='CLOSED' + auto-notarisation of all attached docs.
```

### Tables (V22)
```sql
cases                (id, title, category, priority, status, project_id, opened_by, opened_at, closed_at, outcome)
case_tasks           (id, case_id, title, assignee_id, due_at, status, completed_at)
case_participants    (id, case_id, user_id?, external_email?, role, invited_at)
case_attachments     (id, case_id, document_id, attached_by, attached_at, note)
case_events          (id, case_id, actor_id, event_type, details JSONB, created_at)   -- activity feed
```

### End-to-End Test

```bash
# 1. Open a case
CASE=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  http://localhost:9600/api/cases \
  -d '{"title":"Substation-7 Transformer Failure","category":"ASSET_REPAIR","priority":"HIGH"}')
CASE_ID=$(echo "$CASE" | jq -r .data.id)
echo "$CASE" | jq

# 2. Add a task on the fly
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  http://localhost:9600/api/cases/$CASE_ID/tasks \
  -d '{"title":"Dispatch technician to site","dueAt":"2026-04-25T10:00:00Z"}' | jq

# 3. Attach a document
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/cases/$CASE_ID/documents/$DOC_ID | jq

# 4. Invite external expert
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  http://localhost:9600/api/cases/$CASE_ID/participants \
  -d '{"externalEmail":"specialist@utility-advisors.com","role":"EXPERT"}' | jq

# 5. View the folder + activity feed
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/cases/$CASE_ID | jq '.data | {title, tasks: .tasks | length, attachments: .attachments | length, events: .events | length}'

# 6. Close
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  http://localhost:9600/api/cases/$CASE_ID/close \
  -d '{"outcome":"Resolved — transformer replaced, downtime 4h 22m."}' | jq
```

**UI test**:
1. **Cases** (new sidebar item) → **+ New Case** → pick category & priority.
2. Drop-in documents via "Attach", add tasks via inline form, invite external email.
3. Activity feed shows every action in chronological order.
4. Close → outcome captured, case moves to "Closed" tab.

---

## 7. Green IT / Sustainability Dashboard   *(NEW in V22)*

**Pitch**: *"Apex Nexus isn't just efficient for your people; it's efficient for the planet."*

### What it measures

A scheduled job computes a daily **Green Index** snapshot:

| Metric | How it's computed |
|--------|-------------------|
| **Bytes stored**        | `SUM(file_size) FROM documents WHERE is_deleted=false` |
| **Bytes deduplicated**  | `SUM(file_size) FROM documents WHERE sha256_hash IN (SELECT hash FROM documents GROUP BY sha256_hash HAVING COUNT(*)>1)` — duplicates re-linked to single object |
| **Bytes archived**      | Sum of docs marked `storage_tier='ARCHIVE'` (cold tier) |
| **Energy saved (kWh)**  | `dedup_bytes × 0.72 Wh/GB` (datacenter PUE 1.5, typical NVMe at ~0.48 Wh/GB + overhead) |
| **CO₂ avoided (kg)**    | `kwh × 0.429` (Zimbabwe grid intensity, 2025) |
| **Heavy AI deferred**   | Count of re-indexing jobs pushed to 22:00-06:00 window (carbon-aware scheduling) |

Values are rolled up to daily snapshots in `sustainability_metrics`.

### Workflow
```
Every day at 02:00 UTC:
   SustainabilityService.computeSnapshot()
   └─► INSERT INTO sustainability_metrics  (date, bytes_stored, bytes_deduped, kwh_saved, co2_kg_avoided, jobs_deferred)

User opens /sustainability  →  GET /api/sustainability/snapshot (latest) + /trend?days=30
   └─► Dashboard renders:
       - Big "Green Index" score 0–100 (target: 85+)
       - Monthly kWh saved + CO₂ equivalent (flights / trees planted)
       - 30-day trend line
       - "Heavy jobs deferred to off-peak" counter (carbon-aware scheduling)
```

### Table (V22)
```sql
sustainability_metrics (
  id BIGSERIAL PK,
  snapshot_date DATE UNIQUE,
  bytes_stored BIGINT,
  bytes_deduped BIGINT,
  bytes_archived BIGINT,
  kwh_saved NUMERIC(10,3),
  co2_kg_avoided NUMERIC(10,3),
  jobs_deferred INT,
  green_index INT        -- 0-100 composite score
)
```

### End-to-End Test

```bash
# 1. Force a snapshot
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/sustainability/snapshot/refresh | jq

# 2. Get latest
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9600/api/sustainability/snapshot | jq

# 3. Trend
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9600/api/sustainability/trend?days=30" | jq '.data | length'
```

**UI test**: go to **Sustainability** (new sidebar item) → see Green Index gauge, current month's kWh / CO₂, and 30-day trend.

---

## 8. Multilingual AI — Shona / Ndebele / English   *(NEW in V22)*

**Pitch**: *"Apex Nexus is built for Zimbabweans. Our classifier doesn't just speak English; it understands the local context."*

### Workflow

```
On intake (inside IntakeService.classify):
   │
   ▼
LanguageDetectionService.detect(text):
   1. Count stop-word matches for: ENGLISH | SHONA | NDEBELE
   2. Highest score wins (tie → language with more unique word matches)
   │
   ▼
documents.language = 'en' | 'sn' | 'nd'        (ISO-639-1)
   │
   ▼
Classifier runs normally, but LABEL is localised:
   - Shona: "Chibvumirano" = Contract, "Chikwereti" = Invoice, "Mutemo" = Policy
   - Ndebele: "Isivumelwano" = Contract, "I-inifothi" = Invoice
```

Minimum-viable keyword approach (no LLM round-trip for language detection — too expensive per upload). Confidence included in response.

### Table
New column `documents.language` TEXT DEFAULT 'en'.

### End-to-End Test

```bash
# 1. Classify Shona text
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  http://localhost:9600/api/search/classify-text \
  -d '{"fileName":"chibvumirano.txt","mimeType":"text/plain","text":"Chibvumirano ichi chakaitwa pakati peZETDC neAcme. Mutengo wakawedzera ne-22%."}' | jq '.data | {label, language, confidence}'

# Expected: language="sn", label reflecting "Contract" (or localised equivalent)

# 2. English baseline
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  http://localhost:9600/api/search/classify-text \
  -d '{"fileName":"x.txt","mimeType":"text/plain","text":"This agreement is between ZETDC and Acme. Price increase of 22%."}' | jq '.data | {label, language}'

# Expected: language="en"

# 3. Ndebele
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  http://localhost:9600/api/search/classify-text \
  -d '{"fileName":"y.txt","mimeType":"text/plain","text":"Isivumelwano lesi singumama weZETDC. Inani likhuphukile nge-22%."}' | jq '.data | {label, language}'

# Expected: language="nd"
```

---

# Checklist — End-to-End Demo Script (20 minutes)

Run in this order to demonstrate the whole platform to a stakeholder:

| # | Module | Click path | Prove it works by |
|---|--------|------------|-------------------|
| 1 | **Intake** | Upload the combined MSA doc (SQL above) | Classifier returns "Contract"; language autodetects |
| 2 | **Agents** | Open `/agents` | See 3-4 cards grouped by Auditor / Bridge / Intake |
| 3 | **Notarize** | Documents → select MSA → Notarize | Block # appears; Verify → green ✓ |
| 4 | **SAP** | `/sap` → P2P | Run match on invoice → PARKED |
| 5 | **Cases** | `/cases` → New | Open Substation-7 case, attach MSA, add task, invite expert |
| 6 | **Vendor Portal** | `/vendor-portals` → New | Generate link, upload in incognito → quarantine → approve |
| 7 | **Federated** | `/federated` → search `github` | Internal + Live·Remote (Gmail) hits side-by-side |
| 8 | **Sustainability** | `/sustainability` | Green Index ~80s, kWh saved, CO₂ avoided |
| 9 | **Audit** | `/audit` → Stats | Usernames (not UUIDs), VIEW + FEDERATED_SEARCH events present |

---

## Appendix — Schema quick-reference (new/touched tables)

```sql
-- V22 (new)
cases, case_tasks, case_participants, case_attachments, case_events
sustainability_metrics
agentic_suggestions (add column agent_name)
documents         (add column language)
```
