"use client";

import { useEffect, useState, useCallback } from "react";
import { predictionApi } from "@/lib/api";
import {
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Loader2,
  User as UserIcon,
  ArrowRight,
  Clock,
  Activity,
} from "lucide-react";

const RISK_META: Record<string, { color: string; label: string }> = {
  HIGH:   { color: "bg-red-50 text-red-700 border-red-200",       label: "HIGH" },
  MEDIUM: { color: "bg-amber-50 text-amber-700 border-amber-200", label: "MEDIUM" },
  LOW:    { color: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "LOW" },
};

export default function PredictionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [s, l] = await Promise.all([predictionApi.summary(), predictionApi.list()]);
    setSummary(s.data.data);
    setItems(l.data.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await predictionApi.refresh();
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const reassign = async (instanceId: string, userId: string) => {
    if (!confirm("Reassign this workflow to the suggested user?")) return;
    await predictionApi.reassign(instanceId, userId);
    await refresh();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-orange-600" /> Predictive Bottlenecks
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Early-warning system for your business operations. Apex predicts which workflows will
            miss their SLA — and who can unblock them.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Recompute
        </button>
      </div>

      {/* Summary tiles */}
      {summary && (() => {
        const meaningful = items.filter((p) => p.risk_level !== "LOW" || (p.predicted_delay_hours || 0) > 0);
        const high = meaningful.filter((p) => p.risk_level === "HIGH").length;
        const medium = meaningful.filter((p) => p.risk_level === "MEDIUM").length;
        const low = meaningful.filter((p) => p.risk_level === "LOW").length;
        return (
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Tracked workflows" value={summary.total} tone="slate" icon={Activity} />
            <Stat label="High risk" value={high} tone="red" icon={AlertTriangle} />
            <Stat label="Medium risk" value={medium} tone="amber" icon={Clock} />
            <Stat label="At-risk (low)" value={low} tone="emerald" icon={TrendingUp} />
          </div>
        );
      })()}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading predictions…
        </div>
      ) : items.filter((p) => p.risk_level !== "LOW" || (p.predicted_delay_hours || 0) > 0).length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
          <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>All workflows are on track. No bottlenecks predicted.</p>
          <p className="text-xs mt-1">Click <strong>Recompute</strong> to re-run the model after new activity.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items
            .filter((p) => p.risk_level !== "LOW" || (p.predicted_delay_hours || 0) > 0)
            .map((p) => {
            const meta = RISK_META[p.risk_level] || RISK_META.LOW;
            const delay = Math.round(p.predicted_delay_hours || 0);
            return (
              <div
                key={p.id}
                className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 transition"
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="text-sm font-medium">
                    {p.document_title || "Workflow " + p.workflow_instance_id?.slice(0, 8)}
                  </span>
                  <span className="text-xs text-slate-500">state: {p.current_state}</span>
                  <span className="text-xs text-slate-500">
                    predicted completion: {new Date(p.predicted_completion).toLocaleString()}
                  </span>
                  {delay > 0 && (
                    <span className="text-xs text-red-700">+{delay}h past SLA</span>
                  )}
                </div>
                <div className="text-sm text-slate-500 mt-2">
                  <strong className="text-slate-900">Reason:</strong> {p.bottleneck_reason}
                </div>
                {(p.bottleneck_name || p.suggested_name) && (
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    {p.bottleneck_name && (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <UserIcon className="h-3.5 w-3.5" /> Current: <strong className="text-slate-900">{p.bottleneck_name}</strong>
                      </span>
                    )}
                    {p.suggested_name && p.suggested_id !== p.bottleneck_id && (
                      <>
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <UserIcon className="h-3.5 w-3.5" /> Suggest: <strong>{p.suggested_name}</strong>
                        </span>
                        <button
                          onClick={() => reassign(p.workflow_instance_id, p.suggested_id)}
                          className="ml-auto px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                        >
                          Reassign
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, icon: Icon }: any) {
  const color =
    tone === "red" ? "bg-red-50 border-red-200 text-red-700" :
    tone === "amber" ? "bg-amber-50 border-amber-200 text-amber-700" :
    tone === "emerald" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
    "bg-white border-slate-200 text-slate-700";
  return (
    <div className={`rounded-lg border p-3 flex items-center gap-3 ${color}`}>
      <Icon className="h-5 w-5 opacity-80" />
      <div>
        <div className="text-[11px] uppercase tracking-wider opacity-70">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value ?? 0}</div>
      </div>
    </div>
  );
}
