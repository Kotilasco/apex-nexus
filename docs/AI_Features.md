# Apex Nexus — AI & Intelligence Features

This document describes the four AI-powered capabilities that sit at the heart of
Apex Nexus: **Agentic AI**, **Federated Search**, **Vendor Portal PII Shield**,
and **Predictive Bottlenecks**. For each one we cover what it does, why it
matters, how it works under the covers, and how to demo it.

---

## 1. Agentic AI — Proactive intent detection

### What it does
Every document that enters Apex Nexus (upload, email ingestion, SAP push,
vendor-portal upload) is automatically inspected by an **Agent** that tries to
recognise one of five business intents. When it finds one, it quietly creates a
**Suggestion** in the `/agents` inbox with:

- A confidence score (0–1)
- A human-readable title and rationale
- A pre-filled **proposed action** (a draft workflow, a memo, an approval
  request, etc.) — ready for one-click acceptance.

The five intents recognised today:

| Intent              | Fires when …                                                        |
|---------------------|----------------------------------------------------------------------|
| `INVOICE_AUTOMATCH` | Document contains an invoice number **and** a matching PO number.   |
| `BUDGET_VARIANCE`   | Document mentions a tariff / price increase with a `%` figure.      |
| `CONTRACT_RENEWAL`  | Contract expiry keyword appears within 90 days of today.            |
| `METER_ANOMALY`     | Meter reading is >30% above the 90-day rolling average.             |
| `COMPLIANCE_REVIEW` | Document mentions ISO / regulatory clauses without a review record. |

### Why it matters
The biggest win in document management is **eliminating silent paperwork**.
Instead of staff reading invoices to find budget risks, the agent finds them
first and pre-drafts the variance memo. The human just says *Accept*.

### How it works

```
 Upload / Email / SAP / Vendor Portal
          │
          ▼
 IntakeService.persist(...)
          │
          ▼
 AgenticIntentService.detectForDocument(docId)
          │   (runs 5 independent matchers)
          ▼
 INSERT INTO agentic_suggestions (intent_type, confidence, proposed_action, …)
          │
          ▼
 /agents page polls every 10s and surfaces the new suggestion
```

Matchers are **deterministic regex + SQL queries** — not an LLM call. This
keeps them fast, free, testable, and auditable.

Key code paths:

- Service: [AgenticIntentService.java](../backend/apex-document-service/src/main/java/com/apexnexus/document/service/AgenticIntentService.java)
- Controller: [AgenticController.java](../backend/apex-document-service/src/main/java/com/apexnexus/document/controller/AgenticController.java)
- Hook: [IntakeService.java](../backend/apex-document-service/src/main/java/com/apexnexus/document/service/IntakeService.java) — calls `agenticIntent.detectForDocument()` after auto-route.
- Schema: tables `agentic_suggestions` + `agentic_decisions` (see `V19__agentic_federated_vendor_predictions.sql`).
- UI: [agents/page.tsx](../frontend/web/src/app/(protected)/agents/page.tsx) — Pending / History tabs, Accept / Dismiss.

### Key regex (example)

```java
// Budget variance — matches both "15% increase" and "increase of 15%"
PERCENT_INCREASE = Pattern.compile(
  "(?i)(\\d{1,3}(?:\\.\\d+)?)\\s*%[^0-9]{0,40}(increase|uplift|adjustment|rise|rising|hike|higher)"
+ "|(?i)(increase|uplift|adjustment|rise|rising|hike|higher|increasing|tariff)[^0-9]{0,40}(\\d{1,3}(?:\\.\\d+)?)\\s*%");
```

### Demo script

1. Upload a plain-text document containing:
   `ZETDC tariff notice: a 15% price increase is effective May 1. Invoice INV-2026-00881 for PO 4500012001.`
2. Open `/agents`.
3. Within 10 seconds, two suggestions appear:
   - `INVOICE_AUTOMATCH` — *Invoice with PO 4500012001 detected*
   - `BUDGET_VARIANCE` — *Price / tariff increase of 15% detected*
4. Click **Accept** on the budget variance. The proposed memo is drafted and
   routed to Finance.

---

## 2. Federated Search — one query across the whole organisation

### What it does
A single search box queries **Apex Nexus plus four external corpora** in
parallel and returns a single ranked list with source-type filtering:

- Microsoft **Exchange** (Outlook mailboxes)
- **Gmail** (Google Workspace)
- **SharePoint** sites
- **Network shares** (SMB/CIFS)
- **Legacy ECM** (e.g. ELO, FileNet, OpenText — read-only)
- **Apex Nexus** native corpus

### Why it matters
Most enterprises have 20 years of documents scattered across systems they can
never migrate off. Federated Search gives users the illusion of a single
corpus without having to physically move anything.

