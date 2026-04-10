'use client';

import { useEffect, useState, useCallback } from 'react';
import { auditApi } from '@/lib/api';
import type { AuditEntry } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import {
  ClipboardList, Search, RefreshCw, Filter, User,
  FileText, Globe, ChevronDown, ChevronRight, BarChart3,
  X, Monitor, Clock, Shield, Hash, Tag, Info,
} from 'lucide-react';

type View = 'logs' | 'stats';

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  READ: 'bg-blue-100 text-blue-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-indigo-100 text-indigo-700',
  LOGOUT: 'bg-slate-100 text-slate-600',
  CHECKOUT: 'bg-purple-100 text-purple-700',
  CHECKIN: 'bg-teal-100 text-teal-700',
  APPROVE: 'bg-emerald-100 text-emerald-700',
  REJECT: 'bg-rose-100 text-rose-700',
  DOWNLOAD: 'bg-cyan-100 text-cyan-700',
  SIGN: 'bg-violet-100 text-violet-700',
  WORKFLOW_STARTED: 'bg-orange-100 text-orange-700',
  WORKFLOW_TRANSITION: 'bg-amber-100 text-amber-700',
  COPY_VERSION_TO_PROJECT: 'bg-sky-100 text-sky-700',
  ASSIGN_TO_PROJECT: 'bg-lime-100 text-lime-700',
};

