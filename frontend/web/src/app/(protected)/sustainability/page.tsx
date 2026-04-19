"use client";

import { useEffect, useState, useCallback } from "react";
import { sustainabilityApi } from "@/lib/api";
import {
  Leaf,
  Zap,
  Cloud,
  Trees,
  Plane,
  RefreshCw,
  Loader2,
  Database,
  Archive,
} from "lucide-react";

type Snapshot = {
  green_index: number;
  bytes_stored: number;
  bytes_deduped: number;
  bytes_archived: number;
  kwh_saved: number;
  co2_kg_avoided: number;
  jobs_deferred: number;
  equivalentTreesPerYear?: number;
  equivalentFlightsKm?: number;
  captured_at: string;
};

type TrendPoint = {
  captured_at: string;
  green_index: number;
  kwh_saved: number;
  co2_kg_avoided: number;
};

function fmtBytes(b: number): string {
  if (!b || b < 1024) return `${b ?? 0} B`;
  const u = ["KB", "MB", "GB", "TB", "PB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(2)} ${u[i]}`;
}

export default function SustainabilityPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([
        sustainabilityApi.snapshot(),
        sustainabilityApi.trend(30),
      ]);
      setSnap(s.data.data as Snapshot);
      setTrend((t.data.data || []) as TrendPoint[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await sustainabilityApi.refresh();
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!snap) {
    return <div className="p-6 text-slate-500">No snapshot available.</div>;
  }

  const gi = Math.round(snap.green_index ?? 0);
  const giColor =
    gi >= 75 ? "text-emerald-600" : gi >= 50 ? "text-amber-600" : "text-red-600";
  const giBg =
    gi >= 75
      ? "bg-emerald-50 border-emerald-200"
      : gi >= 50
      ? "bg-amber-50 border-amber-200"
      : "bg-red-50 border-red-200";

  const maxTrend = Math.max(1, ...trend.map((p) => p.green_index || 0));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Leaf className="h-7 w-7 text-emerald-500" />
            <h1 className="text-2xl font-bold tracking-tight">Carbon-Aware Storage</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Composite Green Index across deduplication, archival tiering &amp; deferred indexing.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Green Index hero */}
      <div className={`rounded-xl border p-6 ${giBg}`}>
        <div className="flex items-end gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Green Index</div>
            <div className={`text-6xl font-bold ${giColor}`}>{gi}</div>
            <div className="text-sm text-slate-600 mt-1">
              {gi >= 75
                ? "Excellent — strong dedup &amp; archival posture."
                : gi >= 50
                ? "Healthy — opportunity to deepen archival tiering."
                : "Needs attention — increase dedup &amp; archive cold data."}
            </div>
          </div>
          <div className="ml-auto text-right text-xs text-slate-500">
            captured {new Date(snap.captured_at).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          icon={<Zap className="h-5 w-5 text-amber-500" />}
          label="kWh Saved"
          value={(snap.kwh_saved ?? 0).toFixed(2)}
        />
        <Stat
          icon={<Cloud className="h-5 w-5 text-sky-500" />}
          label="kg CO₂ Avoided"
          value={(snap.co2_kg_avoided ?? 0).toFixed(2)}
        />
        <Stat
          icon={<Trees className="h-5 w-5 text-emerald-500" />}
          label="≈ Trees / yr"
          value={(snap.equivalentTreesPerYear ?? 0).toFixed(1)}
        />
        <Stat
          icon={<Plane className="h-5 w-5 text-indigo-500" />}
          label="≈ Flight km Saved"
          value={(snap.equivalentFlightsKm ?? 0).toFixed(0)}
        />
      </div>

      {/* Storage profile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat
          icon={<Database className="h-5 w-5 text-slate-500" />}
          label="Bytes Stored"
          value={fmtBytes(snap.bytes_stored ?? 0)}
        />
        <Stat
          icon={<Database className="h-5 w-5 text-emerald-500" />}
          label="Bytes Deduplicated"
          value={fmtBytes(snap.bytes_deduped ?? 0)}
        />
        <Stat
          icon={<Archive className="h-5 w-5 text-blue-500" />}
          label="Bytes Archived"
          value={fmtBytes(snap.bytes_archived ?? 0)}
        />
      </div>

      {/* Trend */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-sm">Green Index Trend (last 30 days)</h2>
          <span className="text-xs text-slate-500">{trend.length} samples</span>
        </div>
        {trend.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center">
            No history yet — refresh to capture first datapoint.
          </div>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {trend.map((p, i) => {
              const h = Math.max(2, ((p.green_index ?? 0) / maxTrend) * 100);
              return (
                <div
                  key={i}
                  className="flex-1 bg-emerald-400/70 hover:bg-emerald-500 rounded-t"
                  style={{ height: `${h}%` }}
                  title={`${new Date(p.captured_at).toLocaleDateString()} · GI ${Math.round(
                    p.green_index ?? 0
                  )}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center gap-2">
        {icon}
        <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      </div>
      <div className="text-2xl font-bold mt-2 text-slate-900">{value}</div>
    </div>
  );
}
