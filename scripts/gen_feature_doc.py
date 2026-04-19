"""Generate Apex Nexus feature documentation as a Word document."""
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

# --- Styles ---
styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(11)

def H(text, level=1):
    p = doc.add_heading(text, level=level)
    for r in p.runs:
        r.font.color.rgb = RGBColor(0x1F, 0x3A, 0x8A)
    return p

def P(text, bold=False, italic=False):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold = bold
    r.italic = italic
    return p

def bullet(text):
    doc.add_paragraph(text, style="List Bullet")

def table(rows, headers):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Light Grid Accent 1"
    hdr = t.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
        for p in hdr[i].paragraphs:
            for r in p.runs:
                r.bold = True
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = str(val)
    doc.add_paragraph()

# ─────────────────────────────── TITLE PAGE
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
tr = title.add_run("Apex Nexus")
tr.font.size = Pt(36)
tr.bold = True
tr.font.color.rgb = RGBColor(0x1F, 0x3A, 0x8A)

sub = doc.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
sr = sub.add_run("Enterprise Content Management Platform")
sr.font.size = Pt(18)
sr.italic = True

sub2 = doc.add_paragraph()
sub2.alignment = WD_ALIGN_PARAGRAPH.CENTER
sr2 = sub2.add_run("System Capabilities, Architecture, ELO Differentiation and Roadmap")
sr2.font.size = Pt(14)

doc.add_paragraph()
meta = doc.add_paragraph()
meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
meta.add_run("Technical & Strategic Reference Document\nVersion 1.0  ·  April 2026").italic = True

doc.add_page_break()

# ─────────────────────────────── 1. EXECUTIVE
H("1. Executive Summary", 1)
P(
    "Apex Nexus is a cloud-native, AI-native Enterprise Content Management (ECM) platform "
    "built as a microservice mesh. It combines traditional document management (capture, "
    "storage, retention, workflow, search) with modern capabilities competitors charge extra "
    "for: on-premise LLM classification, workflow health analytics, blockchain-style "
    "notarization, a live knowledge graph, and a Clean-Core SAP integration layer."
)
P(
    "Apex Nexus is positioned as a System of Engagement that cooperates with Systems of "
    "Record (SAP, Oracle, Dynamics) rather than replacing them — a deliberate departure "
    "from monolithic vendors such as ELO, OpenText and M-Files."
)

H("1.1 Architectural Snapshot", 2)
bullet("Frontend: Next.js 14 (App Router), TypeScript, Tailwind — single-page SPA behind JWT.")
bullet("Gateway: Spring Cloud Gateway, JWT auth, rate-limited, 180 s long-timeout for AI routes.")
bullet("Microservices: 8 Spring Boot services — auth, document, workflow, search, audit, retention, notification, and an AI/LLM sidecar via Ollama (llama3.2:1b).")
bullet("Data: PostgreSQL 16 (primary), Redis (cache / presence), MinIO-compatible object store for binaries, Meilisearch for full-text.")
bullet("Deployment: docker-compose for dev; Kubernetes-ready manifests for prod.")

# ─────────────────────────────── 2. CAPABILITY CATALOGUE
doc.add_page_break()
H("2. Capability Catalogue", 1)
P("Every module is listed with (a) what it does, (b) how it works, and (c) why it beats legacy ECM.", italic=True)