export default function AuditPage() {
  const [view, setView] = useState<View>('logs');
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  /* Filters */
  const [filterType, setFilterType] = useState<'date' | 'action' | 'resourceType'>('date');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedResourceType, setSelectedResourceType] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (filterType === 'action' && selectedAction) {
        res = await auditApi.getByAction(selectedAction, page, 20);
      } else if (filterType === 'resourceType' && selectedResourceType) {
        res = await auditApi.getByResourceType(selectedResourceType, page, 20);
      } else if (filterType === 'date' && dateFrom && dateTo) {
        res = await auditApi.getByDate(dateFrom, dateTo, page, 20);
      } else {
        // Default: most recent entries
        res = await auditApi.getRecent(page, 20);
      }
      const data = res.data?.data ?? res.data;
      setEntries(data?.content ?? (Array.isArray(data) ? data : []));
      setTotalPages(data?.totalPages ?? 0);
    } catch (err) { console.error('[Audit] loadLogs failed:', err); }
    setLoading(false);
  }, [filterType, selectedAction, selectedResourceType, dateFrom, dateTo, page]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.getStats();
      setStats(res.data?.data ?? res.data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (view === 'logs') loadLogs();
    else loadStats();
  }, [view, loadLogs, loadStats]);

  const actions = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'CHECKOUT', 'CHECKIN', 'APPROVE', 'REJECT', 'DOWNLOAD'];
  const resourceTypes = ['DOCUMENT', 'FOLDER', 'USER', 'WORKFLOW', 'RETENTION_POLICY'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-1">Immutable record of all system activity</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('logs')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'logs' ? 'bg-primary-600 text-white' : 'bg-white border hover:bg-slate-50'
            }`}
          >
            <ClipboardList className="h-4 w-4 inline mr-1" /> Logs
          </button>
          <button
            onClick={() => setView('stats')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'stats' ? 'bg-primary-600 text-white' : 'bg-white border hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="h-4 w-4 inline mr-1" /> Statistics
          </button>
        </div>
      </div>

      {view === 'logs' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Filter className="h-4 w-4" /> <span className="font-medium">Filter by:</span>
              {(['date', 'action', 'resourceType'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setFilterType(f); setPage(0); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterType === f ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {f === 'resourceType' ? 'Resource Type' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {filterType === 'date' && (
              <div className="flex gap-3">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <span className="text-slate-400 self-center">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <button
                  onClick={() => { setPage(0); loadLogs(); }}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            )}

            {filterType === 'action' && (
              <div className="flex flex-wrap gap-2">
                {actions.map((a) => (
                  <button
                    key={a}
                    onClick={() => { setSelectedAction(a); setPage(0); }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedAction === a ? (actionColors[a] || 'bg-slate-200 text-slate-700') : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}

            {filterType === 'resourceType' && (
              <div className="flex flex-wrap gap-2">
                {resourceTypes.map((r) => (
                  <button
                    key={r}
                    onClick={() => { setSelectedResourceType(r); setPage(0); }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedResourceType === r ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex justify-center py-16">
              <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border">
              <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No audit entries found</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 w-8"></th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Timestamp</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">User</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Action</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Resource</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedEntry(selectedEntry?.id === entry.id ? null : entry)}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedEntry?.id === entry.id ? 'bg-primary-50' : ''}`}
                    >
                      <td className="px-4 py-3 text-slate-400">
                        {selectedEntry?.id === entry.id
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(entry.timestamp || entry.createdAt || '')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-700 font-medium">{entry.username || entry.userId?.slice(0, 8) || 'System'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColors[entry.action] || 'bg-slate-100 text-slate-600'}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-600">{entry.resourceType}</span>
                          {entry.resourceName ? (
                            <span className="text-xs text-slate-500 truncate max-w-[180px]" title={entry.resourceName}>{entry.resourceName}</span>
                          ) : (
                            <span className="text-xs text-slate-400 font-mono">{entry.resourceId?.slice(0, 8)}...</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3" /> {entry.ipAddress || '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detail Panel */}
          {selectedEntry && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Info className="h-4 w-4" /> Audit Entry Details
                </h3>
                <button onClick={() => setSelectedEntry(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Hash className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Entry ID</p>
                      <p className="text-slate-700 font-mono text-xs break-all">{selectedEntry.id}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Timestamp</p>
                      <p className="text-slate-700">{formatDateTime(selectedEntry.timestamp || selectedEntry.createdAt || '')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">User</p>
                      <p className="text-slate-700 font-medium">{selectedEntry.username || 'Unknown'}</p>
                      <p className="text-xs text-slate-400 font-mono">{selectedEntry.userId || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Actor Type</p>
                      <p className="text-slate-700">{selectedEntry.actorType || 'HUMAN'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Tag className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Action</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColors[selectedEntry.action] || 'bg-slate-100 text-slate-600'}`}>
                        {selectedEntry.action}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Resource</p>
                      <p className="text-slate-700">{selectedEntry.resourceType}</p>
                      {selectedEntry.resourceName && (
                        <p className="text-slate-600 text-xs">{selectedEntry.resourceName}</p>
                      )}
                      <p className="text-xs text-slate-400 font-mono break-all">{selectedEntry.resourceId || '—'}</p>
                    </div>
                  </div>
                  {selectedEntry.projectId && (
                    <div className="flex items-start gap-2">
                      <Hash className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider">Project ID</p>
                        <p className="text-xs text-slate-700 font-mono break-all">{selectedEntry.projectId}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <Globe className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">IP Address</p>
                      <p className="text-slate-700 font-mono text-xs">{selectedEntry.ipAddress || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Monitor className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">User Agent</p>
                      <p className="text-xs text-slate-500 break-all">{selectedEntry.userAgent || '—'}</p>
                    </div>
                  </div>
                </div>
                {/* Details JSON */}
                {selectedEntry.details && Object.keys(selectedEntry.details).length > 0 && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Additional Details</p>
                    <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                      {Object.entries(selectedEntry.details).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-3 text-xs">
                          <span className="text-slate-500 font-medium min-w-[100px] shrink-0">{key}</span>
                          <span className="text-slate-700 font-mono break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-slate-500">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Stats View */
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
            </div>
          ) : !stats ? (
            <div className="text-center py-16 bg-white rounded-xl border">
              <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No statistics available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="bg-white rounded-xl border p-5">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                  </p>
                  {typeof value === 'object' && value !== null ? (
                    <div className="mt-2 space-y-1">
                      {Object.entries(value as Record<string, unknown>).slice(0, 5).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-sm">
                          <span className="text-slate-600">{k}</span>
                          <span className="font-medium text-slate-900">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-slate-900 mt-1">{String(value)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
