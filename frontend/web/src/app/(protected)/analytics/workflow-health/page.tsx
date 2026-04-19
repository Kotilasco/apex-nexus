"use client";

import { useEffect, useState } from "react";
import { workflowHealthApi } from "@/lib/api";
import { Activity, AlertTriangle, Clock, TrendingUp, Users, Loader2, RefreshCw } from "lucide-react";

interface HealthData {
  counts: { active: number; completed: number; escalated: number; sla_breached: number; total: number };
  stateTimings: Array<{ state: string; transitions: number; avg_hours: number; max_hours: number }>;
  stateDistribution: Array<{ state: string; count: number }>;
  stuckInstances: Array<{
    id: string; current_state: string; document_title: string;
    assigned_to_name: string; hours_stuck: number; priority: number; escalation_level: number;
  }>;
  throughputByDay: Array<{ day: string; completed: number }>;
  topActors: Array<{ username: string; actions_taken: number; avg_response_hours: number }>;
}

export default function WorkflowHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await workflowHealthApi.overview(days);
      setData(r.data?.data || r.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const heatColor = (hours: number) => {
    if (hours == null) return "#e2e8f0";
    if (hours < 4) return "#bbf7d0";
    if (hours < 12) return "#fde68a";
    if (hours < 48) return "#fdba74";
    return "#fca5a5";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" /> Workflow Health Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Predictive bottleneck analytics — find slow stages, stuck approvals, and SLA breaches.
          </p>
        </div>
        <div className="flex gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="border rounded-md px-2 py-1 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={load} className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {loading && <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading metrics…</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}

      {data && (
        <>
          {/* Counts */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Active" value={data.counts.active} icon={<Activity className="w-4 h-4" />} />
            <Stat label="Completed" value={data.counts.completed} icon={<TrendingUp className="w-4 h-4" />} color="green" />
            <Stat label="Escalated" value={data.counts.escalated} icon={<AlertTriangle className="w-4 h-4" />} color="orange" />
            <Stat label="SLA breached" value={data.counts.sla_breached} icon={<Clock className="w-4 h-4" />} color="red" />
            <Stat label="Total (window)" value={data.counts.total} icon={<Users className="w-4 h-4" />} />
          </div>

          {/* Bottleneck heatmap */}
          <section className="bg-white border rounded-lg shadow-sm p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> State Bottleneck Heatmap
            </h2>
            {data.stateTimings.length === 0 && <p className="text-sm text-slate-400">No transitions in this window.</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.stateTimings.map((s) => (
                <div
                  key={s.state}
                  className="rounded-md p-3 border"
                  style={{ background: heatColor(s.avg_hours) }}
                >
                  <div className="font-medium text-sm">{s.state}</div>
                  <div className="text-2xl font-bold">{s.avg_hours?.toFixed(1) ?? "—"}<span className="text-sm font-normal"> h avg</span></div>
                  <div className="text-xs text-slate-600">
                    {s.transitions} transitions · max {s.max_hours?.toFixed(1)}h
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-400 mt-3 flex gap-3">
              <span><span className="inline-block w-3 h-3 rounded mr-1" style={{ background: "#bbf7d0" }} />&lt;4h</span>
              <span><span className="inline-block w-3 h-3 rounded mr-1" style={{ background: "#fde68a" }} />4-12h</span>
              <span><span className="inline-block w-3 h-3 rounded mr-1" style={{ background: "#fdba74" }} />12-48h</span>
              <span><span className="inline-block w-3 h-3 rounded mr-1" style={{ background: "#fca5a5" }} />48h+</span>
            </div>
          </section>

          {/* Stuck instances */}
          <section className="bg-white border rounded-lg shadow-sm p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" /> Stuck Instances ({data.stuckInstances.length})
            </h2>
            {data.stuckInstances.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing stuck — workflows are flowing.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 border-b">
                  <tr><th className="py-2">Document</th><th>State</th><th>Assigned to</th><th className="text-right">Stuck for</th><th>Priority</th></tr>
                </thead>
                <tbody>
                  {data.stuckInstances.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 truncate max-w-xs">{s.document_title || s.id.slice(0, 8)}</td>
                      <td><span className="text-xs px-2 py-0.5 rounded bg-slate-100">{s.current_state}</span></td>
                      <td className="text-slate-600">{s.assigned_to_name || "—"}</td>
                      <td className="text-right font-mono text-orange-700">{s.hours_stuck?.toFixed(1)}h</td>
                      <td>{s.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Top actors */}
          <section className="bg-white border rounded-lg shadow-sm p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Top Approvers
            </h2>
            {data.topActors.length === 0 ? (
              <p className="text-sm text-slate-400">No approval activity yet.</p>
            ) : (
              <div className="space-y-2">
                {data.topActors.map((a) => (
                  <div key={a.username} className="flex items-center justify-between">
                    <span className="text-sm">{a.username}</span>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{a.actions_taken} actions</span>
                      <span>avg {a.avg_response_hours?.toFixed(1)}h</span>
                      <div className="w-32 bg-slate-100 rounded h-2">
                        <div className="bg-blue-500 h-2 rounded" style={{ width: `${Math.min(100, (a.actions_taken / Math.max(1, data.topActors[0].actions_taken)) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, icon, color = "blue" }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50",
    green: "text-green-600 bg-green-50",
    orange: "text-orange-600 bg-orange-50",
    red: "text-red-600 bg-red-50",
  };
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${colors[color]} mb-2`}>{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