# Capability sections
caps = [
    {
        "num": "2.1",
        "name": "Intelligent Intake (Zero-Touch Capture)",
        "what": "Drop any file (PDF, DOCX, image, email, scan). The system reads, classifies, and routes it to the correct project — then starts the correct workflow, without human triage.",
        "how": [
            "Layer 1 – Structural classifier: inspects MIME, filename patterns, size.",
            "Layer 2 – Textual classifier: regex + keyword scoring on extracted text.",
            "Layer 3 – Semantic AI classifier: on-prem Ollama llama3.2:1b in JSON mode.",
            "CompositeClassifier merges all three, yielding a confidence score and a suggested project.",
            "Auto-route block: if confidence ≥ threshold, creates the document in the right project and triggers the right workflow (e.g. Invoice → AP Approval).",
            "User can override per batch by pinning a project from a dropdown.",
        ],
        "elo": [
            "ELO requires per-tenant training of its \"Teach\" model, or rule templates maintained by consultants.",
            "Apex runs an LLM locally — no data leaves the tenant, no retraining required, no licence uplift.",
            "Auto-routing with workflow trigger is a separate ELO Flows licence; here it is the default path.",
        ],
    },
    {
        "num": "2.2",
        "name": "Document Service (Storage, Versioning, Checkout)",
        "what": "Canonical store for every document: binary in S3-compatible object storage, metadata in Postgres, version history, SHA-256 fingerprint, soft-delete, folder hierarchy.",
        "how": [
            "CreateDocumentRequest → apex-document-service persists metadata row, streams bytes to MinIO, computes SHA-256, indexes into Meilisearch.",
            "File locking via WebDAV + WOPI so Office/OnlyOffice can co-edit.",
            "Every mutation appends an audit row (who/what/when/from-where).",
            "Version chain is linked list with hashes; older versions are retrievable up to retention limit.",
        ],
        "elo": [
            "ELO uses a proprietary repository format; Apex uses open S3 + SHA-256 (portable, future-proof).",
            "OnlyOffice/WOPI editing is included; in ELO requires the Office Add-In suite.",
            "SHA-256 chain enables blockchain notarization (§2.9), which ELO does not offer natively.",
        ],
    },
    {
        "num": "2.3",
        "name": "Projects, Folders, Permissions",
        "what": "Project = workspace with its own folder tree, ACL, retention policy, compliance category and workflow defaults.",
        "how": [
            "projects table carries compliance_category (LEGAL/FINANCIAL/HR/etc.) which the Intake classifier uses to decide routing.",
            "Permissions computed from (role × project × folder) with inherited ACLs.",
            "Project selector is surfaced in Intake, Documents, SAP and Workflow pages.",
        ],
        "elo": [
            "ELO's concept is \"Archive\"+\"Subject Line\", coarser than Apex projects.",
            "Apex permission model is RBAC + attribute-based (jurisdiction, classification) — ELO is primarily RBAC.",
        ],
    },
    {
        "num": "2.4",
        "name": "Workflow Engine + Designer",
        "what": "Stateful workflow instances (approvals, reviews, disputes) with a visual, drag-and-drop designer.",
        "how": [
            "workflow-service persists instances; tasks dispatched via Redis + Notification service (email, in-app, websocket).",
            "Templates: AP Approval, Contract Review, Policy Attestation, Invoice Dispute, Employee Onboarding.",
            "Workflow Designer is a client-side canvas that emits JSON (nodes, edges, condition expressions) executed by the engine.",
            "Workflow Health Dashboard (§2.10) ingests every transition for bottleneck analytics.",
        ],
        "elo": [
            "ELO Flows requires BPMN 2.0 expertise and a separate licence; Apex ships a low-code designer by default.",
            "Health analytics come from a separate BI tool in ELO; here it is one page.",
        ],
    },
    {
        "num": "2.5",
        "name": "Retention & Records Management",
        "what": "Automated lifecycle enforcement: legal hold, retention schedules, disposition with justification.",
        "how": [
            "apex-retention-service evaluates documents against policies nightly.",
            "Supports event-based (e.g. contract end date), time-based (7 yrs after creation), and composite rules.",
            "Legal Hold overrides any retention-based disposition and is audit-logged.",
            "Retention UI shows \"what expires this month\" and allows reviewer override.",
        ],
        "elo": [
            "Functionally equivalent; Apex differentiates with workflow-driven disposition approvals and an immutable disposition ledger.",
        ],
    },
    {
        "num": "2.6",
        "name": "Search (Meilisearch + AI ranking)",
        "what": "Sub-second full-text search with typo tolerance, facets and semantic re-ranking.",
        "how": [
            "Meilisearch indexes documents on create/update.",
            "apex-search-service exposes /search with filters (project, date, classification, jurisdiction).",
            "POST /search/classify-text uses the same LLM pipeline to classify ad-hoc snippets.",
            "Saved searches; NL-question answering backed by a RAG pipeline over indexed content.",
        ],
        "elo": [
            "ELO uses iSearch (proprietary) — performant but closed; typo/NLP capabilities require uplift modules.",
            "Apex RAG is first-class: ask \"which invoices are overdue for Acme Power?\" and get an answer with source links.",
        ],
    },
    {
        "num": "2.7",
        "name": "Email Ingestion (EWS / IMAP)",
        "what": "Configured mailboxes (e.g. invoices@, legal@) are polled; attachments become intake items automatically.",
        "how": [
            "EmailIngestionService polls EWS (Exchange) or IMAP on a schedule.",
            "Each attachment runs through the same Intake pipeline (classification, routing, workflow trigger).",
            "Per-mailbox project and retention defaults are enforced.",
        ],
        "elo": [
            "ELO Mailbox requires Outlook add-in and per-user licensing; Apex is server-side, zero-touch.",
        ],
    },
    {
        "num": "2.8",
        "name": "SAP Integration (P2P, M2C, ArchiveLink)",
        "what": "Clean-Core bridge: Apex attaches, links and automates around SAP without writing to SAP core tables.",
        "how": [
            "SapMockController emulates SAP S/4HANA (9 endpoints: POs, invoices, assets, ArchiveLink).",
            "SapIntegrationService runs PDF → regex extract → 3-way match → auto-park or dispute workflow.",
            "ArchiveLink emulation keeps links in sap_object_links keyed by (ar_object, object_key).",
            "Swap mock for real SAP OData by changing SAP_BASE_URL; UI / workflows unchanged.",
        ],
        "elo": [
            "ELO for SAP requires SAP-certified connector, Z-tables, and consulting engagements.",
            "Apex keeps SAP core pristine (Clean-Core) — a major SAP Rise/Grow selling point.",
            "3-way match + auto-park + dispute workflow all included; in ELO these are three add-ons.",
        ],
    },
    {
        "num": "2.9",
        "name": "Blockchain Notarization",
        "what": "Tamper-evident ledger of document events. Each row hash-chains to the previous, providing cryptographic immutability without external blockchain fees.",
        "how": [
            "Every document mutation writes to notarization_ledger with SHA-256(prev_hash ∥ payload).",
            "NotarizationBadge in UI shows chain-valid / broken-chain.",
            "Verification endpoint re-walks the chain on demand.",
            "Optional anchoring to public chains (Ethereum / Polygon) as a roadmap item.",
        ],
        "elo": [
            "ELO provides WORM storage; Apex adds cryptographic provenance on top (different, stronger guarantee).",
            "No external blockchain means zero gas fees and full air-gap compatibility.",
        ],
    },
    {
        "num": "2.10",
        "name": "Workflow Health Dashboard",
        "what": "Heatmap + metrics showing where processes stall, who is overloaded, and which steps are the biggest bottleneck.",
        "how": [
            "Ingests every workflow transition with timestamp + assignee.",
            "Computes median/percentile dwell time per step.",
            "Bottleneck heatmap uses per-step cycle time vs. SLA.",
            "Drill-down to the specific task, assignee, and documents stuck.",
        ],
        "elo": [
            "Equivalent insight requires ELO Analytics + consulting dashboards.",
            "Apex ships this as a first-class page — operational transparency out of the box.",
        ],
    },
    {
        "num": "2.11",
        "name": "Knowledge Graph",
        "what": "Living graph of people, projects, documents, workflows, entities — navigable visually.",
        "how": [
            "Entities extracted from documents (people, orgs, dates, monetary amounts) via LLM.",
            "Edges derived from workflow participation, authorship, cross-references.",
            "D3-based force-directed UI at /knowledge-graph.",
        ],
        "elo": [
            "ELO has no equivalent. Apex's graph becomes the \"map of the business\".",
        ],
    },
    {
        "num": "2.12",
        "name": "Compliance, Jurisdiction & Trust Center",
        "what": "Per-document jurisdiction tagging (GDPR, HIPAA, POPIA, Zimbabwe Data Protection Act), immutable audit log, Trust Center UI for auditors.",
        "how": [
            "Every mutation audit-logged with user, IP, timestamp, before/after hash.",
            "Jurisdiction engine maps (content type × location) → applicable regulations.",
            "Trust Center exposes signed attestations: \"what our system does with PII\".",
        ],
        "elo": [
            "ELO ships GDPR add-on; Apex bakes multi-jurisdiction in.",
            "Trust Center is a differentiator for regulated-industry sales (utilities, banks).",
        ],
    },
    {
        "num": "2.13",
        "name": "Industry Templates & Marketplace",
        "what": "One-click installation of vertical starter packs (Utility Billing, Legal, HR, Finance, Healthcare).",
        "how": [
            "Each template = (projects, folder trees, retention policies, workflow templates, classifier vocab).",
            "Marketplace service lists plugins and templates; apps page manages install/upgrade.",
        ],
        "elo": [
            "ELO has industry packages sold by partners; Apex treats them as downloadable templates.",
        ],
    },
    {
        "num": "2.14",
        "name": "Notifications, Presence, Collaboration",
        "what": "Websocket-backed real-time presence (who is viewing this doc), in-app toasts, email notifications.",
        "how": [
            "Notification service fans out across channels.",
            "Presence via /ws/* STOMP topics.",
            "Co-editing handled by OnlyOffice/WOPI.",
        ],
        "elo": [
            "ELO has basic notifications; Apex's presence layer is modern-SaaS-grade.",
        ],
    },
    {
        "num": "2.15",
        "name": "Agentic AI (beta)",
        "what": "Autonomous agents that complete tasks end-to-end (summarise contract, find overdue invoices, propose retention disposition).",
        "how": [
            "apex-ai service exposes /agentic endpoints.",
            "Tool-calling LLM orchestrates document retrieval, workflow creation, notifications.",
            "Human-in-the-loop approval before any mutation.",
        ],
        "elo": [
            "ELO is adding AI Assistant; Apex's agentic layer is deeper (tool-use, multi-step reasoning) and runs on-prem.",
        ],
    },
]

