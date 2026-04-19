# SAP Integration — Apex Nexus

**Positioning:** Apex Nexus is the **System of Engagement** for unstructured content; SAP is the **System of Record** for the business transaction. We never duplicate SAP data — we attach, link, and route around it. "Clean Core" by design.

## 1. Architecture

```
┌────────────────────┐                  ┌─────────────────────┐
│   Apex Nexus UI    │   HTTPS (JWT)    │    Apex Gateway     │
│   (/sap, /intake)  ├─────────────────►│  /api/sap/**, ...   │
└────────────────────┘                  └──────────┬──────────┘
                                                   │
                                       ┌───────────▼────────────┐
                                       │  apex-document-service │
                                       │                        │
                                       │  SapIntegrationService │──┐
                                       │  (orchestration)       │  │
                                       └───────────┬────────────┘  │
                                                   │               │
                                                   │ HTTP          │ JDBC
                                                   ▼               ▼
                                       ┌────────────────────┐  ┌──────────────┐
                                       │  SapMockController │  │  PostgreSQL  │
                                       │  (/sap-mock/**)    │  │  sap_* tables│
                                       └────────────────────┘  └──────────────┘

       DEMO MODE:  SapMockController = in-process stand-in for real SAP S/4HANA.
       PROD MODE:  Swap SapMockController with the SAP OData/RFC connector.
                   No UI/workflow changes required — contracts are identical.
```

### Swap to real SAP later

Set `SAP_BASE_URL` on `apex-document-service` to the real SAP gateway (OData v4 or SOAP ArchiveLink), and implement an adapter exposing the same 7 mock endpoints. The UI, orchestration layer, and workflows do not change.

## 2. SAP Business-Object Types Supported

| BOR Object | Meaning | Used for |
|------------|---------|----------|
| `BUS2081`  | FI Invoice (Vendor) | Parked/posted AP invoices, Procure-to-Pay |
| `EQUI`     | Equipment Record | Field photos, inspection reports, Meter-to-Cash |
| `IFLOT`    | Functional Location | Site-level documents (substations, feeders) |
| `BKPF`     | Accounting Document header | General FI attachments |

All links are written to `sap_object_links` with `archive_id='APX'`, emulating SAP ArchiveLink.

## 3. Data Model (`V18__sap_integration.sql`)

| Table | Purpose |
|-------|---------|
| `sap_purchase_orders` | Canonical PO list (`po_number` PK, vendor, amount, status OPEN/CLOSED). |
| `sap_invoices`       | Submitted invoices with 3-way match result in `match_details` JSONB. |
| `sap_assets`         | Equipment records keyed by `equipment_id` with functional location + site. |
| `sap_object_links`   | ArchiveLink table: `(ar_object, object_key, document_id)` triple. |

Seed data (ZETDC-flavoured):

- **5 POs** `4500012001`-`4500012005` (Acme Power, ElectroMax, SmartGrid Meters, Beta Cables, Siemens Energy)
- **6 Assets** `EQ-10000042` / `EQ-10000043` / `EQ-10000099` / `EQ-10000200` / `EQ-10000201` / `EQ-10000500` (Ngezi / Harare / Bulawayo / Mutare)

## 4. Endpoint Reference

### 4.1 Mock-SAP endpoints (demo backend)

All under `GET /api/sap-mock/...` (internal permit-all; gateway enforces JWT).

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/purchase-orders`                     | List all POs |
| GET    | `/purchase-orders/{po}`                | Single PO lookup |
| POST   | `/invoices/match`                      | 3-way match (body: `poNumber`, `amount`, `vendor`); returns `matched`, `action`, `reason`, `amountTolerance` |
| POST   | `/invoices/park`                       | Park/post invoice (body: `poNumber`, `amount`, `vendor`, `apexDocumentId`, `status`) |
| GET    | `/invoices`                            | Invoice ledger |
| GET    | `/assets`                              | All equipment records |
| GET    | `/assets/{equipmentId}`                | Asset with linked attachments |
| POST   | `/archivelink/put`                     | Write a link row (ArchiveLink PUT equivalent) |
| GET    | `/archivelink/get?arObject=&objectKey=` | Retrieve all links for a transaction |

### 4.2 Apex Integration endpoints (real business logic)

Under `/api/sap/...` — these wrap the mock backend and add extraction, workflow triggers, and audit.

| Method | Path | Purpose |
|--------|------|---------|
| POST   | `/invoices/process/{documentId}`                              | Extract PO/amount/vendor from the Apex document, match, auto-park or start dispute |
| POST   | `/assets/{equipmentId}/link/{documentId}?linkType=ATTACHMENT` | Attach an Apex document to an SAP Equipment Record via ArchiveLink (EQUI) |
| GET    | `/transactions/{arObject}/{objectKey}/documents`              | Reverse lookup — what Apex docs are linked to a specific SAP transaction (this is what SAP shows in the attachment list) |
| GET    | `/summary`                                                    | Counts for the dashboard |

## 5. Procure-to-Pay Flow

1. Vendor emails an invoice PDF → captured via **Email Ingestion** or **Intake** page.
2. AI extracts `PO #`, `Amount`, `Vendor` via regex on `documents.extracted_content` (matches patterns like `45nnnnnnnn` / `47nnnnnnnn`, `Total Due: 42,500.00`, `From: Acme Power Systems`).
3. `POST /api/sap/invoices/process/{docId}` calls mock `POST /sap-mock/invoices/match`:
   - **Matched** (amount within 2% tolerance + vendor first-word match): →
     - `POST /sap-mock/invoices/park` creates SAP invoice (e.g. `5105681502`),
     - `POST /sap-mock/archivelink/put` with `arObject=BUS2081`, `objectKey=<sapInvoiceId>` — document is now visible inside SAP's attachment list on transaction `FB02`.
   - **Mismatch**: a workflow of type `Invoice Dispute` is started, assigned to AP with the mismatch reason.
