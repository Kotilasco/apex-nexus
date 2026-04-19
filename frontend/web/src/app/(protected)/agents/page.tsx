"use client";

import { useEffect, useState, useCallback } from "react";
import { agenticApi } from "@/lib/api";
import {
  Bot,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  FileText,
  ArrowRight,
  Clock,
} from "lucide-react";

type Suggestion = {
  id: string;
  document_id: string;
  document_title?: string;
  intent_type: string;
  title: string;
  rationale: string;
  proposed_action: any;
  confidence: number;
  status: string;
  created_at: string;
  acted_at?: string | null;
};

const INTENT_META: Record<string, { color: string; label: string; icon: any }> = {
  INVOICE_AUTOMATCH: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Invoice Auto-Match", icon: FileText },
  BUDGET_VARIANCE:   { color: "bg-amber-50 text-amber-700 border-amber-200",   label: "Budget Variance", icon: AlertTriangle },
  CONTRACT_RENEWAL:  { color: "bg-blue-50 text-blue-700 border-blue-200",     label: "Contract Renewal", icon: Clock },
  METER_ANOMALY:     { color: "bg-red-50 text-red-700 border-red-200",        label: "Meter Anomaly", icon: AlertTriangle },
  COMPLIANCE_REVIEW: { color: "bg-purple-50 text-purple-700 border-purple-200", label: "Compliance Review", icon: AlertTriangle },
};

export default function AgentsPage() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [history, setHistory] = useState<Suggestion[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "history">("pending");

  const load = useCallback(async () => {
    try {
      const [s, p, h, t] = await Promise.all([
        agenticApi.summary(),
        agenticApi.suggestions(),
        agenticApi.history(),
        agenticApi.team(),
      ]);
      setSummary(s.data.data);
      setItems((p.data.data || []) as Suggestion[]);
      setHistory((h.data.data || []) as Suggestion[]);
      setTeam((t.data.data || []) as any[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  const handle = async (id: string, action: "accept" | "dismiss") => {
    setBusyId(id);
    try {
      if (action === "accept") await agenticApi.accept(id);
      else await agenticApi.dismiss(id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const list = tab === "pending" ? items : history;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-7 w-7 text-purple-600" /> Agents
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Apex Nexus agents reason over every captured document and propose the next action.
            You stay in control — approve or dismiss.
          </p>
        </div>
        {summary && (
          <div className="flex gap-3">
            <StatBadge label="Pending" value={summary.pending} tone="amber" />
            <StatBadge label="Accepted" value={summary.accepted} tone="emerald" />
            <StatBadge label="Dismissed" value={summary.dismissed} tone="zinc" />
          </div>
        )}
      </div>

      {/* Multi-Agent Team panel */}
      <div className="rounded-lg border bg-gradient-to-r from-purple-50 to-indigo-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-sm text-slate-900">Multi-Agent Team</h2>
            <p className="text-xs text-slate-500">
              Specialised digital workers collaborate on every document.
            </p>
          </div>
          <div className="flex gap-2">
            {[
              { key: "auditor", label: "Run Auditor" },
              { key: "archivist", label: "Run Archivist" },
              { key: "bridge", label: "Run Bridge" },
            ].map((b) => (
              <button
                key={b.key}
                disabled={runningAgent === b.key}
                onClick={async () => {
                  setRunningAgent(b.key);
                  try {
                    if (b.key === "auditor") await agenticApi.runAuditor();
                    else if (b.key === "archivist") await agenticApi.runArchivist();
                    else await agenticApi.runBridge();
                    await load();
                  } finally {
                    setRunningAgent(null);
                  }
                }}
                className="px-2.5 py-1 text-xs rounded-md bg-white border hover:bg-slate-50 disabled:opacity-50"
              >
                {runningAgent === b.key ? "Running…" : b.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(team.length === 0
            ? [
                { agent_name: "Intake Agent", pending: 0, accepted: 0, dismissed: 0, total: 0 },
                { agent_name: "Auditor Agent", pending: 0, accepted: 0, dismissed: 0, total: 0 },
                { agent_name: "Archivist Agent", pending: 0, accepted: 0, dismissed: 0, total: 0 },
                { agent_name: "Bridge Agent", pending: 0, accepted: 0, dismissed: 0, total: 0 },
              ]
            : team
          ).map((a: any) => (
            <div key={a.agent_name} className="rounded-md border bg-white p-3">
              <div className="text-xs font-semibold text-slate-700">{a.agent_name}</div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                <div>
                  <div className="text-lg font-bold text-amber-600">{a.pending ?? 0}</div>
                  <div className="text-[10px] text-slate-500">pending</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-emerald-600">{a.accepted ?? 0}</div>
                  <div className="text-[10px] text-slate-500">accepted</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-400">{a.dismissed ?? 0}</div>
                  <div className="text-[10px] text-slate-500">dismissed</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(["pending", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition ${
              tab === t
                ? "border-purple-500 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {t === "pending" ? `Pending (${items.length})` : `History (${history.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading suggestions…
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-40" />
          {tab === "pending" ? "No pending suggestions. Agents will surface new ideas here." : "No history yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((s) => {
            const meta = INTENT_META[s.intent_type] || {
              color: "bg-slate-100 text-slate-700 border-slate-200",
              label: s.intent_type,
              icon: Sparkles,
            };
            const Icon = meta.icon;
            return (
              <div
                key={s.id}
                className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 transition"
              >
                <div className="flex items-start gap-4">
                  <div className={`rounded-md border p-2 ${meta.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${meta.color}`}>
                        {meta.label}
                      </span>
                      {(s as any).agent_name && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          {(s as any).agent_name}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        confidence {Math.round(s.confidence * 100)}%
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(s.created_at).toLocaleString()}
                      </span>
                      {s.status !== "PROPOSED" && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          s.status === "ACCEPTED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          s.status === "EXECUTED" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                          "bg-slate-100 text-slate-500 border-slate-200"
                        }`}>
                          {s.status}
                        </span>
                      )}
                    </div>
                    <div className="font-medium mt-1">{s.title}</div>
                    <div className="text-sm text-slate-500 mt-1">{s.rationale}</div>
                    {s.document_title && (
                      <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {s.document_title}
                      </div>
                    )}
                    {s.proposed_action && (
                      <pre className="mt-2 text-[11px] bg-slate-50 border border-slate-200 rounded p-2 text-slate-500 overflow-x-auto">
                        {JSON.stringify(s.proposed_action, null, 2)}
                      </pre>
                    )}
                  </div>
                  {s.status === "PROPOSED" && (
                    <div className="flex flex-col gap-2">
                      <button
                        disabled={busyId === s.id}
                        onClick={() => handle(s.id, "accept")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Accept
                      </button>
                      <button
                        disabled={busyId === s.id}
                        onClick={() => handle(s.id, "dismiss")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, tone }: { label: string; value: number; tone: "amber" | "emerald" | "zinc" }) {
  const color = tone === "amber"
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : tone === "emerald"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-slate-100 text-slate-500 border-slate-200";
  return (
    <div className={`rounded-md border px-3 py-2 ${color}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value ?? 0}</div>
    </div>
  );
}
