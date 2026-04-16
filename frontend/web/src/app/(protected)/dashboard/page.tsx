'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import {
  documentApi, workflowApi, retentionApi, auditApi,
  projectApi, authApi, notificationApi, forwardApi,
} from '@/lib/api';
import {
  FolderOpen, GitBranch, Shield, ClipboardList,
  TrendingUp, Clock, FileCheck, AlertTriangle,
  Paintbrush, Plug, Globe, Factory,
  Users, Bell, ArrowRightLeft, Briefcase,
  ChevronDown, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, RadialBarChart, RadialBar,
} from 'recharts';

/* ── Types ── */
interface Project { id: string; name: string; }

interface DashStats {
  documents: number;
  pendingApprovals: number;
  pendingDispositions: number;
  auditTotal: number;
  totalUsers: number;
  activeProjects: number;
  overdueWorkflows: number;
  unreadNotifications: number;
  pendingForwards: number;
}

interface RetentionData {
  pendingCount: number;
  approvedCount: number;
  destroyedCount: number;
  onHoldCount: number;
  rejectedCount: number;
}

interface AuditData {
  totalEvents: number;
  actionCounts: Record<string, number>;
  mostActiveUsers: Record<string, number>;
  actorTypeCounts: Record<string, number>;
}

interface WorkflowStatusData { name: string; value: number; }
interface ProjectDocData { name: string; documents: number; members: number; }

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const WORKFLOW_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'ESCALATED'];
const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8', IN_REVIEW: '#f59e0b', APPROVED: '#22c55e', REJECTED: '#ef4444',
  CANCELLED: '#6b7280', COMPLETED: '#3b82f6', ESCALATED: '#dc2626',
};

