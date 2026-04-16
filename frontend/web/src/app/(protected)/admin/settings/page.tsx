'use client';

import { useEffect, useState, useCallback } from 'react';
import { retentionApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { RetentionPolicy } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import {
  Settings, Shield, Plus, Save, X, RefreshCw,
  Database, Lock, Clock, Server, Globe,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const { user: currentUser } = useAuthStore();
  const userRoles = (currentUser?.roles ?? []).map((r: any) => (typeof r === "string" ? r : r.name).replace(/^ROLE_/, "").toUpperCase());
  const isAdmin = userRoles.includes("SYSTEM_ADMIN") || userRoles.includes("ADMIN");

  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  /* New policy form */
  const [newName, setNewName] = useState('');
  const [newYears, setNewYears] = useState(7);
  const [newAutoDispose, setNewAutoDispose] = useState(false);
  const [newRequiresApproval, setNewRequiresApproval] = useState(true);

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await retentionApi.getPolicies();
      const data = res.data?.data ?? res.data;
      setPolicies(Array.isArray(data) ? data : data?.content ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await retentionApi.createPolicy({
        name: newName,
        retentionYears: newYears,
        autoDispose: newAutoDispose,
        requiresApproval: newRequiresApproval,
      });
      setShowCreate(false);
      setNewName('');
      setNewYears(7);
      setNewAutoDispose(false);
      setNewRequiresApproval(true);
      loadPolicies();
    } catch { /* silent */ }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await retentionApi.deletePolicy(id);
      loadPolicies();
    } catch { /* silent */ }
  };

  const systemInfo = [
    { icon: Server, label: 'API Gateway', value: 'http://localhost:8080', color: 'text-blue-600' },
    { icon: Database, label: 'PostgreSQL', value: 'localhost:5432', color: 'text-green-600' },
    { icon: Lock, label: 'Encryption', value: 'AES-256-GCM', color: 'text-purple-600' },
    { icon: Clock, label: 'Max Retention', value: '20+ years', color: 'text-amber-600' },
    { icon: Globe, label: 'Search Engine', value: 'Elasticsearch 8.12', color: 'text-cyan-600' },
  ];

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-700">Access Denied</h2>
          <p className="text-sm text-slate-400 mt-1">You need SYSTEM_ADMIN or ADMIN role to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure system parameters and retention policies</p>
      </div>

      {/* System Info */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-slate-400" /> System Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemInfo.map((info) => (
            <div key={info.label} className="bg-white rounded-xl border p-4 flex items-center gap-4">
              <div className={`p-2 bg-slate-50 rounded-lg ${info.color}`}>
                <info.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">{info.label}</p>
                <p className="text-sm font-medium text-slate-900">{info.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Retention Policies */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Shield className="h-5 w-5 text-slate-400" /> Retention Policies
          </h2>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
          >
            <Plus className="h-4 w-4" /> New Policy
          </button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="bg-white rounded-xl border p-5 mb-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Create Retention Policy</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Policy Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., 7-Year Financial Records"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Retention Period (years)</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={newYears}
                  onChange={(e) => setNewYears(parseInt(e.target.value) || 7)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={newAutoDispose}
                  onChange={(e) => setNewAutoDispose(e.target.checked)}
                  className="rounded"
                />
                Auto-dispose after retention
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={newRequiresApproval}
                  onChange={(e) => setNewRequiresApproval(e.target.checked)}
                  className="rounded"
                />
                Requires approval
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-slate-50"
              >
                <X className="h-4 w-4 inline mr-1" /> Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4 inline mr-1" /> Create Policy
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
          </div>
        ) : policies.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <Shield className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No retention policies configured</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Policy Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Retention</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Auto-Dispose</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Approval</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Created</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {policies.map((policy) => (
                  <tr key={policy.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary-500" />
                        <span className="font-medium text-slate-900">{policy.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{policy.retentionYears} years</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        policy.autoDispose ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {policy.autoDispose ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        policy.requiresApproval ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {policy.requiresApproval ? 'Required' : 'Not Required'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(policy.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(policy.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Service Endpoints */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-slate-400" /> Microservice Endpoints
        </h2>
        <div className="bg-white rounded-xl border divide-y">
          {[
            { name: 'API Gateway', port: 8080, path: '/' },
            { name: 'Auth Service', port: 8081, path: '/auth' },
            { name: 'Document Service', port: 8082, path: '/documents' },
            { name: 'Workflow Service', port: 8083, path: '/workflow' },
            { name: 'Search Service', port: 8084, path: '/search' },
            { name: 'Retention Service', port: 8085, path: '/retention' },
            { name: 'Audit Service', port: 8086, path: '/audit' },
            { name: 'Notification Service', port: 8087, path: '/notification' },
          ].map((svc) => (
            <div key={svc.name} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-green-500 rounded-full" />
                <span className="text-sm font-medium text-slate-700">{svc.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <code className="text-xs bg-slate-50 px-2 py-1 rounded text-slate-600">
                  :{svc.port}{svc.path}
                </code>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
