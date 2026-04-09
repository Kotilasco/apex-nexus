'use client';

import { useEffect, useState, useCallback } from 'react';
import { retentionApi } from '@/lib/api';
import type { RetentionPolicy, DispositionItem } from '@/lib/types';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  Shield, Clock, CheckCircle, XCircle, Pause, AlertTriangle,
  RefreshCw, ChevronDown, ChevronUp, Play, Archive,
} from 'lucide-react';

type Tab = 'dispositions' | 'policies' | 'stats';

const dispositionStatusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXECUTED: 'bg-slate-200 text-slate-500',
  ON_HOLD: 'bg-blue-100 text-blue-700',
};

export default function RetentionPage() {
  const [tab, setTab] = useState<Tab>('dispositions');
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [dispositions, setDispositions] = useState<DispositionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadDispositions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await retentionApi.getDispositions(statusFilter, page, 20);
      const data = res.data?.data ?? res.data;
      setDispositions(data?.content ?? []);
      setTotalPages(data?.totalPages ?? 0);
    } catch { /* silent */ }
    setLoading(false);
  }, [statusFilter, page]);

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await retentionApi.getPolicies();
      const data = res.data?.data ?? res.data;
      setPolicies(Array.isArray(data) ? data : data?.content ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await retentionApi.getStats();
      setStats(res.data?.data ?? res.data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'dispositions') loadDispositions();
    else if (tab === 'policies') loadPolicies();
    else loadStats();
  }, [tab, loadDispositions, loadPolicies, loadStats]);

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      await retentionApi.approveDisposition(id);
      loadDispositions();
    } catch { /* silent */ }
    setActionLoading(false);
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await retentionApi.rejectDisposition(id, rejectReason);
      setRejectReason('');
      setExpandedId(null);
      loadDispositions();
    } catch { /* silent */ }
    setActionLoading(false);
  };

  const handleHold = async (id: string) => {
    if (!holdReason.trim()) return;
    setActionLoading(true);
    try {
      await retentionApi.holdDisposition(id, holdReason);
      setHoldReason('');
      setExpandedId(null);
      loadDispositions();
    } catch { /* silent */ }
    setActionLoading(false);
  };

  const handleTriggerScan = async () => {
    try {
      await retentionApi.triggerScan();
      loadDispositions();
    } catch { /* silent */ }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dispositions', label: 'Dispositions' },
    { key: 'policies', label: 'Policies' },
    { key: 'stats', label: 'Statistics' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Retention Management</h1>
          <p className="text-sm text-slate-500 mt-1">Document lifecycle and retention compliance</p>
        </div>
        <button
          onClick={handleTriggerScan}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Play className="h-4 w-4" /> Run Scan
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(0); }}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
        </div>
      ) : tab === 'dispositions' ? (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-2">
            {['PENDING', 'APPROVED', 'REJECTED', 'ON_HOLD', 'EXECUTED'].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(0); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s ? dispositionStatusColors[s] : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>

          {dispositions.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border">
              <Shield className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No disposition items found</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border divide-y">
              {dispositions.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Archive className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-900">{item.documentTitle}</p>
                          <p className="text-xs text-slate-500">
                            Policy: {item.policyName} &middot; Scheduled: {formatDate(item.scheduledDate)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${dispositionStatusColors[item.status]}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                      {item.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(item.id)}
                            disabled={actionLoading}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                            title="Approve"
                          >
                            <CheckCircle className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            className="p-1.5 text-slate-500 hover:bg-slate-50 rounded-lg"
                            title="More actions"
                          >
                            {expandedId === item.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {expandedId === item.id && item.status === 'PENDING' && (
                    <div className="mt-4 pl-8 space-y-3">
                      <div className="flex gap-2">
                        <input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Rejection reason..."
                          className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        />
                        <button
                          onClick={() => handleReject(item.id)}
                          disabled={actionLoading || !rejectReason.trim()}
                          className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={holdReason}
                          onChange={(e) => setHoldReason(e.target.value)}
                          placeholder="Hold reason..."
                          className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        />
                        <button
                          onClick={() => handleHold(item.id)}
                          disabled={actionLoading || !holdReason.trim()}
                          className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Pause className="h-4 w-4" /> Hold
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 pl-8 text-xs text-slate-400">
                    Grace ends: {formatDate(item.graceEndDate)} &middot; Created: {formatDateTime(item.createdAt)}
                    {item.approvedBy && <> &middot; Approved by: {item.approvedBy}</>}
                  </div>
                </div>
              ))}
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
      ) : tab === 'policies' ? (
        <div className="space-y-4">
          {policies.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border">
              <Clock className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No retention policies configured</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {policies.map((policy) => (
                <div key={policy.id} className="bg-white rounded-xl border p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">{policy.name}</h3>
                    <Shield className="h-5 w-5 text-primary-500" />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Retention Period</span>
                      <span className="font-medium">{policy.retentionYears} years</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Auto-Dispose</span>
                      <span className={policy.autoDispose ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                        {policy.autoDispose ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Approval Required</span>
                      <span className={policy.requiresApproval ? 'text-green-600 font-medium' : 'text-slate-400'}>
                        {policy.requiresApproval ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 pt-2 border-t">
                    Created: {formatDate(policy.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Stats Tab */
        <div className="space-y-4">
          {!stats ? (
            <div className="text-center py-16 bg-white rounded-xl border">
              <AlertTriangle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No statistics available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="bg-white rounded-xl border p-5">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{String(value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
