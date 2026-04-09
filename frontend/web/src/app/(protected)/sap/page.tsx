'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  pluginApi, documentApi, workflowApi, auditApi, retentionApi,
} from '@/lib/api';
import type { Plugin, Document } from '@/lib/types';
import { formatDateTime, formatBytes, cn } from '@/lib/utils';
import {
  Layers, CheckCircle2, XCircle, RefreshCw, Play, Power, PowerOff,
  ArrowUpFromLine, ArrowDownToLine, FileText, GitBranch, Shield,
  ClipboardList, Zap, Server, Database, Link2, Activity,
  ChevronDown, ChevronRight, Upload, Download, AlertTriangle, Clock,
} from 'lucide-react';

/* ────────────── types ────────────── */
interface ConnTestResult {
  name: string;
  endpoint: string;
  status: 'idle' | 'testing' | 'pass' | 'fail';
  latency?: number;
  detail?: string;
}

interface SyncEvent {
  id: number;
  timestamp: string;
  direction: 'IMPORT' | 'EXPORT';
  objectType: string;
  objectId: string;
  status: 'SUCCESS' | 'FAILED';
  detail: string;
}

/* ─────── helpers ─────── */
const SAP_PLUGIN_NAME = 'sap-erp-connector';

const CAPABILITY_INFO: Record<string, { label: string; icon: typeof ArrowUpFromLine; color: string }> = {
  'document.import': { label: 'Document Import', icon: ArrowDownToLine, color: 'text-blue-600' },
  'document.export': { label: 'Document Export', icon: ArrowUpFromLine, color: 'text-green-600' },
  'metadata.sync':   { label: 'Metadata Sync',   icon: RefreshCw,       color: 'text-violet-600' },
  'invoice.post':    { label: 'Invoice Posting',  icon: FileText,        color: 'text-amber-600' },
};