### How it works

```
 GET /federated/search?q=<term>&types=EXCHANGE,GMAIL
          │
          ▼
 FederatedSearchService.search(q, types)
          │
          ├── Query 1: SELECT … FROM federated_index fi JOIN federated_sources fs
          │            WHERE search_tokens @@ plainto_tsquery(:q)
          │   (hits Exchange / Gmail / SharePoint / shares / legacy ECM)
          │
          └── Query 2: SELECT … FROM documents
                       WHERE title ILIKE :q OR extracted_content ILIKE :q
              (hits the Apex Nexus native corpus)
          │
          ▼
 Merge → group by source_type → return {results, breakdown, tookMs}
```

- External corpora are **indexed** into the `federated_index` table (tsvector +
  metadata). Apex Nexus only holds the index rows, never the file bytes —
  clicking an external result opens the document in its native system.
- The `federated_sources` table records each connected source, its status, a
  doc-count estimate, and an admin toggle to enable/disable it.
- Adding a new source (e.g. Box, Confluence) is a single `INSERT` plus a
  connector that populates `federated_index` on a schedule.

Key code paths:

- Service: [FederatedSearchService.java](../backend/apex-document-service/src/main/java/com/apexnexus/document/service/FederatedSearchService.java)
- Controller: [FederatedSearchController.java](../backend/apex-document-service/src/main/java/com/apexnexus/document/controller/FederatedSearchController.java)
- UI: [federated/page.tsx](../frontend/web/src/app/(protected)/federated/page.tsx)

### Demo script
1. Open `/federated`.
2. Search `ZETDC` — results appear from **Apex, Gmail, Exchange, SharePoint**
   simultaneously.
3. Click any chip (e.g. `Gmail`) to filter to a single source.
4. Click an external result → opens in Outlook / Gmail / SharePoint.

---

## 3. Vendor Portals — secure upload with PII shield

### What it does
Admins issue a **time-boxed, token-based portal link** to a specific vendor
(e.g. "Acme Power — expires in 30 days"). The vendor opens the link with no
account, no password, and uploads their documents. Before anything enters the
Apex corpus, each upload is:

1. Scanned for **PII** (email, phone, national ID, credit-card).
2. Scanned for **compliance risk** keywords (CONFIDENTIAL, HAZMAT, ASBESTOS,
   LABOR\_RISK, SANCTIONS, WARRANTY\_VOID).
3. **Auto-classified** (INVOICE / CONTRACT / COMPLIANCE\_CERT / QUOTE / GENERAL).
4. **Quarantined** if any finding is present — an admin must approve or reject.

### Why it matters
Letting suppliers email PDFs is how compliance programmes die. The portal
gives vendors a frictionless channel while the PII shield guarantees nothing
sensitive enters your corpus without a human sign-off.

### How it works

```
Admin → POST /vendor-portals  (create, returns 64-char hex token)
Vendor → GET  /public/vendor-portal/{token}          (no JWT, permitAll)
Vendor → POST /public/vendor-portal/{token}/upload   (multipart file)
            │
            ▼
 VendorPortalService.acceptUpload
            │
            ├── PII regex pass   → piiFindings {EMAIL:1, PHONE:1, …}
            ├── Compliance pass  → complianceFindings [CONFIDENTIAL_MARKING, …]
            ├── Heuristic class  → classification = COMPLIANCE_CERT
            └── If any finding → status = QUARANTINED
                Else           → status = APPROVED + trigger agentic detection
            │
            ▼
 Admin opens /vendor-portals → reviews Uploads → Approve / Reject
```

Key code paths:

- Service: [VendorPortalService.java](../backend/apex-document-service/src/main/java/com/apexnexus/document/service/VendorPortalService.java)
- Controller: [VendorPortalController.java](../backend/apex-document-service/src/main/java/com/apexnexus/document/controller/VendorPortalController.java)
- Security: `/public/vendor-portal/**` is `permitAll()` in `SecurityConfig`.
- UI (admin): [vendor-portals/page.tsx](../frontend/web/src/app/(protected)/vendor-portals/page.tsx)
- UI (public, no JWT): [v/[token]/page.tsx](../frontend/web/src/app/v/[token]/page.tsx)

### Key patterns

```java
// PII
EMAIL       = "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}"
PHONE       = "(?:\\+?\\d{1,3}[\\s-]?)?\\(?\\d{2,4}\\)?[\\s-]?\\d{3,4}[\\s-]?\\d{3,4}"
NATIONAL_ID = "\\b\\d{2}-?\\d{6,7}-?[A-Z]-?\\d{2}\\b"
CREDIT      = "\\b(?:\\d[ -]*?){13,16}\\b"

// Compliance keywords
"CONFIDENTIAL", "HAZMAT", "ASBESTOS", "LABOR_RISK", "SANCTIONS", "WARRANTY_VOID"
```

