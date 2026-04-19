"use client";

import { useEffect, useState } from "react";
import { sapApi } from "@/lib/api";
import {
  Server,
  Package,
  Wrench,
  Link2,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Boxes,
  Receipt,
  Building2,
  Tag,
  Database,
  AlertCircle,
  PlayCircle,
} from "lucide-react";

type Tab = "summary" | "p2p" | "m2c" | "archivelink";

export default function SapPage() {
  const [tab, setTab] = useState<Tab>("summary");

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Header />
      <Tabs tab={tab} setTab={setTab} />
      <div className="mt-6">
        {tab === "summary" && <SummaryTab />}
        {tab === "p2p" && <P2PTab />}
        {tab === "m2c" && <M2CTab />}
        {tab === "archivelink" && <ArchiveLinkTab />}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-blue-500/30">
        <Server className="w-6 h-6 text-blue-400" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">SAP Integration</h1>
        <p className="text-sm text-zinc-400">
          Apex Nexus as the <span className="text-zinc-200">System of Engagement</span> — SAP stays the{" "}
          <span className="text-zinc-200">System of Record</span>. Procure-to-Pay, Meter-to-Cash and ArchiveLink all in
          one place.
          <span className="ml-2 italic text-zinc-500">Demo mode: Mock-S4H backend. Endpoint-compatible with real SAP OData.</span>
        </p>
      </div>
    </div>
  );
}

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: Array<{ key: Tab; label: string; icon: any }> = [
    { key: "summary", label: "Overview", icon: Database },
    { key: "p2p", label: "Procure-to-Pay", icon: Receipt },
    { key: "m2c", label: "Asset / Meter-to-Cash", icon: Wrench },
    { key: "archivelink", label: "ArchiveLink Viewer", icon: Link2 },
  ];
  return (
    <div className="flex gap-1 border-b border-zinc-800">
      {items.map((i) => {
        const Icon = i.icon;
        const active = tab === i.key;
        return (
          <button
            key={i.key}
            onClick={() => setTab(i.key)}
            className={`px-4 py-2 text-sm flex items-center gap-2 border-b-2 transition ${
              active
                ? "border-blue-400 text-zinc-100"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Icon className="w-4 h-4" />
            {i.label}
          </button>
        );
      })}
    </div>
  );
}

/* ────────────── SUMMARY ────────────── */

function SummaryTab() {
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    sapApi.summary().then((r: any) => setS(r.data?.data)).finally(() => setLoading(false));
  }, []);
  if (loading) return <Loader />;
  if (!s) return <div className="text-zinc-400 text-sm">No data.</div>;
  const cards = [
    { label: "Open Purchase Orders", value: s.openPOs, icon: Package, color: "text-blue-400" },
    { label: "Invoices Submitted", value: s.totalInvoices, icon: Receipt, color: "text-emerald-400" },
    { label: "Parked / Posted", value: s.parkedInvoices, icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Disputed", value: s.disputedInvoices, icon: AlertCircle, color: "text-amber-400" },
    { label: "Assets Tracked", value: s.assetsTracked, icon: Boxes, color: "text-purple-400" },
    { label: "Docs Linked to SAP", value: s.linkedDocuments, icon: Link2, color: "text-pink-400" },
  ];
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">{c.label}</span>
                <Icon className={`w-4 h-4 ${c.color}`} />
              </div>
              <div className="mt-2 text-2xl font-bold text-zinc-100">{c.value}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-zinc-300">
        <div className="font-semibold text-zinc-100 mb-1 flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-400" /> How it works
        </div>
        <ul className="list-disc list-inside space-y-1 text-zinc-400">
          <li>Procure-to-Pay: upload an invoice PDF → AI extracts PO # / amount / vendor → 3-way match vs SAP PO →
            automatic parking in SAP (BUS2081) via ArchiveLink, or a dispute workflow.</li>
          <li>Meter-to-Cash / Asset: field photos / inspection reports linked to SAP Equipment Records (EQUI). From
            inside SAP Fiori the attachments appear natively.</li>
          <li>Clean Core: nothing is written into SAP's database. We attach, we link — SAP stays pristine.</li>
        </ul>
      </div>
    </div>
  );
}

/* ────────────── P2P ────────────── */

function P2PTab() {
  const [pos, setPos] = useState<any[]>([]);
  const [docId, setDocId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);

  const reload = () => {
    sapApi.purchaseOrders().then((r: any) => setPos(r.data?.data || []));
    sapApi.invoices().then((r: any) => setInvoices(r.data?.data || []));
  };
  useEffect(reload, []);

  const process = async () => {
    if (!docId) return;
    setLoading(true);
    setResult(null);
    try {
      const r: any = await sapApi.processInvoice(docId.trim());
      setResult(r.data?.data);
      reload();
    } catch (e: any) {
      setResult({ error: e.response?.data?.message || e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-400" /> Open Purchase Orders in SAP
        </h3>
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900/60 text-zinc-400">
              <tr>
                <th className="text-left p-2">PO #</th>
                <th className="text-left p-2">Vendor</th>
                <th className="text-right p-2">Amount</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((p) => (
                <tr key={p.po_number} className="border-t border-zinc-800">
                  <td className="p-2 font-mono text-zinc-200">{p.po_number}</td>
                  <td className="p-2 text-zinc-300">{p.vendor_name}</td>
                  <td className="p-2 text-right text-zinc-300">{Number(p.amount).toLocaleString()}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        p.status === "OPEN"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-zinc-700 text-zinc-300"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {pos.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-zinc-500">No POs</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <h3 className="text-sm font-semibold text-zinc-200 mt-6 mb-2 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-400" /> Invoice Ledger
        </h3>
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900/60 text-zinc-400">
              <tr>
                <th className="text-left p-2">SAP Invoice</th>
                <th className="text-left p-2">PO #</th>
                <th className="text-right p-2">Amount</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.invoice_id} className="border-t border-zinc-800">
                  <td className="p-2 font-mono text-zinc-200">{i.invoice_id}</td>
                  <td className="p-2 font-mono text-zinc-300">{i.po_number}</td>
                  <td className="p-2 text-right text-zinc-300">{Number(i.amount).toLocaleString()}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        i.status === "PARKED" || i.status === "POSTED"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : i.status === "DISPUTED"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-zinc-700 text-zinc-300"
                      }`}
                    >
                      {i.status}
                    </span>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-zinc-500">No invoices yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-emerald-400" /> Process an Invoice Document
        </h3>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <p className="text-xs text-zinc-400">
            Paste an Apex document ID (an invoice PDF you already captured via Intake). The system will extract the PO
            number, run the 3-way match against SAP, and auto-park or dispute.
          </p>
          <input
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            placeholder="Document UUID"
            className="w-full rounded bg-zinc-950 border border-zinc-700 px-3 py-2 text-xs font-mono text-zinc-200"
          />
          <button
            onClick={process}
            disabled={loading || !docId}
            className="px-4 py-2 rounded bg-gradient-to-r from-blue-500 to-emerald-500 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            Run P2P Match
          </button>
          {result && (
            <div className="rounded border border-zinc-700 bg-zinc-950 p-3 text-xs">
              {result.error ? (
                <div className="text-red-400 flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> {result.error}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    {result.status === "PARKED_IN_SAP" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="font-semibold text-zinc-100">{result.status}</span>
                    <span className="text-zinc-500">·</span>
                    <span className="text-zinc-400">{result.action}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-zinc-300">
                    <Field label="Extracted PO">{result.extracted?.poNumber || "—"}</Field>
                    <Field label="Extracted Amount">{result.extracted?.amount ?? "—"}</Field>
                    <Field label="Extracted Vendor">{result.extracted?.vendor || "—"}</Field>
                    <Field label="Match">
                      {result.sapMatch?.matched ? "YES" : "NO"}
                      {result.sapMatch?.reason ? ` (${result.sapMatch.reason})` : ""}
                    </Field>
                    {result.sapInvoice?.sapInvoiceId && (
                      <Field label="SAP Invoice ID">
                        <span className="font-mono">{result.sapInvoice.sapInvoiceId}</span>
                      </Field>
                    )}
                    {result.workflowId && (
                      <Field label="Workflow">{result.workflowId}</Field>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="mt-4 rounded border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-zinc-300">
          <div className="font-semibold text-zinc-100 mb-1">Try it with a sample invoice</div>
          Upload a PDF/TXT on the <span className="text-emerald-300">Intake</span> page containing lines like:
          <pre className="mt-1 text-[11px] bg-zinc-950 p-2 rounded text-zinc-300">{`From: Acme Power Systems Ltd
Purchase Order: 4500012001
Total Due: 42,500.00`}</pre>
          Then paste the resulting document ID here.
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-zinc-500 tracking-wide">{label}</div>
      <div>{children}</div>
    </div>
  );
}

/* ────────────── M2C ────────────── */

function M2CTab() {
  const [assets, setAssets] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [docId, setDocId] = useState("");
  const [linkType, setLinkType] = useState("ATTACHMENT");
  const [status, setStatus] = useState<string>("");

  const reload = () => sapApi.assets().then((r: any) => setAssets(r.data?.data || []));
  useEffect(reload, []);

  const open = async (eid: string) => {
    const r: any = await sapApi.asset(eid);
    setSelected(r.data?.data);
  };

  const link = async () => {
    if (!selected || !docId) return;
    setStatus("linking");
    try {
      await sapApi.linkAsset(selected.equipment_id, docId.trim(), linkType);
      setStatus("linked");
      open(selected.equipment_id);
      setDocId("");
    } catch (e: any) {
      setStatus("error: " + (e.response?.data?.message || e.message));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
          <Boxes className="w-4 h-4 text-purple-400" /> SAP Equipment Records
        </h3>
        <div className="space-y-2">
          {assets.map((a) => (
            <button
              key={a.equipment_id}
              onClick={() => open(a.equipment_id)}
              className={`w-full text-left rounded-lg border p-3 transition ${
                selected?.equipment_id === a.equipment_id
                  ? "border-purple-500/60 bg-purple-500/10"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-mono text-sm text-zinc-100">{a.equipment_id}</div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{a.asset_type}</span>
              </div>
              <div className="text-xs text-zinc-300 mt-0.5">{a.name}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-2">
                <Building2 className="w-3 h-3" /> {a.site} · {a.functional_location}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-pink-400" /> Link Document to Equipment
        </h3>
        {!selected ? (
          <div className="text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-lg p-6 text-center">
            Pick an equipment record on the left.
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-purple-400" />
              <div className="text-sm text-zinc-100 font-semibold">{selected.equipment_id}</div>
              <div className="text-xs text-zinc-400">· {selected.name}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <Field label="Functional Location">{selected.functional_location}</Field>
              <Field label="Site">{selected.site}</Field>
              <Field label="Asset Type">{selected.asset_type}</Field>
              <Field label="Status">{selected.status}</Field>
            </div>

            <div className="space-y-2 mb-3">
              <input
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                placeholder="Document UUID to attach"
                className="w-full rounded bg-zinc-950 border border-zinc-700 px-3 py-2 text-xs font-mono text-zinc-200"
              />
              <div className="flex items-center gap-2">
                <select
                  title="Link type"
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value)}
                  className="rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200"
                >
                  <option value="ATTACHMENT">ATTACHMENT</option>
                  <option value="ORIGINAL">ORIGINAL</option>
                  <option value="RENDITION">RENDITION</option>
                </select>
                <button
                  onClick={link}
                  disabled={!docId}
                  className="px-3 py-1.5 rounded bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  <Link2 className="w-3.5 h-3.5" /> Link via ArchiveLink (EQUI)
                </button>
              </div>
              {status && <div className="text-[11px] text-zinc-400">{status}</div>}
            </div>

            <div className="text-[11px] uppercase text-zinc-500 tracking-wide mb-1">
              Linked Documents ({selected.attachments?.length || 0})
            </div>
            <div className="space-y-1">
              {(selected.attachments || []).map((att: any) => (
                <div key={att.id} className="rounded border border-zinc-800 bg-zinc-950 p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-zinc-200">{att.title}</span>
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 rounded">{att.link_type}</span>
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 rounded">{att.document_class}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">{att.document_id}</div>
                </div>
              ))}
              {(!selected.attachments || selected.attachments.length === 0) && (
                <div className="text-xs text-zinc-500 italic">No documents linked yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────── ARCHIVELINK ────────────── */

function ArchiveLinkTab() {
  const [arObject, setArObject] = useState("BUS2081");
  const [objectKey, setObjectKey] = useState("");
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const query = async () => {
    if (!objectKey) return;
    setLoading(true);
    try {
      const r: any = await sapApi.transactionDocuments(arObject, objectKey);
      setDocs(r.data?.data || []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 mb-4">
        <div className="text-xs text-zinc-400 mb-3">
          This is what SAP sees when a user opens the transaction. Documents linked via Apex appear in SAP's
          attachment list natively — no custom UI inside SAP needed.
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <div className="text-[10px] uppercase text-zinc-500 tracking-wide mb-1">BOR Object</div>
            <select
              title="SAP BOR object"
              value={arObject}
              onChange={(e) => setArObject(e.target.value)}
              className="rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200"
            >
              <option value="BUS2081">BUS2081 (FI Invoice)</option>
              <option value="EQUI">EQUI (Equipment)</option>
              <option value="IFLOT">IFLOT (Functional Location)</option>
              <option value="BKPF">BKPF (Accounting Doc)</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-[10px] uppercase text-zinc-500 tracking-wide mb-1">Object Key</div>
            <input
              value={objectKey}
              onChange={(e) => setObjectKey(e.target.value)}
              placeholder="e.g. 5105681502 or EQ-10000042"
              className="w-full rounded bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-xs font-mono text-zinc-200"
            />
          </div>
          <button
            onClick={query}
            disabled={!objectKey || loading}
            className="px-4 py-1.5 rounded bg-blue-500 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Query SAP ArchiveLink
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900/60 text-zinc-400">
            <tr>
              <th className="text-left p-2">Link ID</th>
              <th className="text-left p-2">Document</th>
              <th className="text-left p-2">Link Type</th>
              <th className="text-left p-2">Class</th>
              <th className="text-left p-2">Linked At</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.link_id} className="border-t border-zinc-800">
                <td className="p-2 font-mono text-zinc-400">{String(d.link_id).slice(0, 8)}…</td>
                <td className="p-2 text-zinc-200">{d.title}</td>
                <td className="p-2">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">{d.link_type}</span>
                </td>
                <td className="p-2 text-zinc-300">{d.document_class}</td>
                <td className="p-2 text-zinc-400">{new Date(d.linked_at).toLocaleString()}</td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center text-zinc-500">No documents linked.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center gap-2 text-zinc-400 text-sm py-6">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading...
    </div>
  );
}