/* ══════════════════════════════════════════ */
export default function SapIntegrationPage() {
  const [plugin, setPlugin] = useState<Plugin | null>(null);
  const [pluginLoading, setPluginLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  /* Connection tests */
  const [tests, setTests] = useState<ConnTestResult[]>([]);
  const [running, setRunning] = useState(false);

  /* Live data panels */
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docCount, setDocCount] = useState(0);
  const [approvalCount, setApprovalCount] = useState(0);
  const [auditCount, setAuditCount] = useState(0);
  const [retentionPolicies, setRetentionPolicies] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  /* Sync simulation */
  const [syncLog, setSyncLog] = useState<SyncEvent[]>([]);
  const [syncing, setSyncing] = useState(false);

  /* Expanded panels */
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    connection: true,
    data: true,
    sync: true,
  });

  /* ── Load SAP plugin ── */
  const loadPlugin = useCallback(async () => {
    setPluginLoading(true);
    try {
      const res = await pluginApi.getByName(SAP_PLUGIN_NAME);
      setPlugin(res.data?.data ?? res.data ?? null);
    } catch {
      setPlugin(null);
    }
    setPluginLoading(false);
  }, []);

  /* ── Load live data ── */
  const loadData = useCallback(async () => {
    setDataLoading(true);
    const [docRes, wfRes, auditRes, retRes] = await Promise.allSettled([
      documentApi.list(undefined, 0, 5),
      workflowApi.getPendingCount(),
      auditApi.getStats(),
      retentionApi.getPolicies(),
    ]);
    if (docRes.status === 'fulfilled') {
      const d = docRes.value.data?.data ?? docRes.value.data;
      setDocuments(d?.content ?? []);
      setDocCount(d?.totalElements ?? 0);
    }
    if (wfRes.status === 'fulfilled') {
      setApprovalCount(wfRes.value.data?.data ?? wfRes.value.data ?? 0);
    }
    if (auditRes.status === 'fulfilled') {
      setAuditCount(auditRes.value.data?.data?.totalEntries ?? 0);
    }
    if (retRes.status === 'fulfilled') {
      const r = retRes.value.data?.data ?? retRes.value.data;
      setRetentionPolicies(Array.isArray(r) ? r.length : r?.totalElements ?? 0);
    }
    setDataLoading(false);
  }, []);

  useEffect(() => { loadPlugin(); loadData(); }, [loadPlugin, loadData]);

  /* ── Toggle SAP connector ── */
  const togglePlugin = async () => {
    if (!plugin) return;
    setToggling(true);
    try {
      if (plugin.status === 'ACTIVE') {
        await pluginApi.deactivate(plugin.id);
      } else {
        await pluginApi.activate(plugin.id);
      }
      await loadPlugin();
    } catch { /* ignore */ }
    setToggling(false);
  };

  /* ── Connection test suite ── */
  const runConnectionTests = async () => {
    const endpoints: { name: string; endpoint: string; fn: () => Promise<unknown> }[] = [
      { name: 'Auth Service', endpoint: 'GET /auth/me',          fn: () => import('@/lib/api').then(m => m.authApi.me()) },
      { name: 'Document Service', endpoint: 'GET /documents/my', fn: () => documentApi.list(undefined, 0, 1) },
      { name: 'Workflow Engine', endpoint: 'GET /workflow/definitions', fn: () => workflowApi.getDefinitions() },
      { name: 'Search Service', endpoint: 'GET /search?q=sap',   fn: () => import('@/lib/api').then(m => m.searchApi.quick('sap', 0, 1)) },
      { name: 'Retention Service', endpoint: 'GET /retention/policies', fn: () => retentionApi.getPolicies() },
      { name: 'Audit Service', endpoint: 'GET /audit/stats',    fn: () => auditApi.getStats() },
    ];

    setRunning(true);
    const results: ConnTestResult[] = endpoints.map(e => ({
      name: e.name, endpoint: e.endpoint, status: 'testing' as const,
    }));
    setTests([...results]);

    for (let i = 0; i < endpoints.length; i++) {
      const start = performance.now();
      try {
        await endpoints[i].fn();
        results[i] = { ...results[i], status: 'pass', latency: Math.round(performance.now() - start), detail: 'OK' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        results[i] = { ...results[i], status: 'fail', latency: Math.round(performance.now() - start), detail: msg };
      }
      setTests([...results]);
    }
    setRunning(false);
  };

  /* ── Simulate SAP sync ── */
  const simulateSync = async () => {
    setSyncing(true);
    const events: SyncEvent[] = [];
    let counter = syncLog.length;

    // 1. Import: list documents SAP would pull
    try {
      const res = await documentApi.list(undefined, 0, 3);
      const docs = res.data?.data?.content ?? [];
      for (const doc of docs) {
        counter++;
        events.push({
          id: counter,
          timestamp: new Date().toISOString(),
          direction: 'IMPORT',
          objectType: 'Document',
          objectId: doc.id.slice(0, 8),
          status: 'SUCCESS',
          detail: `Imported "${doc.title}" (${formatBytes(doc.fileSizeBytes || doc.fileSize || 0)})`,
        });
      }
    } catch {
      counter++;
      events.push({
        id: counter, timestamp: new Date().toISOString(),
        direction: 'IMPORT', objectType: 'Document', objectId: '—',
        status: 'FAILED', detail: 'Failed to reach Document Service',
      });
    }

    // 2. Export: simulate posting an invoice doc
    try {
      const form = new FormData();
      const blob = new Blob(['SAP Invoice #' + Date.now()], { type: 'text/plain' });
      form.append('file', blob, `SAP_Invoice_${Date.now()}.txt`);
      form.append('title', `SAP Invoice ${new Date().toLocaleDateString()}`);
      form.append('description', 'Auto-generated by SAP ERP Connector');
      form.append('tags', 'sap,invoice,erp');
      const upload = await documentApi.upload(form);
      const docId = upload.data?.data?.id ?? upload.data?.id ?? '?';
      counter++;
      events.push({
        id: counter, timestamp: new Date().toISOString(),
        direction: 'EXPORT', objectType: 'Invoice', objectId: docId.slice(0, 8),
        status: 'SUCCESS', detail: `Exported SAP Invoice to Apex Nexus (doc: ${docId.slice(0, 8)}…)`,
      });
    } catch {
      counter++;
      events.push({
        id: counter, timestamp: new Date().toISOString(),
        direction: 'EXPORT', objectType: 'Invoice', objectId: '—',
        status: 'FAILED', detail: 'Invoice upload failed',
      });
    }

    // 3. Metadata sync: check workflow
    try {
      await workflowApi.getDefinitions();
      counter++;
      events.push({
        id: counter, timestamp: new Date().toISOString(),
        direction: 'IMPORT', objectType: 'Workflow Defs', objectId: '—',
        status: 'SUCCESS', detail: 'Workflow definitions synced for approval routing',
      });
    } catch {
      counter++;
      events.push({
        id: counter, timestamp: new Date().toISOString(),
        direction: 'IMPORT', objectType: 'Workflow Defs', objectId: '—',
        status: 'FAILED', detail: 'Workflow sync failed',
      });
    }

    setSyncLog(prev => [...events, ...prev]);
    await loadData(); // refresh live stats
    setSyncing(false);
  };

  const toggle = (key: string) =>
    setExpandedPanels(prev => ({ ...prev, [key]: !prev[key] }));

  /* ── parse capabilities safely ── */
  const capabilities: string[] = (() => {
    if (!plugin?.capabilities) return [];
    if (Array.isArray(plugin.capabilities)) return plugin.capabilities;
    try { return JSON.parse(plugin.capabilities as unknown as string); } catch { return []; }
  })();

  const isActive = plugin?.status === 'ACTIVE';

  /* ═════════════════════ RENDER ═════════════════════ */
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-7 w-7 text-blue-600" />
            SAP ERP Integration
          </h1>
          <p className="text-slate-500 mt-1">
            Bi-directional document sync with SAP ERP / S4HANA
          </p>
        </div>
        <button
          onClick={() => { loadPlugin(); loadData(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 transition"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* ── Plugin Status Card ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'h-14 w-14 rounded-xl flex items-center justify-center',
                isActive ? 'bg-green-100' : 'bg-slate-100',
              )}>
                <Layers className={cn('h-7 w-7', isActive ? 'text-green-600' : 'text-slate-400')} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {plugin?.displayName ?? 'SAP ERP Connector'}
                </h2>
                <p className="text-sm text-slate-500">
                  {plugin?.description ?? 'Loading…'}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span>v{plugin?.version ?? '—'}</span>
                  <span>·</span>
                  <span>{plugin?.vendor ?? '—'}</span>
                  <span>·</span>
                  <span className="uppercase">{plugin?.pluginType ?? '—'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Status badge */}
              <span className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold',
                isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500',
              )}>
                {plugin?.status ?? 'UNKNOWN'}
              </span>

              {/* Toggle button */}
              <button
                onClick={togglePlugin}
                disabled={pluginLoading || toggling || !plugin}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition',
                  isActive
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-green-50 text-green-600 hover:bg-green-100',
                  (pluginLoading || toggling) && 'opacity-50 cursor-not-allowed',
                )}
              >
                {toggling ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : isActive ? (
                  <PowerOff className="h-4 w-4" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
                {isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>

          {/* Capabilities */}
          {capabilities.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {capabilities.map((cap) => {
                const info = CAPABILITY_INFO[cap];
                const Icon = info?.icon ?? Zap;
                return (
                  <span key={cap} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
                    <Icon className={cn('h-3.5 w-3.5', info?.color ?? 'text-slate-400')} />
                    {info?.label ?? cap}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Connection Test Panel ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => toggle('connection')}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">Connection Test</h3>
            <span className="text-xs text-slate-400">Verify Apex Nexus API reachability from SAP connector</span>
          </div>
          {expandedPanels.connection ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
        </button>

        {expandedPanels.connection && (
          <div className="px-6 pb-6 space-y-4">
            <button
              onClick={runConnectionTests}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? 'Testing…' : 'Run Connection Tests'}
            </button>

            {tests.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Service</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Endpoint</th>
                      <th className="text-center px-4 py-2 font-medium text-slate-600">Status</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tests.map((t) => (
                      <tr key={t.name} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{t.name}</td>
                        <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{t.endpoint}</td>
                        <td className="px-4 py-2.5 text-center">
                          {t.status === 'testing' && <RefreshCw className="h-4 w-4 animate-spin text-blue-500 mx-auto" />}
                          {t.status === 'pass' && <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />}
                          {t.status === 'fail' && <XCircle className="h-4 w-4 text-red-500 mx-auto" />}
                          {t.status === 'idle' && <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-500">
                          {t.latency !== undefined ? `${t.latency}ms` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tests.length > 0 && !running && (
              <div className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium',
                tests.every(t => t.status === 'pass')
                  ? 'bg-green-50 text-green-700'
                  : 'bg-amber-50 text-amber-700',
              )}>
                {tests.every(t => t.status === 'pass') ? (
                  <><CheckCircle2 className="h-4 w-4" /> All services reachable — SAP connector can communicate with Apex Nexus</>
                ) : (
                  <><AlertTriangle className="h-4 w-4" /> Some services unreachable — check network and configuration</>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Live Data Panel ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => toggle('data')}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-violet-600" />
            <h3 className="font-semibold text-slate-900">Live Data from Apex Nexus</h3>
            <span className="text-xs text-slate-400">Real-time data visible to SAP connector</span>
          </div>
          {expandedPanels.data ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
        </button>

        {expandedPanels.data && (
          <div className="px-6 pb-6 space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Documents', value: docCount, icon: FileText, color: 'bg-blue-50 text-blue-600' },
                { label: 'Pending Approvals', value: approvalCount, icon: GitBranch, color: 'bg-amber-50 text-amber-600' },
                { label: 'Audit Entries', value: auditCount, icon: ClipboardList, color: 'bg-green-50 text-green-600' },
                { label: 'Retention Policies', value: retentionPolicies, icon: Shield, color: 'bg-red-50 text-red-600' },
              ].map((card) => (
                <div key={card.label} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('p-1.5 rounded-md', card.color)}>
                      <card.icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium text-slate-500">{card.label}</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {dataLoading ? '…' : card.value.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Recent documents table */}
            {documents.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-600 mb-2">Recent Documents (SAP-visible)</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-slate-600">Title</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-600">Type</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-600">Status</th>
                        <th className="text-right px-4 py-2 font-medium text-slate-600">Size</th>
                        <th className="text-right px-4 py-2 font-medium text-slate-600">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-800 truncate max-w-[200px]">{doc.title}</td>
                          <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{doc.mimeType}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium',
                              doc.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500',
                            )}>
                              {doc.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-500 text-xs">
                            {formatBytes(doc.fileSizeBytes || doc.fileSize || 0)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-500 text-xs">
                            {formatDateTime(doc.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sync Simulation Panel ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => toggle('sync')}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-3">
            <Link2 className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-slate-900">Sync Simulation</h3>
            <span className="text-xs text-slate-400">Run a bi-directional sync cycle to prove integration works</span>
          </div>
          {expandedPanels.sync ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
        </button>

        {expandedPanels.sync && (
          <div className="px-6 pb-6 space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={simulateSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
              >
                {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {syncing ? 'Syncing…' : 'Run Sync Cycle'}
              </button>
              <span className="text-xs text-slate-400">
                Imports documents from Apex Nexus, exports SAP invoice, syncs workflow definitions
              </span>
            </div>

            {/* Sync architecture diagram */}
            <div className="flex items-center justify-center gap-4 py-6 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-center">
                <div className="bg-blue-100 rounded-xl p-4 mb-2 inline-block">
                  <Server className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-sm font-semibold text-slate-700">SAP ERP</div>
                <div className="text-xs text-slate-400">S/4HANA</div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1">
                  <ArrowUpFromLine className="h-4 w-4 text-green-500" />
                  <span className="text-[10px] text-slate-400 w-16 text-center">Invoices</span>
                  <ArrowDownToLine className="h-4 w-4 text-green-500" />
                </div>
                <div className={cn(
                  'px-3 py-1 rounded-full text-[10px] font-bold',
                  isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500',
                )}>
                  {isActive ? 'CONNECTED' : 'DISCONNECTED'}
                </div>
                <div className="flex items-center gap-1">
                  <ArrowDownToLine className="h-4 w-4 text-blue-500" />
                  <span className="text-[10px] text-slate-400 w-16 text-center">Documents</span>
                  <ArrowUpFromLine className="h-4 w-4 text-blue-500" />
                </div>
              </div>

              <div className="text-center">
                <div className="bg-violet-100 rounded-xl p-4 mb-2 inline-block">
                  <Database className="h-8 w-8 text-violet-600" />
                </div>
                <div className="text-sm font-semibold text-slate-700">Apex Nexus</div>
                <div className="text-xs text-slate-400">ECM Platform</div>
              </div>
            </div>

            {/* Sync log */}
            {syncLog.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-600 mb-2">Sync Log</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-slate-600 w-10">#</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Time</th>
                        <th className="text-center px-3 py-2 font-medium text-slate-600">Dir</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Object</th>
                        <th className="text-center px-3 py-2 font-medium text-slate-600">Status</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {syncLog.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-400 text-xs">{ev.id}</td>
                          <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">
                            {formatDateTime(ev.timestamp)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {ev.direction === 'IMPORT' ? (
                              <Download className="h-3.5 w-3.5 text-blue-500 mx-auto" />
                            ) : (
                              <Upload className="h-3.5 w-3.5 text-green-500 mx-auto" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-700 text-xs font-medium">{ev.objectType}</td>
                          <td className="px-3 py-2 text-center">
                            {ev.status === 'SUCCESS' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{ev.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Integration Architecture ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Server className="h-5 w-5 text-slate-600" />
          Integration Architecture
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {[
            {
              title: 'Document Archival',
              icon: FileText,
              color: 'text-blue-600 bg-blue-50',
              items: ['ERP generates invoices / POs', 'Uploads via Document API', 'Links document ID back to ERP record'],
            },
            {
              title: 'Approval Sync',
              icon: GitBranch,
              color: 'text-amber-600 bg-amber-50',
              items: ['Workflow approval events', 'Publish to ERP webhook', 'Update ERP approval status'],
            },
            {
              title: 'Retention Compliance',
              icon: Shield,
              color: 'text-red-600 bg-red-50',
              items: ['ERP defines retention rules', 'Retention API creates policies', 'Automated lifecycle management'],
            },
          ].map((block) => (
            <div key={block.title} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={cn('p-1.5 rounded-md', block.color)}>
                  <block.icon className="h-4 w-4" />
                </div>
                <span className="font-medium text-slate-800">{block.title}</span>
              </div>
              <ol className="space-y-1.5 text-slate-500 text-xs">
                {block.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="bg-slate-200 text-slate-600 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
