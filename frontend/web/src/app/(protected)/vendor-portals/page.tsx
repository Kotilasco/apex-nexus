"use client";

import { useEffect, useState, useCallback } from "react";
import { vendorPortalApi, projectApi } from "@/lib/api";
import {
  Building2,
  Plus,
  Copy,
  ExternalLink,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Ban,
} from "lucide-react";

type Portal = {
  id: string;
  vendor_code: string;
  vendor_name: string;
  contact_email?: string;
  project_id?: string;
  project_name?: string;
  access_token: string;
  status: string;
  expires_at: string;
  upload_count: number;
  quarantine_count: number;
};

export default function VendorPortalsPage() {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    const [s, l] = await Promise.all([vendorPortalApi.summary(), vendorPortalApi.list()]);
    setSummary(s.data.data);
    setPortals(l.data.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    projectApi.list().then((r: any) => {
      const items = r.data?.data || r.data || [];
      setProjects(Array.isArray(items) ? items.map((p: any) => ({ id: p.id, name: p.name })) : []);
    });
  }, [load]);

  const openPortal = async (id: string) => {
    const r: any = await vendorPortalApi.get(id);
    setSelected(r.data.data);
  };

  const review = async (uploadId: string, action: "approve" | "reject") => {
    const notes = prompt(`${action} notes (optional):`) || undefined;
    if (action === "approve") await vendorPortalApi.approve(uploadId, notes);
    else await vendorPortalApi.reject(uploadId, notes);
    if (selected) openPortal(selected.id);
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this portal? The vendor will lose access immediately.")) return;
    await vendorPortalApi.revoke(id);
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-indigo-600" /> Vendor Portals
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Secured data rooms for your suppliers. Every upload is scanned for PII and compliance risk
            <strong className="text-slate-900"> before</strong> it enters your corpus.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> New Portal
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-5 gap-3">
          <Stat label="Active portals" value={summary.active_portals} />
          <Stat label="Distinct vendors" value={summary.distinct_vendors} />
          <Stat label="Total uploads" value={summary.total_uploads} />
          <Stat label="Quarantined" value={summary.quarantined} tone="amber" />
          <Stat label="Approved" value={summary.approved} tone="emerald" />
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-2">
          {portals.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-600/40 transition"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <Building2 className="h-5 w-5 text-indigo-600" />
                <span className="font-medium">{p.vendor_name}</span>
                <span className="text-xs text-slate-500">· {p.vendor_code}</span>
                <StatusPill status={p.status} />
                {p.quarantine_count > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                    <AlertTriangle className="inline h-3 w-3 mr-1" />
                    {p.quarantine_count} quarantined
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  {p.upload_count} uploads
                </span>
                {p.project_name && (
                  <span className="text-xs text-slate-500">→ {p.project_name}</span>
                )}
                <span className="text-xs text-slate-500">
                  expires {new Date(p.expires_at).toLocaleDateString()}
                </span>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/v/${p.access_token}`;
                      navigator.clipboard.writeText(url);
                      alert("Portal URL copied to clipboard:\n" + url);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </button>
                  <button
                    onClick={() => openPortal(p.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-md bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    <FileText className="h-3.5 w-3.5" /> Uploads
                  </button>
                  {p.status === "ACTIVE" && (
                    <button
                      onClick={() => revoke(p.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                    >
                      <Ban className="h-3.5 w-3.5" /> Revoke
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {portals.length === 0 && (
            <div className="text-center py-10 text-slate-500">No portals yet.</div>
          )}
        </div>
      )}

      {showNew && <NewPortalModal projects={projects} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
      {selected && (
        <UploadsModal
          portal={selected}
          onClose={() => setSelected(null)}
          onReview={review}
          onCompliance={() => openPortal(selected.id)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" | "emerald" }) {
  const color = tone === "amber" ? "text-amber-700" : tone === "emerald" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value ?? 0}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    status === "REVOKED" ? "bg-red-50 text-red-700 border-red-200" :
    "bg-slate-100 text-slate-700 border-slate-200";
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${color}`}>{status}</span>;
}

function NewPortalModal({ projects, onClose, onCreated }: any) {
  const [f, setF] = useState<any>({
    vendorCode: "",
    vendorName: "",
    contactEmail: "",
    projectId: "",
    requiredDocs: "Insurance Certificate, Tax Clearance, BEE Certificate, Signed Contract",
    expiryDays: 30,
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const submit = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r: any = await vendorPortalApi.create({
        vendorCode: f.vendorCode,
        vendorName: f.vendorName,
        contactEmail: f.contactEmail || undefined,
        projectId: f.projectId || undefined,
        requiredDocs: f.requiredDocs.split(",").map((s: string) => s.trim()).filter(Boolean),
        expiryDays: Number(f.expiryDays),
      });
      setResult(r.data.data);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-lg p-6 w-full max-w-lg">
        {result ? (
          <>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Portal created
            </h2>
            <p className="text-sm text-slate-500 mb-3">Share this secure link with {result.vendorName}:</p>
            <div className="bg-white border border-slate-200 rounded p-3 font-mono text-xs break-all">
              {window.location.origin}{result.portalUrl}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.origin + result.portalUrl);
                alert("Copied");
              }}
              className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-slate-100 border border-slate-300"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
            <div className="flex justify-end mt-6">
              <button onClick={onCreated} className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm">Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <h2 className="text-lg font-bold">New Vendor Portal</h2>
            <Field label="Vendor Code" value={f.vendorCode} onChange={(v) => setF({ ...f, vendorCode: v })} required />
            <Field label="Vendor Name" value={f.vendorName} onChange={(v) => setF({ ...f, vendorName: v })} required />
            <Field label="Contact Email" value={f.contactEmail} onChange={(v) => setF({ ...f, contactEmail: v })} type="email" />
            <div>
              <label className="text-xs text-slate-500">Pin to Project</label>
              <select
                value={f.projectId}
                onChange={(e) => setF({ ...f, projectId: e.target.value })}
                title="Pin to project"
                className="w-full mt-1 px-3 py-2 rounded-md bg-white border border-slate-200 text-sm"
              >
                <option value="">— None —</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <Field label="Required Documents (comma separated)" value={f.requiredDocs} onChange={(v) => setF({ ...f, requiredDocs: v })} />
            <Field label="Expiry (days)" value={f.expiryDays} onChange={(v) => setF({ ...f, expiryDays: v })} type="number" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-slate-100 text-sm">Cancel</button>
              <button type="submit" disabled={busy} className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm disabled:opacity-50">
                {busy ? "Creating…" : "Create Portal"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: any) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        title={label}
        placeholder={label}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 rounded-md bg-white border border-slate-200 text-sm"
      />
    </div>
  );
}

function UploadsModal({ portal, onClose, onReview, onCompliance }: any) {
  const compliance = portal.complianceDocs || [];
  const access = portal.accessLog || [];
  const [showAdd, setShowAdd] = useState(false);
  const cs = portal.compliance_status || "UNKNOWN";
  const csColor = cs === "COMPLIANT" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    cs === "EXPIRING" ? "bg-amber-50 text-amber-700 border-amber-200" :
    cs === "NON_COMPLIANT" ? "bg-red-50 text-red-700 border-red-200" :
    "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-lg p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" /> {portal.vendor_name}
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${csColor}`}>{cs}</span>
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">×</button>
        </div>
        {portal.blocked_reason && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="inline h-4 w-4 mr-1" />
            <strong>Auto-block:</strong> {portal.blocked_reason}. New uploads from this vendor will be rejected until resolved.
          </div>
        )}

        {/* Compliance / eligibility documents */}
        <div className="mb-5 border border-slate-200 rounded-md">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2 border-b border-slate-200">
            <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-600" /> Eligibility documents ({compliance.length})
            </div>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="text-xs px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white inline-flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Register
            </button>
          </div>
          {showAdd && (
            <AddComplianceForm
              portalId={portal.id}
              onClose={() => setShowAdd(false)}
              onAdded={onCompliance}
            />
          )}
          {compliance.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-4">No eligibility documents registered yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {compliance.map((d: any) => {
                const tone = d.status === "VALID" ? "text-emerald-700" :
                  d.status === "EXPIRING_SOON" ? "text-amber-700" :
                  d.status === "EXPIRED" ? "text-red-700" : "text-slate-700";
                return (
                  <div key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="font-mono text-xs px-2 py-0.5 rounded-full border bg-slate-100 text-slate-700 border-slate-200">
                      {d.doc_type}
                    </span>
                    <span className="text-slate-900">{d.label || "—"}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      expires {d.expires_on ? new Date(d.expires_on).toLocaleDateString() : "—"}
                    </span>
                    <span className={`text-xs font-medium ${tone}`}>{d.status}</span>
                    <button
                      onClick={async () => {
                        if (!confirm("Remove this eligibility document?")) return;
                        await vendorPortalApi.removeComplianceDoc(d.id);
                        await onCompliance();
                      }}
                      className="p-1 rounded-md text-red-600 hover:bg-red-50"
                      title="Remove"
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Uploads */}
        <div className="text-sm font-medium text-slate-900 mb-2">Uploads ({(portal.uploads || []).length})</div>
        {(portal.uploads || []).length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">No uploads yet.</div>
        ) : (
          <div className="space-y-2">
            {portal.uploads.map((u: any) => {
              const hasPii = u.pii_findings && Object.keys(u.pii_findings).length > 0;
              const hasCompliance = u.compliance_findings && u.compliance_findings.length > 0;
              return (
                <div key={u.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <span className="font-medium">{u.filename || u.document_title}</span>
                    <StatusPill status={u.status} />
                    {u.classification && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-cyan-50 text-cyan-700 border-cyan-200">
                        {u.classification}
                      </span>
                    )}
                    {hasPii && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                        <Shield className="inline h-3 w-3 mr-1" /> PII
                      </span>
                    )}
                    {hasCompliance && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
                        <AlertTriangle className="inline h-3 w-3 mr-1" /> Compliance
                      </span>
                    )}
                    <span className="text-xs text-slate-500 ml-auto">
                      {new Date(u.uploaded_at).toLocaleString()}
                    </span>
                  </div>
                  {(hasPii || hasCompliance) && (
                    <div className="mt-2 text-xs text-slate-500 space-y-1">
                      {hasPii && (
                        <div>PII: {Object.entries(u.pii_findings).map(([k, v]: any) => `${k}=${v}`).join(", ")}</div>
                      )}
                      {hasCompliance && (
                        <div>Compliance: {u.compliance_findings.join(", ")}</div>
                      )}
                    </div>
                  )}
                  {u.status === "QUARANTINED" || u.status === "RECEIVED" ? (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => onReview(u.id, "approve")}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </button>
                      <button
                        onClick={() => onReview(u.id, "reject")}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-red-700 hover:bg-red-600 text-white"
                      >
                        <XCircle className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {/* Access log */}
        {access.length > 0 && (
          <div className="mt-5 border border-slate-200 rounded-md">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-sm font-medium text-slate-900">
              Recent access ({access.length})
            </div>
            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {access.map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <span className="font-mono px-2 py-0.5 rounded border bg-white border-slate-200 text-slate-700">{a.action}</span>
                  <span className="text-slate-500 font-mono">{a.remote_ip || "—"}</span>
                  <span className="text-slate-600 truncate flex-1" title={a.watermark || ""}>{a.watermark || ""}</span>
                  <span className="text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const COMPLIANCE_TYPES = [
  "TAX_CLEARANCE", "PRAZ", "BEE", "ISO_9001", "ISO_27001",
  "INSURANCE", "COMPANY_REGISTRATION", "VAT", "OTHER",
];

function AddComplianceForm({ portalId, onClose, onAdded }: { portalId: string; onClose: () => void; onAdded: () => void | Promise<void>; }) {
  const [f, setF] = useState({
    docType: "TAX_CLEARANCE",
    label: "",
    expiresOn: "",
    validFrom: "",
  });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.expiresOn) return;
    setBusy(true);
    try {
      await vendorPortalApi.addComplianceDoc(portalId, {
        docType: f.docType,
        label: f.label || undefined,
        expiresOn: f.expiresOn,
        validFrom: f.validFrom || undefined,
      });
      await onAdded();
      onClose();
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-4 gap-2 items-end">
      <div>
        <label className="text-xs text-slate-500">Type</label>
        <select
          value={f.docType}
          onChange={(e) => setF({ ...f, docType: e.target.value })}
          title="Document type"
          className="w-full mt-1 px-2 py-1.5 rounded-md bg-white border border-slate-300 text-sm"
        >
          {COMPLIANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500">Label</label>
        <input
          value={f.label}
          onChange={(e) => setF({ ...f, label: e.target.value })}
          placeholder="Tax Clearance 2026"
          className="w-full mt-1 px-2 py-1.5 rounded-md bg-white border border-slate-300 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500">Expires on</label>
        <input
          type="date"
          title="Expires on"
          value={f.expiresOn}
          onChange={(e) => setF({ ...f, expiresOn: e.target.value })}
          required
          className="w-full mt-1 px-2 py-1.5 rounded-md bg-white border border-slate-300 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs disabled:opacity-50">
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200 text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}
