"use client";

import { useEffect, useState } from "react";
import { federatedApi } from "@/lib/api";
import {
  Telescope,
  Search,
  Mail,
  FolderOpen,
  Database,
  Archive,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Building,
  Settings,
  Plus,
  Trash2,
  Power,
  PowerOff,
  X,
} from "lucide-react";

const TYPE_META: Record<string, { label: string; color: string; icon: any }> = {
  EXCHANGE:      { label: "Outlook / Exchange", color: "text-blue-700 bg-blue-50 border-blue-200",   icon: Mail },  GMAIL:         { label: "Gmail",              color: "text-red-700 bg-red-50 border-red-200",       icon: Mail },  SHAREPOINT:    { label: "SharePoint",         color: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30", icon: FolderOpen },
  NETWORK_SHARE: { label: "Network Share",      color: "text-amber-700 bg-amber-500/10 border-amber-500/30", icon: Database },
  LEGACY_ECM:    { label: "Legacy ECM (ELO)",   color: "text-purple-700 bg-purple-500/10 border-purple-500/30", icon: Archive },
  APEX:          { label: "Apex Nexus",         color: "text-cyan-700 bg-cyan-50 border-cyan-200", icon: CheckCircle2 },
};

export default function FederatedPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [q, setQ] = useState("Project Alpha");
  const [filter, setFilter] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const loadSources = async () => {
    const r: any = await federatedApi.sources();
    setSources(r.data.data || []);
  };

  useEffect(() => {
    loadSources();
    runSearch("Project Alpha", new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async (query: string, types: Set<string>) => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const r: any = await federatedApi.search(query, types.size ? Array.from(types) : undefined);
      setResults(r.data.data);
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (t: string) => {
    const next = new Set(filter);
    next.has(t) ? next.delete(t) : next.add(t);
    setFilter(next);
    runSearch(q, next);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Telescope className="h-7 w-7 text-cyan-600" /> Federated Search
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            One query across Outlook, Gmail, SharePoint, network shares, legacy ECM — and Apex Nexus
            itself. The Brain that sees your entire organisation.
          </p>
        </div>
        <button
          onClick={() => setConfigOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 text-sm font-medium text-slate-700"
        >
          <Settings className="h-4 w-4" /> Configure Sources
        </button>
      </div>

      {/* Search bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(q, filter);
        }}
        className="flex gap-2"
      >
        <div className="flex-1 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-md bg-white border border-slate-200 focus:border-cyan-500 outline-none"
            placeholder="Search across all sources…"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
        >
          Search
        </button>
      </form>

      {/* Source filters */}
      <div className="flex flex-wrap gap-2">
        {sources.map((s) => {
          const meta = TYPE_META[s.source_type] || TYPE_META.APEX;
          const Icon = meta.icon;
          const active = filter.has(s.source_type);
          return (
            <button
              key={s.id}
              onClick={() => toggleFilter(s.source_type)}
              disabled={!s.enabled}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition ${
                active ? "bg-cyan-600 border-cyan-600 text-white" :
                s.enabled ? `${meta.color} hover:brightness-125` :
                "bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.name}
              <span className="opacity-60">({s.doc_count_estimate?.toLocaleString?.() ?? 0})</span>
            </button>
          );
        })}
      </div>

      {/* Summary */}
      {results && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>Found <strong className="text-slate-900">{results.total}</strong> results in <strong>{results.tookMs}ms</strong></span>
          {Object.entries(results.breakdown || {}).map(([k, v]: any) => {
            const meta = TYPE_META[k] || { label: k, color: "text-slate-700", icon: Building };
            return (
              <span key={k} className={`text-xs px-2 py-0.5 rounded-full border ${meta.color}`}>
                {meta.label}: {v}
              </span>
            );
          })}
        </div>
      )}

      {/* Results */}
      {loading && (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Querying all sources…
        </div>
      )}
      {results && !loading && (
        <div className="space-y-3">
          {results.results.map((r: any, i: number) => {
            const meta = TYPE_META[r.source_type] || TYPE_META.APEX;
            const Icon = meta.icon;
            return (
              <a
                key={r.id || i}
                href={r.in_apex ? `/documents/${r.external_id}` : r.external_url}
                target={r.in_apex ? undefined : "_blank"}
                rel="noreferrer"
                className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-cyan-600/50 transition"
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-md border p-2 ${meta.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${meta.color}`}>
                        {meta.label}
                      </span>
                      {r.live && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 inline-flex items-center gap-1">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75 animate-ping" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                          </span>
                          Live · Remote
                        </span>
                      )}
                      {r.in_apex && !r.live && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-cyan-50 text-cyan-700 border-cyan-200">
                          In Apex
                        </span>
                      )}
                      {!r.in_apex && !r.live && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                          Indexed
                        </span>
                      )}
                      {r.modified_at && (
                        <span className="text-xs text-slate-500">
                          {new Date(r.modified_at).toLocaleDateString()}
                        </span>
                      )}
                      {r.author && <span className="text-xs text-slate-500">· {r.author}</span>}
                    </div>
                    <div className="font-medium mt-1 flex items-center gap-1">
                      {r.title}
                      {!r.in_apex && <ExternalLink className="h-3 w-3 text-slate-500" />}
                    </div>
                    {r.snippet && <div className="text-sm text-slate-500 mt-1">{r.snippet}</div>}
                    <div className="text-xs text-slate-400 mt-1">{r.source_name}</div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {configOpen && (
        <SourcesConfigModal
          sources={sources}
          onClose={() => setConfigOpen(false)}
          onChange={async () => { await loadSources(); runSearch(q, filter); }}
        />
      )}
    </div>
  );
}

const SOURCE_TYPES: Array<{ value: string; label: string; example: string }> = [
  { value: "GMAIL",         label: "Gmail",                 example: "imap.gmail.com:993 / user@company.com" },
  { value: "EXCHANGE",      label: "Outlook / Exchange",    example: "https://outlook.office365.com/ews" },
  { value: "SHAREPOINT",    label: "SharePoint",            example: "https://<tenant>.sharepoint.com/sites/<site>" },
  { value: "NETWORK_SHARE", label: "Network Share (SMB)",   example: "\\\\server\\share" },
  { value: "LEGACY_ECM",    label: "Legacy ECM (ELO etc.)", example: "https://elo.internal/api" },
];

function SourcesConfigModal({ sources, onClose, onChange }: { sources: any[]; onClose: () => void; onChange: () => void | Promise<void>; }) {
  const [form, setForm] = useState({ name: "", sourceType: "GMAIL", endpointUrl: "", authConfig: "", docCountEstimate: 0 });
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; endpointUrl: string; authConfig: string }>({ name: "", endpointUrl: "", authConfig: "" });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.endpointUrl) return;
    setBusy(true);
    try {
      await federatedApi.createSource({
        name: form.name.trim(),
        sourceType: form.sourceType,
        endpointUrl: form.endpointUrl.trim(),
        authConfig: form.authConfig || undefined,
        docCountEstimate: Number(form.docCountEstimate) || 0,
      });
      setForm({ name: "", sourceType: form.sourceType, endpointUrl: "", authConfig: "", docCountEstimate: 0 });
      await onChange();
    } finally { setBusy(false); }
  };

  const importFromEmail = async () => {
    setImportBusy(true);
    try {
      const r: any = await federatedApi.importFromEmail();
      const d = r.data?.data ?? r.data ?? {};
      alert(`Email-ingestion mailboxes imported.\nAdded: ${d.added ?? 0}\nSkipped (already linked): ${d.skipped ?? 0}\nTotal mailboxes scanned: ${d.total ?? 0}`);
      await onChange();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Import failed");
    } finally { setImportBusy(false); }
  };

  const startEdit = (s: any) => {
    setEditId(s.id);
    setEditForm({
      name: s.name || "",
      endpointUrl: s.endpoint_url || "",
      authConfig: typeof s.config === "string" ? s.config : (s.config ? JSON.stringify(s.config) : ""),
    });
  };
  const saveEdit = async () => {
    if (!editId) return;
    await federatedApi.updateSource(editId, {
      name: editForm.name,
      endpointUrl: editForm.endpointUrl,
      authConfig: editForm.authConfig || "{}",
    });
    setEditId(null);
    await onChange();
  };
  const cancelEdit = () => setEditId(null);

  const toggle = async (id: string, enabled: boolean) => { await federatedApi.toggleSource(id, enabled); await onChange(); };
  const remove = async (id: string) => {
    if (!confirm("Remove this source and all its indexed rows?")) return;
    await federatedApi.deleteSource(id); await onChange();
  };
  const test = async (id: string) => {
    const r: any = await federatedApi.testSource(id);
    alert(`${r.data.data.name}\n${r.data.data.message}`);
  };

  const typeMeta = SOURCE_TYPES.find((t) => t.value === form.sourceType);

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900">
            <Settings className="h-5 w-5 text-cyan-600" /> Configure Federated Sources
          </h2>
          <button onClick={onClose} title="Close" className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Quick import */}
          <div className="rounded-lg border border-cyan-200 bg-cyan-50/40 p-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium text-slate-900 text-sm">Already configured email ingestion?</div>
              <p className="text-xs text-slate-600 mt-0.5">
                Pull the mailboxes you set up under Email Ingestion and turn them into searchable federated sources in one click.
              </p>
            </div>
            <button
              onClick={importFromEmail}
              disabled={importBusy}
              className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-sm disabled:opacity-50 inline-flex items-center gap-2"
            >
              {importBusy ? "Importing…" : "Import from Email Ingestion"}
            </button>
          </div>

          {/* Add */}
          <form onSubmit={add} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="font-medium text-slate-900 flex items-center gap-2"><Plus className="h-4 w-4" /> Add a source</div>
            <p className="text-xs text-slate-500">
              Connect the mailboxes, drives and archives you want Apex to search. Endpoint is the address
              users already use (mailbox, site URL, UNC path). Auth config is the secret / app password
              stored encrypted.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Display name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-md bg-white border border-slate-300 text-sm"
                  placeholder="Procurement Gmail"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Type</label>
                <select
                  value={form.sourceType}
                  onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
                  title="Source type"
                  className="w-full mt-1 px-3 py-2 rounded-md bg-white border border-slate-300 text-sm"
                >
                  {SOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-500">Endpoint / mailbox</label>
                <input
                  value={form.endpointUrl}
                  onChange={(e) => setForm({ ...form, endpointUrl: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-md bg-white border border-slate-300 text-sm font-mono"
                  placeholder={typeMeta?.example || ""}
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-500">Auth config (JSON)</label>
                <input
                  value={form.authConfig}
                  onChange={(e) => setForm({ ...form, authConfig: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-md bg-white border border-slate-300 text-sm font-mono"
                  placeholder='{"username":"user@company.com","appPassword":"••••"}'
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Est. document count</label>
                <input
                  type="number"
                  value={form.docCountEstimate}
                  onChange={(e) => setForm({ ...form, docCountEstimate: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 rounded-md bg-white border border-slate-300 text-sm"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-sm disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> {busy ? "Adding…" : "Add source"}
              </button>
            </div>
          </form>

          {/* Existing */}
          <div>
            <div className="text-sm font-medium text-slate-900 mb-2">Connected sources</div>
            <div className="space-y-2">
              {sources.length === 0 && <div className="text-sm text-slate-500">No sources yet.</div>}
              {sources.map((s: any) => {
                const meta = TYPE_META[s.source_type] || { label: s.source_type, color: "bg-slate-100 text-slate-700 border-slate-200", icon: Building };
                const Icon = meta.icon;
                if (editId === s.id) {
                  return (
                    <div key={s.id} className="rounded-md border border-cyan-300 bg-cyan-50/40 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                        <Icon className="h-4 w-4" /> Editing &laquo;{s.name}&raquo;
                      </div>
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Display name"
                        title="Display name"
                        className="w-full px-3 py-1.5 rounded-md bg-white border border-slate-300 text-sm"
                      />
                      <input
                        value={editForm.endpointUrl}
                        onChange={(e) => setEditForm({ ...editForm, endpointUrl: e.target.value })}
                        placeholder="Endpoint / mailbox"
                        title="Endpoint / mailbox"
                        className="w-full px-3 py-1.5 rounded-md bg-white border border-slate-300 text-sm font-mono"
                      />
                      <input
                        value={editForm.authConfig}
                        onChange={(e) => setEditForm({ ...editForm, authConfig: e.target.value })}
                        placeholder='Auth config JSON, e.g. {"username":"…","appPassword":"…"}'
                        title="Auth config JSON"
                        className="w-full px-3 py-1.5 rounded-md bg-white border border-slate-300 text-sm font-mono"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={cancelEdit} className="px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200 text-xs">Cancel</button>
                        <button onClick={saveEdit} className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs">Save changes</button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3">
                    <div className={`rounded-md border p-1.5 ${meta.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 text-sm truncate">{s.name}</div>
                      <div className="text-xs text-slate-500 font-mono truncate">{s.endpoint_url || "—"}</div>
                    </div>
                    <span className="text-xs text-slate-500">{s.doc_count_estimate?.toLocaleString?.() ?? 0} docs</span>
                    <button
                      onClick={() => startEdit(s)}
                      className="px-2 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200"
                      title="Edit source"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => test(s.id)}
                      className="px-2 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200"
                      title="Test connection"
                    >
                      Test
                    </button>
                    <button
                      onClick={() => toggle(s.id, !s.enabled)}
                      className={`px-2 py-1 text-xs rounded-md border inline-flex items-center gap-1 ${
                        s.enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {s.enabled ? <><Power className="h-3 w-3" /> On</> : <><PowerOff className="h-3 w-3" /> Off</>}
                    </button>
                    <button
                      onClick={() => remove(s.id)}
                      className="p-1.5 rounded-md text-red-600 hover:bg-red-50"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