### Demo script
1. Admin → `/vendor-portals` → **New Portal** → "Acme Power".
2. Copy the portal link, paste it in an incognito window.
3. Upload a file containing an email address and the word "confidential".
4. Status returned: `QUARANTINED`, `piiFindings: {EMAIL:1}`,
   `complianceFindings: [CONFIDENTIAL_MARKING]`.
5. Admin → **Uploads** → **Approve** (with reviewer notes).

---

## 4. Predictive Bottlenecks — early-warning for SLAs

### What it does
For every active workflow instance, Apex predicts:

- When the workflow will actually complete (`predicted_completion`)
- Whether it will miss its SLA (`risk_level = HIGH | MEDIUM | LOW`)
- **Who** is blocking it (`bottleneck_user`)
- **Who** should take it instead (`suggested_user` — the least-loaded eligible user)

Admins see a ranked list at `/predictions` with a one-click **Reassign**
button.

### Why it matters
Workflow dashboards tell you what's *already* late. Predictions tell you
what's *about to be* late, and let you unblock it before the SLA breaches.
That's the difference between reporting and operating.

### How it works

```
 POST /workflows/predictions/refresh
          │
          ▼
 WorkflowPredictionService.computeAll()
          │
          ├── For each active instance:
          │     history    = median dwell time in this state across past runs
          │     backlog    = # active instances currently on this assignee
          │     predicted  = now + history * (1 + backlog * 0.15)
          │     delta      = predicted - SLA deadline
          │     risk_level = delta > 48h ? HIGH : delta > 12h ? MEDIUM : LOW
          │     suggested  = user with min(backlog) among eligible role members
          │
          └── UPSERT into workflow_predictions
          │
          ▼
 /predictions page reads workflow_predictions JOIN documents JOIN users
```

- Only workflows with a real bottleneck (`predicted_delay_hours > 0` **or**
  not `LOW`) are shown. Workflows that are on track are hidden as noise.
- The backlog coefficient `0.15` was tuned empirically; it can be moved into
  a config property later.
- Reassignment calls the existing `WorkflowService.reassign()` and writes an
  audit entry.

Key code paths:

- Service: [WorkflowPredictionService.java](../backend/apex-workflow-service/src/main/java/com/apexnexus/workflow/service/WorkflowPredictionService.java)
- Controller: [WorkflowPredictionController.java](../backend/apex-workflow-service/src/main/java/com/apexnexus/workflow/controller/WorkflowPredictionController.java)
- UI: [predictions/page.tsx](../frontend/web/src/app/(protected)/predictions/page.tsx)

### Demo script
1. Admin → `/predictions` → **Recompute**.
2. A workflow appears with `HIGH` risk: *"Bottleneck: user X has 11 active
   tasks, predicted +73h past SLA."*
3. Suggested reassignee (*user Y, 2 active tasks*) is shown inline.
4. Click **Reassign** → audit row written, prediction re-computed, risk drops
   to `LOW`.

---

## Infrastructure shared by all four features

| Concern              | Implementation                                                                 |
|----------------------|--------------------------------------------------------------------------------|
| Database             | Postgres, single schema, `V19` migration owns all four tables.                 |
| Auth                 | Spring Security JWT for admin endpoints. Vendor public endpoints are `permitAll`. |
| Gateway routing      | `apex-gateway` routes `/api/agentic/**`, `/api/federated/**`, `/api/vendor-portals/**`, `/api/public/**` to `apex-document-service`; `/api/workflows/predictions/**` to `apex-workflow-service`. |
| Frontend             | Next.js App Router. Protected routes live under `(protected)/`; the public vendor upload page lives at `/v/[token]` **outside** the group (no JWT). |
| Observability        | Every accept/dismiss/reassign writes to `audit_log`. Each feature also writes domain events (e.g. `AI_SUGGESTION_ACCEPTED`) that appear in the Audit page. |

## Why this is "AI"

None of these features require a hosted LLM. They are **deterministic
intelligence**: regex, SQL aggregations, and statistical estimators. That is
deliberate:

- **Zero token cost** — runs on-prem or air-gapped.
- **Deterministic** — the same input always yields the same suggestion, which
  auditors and regulators require.
- **Explainable** — every suggestion carries the exact regex / rule that
  triggered it.
- **Extensible** — any of these services can be swapped for an LLM call later
  (e.g. classification, or a better bottleneck model) without changing the
  surrounding workflow, schema, or UI.

This is what gives Apex Nexus its edge: the *agent pattern* (observe →
suggest → await human consent → act) is implemented end-to-end, and it is
ready for an LLM to drop in as a smarter matcher when the business case
justifies it.