/* ── Helper to safely extract values ── */
function v(res: PromiseSettledResult<any>, ...paths: string[]): any {
  if (res.status !== 'fulfilled') return undefined;
  let val = res.value?.data;
  // unwrap {data: ...} wrapper if present
  if (val && typeof val === 'object' && 'data' in val && !Array.isArray(val)) val = val.data;
  for (const p of paths) { val = val?.[p]; }
  return val;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashStats>({
    documents: 0, pendingApprovals: 0, pendingDispositions: 0, auditTotal: 0,
    totalUsers: 0, activeProjects: 0, overdueWorkflows: 0, unreadNotifications: 0, pendingForwards: 0,
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [projectOpen, setProjectOpen] = useState(false);

  const [retentionData, setRetentionData] = useState<RetentionData | null>(null);
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatusData[]>([]);
  const [projectDocs, setProjectDocs] = useState<ProjectDocData[]>([]);

  /* ── Load all dashboard data ── */
  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      // Batch 1: core stats + projects list
      const [docRes, wfCount, retRes, auditRes, projRes, usersRes, overdueRes, notifRes, fwdRes] =
        await Promise.allSettled([
          documentApi.list(undefined, 0, 1),
          workflowApi.getPendingCount(),
          retentionApi.getStats(),
          auditApi.getStats(),
          projectApi.list(),
          authApi.getUsers(),
          workflowApi.getOverdue(),
          notificationApi.getUnreadCount(),
          forwardApi.getPendingCount(),
        ]);

      // Parse retention
      const ret: RetentionData = {
        pendingCount: v(retRes, 'pendingCount') ?? 0,
        approvedCount: v(retRes, 'approvedCount') ?? 0,
        destroyedCount: v(retRes, 'destroyedCount') ?? 0,
        onHoldCount: v(retRes, 'onHoldCount') ?? 0,
        rejectedCount: v(retRes, 'rejectedCount') ?? 0,
      };
      setRetentionData(ret);

      // Parse audit
      const audit: AuditData = {
        totalEvents: v(auditRes, 'totalEvents') ?? v(auditRes, 'totalEntries') ?? 0,
        actionCounts: v(auditRes, 'actionCounts') ?? {},
        mostActiveUsers: v(auditRes, 'mostActiveUsers') ?? {},
        actorTypeCounts: v(auditRes, 'actorTypeCounts') ?? {},
      };
      setAuditData(audit);

      // Parse projects
      const projList: Project[] = (() => {
        if (projRes.status !== 'fulfilled') return [];
        const d = projRes.value?.data?.data ?? projRes.value?.data;
        if (Array.isArray(d)) return d.map((p: any) => ({ id: p.id, name: p.name }));
        if (d?.content && Array.isArray(d.content)) return d.content.map((p: any) => ({ id: p.id, name: p.name }));
        return [];
      })();
      setProjects(projList);

      // Parse users (may be paged or list)
      const usersData = usersRes.status === 'fulfilled' ? (usersRes.value?.data?.data ?? usersRes.value?.data) : null;
      const totalUsers = Array.isArray(usersData) ? usersData.length
        : (usersData?.totalElements ?? usersData?.content?.length ?? 0);

      // Parse overdue
      const overdueData = overdueRes.status === 'fulfilled' ? (overdueRes.value?.data?.data ?? overdueRes.value?.data) : [];
      const overdueCount = Array.isArray(overdueData) ? overdueData.length : 0;

      setStats({
        documents: v(docRes, 'totalElements') ?? 0,
        pendingApprovals: (() => {
          if (wfCount.status !== 'fulfilled') return 0;
          const d = wfCount.value?.data;
          return typeof d === 'number' ? d : (d?.data ?? 0);
        })(),
        pendingDispositions: ret.pendingCount,
        auditTotal: audit.totalEvents,
        totalUsers,
        activeProjects: projList.length,
        overdueWorkflows: overdueCount,
        unreadNotifications: (() => {
          if (notifRes.status !== 'fulfilled') return 0;
          const d = notifRes.value?.data;
          return typeof d === 'number' ? d : (d?.data ?? 0);
        })(),
        pendingForwards: (() => {
          if (fwdRes.status !== 'fulfilled') return 0;
          const d = fwdRes.value?.data;
          return typeof d === 'number' ? d : (d?.data ?? 0);
        })(),
      });

      // Batch 2: workflow status counts (parallel)
      const wfStatusPromises = WORKFLOW_STATUSES.map(s =>
        workflowApi.getByStatus(s, 0, 1).then(r => ({
          name: s, value: r.data?.data?.totalElements ?? r.data?.totalElements ?? 0,
        })).catch(() => ({ name: s, value: 0 }))
      );
      const wfData = await Promise.all(wfStatusPromises);
      setWorkflowStatus(wfData.filter(d => d.value > 0));

      // Batch 3: per-project doc & member counts
      if (projList.length > 0) {
        const projDocPromises = projList.slice(0, 12).map(async (p) => {
          const [docR, memR] = await Promise.allSettled([
            documentApi.listByProject(p.id, undefined, 0, 1),
            projectApi.getMembers(p.id),
          ]);
          return {
            name: p.name.length > 14 ? p.name.slice(0, 12) + '...' : p.name,
            documents: v(docR, 'totalElements') ?? (
              docR.status === 'fulfilled'
                ? (Array.isArray(docR.value?.data?.data) ? docR.value.data.data.length : 0)
                : 0
            ),
            members: (() => {
              if (memR.status !== 'fulfilled') return 0;
              const d = memR.value?.data?.data ?? memR.value?.data;
              return Array.isArray(d) ? d.length : 0;
            })(),
          };
        });
        setProjectDocs(await Promise.all(projDocPromises));
      }
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Derived chart data ── */
  const retentionChartData = retentionData ? [
    { name: 'Pending', value: retentionData.pendingCount },
    { name: 'Approved', value: retentionData.approvedCount },
    { name: 'Destroyed', value: retentionData.destroyedCount },
    { name: 'On Hold', value: retentionData.onHoldCount },
    { name: 'Rejected', value: retentionData.rejectedCount },
  ].filter(d => d.value > 0) : [];

  const auditActionData = auditData
    ? Object.entries(auditData.actionCounts)
        .map(([name, value]) => ({
          name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          value,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
    : [];

  const actorTypeData = auditData
    ? Object.entries(auditData.actorTypeCounts)
        .map(([name, value]) => ({ name: name === 'HUMAN' ? 'Human' : name === 'AI_SERVICE' ? 'AI Service' : name, value }))
        .filter(d => d.value > 0)
    : [];

  const topUsersData = auditData
    ? Object.entries(auditData.mostActiveUsers)
        .map(([name, value]) => ({ name: name.length > 12 ? name.slice(0, 10) + '...' : name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    : [];

  /* ── Project-filtered data ── */
  const filteredProjectDocs = selectedProject === 'all'
    ? projectDocs
    : projectDocs.filter(p => {
        const proj = projects.find(pr => pr.id === selectedProject);
        return proj && (p.name === proj.name || p.name === (proj.name.length > 14 ? proj.name.slice(0, 12) + '...' : proj.name));
      });

  /* ── Stat cards (8) ── */
  const cards = [
    { label: 'Total Documents', value: stats.documents, icon: FolderOpen, color: 'bg-blue-500', href: '/documents' },
    { label: 'Pending Approvals', value: stats.pendingApprovals, icon: GitBranch, color: 'bg-amber-500', href: '/workflow' },
    { label: 'Pending Dispositions', value: stats.pendingDispositions, icon: Shield, color: 'bg-red-500', href: '/retention' },
    { label: 'Audit Events', value: stats.auditTotal, icon: ClipboardList, color: 'bg-green-500', href: '/audit' },
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'bg-indigo-500', href: '/admin' },
    { label: 'Active Projects', value: stats.activeProjects, icon: Briefcase, color: 'bg-cyan-500', href: '/projects' },
    { label: 'Overdue Workflows', value: stats.overdueWorkflows, icon: AlertTriangle, color: 'bg-orange-500', href: '/workflow' },
    { label: 'Unread Notifications', value: stats.unreadNotifications, icon: Bell, color: 'bg-pink-500', href: '/notifications' },
  ];

  const selectedProjectName = selectedProject === 'all'
    ? 'All Projects'
    : projects.find(p => p.id === selectedProject)?.name ?? 'All Projects';

  return (
    <div className="space-y-6">
      {/* Header with project selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {user?.fullName?.split(' ')[0]}
          </h1>
          <p className="text-slate-500 mt-1">Here&apos;s an overview of your workspace</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Project Selector */}
          <div className="relative">
            <button
              onClick={() => setProjectOpen(!projectOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition text-sm font-medium text-slate-700 min-w-[180px]"
            >
              <Briefcase className="h-4 w-4 text-slate-400" />
              <span className="truncate">{selectedProjectName}</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 ml-auto transition-transform ${projectOpen ? 'rotate-180' : ''}`} />
            </button>
            {projectOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                <button
                  onClick={() => { setSelectedProject('all'); setProjectOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${selectedProject === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                >
                  All Projects
                </button>
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProject(p.id); setProjectOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 truncate ${selectedProject === p.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Refresh */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stat cards — 2 rows of 4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {loading ? '—' : card.value.toLocaleString()}
                </p>
              </div>
              <div className={`${card.color} p-3 rounded-xl`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Row 1: Workflow Status + Retention Dispositions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Workflow Status Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Workflow Status Distribution</h2>
          {workflowStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={workflowStatus} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="value" name="Workflows" radius={[0, 4, 4, 0]}>
                  {workflowStatus.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-slate-400">No workflow data</div>
          )}
        </div>

        {/* Retention Dispositions */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Retention Dispositions</h2>
          {retentionChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={retentionChartData}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {retentionChartData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-slate-400">No retention data</div>
          )}
        </div>
      </div>

      {/* Row 2: Audit Actions + Human vs AI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Audit Action Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Audit Actions Breakdown</h2>
          {auditActionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={auditActionData}>
                <XAxis dataKey="name" tick={{ fontSize: 10, angle: -35, textAnchor: 'end' }} height={70} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Events">
                  {auditActionData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400">No audit data</div>
          )}
        </div>

        {/* Human vs AI Activity */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Human vs AI Activity</h2>
          {actorTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={actorTypeData}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  <Cell fill="#3b82f6" />
                  <Cell fill="#8b5cf6" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400">No activity data</div>
          )}
        </div>
      </div>

      {/* Row 3: Project Documents + Most Active Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Documents Per Project */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Documents Per Project
            {selectedProject !== 'all' && <span className="text-sm font-normal text-slate-500 ml-2">({selectedProjectName})</span>}
          </h2>
          {filteredProjectDocs.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={filteredProjectDocs}>
                <XAxis dataKey="name" tick={{ fontSize: 10, angle: -25, textAnchor: 'end' }} height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="documents" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Documents" />
                <Bar dataKey="members" fill="#22c55e" radius={[4, 4, 0, 0]} name="Members" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400">No project data</div>
          )}
        </div>

        {/* Most Active Users */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Most Active Users</h2>
          {topUsersData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topUsersData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="value" name="Actions" radius={[0, 4, 4, 0]}>
                  {topUsersData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400">No user data</div>
          )}
        </div>
      </div>

      {/* Row 4: Retention Summary Cards */}
      {retentionData && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Pending', value: retentionData.pendingCount, color: 'text-amber-600 bg-amber-50 border-amber-200' },
            { label: 'Approved', value: retentionData.approvedCount, color: 'text-green-600 bg-green-50 border-green-200' },
            { label: 'Destroyed', value: retentionData.destroyedCount, color: 'text-red-600 bg-red-50 border-red-200' },
            { label: 'On Hold', value: retentionData.onHoldCount, color: 'text-blue-600 bg-blue-50 border-blue-200' },
            { label: 'Rejected', value: retentionData.rejectedCount, color: 'text-slate-600 bg-slate-50 border-slate-200' },
          ].map(item => (
            <div key={item.label} className={`rounded-xl border p-4 text-center ${item.color}`}>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs font-medium mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      )}

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
