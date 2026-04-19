'use client';

import { useEffect, useState } from 'react';
import { complianceApi } from '@/lib/api';
import {
  Shield, AlertTriangle, Users, FileText, Globe, DollarSign,
  Activity, Download, RefreshCw, Plus, CheckCircle2, Clock,
  XCircle, Eye, AlertCircle, FileCheck, Lock, Flag,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

type Tab =
  | 'overview'
  | 'pii'
  | 'dsr'
  | 'breaches'
  | 'consent'
  | 'transfers'
  | 'dst'
  | 'snapshots';

export default function PotrazPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const res = await complianceApi.dashboard();
        if (!cancel) setDashboard(res.data?.data ?? res.data);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-yellow-500 flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">POTRAZ Compliance</h1>
              <p className="text-sm text-slate-500">
                Zimbabwe Cyber &amp; Data Protection Act · Digital Services Tax · Audit-ready
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={async () => {
              try {
                const res = await complianceApi.createSnapshot('POTRAZ_AUDIT');
                const snap = res.data?.data ?? res.data;
                downloadJson(snap, `potraz-audit-${new Date().toISOString().slice(0,10)}.json`);
                alert('Snapshot saved and downloaded.');
              } catch (e: any) {
                alert(e?.response?.data?.message || 'Failed to generate snapshot');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Download className="h-4 w-4" /> Generate Audit Report
          </button>
        </div>
      </div>

      {/* Score banner */}
      {dashboard && (
        <ScoreBanner score={dashboard.complianceScore} dashboard={dashboard} />
      )}

      {/* Tab nav */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-4 overflow-x-auto">
          {([
            { k: 'overview',  label: 'Overview',   icon: Activity },
            { k: 'pii',       label: 'PII Inventory', icon: Lock },
            { k: 'dsr',       label: 'Subject Requests', icon: Users },
            { k: 'breaches',  label: 'Breach Register', icon: AlertTriangle },
            { k: 'consent',   label: 'Consent',    icon: FileCheck },
            { k: 'transfers', label: 'Cross-Border', icon: Globe },
            { k: 'dst',       label: '15% DST',    icon: DollarSign },
            { k: 'snapshots', label: 'Reports',    icon: FileText },
          ] as { k: Tab; label: string; icon: any }[]).map(t => {
            const Ic = t.icon;
            const active = tab === t.k;
            return (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                  active
                    ? 'border-green-600 text-green-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}>
                <Ic className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Panels */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
      ) : (
        <>
          {tab === 'overview'  && <OverviewTab dashboard={dashboard} />}
          {tab === 'pii'       && <PiiTab />}
          {tab === 'dsr'       && <DsrTab onChange={refresh} />}
          {tab === 'breaches'  && <BreachesTab onChange={refresh} />}
          {tab === 'consent'   && <ConsentTab onChange={refresh} />}
          {tab === 'transfers' && <TransfersTab onChange={refresh} />}
          {tab === 'dst'       && <DstTab onChange={refresh} />}
          {tab === 'snapshots' && <SnapshotsTab onChange={refresh} />}
        </>
      )}
    </div>
  );
}

// ─────────────── Score banner ──────────────────

function ScoreBanner({ score, dashboard }: { score: number; dashboard: any }) {
  const s = Number(score ?? 0);
  const colour = s >= 85 ? 'bg-green-500' : s >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const textColour = s >= 85 ? 'text-green-700 bg-green-50 border-green-200'
                   : s >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200'
                             : 'text-red-700 bg-red-50 border-red-200';
  const label = s >= 85 ? 'Good standing' : s >= 60 ? 'Needs attention' : 'Critical — action required';

  const overdue = Number(dashboard?.dsr?.overdue ?? 0);
  const notifyOverdue = Number(dashboard?.breaches?.notification_overdue ?? 0);
  const criticalPii = Number(dashboard?.pii?.critical ?? 0);

  return (
    <div className={`rounded-xl border p-5 ${textColour}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
              <path className="stroke-slate-200" strokeWidth="3" fill="none"
                d="M18 2a16 16 0 1 1 0 32 16 16 0 0 1 0-32"/>
              <path className={colour.replace('bg-', 'stroke-')} strokeWidth="3" fill="none"
                strokeLinecap="round"
                strokeDasharray={`${s}, 100`}
                d="M18 2a16 16 0 1 1 0 32 16 16 0 0 1 0-32"/>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
              {s}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide">Compliance Score</p>
            <p className="text-lg font-bold">{label}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <Pill icon={Clock} label="Overdue DSRs" value={overdue} danger={overdue > 0} />
          <Pill icon={AlertTriangle} label="POTRAZ notification due" value={notifyOverdue} danger={notifyOverdue > 0} />
          <Pill icon={Lock} label="Critical PII docs" value={criticalPii} danger={criticalPii > 0} />
        </div>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, label, value, danger }: { icon: any; label: string; value: number; danger?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
      danger ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-600'
    }`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

// ─────────────── Overview ──────────────────

function OverviewTab({ dashboard }: { dashboard: any }) {
  if (!dashboard) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <MetricCard title="PII Documents" value={dashboard.pii?.pii_documents ?? 0}
        sub={`${dashboard.pii?.total_documents ?? 0} total`} icon={Lock} colour="red" />
      <MetricCard title="Data Subject Requests" value={dashboard.dsr?.total ?? 0}
        sub={`${dashboard.dsr?.pending ?? 0} pending · ${dashboard.dsr?.overdue ?? 0} overdue`} icon={Users} colour="blue" />
      <MetricCard title="Breaches" value={dashboard.breaches?.total ?? 0}
        sub={`${dashboard.breaches?.open ?? 0} open · ${dashboard.breaches?.critical ?? 0} critical`} icon={AlertTriangle} colour="amber" />
      <MetricCard title="Active Consents" value={dashboard.consent?.granted ?? 0}
        sub={`${dashboard.consent?.withdrawn ?? 0} withdrawn`} icon={FileCheck} colour="green" />
      <MetricCard title="Cross-Border Transfers" value={dashboard.transfers?.total ?? 0}
        sub={`${dashboard.transfers?.approved ?? 0} approved`} icon={Globe} colour="purple" />
      <MetricCard title={`DST ${dashboard.dst?.year ?? ''}`}
        value={`$${Number(dashboard.dst?.dst_total ?? 0).toLocaleString()}`}
        sub={`${dashboard.dst?.invoice_count ?? 0} invoices · 15%`} icon={DollarSign} colour="yellow" />

      <div className="md:col-span-2 lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <Flag className="h-4 w-4 text-green-600" /> Zimbabwe Retention Rules
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left py-2 pr-4">Category</th>
                <th className="text-left py-2 pr-4">Minimum Years</th>
                <th className="text-left py-2 pr-4">Legal Citation</th>
                <th className="text-left py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(dashboard.zwRetentionRules || []).map((r: any, i: number) => (
                <tr key={i}>
                  <td className="py-2 pr-4 font-medium">{r.document_category}</td>
                  <td className="py-2 pr-4">{r.min_retention_years}</td>
                  <td className="py-2 pr-4 text-slate-600">{r.legal_citation}</td>
                  <td className="py-2 text-slate-500 truncate max-w-md">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, icon: Icon, colour }: any) {
  const colourMap: Record<string, string> = {
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-700',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          <p className="text-xs text-slate-500 mt-1">{sub}</p>
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colourMap[colour]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ─────────────── PII Tab ──────────────────

function PiiTab() {
  const [inv, setInv] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [selDoc, setSelDoc] = useState<string | null>(null);

  useEffect(() => {
    complianceApi.piiInventory().then(r => setInv(r.data?.data ?? r.data)).catch(()=>{});
    complianceApi.piiAccessLog(undefined, 100).then(r => setLog(r.data?.data ?? r.data ?? [])).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!selDoc) return;
    complianceApi.piiAccessLog(selDoc, 200).then(r => setLog(r.data?.data ?? r.data ?? [])).catch(()=>{});
  }, [selDoc]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Lock className="h-4 w-4" /> PII Documents
        </h3>
        {inv ? (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
              <Stat label="Critical" value={inv.critical} tone="red" />
              <Stat label="High" value={inv.high} tone="orange" />
              <Stat label="Medium" value={inv.medium} tone="amber" />
              <Stat label="Low" value={inv.low} tone="slate" />
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {(inv.recentDetections || []).map((d: any) => (
                <button key={d.id} onClick={() => setSelDoc(d.id)}
                  className={`w-full text-left bg-slate-50 hover:bg-slate-100 rounded p-3 border ${
                    selDoc === d.id ? 'border-green-500' : 'border-slate-200'
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{d.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{d.mime_type}</p>
                    </div>
                    <SeverityBadge severity={d.pii_severity} />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {String(d.pii_types || '').split(',').filter(Boolean).map((t: string) => (
                      <span key={t} className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-semibold">
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : <p className="text-sm text-slate-400">Loading…</p>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Eye className="h-4 w-4" /> Access Log {selDoc && '(filtered)'}
          </h3>
          {selDoc && (
            <button onClick={() => setSelDoc(null)}
              className="text-xs text-slate-500 hover:text-slate-700">Clear filter</button>
          )}
        </div>
        <div className="space-y-2 max-h-[560px] overflow-y-auto">
          {log.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No access events</p>
          ) : log.map((e: any) => (
            <div key={e.id} className="text-xs border-l-2 border-blue-400 pl-3 py-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{e.username || 'system'}</span>
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">
                  {e.action}
                </span>
                <span className="ml-auto text-slate-400">{formatDate(e.created_at)}</span>
              </div>
              {e.document_title && (
                <p className="text-[11px] text-slate-600 mt-0.5 truncate">{e.document_title}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: any) {
  const toneMap: Record<string, string> = {
    red: 'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <div className={`rounded p-2 ${toneMap[tone]}`}>
      <p className="text-[10px] uppercase font-semibold">{label}</p>
      <p className="text-lg font-bold">{value ?? 0}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-800 border-red-300',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
    MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300',
    LOW: 'bg-slate-100 text-slate-700 border-slate-300',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${map[severity] || map.LOW}`}>
      {severity || 'N/A'}
    </span>
  );
}

// ─────────────── DSR Tab ──────────────────

function DsrTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [sel, setSel] = useState<any | null>(null);

  const reload = () => complianceApi.listDsrs().then(r => setItems(r.data?.data ?? r.data ?? []));
  useEffect(() => { reload(); }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Data Subject Requests</h3>
          <button onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">
            <Plus className="h-3 w-3" /> New
          </button>
        </div>
        <div className="space-y-2 max-h-[560px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No requests yet</p>
          ) : items.map(i => (
            <button key={i.id} onClick={() => setSel(i)}
              className={`w-full text-left bg-slate-50 hover:bg-slate-100 rounded p-3 border ${
                sel?.id === i.id ? 'border-green-500' : 'border-slate-200'
              }`}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{i.request_number} · {i.request_type}</p>
                  <p className="text-[11px] text-slate-500 truncate">{i.data_subject_name || i.data_subject_id}</p>
                </div>
                <StatusBadge status={i.status} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Due {formatDate(i.due_at)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        {sel ? <DsrDetail dsr={sel} onChange={() => { reload(); onChange(); }} /> : (
          <p className="text-sm text-slate-400 italic">Select a request to view details</p>
        )}
      </div>

      {showNew && <NewDsrModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); reload(); onChange(); }} />}
    </div>
  );
}

function DsrDetail({ dsr, onChange }: { dsr: any; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-semibold">{dsr.request_number}</p>
          <p className="text-sm text-slate-500">{dsr.request_type}</p>
        </div>
        <StatusBadge status={dsr.status} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm mb-4">
        <dt className="text-slate-500">Subject</dt><dd>{dsr.data_subject_name || dsr.data_subject_id}</dd>
        <dt className="text-slate-500">Email</dt><dd>{dsr.data_subject_email || '—'}</dd>
        <dt className="text-slate-500">Received</dt><dd>{formatDate(dsr.received_at)}</dd>
        <dt className="text-slate-500">Due</dt><dd className="font-medium">{formatDate(dsr.due_at)}</dd>
        <dt className="text-slate-500">Description</dt><dd className="col-span-1 text-slate-700">{dsr.description || '—'}</dd>
      </dl>

      <div className="flex gap-2 mb-3">
        <button disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await complianceApi.executeDsr(dsr.id);
              setResult(r.data?.data ?? r.data);
              onChange();
            } catch (e: any) {
              alert(e?.response?.data?.message || 'Execute failed');
            }
            setBusy(false);
          }}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">
          Execute (auto-discover PII)
        </button>
        {['PENDING', 'IN_PROGRESS'].includes(dsr.status) && (
          <>
            <button
              onClick={async () => {
                await complianceApi.updateDsrStatus(dsr.id, 'COMPLETED', 'Closed by admin');
                onChange();
              }}
              className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700">
              Mark complete
            </button>
            <button
              onClick={async () => {
                await complianceApi.updateDsrStatus(dsr.id, 'REJECTED', 'Rejected');
                onChange();
              }}
              className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700">
              Reject
            </button>
          </>
        )}
      </div>

      {result && (
        <div className="bg-slate-50 rounded p-3 mt-2 text-xs">
          <p className="font-semibold mb-2">Discovery result — {result.matchedDocuments} document(s)</p>
          {(result.documents || []).slice(0, 10).map((d: any) => (
            <div key={d.id} className="flex items-center gap-2 py-0.5">
              <SeverityBadge severity={d.pii_severity} />
              <span className="truncate">{d.title}</span>
            </div>
          ))}
          {result.erasureMarked > 0 && (
            <p className="mt-2 text-red-700 font-semibold">🗑 {result.erasureMarked} documents marked PENDING_ERASURE</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    OPEN: 'bg-red-100 text-red-800',
    INVESTIGATING: 'bg-amber-100 text-amber-800',
    CONTAINED: 'bg-blue-100 text-blue-800',
    RESOLVED: 'bg-slate-200 text-slate-700',
    REPORTED: 'bg-green-100 text-green-800',
    GRANTED: 'bg-green-100 text-green-800',
    WITHDRAWN: 'bg-slate-200 text-slate-700',
    EXPIRED: 'bg-red-100 text-red-800',
  };
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${map[status] || 'bg-slate-100 text-slate-700'}`}>{status}</span>;
}

function NewDsrModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    dataSubjectId: '', dataSubjectName: '', dataSubjectEmail: '',
    requestType: 'ACCESS', description: '',
  });
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title="New Data Subject Request">
      <div className="space-y-3">
        <Field label="Subject ID (email or national ID)" required>
          <input className="input" value={form.dataSubjectId} onChange={e => setForm({ ...form, dataSubjectId: e.target.value })} />
        </Field>
        <Field label="Subject name">
          <input className="input" value={form.dataSubjectName} onChange={e => setForm({ ...form, dataSubjectName: e.target.value })} />
        </Field>
        <Field label="Subject email">
          <input type="email" className="input" value={form.dataSubjectEmail} onChange={e => setForm({ ...form, dataSubjectEmail: e.target.value })} />
        </Field>
        <Field label="Request type" required>
          <select className="input" value={form.requestType} onChange={e => setForm({ ...form, requestType: e.target.value })}>
            <option value="ACCESS">Access (Article 15)</option>
            <option value="ERASURE">Erasure / Right to be forgotten</option>
            <option value="PORTABILITY">Data portability</option>
            <option value="RECTIFICATION">Rectification</option>
            <option value="RESTRICTION">Restrict processing</option>
            <option value="OBJECTION">Object to processing</option>
          </select>
        </Field>
        <Field label="Description">
          <textarea className="input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
          <button disabled={busy || !form.dataSubjectId}
            onClick={async () => {
              setBusy(true);
              try {
                await complianceApi.createDsr(form);
                onCreated();
              } catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
              setBusy(false);
            }}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
            Create request
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────── Breaches Tab ──────────────────

function BreachesTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);
  const [showNew, setShowNew] = useState(false);

  const reload = () => complianceApi.listBreaches().then(r => setItems(r.data?.data ?? r.data ?? []));
  useEffect(() => { reload(); }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Data Breach Register</h3>
          <button onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">
            <Plus className="h-3 w-3" /> Report breach
          </button>
        </div>
        <div className="space-y-2 max-h-[560px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No breaches recorded</p>
          ) : items.map(b => (
            <button key={b.id} onClick={() => setSel(b)}
              className={`w-full text-left bg-slate-50 hover:bg-slate-100 rounded p-3 border ${
                sel?.id === b.id ? 'border-red-500' : 'border-slate-200'
              }`}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.breach_number} · {b.title}</p>
                  <p className="text-[11px] text-slate-500">{b.records_affected} records · {formatDate(b.discovered_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <SeverityBadge severity={b.severity} />
                  <StatusBadge status={b.status} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        {sel ? <BreachDetail breach={sel} onChange={() => { reload(); onChange(); }} /> : (
          <p className="text-sm text-slate-400 italic">Select a breach to view details</p>
        )}
      </div>

      {showNew && <NewBreachModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); reload(); onChange(); }} />}
    </div>
  );
}

function BreachDetail({ breach, onChange }: { breach: any; onChange: () => void }) {
  const hoursFromDiscovery = breach.discovered_at
    ? Math.floor((Date.now() - new Date(breach.discovered_at).getTime()) / 3_600_000)
    : 0;
  const needsNotification = !breach.potraz_notified && ['HIGH', 'CRITICAL'].includes(breach.severity);
  const overdue = needsNotification && hoursFromDiscovery > 24;
  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-semibold">{breach.breach_number}</p>
          <p className="text-sm text-slate-500">{breach.title}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <SeverityBadge severity={breach.severity} />
          <StatusBadge status={breach.status} />
        </div>
      </div>
      {overdue && (
        <div className="bg-red-50 border border-red-300 rounded p-3 mb-3 text-sm text-red-800">
          ⚠ POTRAZ 24-hour notification is <b>{hoursFromDiscovery}h OVERDUE</b>.
        </div>
      )}
      <dl className="grid grid-cols-2 gap-2 text-sm mb-4">
        <dt className="text-slate-500">Discovered</dt><dd>{formatDate(breach.discovered_at)}</dd>
        <dt className="text-slate-500">Occurred</dt><dd>{formatDate(breach.occurred_at)}</dd>
        <dt className="text-slate-500">Records affected</dt><dd>{breach.records_affected}</dd>
        <dt className="text-slate-500">Type</dt><dd>{breach.breach_type || '—'}</dd>
        <dt className="text-slate-500">POTRAZ notified</dt>
        <dd>{breach.potraz_notified ? `${formatDate(breach.potraz_notified_at)} · ${breach.potraz_reference || ''}` : 'No'}</dd>
      </dl>
      <p className="text-sm text-slate-700 mb-4">{breach.description}</p>

      {needsNotification && (
        <button
          onClick={async () => {
            const ref = prompt('POTRAZ reference number:');
            if (!ref) return;
            await complianceApi.notifyPotraz(breach.id, ref);
            onChange();
          }}
          className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700">
          Record POTRAZ notification
        </button>
      )}
    </div>
  );
}

function NewBreachModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', severity: 'HIGH', breachType: 'CONFIDENTIALITY',
    recordsAffected: 0, dataCategories: 'EMAIL,NAME',
  });
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title="Report data breach">
      <div className="space-y-3">
        <Field label="Title" required>
          <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Description" required>
          <textarea className="input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Severity">
            <select className="input" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
              <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
            </select>
          </Field>
          <Field label="Type">
            <select className="input" value={form.breachType} onChange={e => setForm({ ...form, breachType: e.target.value })}>
              <option>CONFIDENTIALITY</option><option>INTEGRITY</option><option>AVAILABILITY</option>
            </select>
          </Field>
          <Field label="Records affected">
            <input type="number" className="input" value={form.recordsAffected}
              onChange={e => setForm({ ...form, recordsAffected: Number(e.target.value) })} />
          </Field>
          <Field label="Data categories (csv)">
            <input className="input" value={form.dataCategories} onChange={e => setForm({ ...form, dataCategories: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
          <button disabled={busy || !form.title}
            onClick={async () => {
              setBusy(true);
              try {
                await complianceApi.createBreach({
                  ...form,
                  dataCategories: form.dataCategories.split(',').map(s => s.trim()).filter(Boolean),
                });
                onCreated();
              } catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
              setBusy(false);
            }}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
            Record breach
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────── Consent Tab ──────────────────

function ConsentTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);

  const reload = () => complianceApi.listConsents().then(r => setItems(r.data?.data ?? r.data ?? []));
  useEffect(() => { reload(); }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900">Consent Records</h3>
        <button onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">
          <Plus className="h-3 w-3" /> New
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs text-slate-500 uppercase">
            <tr>
              <th className="text-left py-2 pr-4">Subject</th>
              <th className="text-left py-2 pr-4">Purpose</th>
              <th className="text-left py-2 pr-4">Lawful basis</th>
              <th className="text-left py-2 pr-4">Status</th>
              <th className="text-left py-2 pr-4">Granted</th>
              <th className="text-left py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr><td colSpan={6} className="py-4 text-center text-slate-400">No consent records</td></tr>
            ) : items.map(c => (
              <tr key={c.id}>
                <td className="py-2 pr-4 font-medium">{c.data_subject_name || c.data_subject_id}</td>
                <td className="py-2 pr-4">{c.purpose}</td>
                <td className="py-2 pr-4 text-slate-600">{c.lawful_basis}</td>
                <td className="py-2 pr-4"><StatusBadge status={c.status} /></td>
                <td className="py-2 pr-4 text-slate-500">{formatDate(c.granted_at)}</td>
                <td className="py-2">
                  {c.status === 'GRANTED' && (
                    <button
                      onClick={async () => { await complianceApi.withdrawConsent(c.id); reload(); onChange(); }}
                      className="text-xs text-red-600 hover:underline">Withdraw</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && <NewConsentModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); reload(); onChange(); }} />}
    </div>
  );
}

function NewConsentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    dataSubjectId: '', dataSubjectName: '', purpose: 'MARKETING',
    lawfulBasis: 'CONSENT', source: 'web-form', expiresAt: '',
  });
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title="Record consent">
      <div className="space-y-3">
        <Field label="Subject ID" required>
          <input className="input" value={form.dataSubjectId} onChange={e => setForm({ ...form, dataSubjectId: e.target.value })} />
        </Field>
        <Field label="Subject name">
          <input className="input" value={form.dataSubjectName} onChange={e => setForm({ ...form, dataSubjectName: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Purpose">
            <select className="input" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}>
              <option>MARKETING</option><option>PROCESSING</option><option>STORAGE</option>
              <option>ANALYTICS</option><option>THIRD_PARTY_SHARING</option>
            </select>
          </Field>
          <Field label="Lawful basis">
            <select className="input" value={form.lawfulBasis} onChange={e => setForm({ ...form, lawfulBasis: e.target.value })}>
              <option>CONSENT</option><option>CONTRACT</option><option>LEGAL_OBLIGATION</option>
              <option>VITAL</option><option>PUBLIC</option><option>LEGITIMATE</option>
            </select>
          </Field>
          <Field label="Source">
            <input className="input" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />
          </Field>
          <Field label="Expires (optional)">
            <input type="date" className="input" value={form.expiresAt}
              onChange={e => setForm({ ...form, expiresAt: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
          <button disabled={busy || !form.dataSubjectId}
            onClick={async () => {
              setBusy(true);
              try {
                await complianceApi.createConsent({
                  ...form,
                  expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
                });
                onCreated();
              } catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
              setBusy(false);
            }}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────── Transfers Tab ──────────────────

function TransfersTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);

  const reload = () => complianceApi.listTransfers().then(r => setItems(r.data?.data ?? r.data ?? []));
  useEffect(() => { reload(); }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Globe className="h-4 w-4" /> Cross-border transfers
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold">ZW DPA s.18</span>
        </h3>
        <button onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700">
          <Plus className="h-3 w-3" /> New transfer
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs text-slate-500 uppercase">
            <tr>
              <th className="text-left py-2 pr-4">Target</th>
              <th className="text-left py-2 pr-4">Mechanism</th>
              <th className="text-left py-2 pr-4">Records</th>
              <th className="text-left py-2 pr-4">Purpose</th>
              <th className="text-left py-2 pr-4">Approved</th>
              <th className="text-left py-2">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr><td colSpan={6} className="py-4 text-center text-slate-400">No transfers logged</td></tr>
            ) : items.map(t => (
              <tr key={t.id}>
                <td className="py-2 pr-4 font-medium">{t.target_country || t.target_jurisdiction}</td>
                <td className="py-2 pr-4"><span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded">{t.transfer_mechanism}</span></td>
                <td className="py-2 pr-4">{t.records_transferred}</td>
                <td className="py-2 pr-4 text-slate-600 truncate max-w-xs">{t.purpose}</td>
                <td className="py-2 pr-4">{t.approved ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-slate-400" />}</td>
                <td className="py-2 text-slate-500">{formatDate(t.transfer_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showNew && <NewTransferModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); reload(); onChange(); }} />}
    </div>
  );
}

function NewTransferModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    targetJurisdiction: 'EU', targetCountry: '', targetOrganization: '',
    transferMechanism: 'SCC', lawfulBasis: 'CONTRACT', recordsTransferred: 0,
    purpose: '', safeguards: '', dataCategories: '',
  });
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title="Log cross-border transfer">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Target jurisdiction (ISO)">
            <input className="input" value={form.targetJurisdiction} onChange={e => setForm({ ...form, targetJurisdiction: e.target.value })} />
          </Field>
          <Field label="Target country">
            <input className="input" value={form.targetCountry} onChange={e => setForm({ ...form, targetCountry: e.target.value })} />
          </Field>
          <Field label="Target organization">
            <input className="input" value={form.targetOrganization} onChange={e => setForm({ ...form, targetOrganization: e.target.value })} />
          </Field>
          <Field label="Records">
            <input type="number" className="input" value={form.recordsTransferred}
              onChange={e => setForm({ ...form, recordsTransferred: Number(e.target.value) })} />
          </Field>
          <Field label="Mechanism">
            <select className="input" value={form.transferMechanism} onChange={e => setForm({ ...form, transferMechanism: e.target.value })}>
              <option>ADEQUACY</option><option>SCC</option><option>BCR</option>
              <option>DEROGATION</option><option>CONSENT</option>
            </select>
          </Field>
          <Field label="Lawful basis">
            <input className="input" value={form.lawfulBasis} onChange={e => setForm({ ...form, lawfulBasis: e.target.value })} />
          </Field>
        </div>
        <Field label="Data categories (csv)">
          <input className="input" value={form.dataCategories} onChange={e => setForm({ ...form, dataCategories: e.target.value })} />
        </Field>
        <Field label="Purpose">
          <textarea className="input" rows={2} value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} />
        </Field>
        <Field label="Safeguards">
          <textarea className="input" rows={2} value={form.safeguards} onChange={e => setForm({ ...form, safeguards: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
          <button disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await complianceApi.createTransfer({
                  ...form,
                  dataCategories: form.dataCategories.split(',').map(s => s.trim()).filter(Boolean),
                });
                onCreated();
              } catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
              setBusy(false);
            }}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────── DST Tab ──────────────────

function DstTab({ onChange }: { onChange: () => void }) {
  const year = new Date().getFullYear();
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);

  const reload = () => {
    complianceApi.listDst(year).then(r => setItems(r.data?.data ?? r.data ?? []));
    complianceApi.dstSummary(year).then(r => setSummary(r.data?.data ?? r.data));
  };
  useEffect(() => { reload(); }, []);

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <MetricCard title={`Gross ${year}`} value={`$${Number(summary?.gross_total || 0).toLocaleString()}`}
          sub={`${summary?.invoice_count || 0} invoices`} icon={DollarSign} colour="blue" />
        <MetricCard title="15% DST due" value={`$${Number(summary?.dst_total || 0).toLocaleString()}`}
          sub="Zimbabwe Finance Act 2023" icon={DollarSign} colour="red" />
        <MetricCard title="Net paid" value={`$${Number(summary?.net_total || 0).toLocaleString()}`}
          sub="After 15% DST" icon={DollarSign} colour="green" />
        <MetricCard title="Remitted to ZIMRA" value={summary?.remitted_count || 0}
          sub="of tax invoices" icon={FileCheck} colour="amber" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Monthly breakdown {year}</h3>
        <div className="grid grid-cols-4 md:grid-cols-12 gap-1 mb-4">
          {months.map((m, idx) => {
            const row = (summary?.monthly || []).find((x: any) => x.period_month === idx + 1);
            const amount = Number(row?.dst_total || 0);
            const max = Math.max(...(summary?.monthly || []).map((x: any) => Number(x.dst_total || 0)), 1);
            const pct = max > 0 ? (amount / max) * 100 : 0;
            return (
              <div key={m} className="flex flex-col items-center">
                <div className="h-16 w-full flex items-end">
                  <div className="w-full bg-red-400 rounded-t" style={{ height: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-slate-500 mt-1">{m}</span>
                <span className="text-[10px] font-semibold">${amount.toFixed(0)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">DST Invoices</h3>
          <button onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700">
            <Plus className="h-3 w-3" /> Add invoice
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left py-2 pr-4">Invoice</th>
                <th className="text-left py-2 pr-4">Supplier</th>
                <th className="text-left py-2 pr-4">Category</th>
                <th className="text-left py-2 pr-4">Date</th>
                <th className="text-right py-2 pr-4">Gross</th>
                <th className="text-right py-2 pr-4">DST (15%)</th>
                <th className="text-left py-2">Remitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr><td colSpan={7} className="py-4 text-center text-slate-400">No DST invoices</td></tr>
              ) : items.map(i => (
                <tr key={i.id}>
                  <td className="py-2 pr-4">{i.invoice_number}</td>
                  <td className="py-2 pr-4 font-medium">{i.supplier_name}</td>
                  <td className="py-2 pr-4 text-slate-600">{i.service_category}</td>
                  <td className="py-2 pr-4 text-slate-500">{i.invoice_date}</td>
                  <td className="py-2 pr-4 text-right">${Number(i.gross_amount_usd).toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right font-semibold text-red-700">${Number(i.dst_amount_usd).toFixed(2)}</td>
                  <td className="py-2">{i.remitted ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-amber-500" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && <NewDstModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); reload(); onChange(); }} />}
    </div>
  );
}

function NewDstModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    invoiceNumber: '', supplierName: '', supplierCountry: 'USA',
    serviceCategory: 'SAAS', serviceDescription: '',
    grossAmountUsd: 0, dstRate: 15, invoiceDate: new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);
  const dst = (form.grossAmountUsd * form.dstRate) / 100;
  const net = form.grossAmountUsd - dst;
  return (
    <Modal onClose={onClose} title="Record digital services tax invoice">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Invoice no.">
            <input className="input" value={form.invoiceNumber} onChange={e => setForm({ ...form, invoiceNumber: e.target.value })} />
          </Field>
          <Field label="Date" required>
            <input type="date" className="input" value={form.invoiceDate}
              onChange={e => setForm({ ...form, invoiceDate: e.target.value })} />
          </Field>
          <Field label="Supplier" required>
            <input className="input" value={form.supplierName} onChange={e => setForm({ ...form, supplierName: e.target.value })} />
          </Field>
          <Field label="Supplier country">
            <input className="input" value={form.supplierCountry} onChange={e => setForm({ ...form, supplierCountry: e.target.value })} />
          </Field>
          <Field label="Category">
            <select className="input" value={form.serviceCategory} onChange={e => setForm({ ...form, serviceCategory: e.target.value })}>
              <option>SAAS</option><option>CLOUD</option><option>DIGITAL_ADVERTISING</option>
              <option>STREAMING</option><option>OTHER</option>
            </select>
          </Field>
          <Field label="Gross (USD)" required>
            <input type="number" step="0.01" className="input" value={form.grossAmountUsd}
              onChange={e => setForm({ ...form, grossAmountUsd: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Description">
          <textarea className="input" rows={2} value={form.serviceDescription} onChange={e => setForm({ ...form, serviceDescription: e.target.value })} />
        </Field>
        <div className="bg-slate-50 rounded p-3 text-sm grid grid-cols-3 gap-2">
          <div><span className="text-slate-500">DST 15%:</span> <b className="text-red-700">${dst.toFixed(2)}</b></div>
          <div><span className="text-slate-500">Net:</span> <b>${net.toFixed(2)}</b></div>
          <div><span className="text-slate-500">Total:</span> <b>${form.grossAmountUsd.toFixed(2)}</b></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
          <button disabled={busy || !form.supplierName || !form.grossAmountUsd}
            onClick={async () => {
              setBusy(true);
              try {
                await complianceApi.createDst(form);
                onCreated();
              } catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
              setBusy(false);
            }}
            className="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50">
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────── Snapshots Tab ──────────────────

function SnapshotsTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const reload = () => complianceApi.listSnapshots().then(r => setItems(r.data?.data ?? r.data ?? []));
  useEffect(() => { reload(); }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900">Compliance Reports / Snapshots</h3>
        <div className="flex gap-2">
          {['POTRAZ_AUDIT', 'PII_INVENTORY', 'DST_QUARTERLY'].map(t => (
            <button key={t}
              onClick={async () => {
                await complianceApi.createSnapshot(t);
                reload(); onChange();
              }}
              className="text-xs px-2 py-1 bg-slate-700 text-white rounded hover:bg-slate-800">
              + {t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>
      <table className="min-w-full text-sm">
        <thead className="text-xs text-slate-500 uppercase">
          <tr>
            <th className="text-left py-2 pr-4">Title</th>
            <th className="text-left py-2 pr-4">Type</th>
            <th className="text-left py-2 pr-4">Score</th>
            <th className="text-left py-2 pr-4">Generated</th>
            <th className="text-left py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <tr><td colSpan={5} className="py-4 text-center text-slate-400">No reports</td></tr>
          ) : items.map(s => (
            <tr key={s.id}>
              <td className="py-2 pr-4 font-medium">{s.title}</td>
              <td className="py-2 pr-4"><span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded">{s.report_type}</span></td>
              <td className="py-2 pr-4 font-bold">{s.score ?? '—'}</td>
              <td className="py-2 pr-4 text-slate-500">{formatDate(s.generated_at)}</td>
              <td className="py-2">
                <button
                  onClick={async () => {
                    const res = await complianceApi.getSnapshot(s.id);
                    const data = res.data?.data ?? res.data;
                    downloadJson(data, `${s.report_type}-${s.id.slice(0,8)}.json`);
                  }}
                  className="text-xs text-blue-600 hover:underline">Download</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────── Reusable UI ──────────────────

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} title="Close" className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        {children}
      </div>
      <style jsx>{`
        :global(.input) {
          display: block; width: 100%; padding: 0.375rem 0.625rem;
          font-size: 0.875rem; border: 1px solid #cbd5e1; border-radius: 0.375rem;
          background: white;
        }
        :global(.input:focus) { outline: 2px solid #10b981; outline-offset: -1px; }
      `}</style>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}{required && <span className="text-red-500"> *</span>}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function downloadJson(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
