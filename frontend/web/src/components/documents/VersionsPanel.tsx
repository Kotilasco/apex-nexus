'use client';

import { useState, useEffect } from 'react';
import { documentApi, projectApi } from '@/lib/api';
import type { Document, DocumentVersion } from '@/lib/types';
import { formatBytes, formatDateTime } from '@/lib/utils';
import { X, Download, History, Eye, AlertTriangle, GitCompare, Copy, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const DocxViewer = dynamic(() => import('@/components/documents/DocxViewer'), { ssr: false });

interface Props {
  document: Document;
  onClose: () => void;
}

export default function VersionsPanel({ document: doc, onClose }: Props) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<[number | null, number | null]>([null, null]);
  const [compareResult, setCompareResult] = useState<{ text1: string; text2: string; version1: string; version2: string } | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Copy to Project state
  const [copyVersion, setCopyVersion] = useState<number | null>(null);
  const [copyProjects, setCopyProjects] = useState<{ id: string; name: string }[]>([]);
  const [copyTargetProject, setCopyTargetProject] = useState('');
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    documentApi.getVersions(doc.id)
      .then(res => setVersions(res.data?.data ?? res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [doc.id]);

  const handleDownload = async (version: DocumentVersion) => {
    try {
      const res = await documentApi.downloadVersion(doc.id, version.versionNumber);
      const url = URL.createObjectURL(res.data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = version.fileName || doc.title;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const handlePreview = async (version: DocumentVersion) => {
    if (previewVersion === version.versionNumber) {
      // Toggle off
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewText(null);
      setPreviewVersion(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewVersion(version.versionNumber);
    setPreviewText(null);
    try {
      const res = await documentApi.downloadVersion(doc.id, version.versionNumber);
      const mime = doc.mimeType || '';
      if (mime.startsWith('text/') || mime === 'application/json') {
        const text = await res.data.text();
        setPreviewText(text);
      }
      const url = URL.createObjectURL(res.data);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
    } catch {
      setPreviewVersion(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDocx = doc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  // Compare mode handlers
  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    setCompareSelection([null, null]);
    setCompareResult(null);
  };

  const handleCompareSelect = (versionNum: number) => {
    if (!compareMode) return;
    setCompareSelection(prev => {
      if (prev[0] === null) return [versionNum, null];
      if (prev[0] === versionNum) return [null, null];
      if (prev[1] === versionNum) return [prev[0], null];
      return [prev[0], versionNum];
    });
  };

  const runComparison = async () => {
    const [v1, v2] = compareSelection;
    if (v1 === null || v2 === null) return;
    setCompareLoading(true);
    try {
      const res = await documentApi.compareVersions(doc.id, v1, v2);
      const data = res.data?.data ?? res.data;
      setCompareResult(data);
    } catch {
      alert('Failed to compare versions — text extraction may not be available for this file type.');
    } finally {
      setCompareLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[600px] bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary-600" />
          <h2 className="font-semibold text-slate-900">Versions — {doc.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleCompareMode}
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${
              compareMode ? 'bg-primary-100 text-primary-700 border border-primary-300' : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="Compare versions side-by-side"
          >
            <GitCompare className="h-4 w-4" />
            {compareMode ? 'Exit Compare' : 'Compare'}
          </button>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {/* Compare mode instructions */}
        {compareMode && !compareResult && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm">
            <p className="text-primary-800 font-medium">Select two versions to compare</p>
            <p className="text-primary-600 text-xs mt-1">
              {compareSelection[0] === null
                ? 'Click on the first version'
                : compareSelection[1] === null
                ? `V${compareSelection[0]} selected — now click the second version`
                : `Comparing V${compareSelection[0]} vs V${compareSelection[1]}`}
            </p>
            {compareSelection[0] !== null && compareSelection[1] !== null && (
              <button
                onClick={runComparison}
                disabled={compareLoading}
                className="mt-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {compareLoading ? (
                  <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> Extracting text...</>
                ) : (
                  <><GitCompare className="h-3 w-3" /> Compare Now</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Compare result — side-by-side text */}
        {compareResult && (
          <div className="border border-primary-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-primary-50 px-3 py-2 border-b border-primary-200">
              <span className="text-xs font-semibold text-primary-800">
                Side-by-Side Comparison: V{compareResult.version1} vs V{compareResult.version2}
              </span>
              <button
                onClick={() => setCompareResult(null)}
                className="text-xs text-primary-600 hover:text-primary-800 underline"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-200 max-h-[400px] overflow-auto">
              <div className="p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Version {compareResult.version1}
                </p>
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                  {compareResult.text1}
                </pre>
              </div>
              <div className="p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Version {compareResult.version2}
                </p>
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                  {compareResult.text2}
                </pre>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : versions.length === 0 ? (
          <p className="text-center text-slate-400 py-8">No version history</p>
        ) : (
          versions.map((v, i) => (
            <div key={v.id}>
              <div
                className={`border rounded-lg p-3 transition cursor-pointer ${
                  compareMode && (compareSelection[0] === v.versionNumber || compareSelection[1] === v.versionNumber)
                    ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-300'
                    : previewVersion === v.versionNumber
                    ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-300'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => compareMode ? handleCompareSelect(v.versionNumber) : handlePreview(v)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-900">
                    {compareMode && (compareSelection[0] === v.versionNumber || compareSelection[1] === v.versionNumber) && (
                      <span className="mr-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary-600 text-white text-[10px]">
                        {compareSelection[0] === v.versionNumber ? '1' : '2'}
                      </span>
                    )}
                    Version {v.versionNumber}
                    {i === 0 && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Current</span>}
                    {v.anomalyFlagged && (
                      <span
                        className="ml-2 inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full"
                        title={`Anomaly Score: ${((v.anomalyScore ?? 0) * 100).toFixed(0)}% | Similarity: ${((v.similarityScore ?? 1) * 100).toFixed(0)}%`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        AI Anomaly
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePreview(v); }}
                      className="p-1.5 rounded-lg hover:bg-slate-200"
                      title="Preview this version"
                    >
                      <Eye className="h-4 w-4 text-primary-500" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(v); }}
                      className="p-1.5 rounded-lg hover:bg-slate-200"
                      title="Download this version"
                    >
                      <Download className="h-4 w-4 text-slate-500" />
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setCopyVersion(v.versionNumber);
                        setCopyTargetProject('');
                        try {
                          const res = await projectApi.getMine();
                          setCopyProjects(res.data?.data ?? res.data ?? []);
                        } catch { setCopyProjects([]); }
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-200"
                      title="Copy this version to another project"
                    >
                      <Copy className="h-4 w-4 text-emerald-500" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{v.fileName} • {formatBytes(v.fileSizeBytes)}</p>
                {v.changeSummary && <p className="text-xs text-slate-600 mt-1">{v.changeSummary}</p>}
                <p className="text-[10px] text-slate-400 mt-1">by {v.authorName} • {formatDateTime(v.createdAt)}</p>
                {v.anomalyFlagged && v.anomalyReasons && v.anomalyReasons.length > 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    <div className="flex items-center gap-1 font-semibold mb-1">
                      <AlertTriangle className="h-3 w-3" />
                      Potential Version Mismatch
                    </div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {v.anomalyReasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                    <p className="mt-1 text-[10px] text-red-500">
                      Similarity: {((v.similarityScore ?? 1) * 100).toFixed(0)}% • This may be a wrong document checked in by mistake.
                    </p>
                  </div>
                )}
              </div>

              {/* Inline preview for the selected version */}
              {previewVersion === v.versionNumber && (
                <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                  {previewLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                      <span className="ml-2 text-sm text-slate-500">Loading preview…</span>
                    </div>
                  ) : previewText !== null ? (
                    <pre className="p-4 text-xs font-mono text-slate-800 bg-white max-h-[400px] overflow-auto whitespace-pre-wrap">{previewText}</pre>
                  ) : previewUrl && isDocx ? (
                    <div className="h-[400px]">
                      <DocxViewer url={previewUrl} />
                    </div>
                  ) : previewUrl && doc.mimeType === 'application/pdf' ? (
                    <iframe src={previewUrl} className="w-full h-[400px]" title={`Version ${v.versionNumber}`} />
                  ) : previewUrl && doc.mimeType?.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt={`Version ${v.versionNumber}`} className="max-h-[400px] mx-auto" />
                  ) : previewUrl && doc.mimeType?.startsWith('video/') ? (
                    <video src={previewUrl} controls className="w-full max-h-[400px]" />
                  ) : previewUrl && doc.mimeType?.startsWith('audio/') ? (
                    <div className="p-6 flex items-center justify-center"><audio src={previewUrl} controls /></div>
                  ) : previewUrl ? (
                    <div className="p-4 text-center text-sm text-slate-500">
                      Preview not available for this file type.{' '}
                      <button onClick={() => handleDownload(v)} className="text-primary-600 underline">Download</button> instead.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {/* Copy to Project Modal */}
      {copyVersion !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setCopyVersion(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-[420px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Copy Version {copyVersion} to Project</h3>
            <p className="text-sm text-gray-600 mb-4">Document: <span className="font-medium">{doc.title}</span></p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Project</label>
            <select
              value={copyTargetProject}
              onChange={e => setCopyTargetProject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="">— Choose a project —</option>
              {copyProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCopyVersion(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button
                disabled={!copyTargetProject || copying}
                onClick={async () => {
                  setCopying(true);
                  try {
                    await documentApi.copyVersionToProject(doc.id, copyVersion, { targetProjectId: copyTargetProject });
                    setCopyVersion(null);
                    alert('Version copied successfully!');
                  } catch { alert('Failed to copy version'); }
                  finally { setCopying(false); }
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {copying && <Loader2 className="h-4 w-4 animate-spin" />}
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
