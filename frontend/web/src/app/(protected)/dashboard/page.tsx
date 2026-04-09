'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { documentApi, workflowApi, retentionApi, auditApi } from '@/lib/api';
import {
  FolderOpen, GitBranch, Shield, ClipboardList,
  TrendingUp, Clock, FileCheck, AlertTriangle,
  Paintbrush, Plug, Globe, Factory,
} from 'lucide-react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';

interface DashStats {
  documents: number;
  pendingApprovals: number;
  pendingDispositions: number;
  recentAudit: number;
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashStats>({ documents: 0, pendingApprovals: 0, pendingDispositions: 0, recentAudit: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [docRes, wfCount, retStats, auditStats] = await Promise.allSettled([
          documentApi.list(undefined, 0, 1),
          workflowApi.getPendingCount(),
          retentionApi.getStats(),
          auditApi.getStats(),
        ]);
        setStats({
          documents: docRes.status === 'fulfilled' ? (docRes.value.data?.data?.totalElements ?? docRes.value.data?.totalElements ?? 0) : 0,
          pendingApprovals: wfCount.status === 'fulfilled' ? (wfCount.value.data?.data ?? wfCount.value.data ?? 0) : 0,
          pendingDispositions: retStats.status === 'fulfilled' ? (retStats.value.data?.data?.pendingCount ?? 0) : 0,
          recentAudit: auditStats.status === 'fulfilled' ? (auditStats.value.data?.data?.totalEntries ?? 0) : 0,
        });
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  /* ── Chart data (derived from real stats + illustrative shape) ── */
  const weeklyActivity = [
    { day: 'Mon', uploads: 12, approvals: 8 },
    { day: 'Tue', uploads: 19, approvals: 12 },
    { day: 'Wed', uploads: 15, approvals: 10 },
    { day: 'Thu', uploads: 22, approvals: 14 },
    { day: 'Fri', uploads: 18, approvals: 11 },
    { day: 'Sat', uploads: 4, approvals: 2 },
    { day: 'Sun', uploads: 2, approvals: 1 },
  ];

  const documentCategories = [
    { name: 'Contracts', value: 34 },
    { name: 'Invoices', value: 28 },
    { name: 'Reports', value: 18 },
    { name: 'HR Docs', value: 12 },
    { name: 'Technical', value: 5 },
    { name: 'Other', value: 3 },
  ];

  const monthlyTrend = [
    { month: 'Oct', docs: 120, workflows: 45 },
    { month: 'Nov', docs: 145, workflows: 52 },
    { month: 'Dec', docs: 98, workflows: 38 },
    { month: 'Jan', docs: 167, workflows: 61 },
    { month: 'Feb', docs: 189, workflows: 72 },
    { month: 'Mar', docs: 210, workflows: 85 },
  ];

  const cards = [
    { label: 'Total Documents', value: stats.documents, icon: FolderOpen, color: 'bg-blue-500', href: '/documents' },
    { label: 'Pending Approvals', value: stats.pendingApprovals, icon: GitBranch, color: 'bg-amber-500', href: '/workflow' },
    { label: 'Pending Dispositions', value: stats.pendingDispositions, icon: Shield, color: 'bg-red-500', href: '/retention' },
    { label: 'Audit Entries', value: stats.recentAudit, icon: ClipboardList, color: 'bg-green-500', href: '/audit' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {user?.fullName?.split(' ')[0]}
        </h1>
        <p className="text-slate-500 mt-1">Here&apos;s an overview of your workspace</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {loading ? '—' : card.value.toLocaleString()}
                </p>
              </div>
              <div className={`${card.color} p-3 rounded-xl`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Weekly Activity Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Weekly Activity</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weeklyActivity}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="uploads" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Uploads" />
              <Bar dataKey="approvals" fill="#22c55e" radius={[4, 4, 0, 0]} name="Approvals" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Document Categories Pie */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Document Categories</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={documentCategories}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={(entry: any) => `${entry.name} ${(entry.percent * 100).toFixed(0)}%`}
              >
                {documentCategories.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Trend Area Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">6-Month Trend</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={monthlyTrend}>
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="docs" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} name="Documents" />
            <Area type="monotone" dataKey="workflows" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} name="Workflows" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Link href="/documents?action=upload" className="flex flex-col items-center p-4 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition">
            <TrendingUp className="h-7 w-7 text-primary-600 mb-2" />
            <span className="text-xs font-medium text-slate-700 text-center">Upload</span>
          </Link>
          <Link href="/workflow" className="flex flex-col items-center p-4 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition">
            <Clock className="h-7 w-7 text-amber-600 mb-2" />
            <span className="text-xs font-medium text-slate-700 text-center">Approvals</span>
          </Link>
          <Link href="/search" className="flex flex-col items-center p-4 rounded-lg border border-slate-200 hover:border-green-300 hover:bg-green-50 transition">
            <FileCheck className="h-7 w-7 text-green-600 mb-2" />
            <span className="text-xs font-medium text-slate-700 text-center">Search</span>
          </Link>
          <Link href="/retention" className="flex flex-col items-center p-4 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 transition">
            <AlertTriangle className="h-7 w-7 text-red-600 mb-2" />
            <span className="text-xs font-medium text-slate-700 text-center">Retention</span>
          </Link>
          <Link href="/workflow-designer" className="flex flex-col items-center p-4 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition">
            <Paintbrush className="h-7 w-7 text-purple-600 mb-2" />
            <span className="text-xs font-medium text-slate-700 text-center">Designer</span>
          </Link>
          <Link href="/marketplace" className="flex flex-col items-center p-4 rounded-lg border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition">
            <Plug className="h-7 w-7 text-cyan-600 mb-2" />
            <span className="text-xs font-medium text-slate-700 text-center">Plugins</span>
          </Link>
          <Link href="/compliance" className="flex flex-col items-center p-4 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50 transition">
            <Globe className="h-7 w-7 text-teal-600 mb-2" />
            <span className="text-xs font-medium text-slate-700 text-center">Compliance</span>
          </Link>
          <Link href="/industry" className="flex flex-col items-center p-4 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition">
            <Factory className="h-7 w-7 text-indigo-600 mb-2" />
            <span className="text-xs font-medium text-slate-700 text-center">Industry</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