for cap in caps:
    H(f"{cap['num']}  {cap['name']}", 2)
    P("What it does", bold=True)
    P(cap["what"])
    P("How it works", bold=True)
    for step in cap["how"]:
        bullet(step)
    P("Why it beats ELO", bold=True)
    for adv in cap["elo"]:
        bullet(adv)
    doc.add_paragraph()

# ─────────────────────────────── 3. SIDE-BY-SIDE
doc.add_page_break()
H("3. Apex Nexus vs. ELO — Side-by-Side", 1)
table(
    rows=[
        ["On-prem LLM classification", "Built-in (Ollama)", "Requires ELO iSearch Plus + consulting"],
        ["Auto-routing + workflow trigger", "Default", "ELO Flows add-on"],
        ["SAP Clean-Core integration", "Built-in, swappable mock", "Certified connector + Z-tables"],
        ["Blockchain notarization", "Built-in", "Not offered"],
        ["Knowledge Graph", "Built-in", "Not offered"],
        ["Workflow Health Analytics", "Built-in", "ELO Analytics add-on"],
        ["Agentic AI", "Built-in (tool-calling)", "Assistant only, roadmap"],
        ["Per-document jurisdiction", "Built-in", "GDPR pack"],
        ["OnlyOffice co-editing", "Built-in", "Office Add-In module"],
        ["Open formats (S3, SHA-256, JSON)", "Yes", "Proprietary repository"],
        ["Deployment footprint", "docker-compose / k8s", "Windows-centric + DB cluster"],
        ["Licensing", "Flat per-tenant", "Per named user + modules"],
    ],
    headers=["Capability", "Apex Nexus", "ELO ECM"],
)