4. Response to UI includes `extracted`, `sapMatch`, `sapInvoice`, `status`, `action`.

## 6. Meter-to-Cash / Asset Flow

1. Field engineer uploads inspection photos via Intake (mobile upload supported).
2. On the `/sap → Asset / Meter-to-Cash` tab the user picks the target Equipment Record and clicks **Link via ArchiveLink (EQUI)**.
3. `POST /api/sap/assets/EQ-10000042/link/{documentId}?linkType=ATTACHMENT` writes a link row with `ar_object=EQUI`.
4. Inside SAP Fiori (`IE03 Display Equipment`) the photo now appears in **Services for Object → Attachments**.
5. Reverse lookup is on the **ArchiveLink Viewer** tab: any user can ask "what documents are attached to EQ-10000042?" without leaving Apex.

## 7. Demo Scripts

### 7.1 Procure-to-Pay (≈ 90 s)

```bash
# 0. Login
TOKEN=$(curl -s -X POST http://localhost:8200/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@2024!"}' | jq -r '.data.accessToken')

# 1. Create an invoice document via Intake
cat > /tmp/acme_invoice.txt <<'EOF'
INVOICE
From: Acme Power Systems Ltd
Purchase Order: 4500012001
Description: 33kV Distribution Transformer
Total Due: 42,500.00
EOF

BATCH=$(curl -s -X POST "http://localhost:8200/api/intake/upload?autoRoute=false" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@/tmp/acme_invoice.txt" | jq -r '.data.batchId')

sleep 3
DOC=$(curl -s "http://localhost:8200/api/intake/batches/$BATCH" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].document_id')

# 2. Run P2P
curl -s -X POST "http://localhost:8200/api/sap/invoices/process/$DOC" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Expected tail:
```json
"status": "PARKED_IN_SAP",
"action": "AUTO_PARKED",
"sapInvoice": { "sapInvoiceId": "5105681502", "poNumber": "4500012001" }
```

### 7.2 Meter-to-Cash / Asset (≈ 60 s)

```bash
# Attach a photo to Equipment EQ-10000042
PHOTO=$(curl -s -X POST "http://localhost:8200/api/intake/upload?autoRoute=false" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@/tmp/inspection.jpg" | jq -r '.data.batchId')
# ... fetch doc id ...

curl -X POST "http://localhost:8200/api/sap/assets/EQ-10000042/link/$DOC_ID?linkType=ATTACHMENT" \
  -H "Authorization: Bearer $TOKEN"

# Verify from SAP's perspective
curl "http://localhost:8200/api/sap/transactions/EQUI/EQ-10000042/documents" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 7.3 Negative path — dispute

Create an invoice with `Total Due: 60,000.00` against PO `4500012001` (whose SAP amount is 42,500). `/sap/invoices/process` will return `matched=false`, `reason=amount`, `action=DISPUTE`, and a workflow instance id — a dispute ticket auto-assigned to AP.

## 8. Test Matrix

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Valid invoice, amount exact, vendor exact | `AUTO_PARKED`, SAP invoice id created |
| 2 | Amount within 2 % tolerance | `AUTO_PARKED` (tolerance is visible in match payload) |
| 3 | Amount outside tolerance | `DISPUTE`, `reason=amount` |
| 4 | Vendor mismatch | `DISPUTE`, `reason=vendor` |
| 5 | Missing PO in text | `NEEDS_REVIEW`, `reason=po-not-extracted` |
| 6 | PO not in SAP | `DISPUTE`, `reason=po-not-found` |
| 7 | PO status `CLOSED` | `DISPUTE`, `reason=po-closed` |
| 8 | Photo → existing asset | `LINKED`, appears in `/transactions/EQUI/<eid>/documents` |
| 9 | Photo → unknown asset | `404 asset not found` |
| 10 | Duplicate invoice processing | Idempotent — same `sapInvoiceId` returned or invoice flagged as already parked |

## 9. Clean-Core Positioning (vs. ELO / OpenText)

| Aspect | Legacy ECM (ELO et al.) | Apex Nexus |
|--------|-------------------------|------------|
| Writes to SAP core tables | Yes — custom Z-tables | Never |
| Workflow engine | Inside ECM only | In Apex, SAP, or both — by choice |
| Per-document AI | Bolt-on add-ons | Built-in (Intake 3-layer classifier) |
| Asset / photo flows | SAP Mobile Services $$$ | Native intake + ArchiveLink link |
| Migration path | S/4HANA OCI needed | Keep mock, swap adapter when SAP exposes OData |

## 10. Security Notes

- `/sap-mock/**` is permit-all **inside** `apex-document-service` (used only for intra-process RPC); externally, the gateway requires a valid JWT for `/api/sap-mock/**`.
- ArchiveLink writes record `linked_by` from the JWT principal (auditable chain of custody).
- All object key lookups are parameterised JDBC — no string concatenation.
- Dispute workflow assignment uses existing Apex RBAC (AP Clerk role).

## 11. Roadmap to real SAP

1. Implement `RealSapConnector` implementing the same 9 mock endpoints against SAP Gateway (OData + ArchiveLink HTTP content server).
2. Move secrets to Azure Key Vault; inject `SAP_OAUTH_CLIENT_ID`, `SAP_OAUTH_CLIENT_SECRET`.
3. Add background reconciliation job: for any `sap_invoices` rows older than N days without a `POSTED` status in SAP, re-sync.
4. (Optional) Event-driven: subscribe to SAP Event Mesh for PO / invoice lifecycle events and push updates to Apex's websocket layer.
