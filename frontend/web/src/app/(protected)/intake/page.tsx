"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { intakeApi, projectApi } from "@/lib/api";
import {
  Inbox,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FolderKanban,
  FileText,
  Brain,
  Layers,
  Tag,
  ArrowRight,
} from "lucide-react";

type IntakeRow = {
  id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  status: string;
  classification: string | null;
  confidence: number | null;
  suggested_project: string | null;
  suggested_project_name: string | null;
  suggested_tags: string[] | null;
  document_id: string | null;
  document_title: string | null;
  error_message: string | null;
};

const STATUS_META: Record<string, { color: string; label: string; icon: any }> = {
  PENDING: { color: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", label: "Queued", icon: Loader2 },
  UPLOADED: { color: "bg-blue-500/15 text-blue-300 border-blue-500/30", label: "Uploaded", icon: Upload },
  CLASSIFIED: { color: "bg-purple-500/15 text-purple-300 border-purple-500/30", label: "Classified", icon: Brain },
  ROUTED: { color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "Routed", icon: CheckCircle2 },
  ROUTED_AND_WORKFLOW: { color: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40", label: "Routed + Workflow Started", icon: Sparkles },
  CLASSIFICATION_FAILED: { color: "bg-amber-500/15 text-amber-300 border-amber-500/30", label: "Needs Review", icon: AlertCircle },
  FAILED: { color: "bg-red-500/15 text-red-300 border-red-500/30", label: "Failed", icon: AlertCircle },
};

export default function IntakePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [autoRoute, setAutoRoute] = useState(true);
  const [pinnedProjectId, setPinnedProjectId] = useState<string>("");
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<IntakeRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    projectApi.list().then((r: any) => {
      const items = r.data?.data || r.data || [];
      setProjects(Array.isArray(items) ? items.map((p: any) => ({ id: p.id, name: p.name })) : []);
    }).catch(() => {});
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length) setFiles((prev) => [...prev, ...picked]);
  };

  const submit = async () => {
    if (!files.length) return;
    setSubmitting(true);
    setRows([]);
    setBatchId(null);
    try {
      const resp: any = await intakeApi.upload(files, autoRoute, pinnedProjectId || undefined);
      const bid = resp.data?.data?.batchId;
      setBatchId(bid);
      setFiles([]);
      // Initial fetch + start polling
      await refresh(bid);
      pollRef.current = setInterval(() => refresh(bid), 2000);
    } catch (err: any) {
      alert("Upload failed: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const refresh = async (bid?: string | null) => {
    const id = bid || batchId;
    if (!id) return;
    try {
      const resp: any = await intakeApi.batch(id);
      const next: IntakeRow[] = resp.data?.data || [];
      setRows(next);
      const allDone = next.length > 0 && next.every((r) =>
        ["ROUTED", "ROUTED_AND_WORKFLOW", "CLASSIFIED", "FAILED", "CLASSIFICATION_FAILED"].includes(r.status));
      if (allDone && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (e) {
      /* ignore */
    }
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
          <Inbox className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Intelligent Intake</h1>
          <p className="text-sm text-zinc-400">
            Drop any files. The system reads, classifies (Structural + Textual + Semantic AI),
            routes to the right project, and starts the right workflow — automatically.
            <span className="ml-2 italic text-zinc-500">You're the manager, not the librarian.</span>
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-10 text-center transition-all ${
          dragOver ? "border-purple-400 bg-purple-500/10" : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-600"
        }`}
      >
        <Upload className="w-10 h-10 mx-auto text-zinc-500 mb-3" />
        <p className="text-zinc-300 font-medium mb-1">Drop files here, or click to browse</p>
        <p className="text-xs text-zinc-500 mb-4">PDF, DOCX, XLSX, images, text — anything</p>
        <input
          id="intake-file-input"
          type="file"
          multiple
          className="hidden"
          onChange={onPick}
        />
        <label
          htmlFor="intake-file-input"
          className="inline-block cursor-pointer px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm border border-zinc-700"
        >
          Browse files
        </label>
      </div>

      {/* Pending file list */}
      {files.length > 0 && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-sm text-zinc-400 mb-2">{files.length} file(s) ready to intake:</div>
          <ul className="text-sm text-zinc-200 space-y-1 max-h-40 overflow-auto">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-500" />
                <span>{f.name}</span>
                <span className="text-xs text-zinc-500">({Math.round(f.size / 1024)} KB)</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={autoRoute}
                onChange={(e) => setAutoRoute(e.target.checked)}
                className="rounded border-zinc-600"
              />
              Auto-route to suggested project + start workflow
            </label>
            <div className="inline-flex items-center gap-2 text-xs text-zinc-300">
              <FolderKanban className="w-3.5 h-3.5 text-zinc-500" />
              <span>Pin to project (override AI):</span>
              <select
                title="Pin to project"
                value={pinnedProjectId}
                onChange={(e) => setPinnedProjectId(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
              >
                <option value="">— Let AI choose —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setFiles([])}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Clear
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Capture &amp; Classify
            </button>
          </div>
        </div>
      )}

      {/* Results table */}
      {rows.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              Capture batch <span className="font-mono text-xs text-zinc-500">{batchId?.slice(0, 8)}…</span>
            </h2>
            <button
              onClick={() => refresh()}
              className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded border border-zinc-800"
            >
              Refresh
            </button>
          </div>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-zinc-400 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">File</th>
                  <th className="text-left px-4 py-2">Classification</th>
                  <th className="text-left px-4 py-2">Confidence</th>
                  <th className="text-left px-4 py-2">Routed to</th>
                  <th className="text-left px-4 py-2">Tags</th>
                  <th className="text-left px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.PENDING;
                  const Icon = meta.icon;
                  const conf = r.confidence != null ? Math.round(r.confidence * 100) : null;
                  return (
                    <tr key={r.id} className="border-t border-zinc-800 hover:bg-zinc-900/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-zinc-500" />
                          <span className="text-zinc-200">{r.filename}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.classification ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs">
                            <Brain className="w-3 h-3" />
                            {r.classification}
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-xs italic">analysing…</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {conf != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                                style={{ width: `${conf}%` }}
                              />
                            </div>
                            <span className="text-xs text-zinc-400">{conf}%</span>
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.suggested_project_name ? (
                          <span className="inline-flex items-center gap-1 text-zinc-200 text-xs">
                            <ArrowRight className="w-3 h-3 text-emerald-400" />
                            <FolderKanban className="w-3 h-3 text-emerald-400" />
                            {r.suggested_project_name}
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-xs italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.suggested_tags && r.suggested_tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.suggested_tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px]"
                              >
                                <Tag className="w-2.5 h-2.5" />
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${meta.color}`}>
                          <Icon className={`w-3 h-3 ${r.status === "PENDING" || r.status === "UPLOADED" ? "animate-spin" : ""}`} />
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer summary */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="text-zinc-500 mb-1">Layer 1 — Structural</div>
              <div className="text-zinc-200">MIME type · extension · file size</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="text-zinc-500 mb-1">Layer 2 — Textual</div>
              <div className="text-zinc-200">Keywords · regex rules · OCR text</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="text-zinc-500 mb-1">Layer 3 — Semantic AI</div>
              <div className="text-zinc-200">LLM understanding · intent · priority</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