# ─────────────────────────────── 4. IMPROVEMENT ROADMAP
doc.add_page_break()
H("4. Where We Can Improve", 1)

improvements = [
    ("OCR & IDP", [
        "Today: text is extracted, but OCR on scanned PDFs is basic (Tesseract-level).",
        "Gap: Intelligent Document Processing with table/region extraction, form recognizers.",
        "Next: integrate an optional Azure Form Recognizer / AWS Textract adapter; keep the on-prem LLM fallback.",
    ]),
    ("LLM capacity", [
        "Today: llama3.2:1b — fast, small, good for classification.",
        "Gap: nuanced summarisation and multi-document reasoning need larger models.",
        "Next: pluggable model tier (1b local, 8b GPU host, or bring-your-own-GPT via Azure OpenAI).",
    ]),
    ("Real SAP connector", [
        "Today: mock SapMockController covering 9 endpoints.",
        "Gap: production SAP OData v4 + ArchiveLink HTTP content server.",
        "Next: SapOdataConnector adapter with OAuth2; secrets in Key Vault; reconciliation job.",
    ]),
    ("High availability", [
        "Today: single-node Postgres, single MinIO.",
        "Gap: no built-in HA for production utility customers.",
        "Next: Patroni/Postgres cluster; MinIO distributed; active-active gateways behind a LB.",
    ]),
    ("Mobile", [
        "Today: responsive web app.",
        "Gap: no offline-first mobile for field engineers (meter reading, photos).",
        "Next: React Native shell reusing the same /intake + /sap APIs.",
    ]),
    ("Content AI depth", [
        "Today: classification + basic RAG.",
        "Gap: clause extraction, contract comparison, redline generation.",
        "Next: fine-tune for legal clauses; integrate DocAssist workflow.",
    ]),
    ("External signing", [
        "Today: internal e-signature flow via workflow approval.",
        "Gap: no native DocuSign / Adobe Sign integration.",
        "Next: plug-in signing connectors with callback for workflow completion.",
    ]),
    ("Observability", [
        "Today: Spring Actuator + application logs.",
        "Gap: no unified trace/metrics dashboard in-product.",
        "Next: OpenTelemetry traces → Grafana Tempo; per-workflow SLA burn alerts.",
    ]),
    ("Multi-tenancy", [
        "Today: single-tenant deployment.",
        "Gap: SaaS tenants share infra would need row-level isolation and per-tenant KMS.",
        "Next: tenant_id propagation through every service; pgcrypto column-level encryption with tenant keys.",
    ]),
    ("Data residency & encryption", [
        "Today: storage encrypted in MinIO; Postgres at rest via disk.",
        "Gap: client-side encryption / BYO-Key for highly regulated industries.",
        "Next: optional envelope encryption using tenant KMS (Azure Key Vault / HashiCorp Vault).",
    ]),
    ("Marketplace economics", [
        "Today: marketplace UI exists but few third-party plugins.",
        "Gap: no revenue-share mechanism for ISV partners.",
        "Next: signed plugin manifests + billing integration for paid extensions.",
    ]),
    ("Blockchain anchoring", [
        "Today: internal hash chain only.",
        "Gap: external anchoring for court-grade evidence.",
        "Next: periodic Merkle-root anchoring to Polygon/Ethereum (opt-in).",
    ]),
    ("Accessibility (WCAG AA)", [
        "Today: decent contrast, keyboard support.",
        "Gap: formal WCAG 2.1 AA audit not yet run.",
        "Next: commit to annual axe-core CI checks; address any screen-reader gaps.",
    ]),
    ("Internationalisation", [
        "Today: English UI.",
        "Gap: no i18n for regional deployments (Shona, Afrikaans, French for francophone Africa).",
        "Next: next-intl integration + translator workflow tied to Apex's own content pipeline.",
    ]),
]
for title_, items in improvements:
    H(title_, 2)
    for it in items:
        bullet(it)

# ─────────────────────────────── 5. CLOSING
doc.add_page_break()
H("5. Closing — Why This Wins", 1)
P(
    "Against ELO, our core thesis is: AI-native, open-format, microservice-based, cloud-ready, "
    "with SAP Clean-Core discipline. ELO's strengths — long history, SAP certification, broad "
    "partner network — are offset by proprietary architecture, module-heavy licensing, and a "
    "slower pace of AI innovation."
)
P(
    "For a utility like ZETDC, Apex Nexus offers the same ECM fundamentals ELO offers, "
    "plus a real P2P auto-park flow, a Meter-to-Cash asset-linking story, a knowledge graph "
    "that makes ops visible, and a migration path that keeps SAP's core clean."
)
P(
    "The improvement roadmap above is intentional: we ship the demo-critical 80 % today "
    "and have a clear path for the remaining 20 % — OCR depth, HA, mobile, deeper AI, "
    "real SAP, and external anchoring — as paid-tier features."
)

out = r"C:\Users\User\apex-nexus\docs\Apex_Nexus_Capability_Reference.docx"
doc.save(out)
print("Wrote", out)
