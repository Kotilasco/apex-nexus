"use client";

import { useEffect, useState, useCallback } from "react";
import { casesApi } from "@/lib/api";
import {
  FolderHeart,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";

type Case = {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  closed_at?: string | null;
  outcome?: string | null;
};

type Detail = {
  case: Case;
  tasks: any[];
  participants: any[];
  attachments: any[];
  events: any[];
};

const CATEGORIES = [
  "ASSET_REPAIR",
  "VENDOR_DISPUTE",
  "COMPLIANCE_INCIDENT",
  "OUTAGE_RESPONSE",
  "POLICY_REVIEW",
  "GENERAL",
];

const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 border-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
  WAITING: "bg-slate-50 text-slate-700 border-slate-200",
  CLOSED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        casesApi.summary(),
        casesApi.list(statusFilter || undefined),
      ]);
      setSummary(s.data.data);
      setCases((l.data.data || []) as Case[]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id: string) => {
    const r = await casesApi.get(id);
    setSelected(r.data.data as Detail);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FolderHeart className="h-7 w-7 text-rose-500" />
            <h1 className="text-2xl font-bold tracking-tight">Adaptive Case Management</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Non-linear case folders that orchestrate documents, people, tasks &amp; outcomes.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> New Case
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Open", value: summary.open ?? 0, color: "text-blue-600" },
            { label: "In Progress", value: summary.in_progress ?? 0, color: "text-amber-600" },
            { label: "Waiting", value: summary.waiting ?? 0, color: "text-slate-600" },
            { label: "Closed", value: summary.closed ?? 0, color: "text-emerald-600" },
            { label: "Total", value: summary.total ?? 0, color: "text-slate-900" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">{s.label}</div>
              <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Status:</span>
        {["", "OPEN", "IN_PROGRESS", "WAITING", "CLOSED"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs rounded-full border ${
              statusFilter === s
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          No cases yet. Create the first one to get started.
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => openDetail(c.id)}
              className="w-full text-left p-4 hover:bg-slate-50 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 truncate">{c.title}</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] uppercase rounded border ${
                      STATUS_COLOR[c.status] || "bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {c.category} · priority {c.priority} ·{" "}
                  {new Date(c.created_at).toLocaleDateString()}
                </div>
                {c.description && (
                  <div className="text-sm text-slate-600 mt-2 line-clamp-2">{c.description}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await load();
          }}
        />
      )}

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer
          detail={selected}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            const r = await casesApi.get(selected.case.id);
            setSelected(r.data.data as Detail);
            await load();
          }}
        />
      )}
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState("NORMAL");
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">New Case</h2>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Case title"
            className="w-full px-3 py-2 border rounded text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={3}
            className="w-full px-3 py-2 border rounded text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 border rounded text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="px-3 py-2 border rounded text-sm"
            >
              {["LOW", "NORMAL", "HIGH", "CRITICAL"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm border rounded">
            Cancel
          </button>
          <button
            disabled={busy || !title.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await casesApi.create({ title, description, category, priority });
                onCreated();
              } finally {
                setBusy(false);
              }
            }}
            className="px-3 py-2 text-sm rounded bg-primary-600 text-white disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailDrawer({
  detail,
  onClose,
  onChanged,
}: {
  detail: Detail;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [taskTitle, setTaskTitle] = useState("");
  const [outcome, setOutcome] = useState("");
  const c = detail.case;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">{c.category}</div>
            <h2 className="font-semibold text-lg">{c.title}</h2>
          </div>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <div>
            <div className="text-xs uppercase text-slate-500 mb-1">Description</div>
            <div className="text-sm text-slate-700">{c.description || "—"}</div>
          </div>

          {/* Tasks */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">Tasks ({detail.tasks?.length ?? 0})</h3>
            </div>
            <div className="space-y-2">
              {(detail.tasks || []).map((t: any) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2 border rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    {t.status === "DONE" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-500" />
                    )}
                    <span className={t.status === "DONE" ? "line-through text-slate-400" : ""}>
                      {t.title}
                    </span>
                  </div>
                  {t.status !== "DONE" && (
                    <button
                      onClick={async () => {
                        await casesApi.completeTask(t.id);
                        onChanged();
                      }}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      Complete
                    </button>
                  )}
                </div>
              ))}
            </div>
            {c.status !== "CLOSED" && (
              <div className="flex gap-2 mt-2">
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="New task"
                  className="flex-1 px-2 py-1 border rounded text-sm"
                />
                <button
                  onClick={async () => {
                    if (!taskTitle.trim()) return;
                    await casesApi.addTask(c.id, { title: taskTitle });
                    setTaskTitle("");
                    onChanged();
                  }}
                  className="px-3 py-1 text-sm bg-slate-900 text-white rounded"
                >
                  Add
                </button>
              </div>
            )}
          </section>

          {/* Participants */}
          <section>
            <h3 className="font-medium text-sm mb-2">
              Participants ({detail.participants?.length ?? 0})
            </h3>
            <div className="flex flex-wrap gap-2">
              {(detail.participants || []).map((p: any) => (
                <span
                  key={p.id}
                  className="px-2 py-1 text-xs bg-slate-100 rounded-full"
                >
                  {p.full_name || p.username || p.external_email} · {p.role}
                </span>
              ))}
            </div>
          </section>

          {/* Attachments */}
          <section>
            <h3 className="font-medium text-sm mb-2">
              Attached Documents ({detail.attachments?.length ?? 0})
            </h3>
            {(detail.attachments || []).length === 0 ? (
              <div className="text-xs text-slate-500">No attached documents.</div>
            ) : (
              <ul className="text-sm space-y-1">
                {(detail.attachments || []).map((a: any) => (
                  <li key={a.id} className="text-slate-700">
                    {a.title || a.document_id}
                    {a.note && <span className="text-slate-400"> — {a.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Events */}
          <section>
            <h3 className="font-medium text-sm mb-2">Activity</h3>
            <ol className="border-l border-slate-200 pl-4 space-y-2 text-xs text-slate-600">
              {(detail.events || []).map((e: any) => (
                <li key={e.id}>
                  <span className="font-mono">{e.event_type}</span>
                  {e.event_text && <> — {e.event_text}</>}
                  <span className="text-slate-400">
                    {" "}
                    · {new Date(e.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* Close */}
          {c.status !== "CLOSED" && (
            <section className="border-t pt-4">
              <div className="flex gap-2">
                <input
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="Resolution outcome"
                  className="flex-1 px-2 py-1 border rounded text-sm"
                />
                <button
                  disabled={!outcome.trim()}
                  onClick={async () => {
                    await casesApi.close(c.id, outcome);
                    onChanged();
                  }}
                  className="px-3 py-1 text-sm rounded bg-emerald-600 text-white disabled:opacity-50"
                >
                  Close case
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
