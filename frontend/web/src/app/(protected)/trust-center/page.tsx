'use client';

import { useEffect, useState } from 'react';
import { governanceApi } from '@/lib/api';
import { useProjectStore } from '@/lib/project-store';
import type { GovernancePolicy, PolicyAuditEntry } from '@/lib/types';
import {
  ShieldCheck, Eye, Sparkles, Bot, Search, GitBranch,
  ToggleLeft, ToggleRight, Clock, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const POLICY_META: Record<string, { label: string; description: string; icon: typeof Sparkles }> = {
  AI_CLASSIFICATION: { label: 'AI Classification', description: 'Automatic document classification using AI models', icon: Sparkles },
  AUTO_TAG: { label: 'Auto Tagging', description: 'AI-powered tag suggestions for uploaded documents', icon: Sparkles },
  CONTENT_GENERATION: { label: 'Content Generation', description: 'AI content drafting and summarization capabilities', icon: Bot },
  AI_SEARCH_ASSIST: { label: 'AI Search Assist', description: 'Enhanced search with AI-powered query understanding', icon: Search },
  WORKFLOW_AI_ROUTING: { label: 'Workflow AI Routing', description: 'Intelligent workflow routing based on document analysis', icon: GitBranch },
};

export default function TrustCenterPage() {
  const { activeProject } = useProjectStore();
  const [policies, setPolicies] = useState<GovernancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState<GovernancePolicy | null>(null);
  const [auditEntries, setAuditEntries] = useState<PolicyAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    loadPolicies();
  }, [activeProject]);

  async function loadPolicies() {
    setLoading(true);
    try {
      const res = await governanceApi.getEffective(activeProject?.id);
      setPolicies(res.data?.data ?? res.data ?? []);
    } catch {
      setPolicies([]);
    }
    setLoading(false);
  }

  async function togglePolicy(policy: GovernancePolicy) {
    setToggling(policy.id);
    try {
      await governanceApi.updatePolicy(policy.id, {
        isEnabled: !policy.isEnabled,
        reason: `Toggled ${policy.isEnabled ? 'off' : 'on'} from Trust Center`,
      });
      await loadPolicies();
    } catch { /* ignore */ }
    setToggling(null);
  }

  async function viewAuditTrail(policy: GovernancePolicy) {
    setSelectedPolicy(policy);
    setAuditLoading(true);
    try {
      const res = await governanceApi.getPolicyAudit(policy.id);
      setAuditEntries(res.data?.data ?? res.data ?? []);
    } catch {
      setAuditEntries([]);
    }
    setAuditLoading(false);
  }

  const enabledCount = policies.filter(p => p.isEnabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary-600" />
            AI Trust Center
          </h1>
          <p className="text-slate-500 mt-1">
            Manage AI governance policies
            {activeProject ? ` for ${activeProject.name}` : ' (global scope)'}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-5 py-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-600">{enabledCount}</p>
            <p className="text-xs text-slate-500">Active</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-400">{policies.length - enabledCount}</p>
            <p className="text-xs text-slate-500">Disabled</p>
          </div>
        </div>
      </div>

      {/* Policy Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((policy) => {
            const meta = POLICY_META[policy.policyType] ?? {
              label: policy.policyType, description: 'Custom policy', icon: ShieldCheck,
            };
            const Icon = meta.icon;
            return (
              <div
                key={policy.id}
                className={cn(
                  'bg-white rounded-xl border p-5 transition-all',
                  policy.isEnabled
                    ? 'border-primary-200 shadow-sm'
                    : 'border-slate-200 opacity-75'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-lg',
                      policy.isEnabled ? 'bg-primary-50 text-primary-600' : 'bg-slate-100 text-slate-400'
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{meta.label}</h3>
                      <p className="text-sm text-slate-500 mt-0.5">{meta.description}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => togglePolicy(policy)}
                    disabled={toggling === policy.id}
                    className="shrink-0 ml-4"
                    title={policy.isEnabled ? 'Disable' : 'Enable'}
                  >
                    {policy.isEnabled ? (
                      <ToggleRight className="h-8 w-8 text-primary-600" />
                    ) : (
                      <ToggleLeft className="h-8 w-8 text-slate-300" />
                    )}
                  </button>
                </div>

                {/* Scope badge & audit link */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    policy.scope === 'GLOBAL' && 'bg-blue-100 text-blue-700',
                    policy.scope === 'PROJECT' && 'bg-violet-100 text-violet-700',
                    policy.scope === 'USER' && 'bg-amber-100 text-amber-700'
                  )}>
                    {policy.scope}
                  </span>
                  <button
                    onClick={() => viewAuditTrail(policy)}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Clock className="h-3 w-3" /> Audit Trail <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                {/* Settings preview */}
                {policy.settings && Object.keys(policy.settings).length > 0 && (
                  <div className="mt-3 bg-slate-50 rounded-lg p-3 text-xs text-slate-600 font-mono">
                    {Object.entries(policy.settings).slice(0, 4).map(([k, v]) => (
                      <div key={k}><span className="text-slate-400">{k}:</span> {String(v)}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Audit Trail Panel */}
      {selectedPolicy && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-400" />
              Audit Trail: {POLICY_META[selectedPolicy.policyType]?.label ?? selectedPolicy.policyType}
            </h2>
            <button
              onClick={() => setSelectedPolicy(null)}
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>

          {auditLoading ? (
            <div className="text-sm text-slate-400 py-4">Loading audit trail...</div>
          ) : auditEntries.length === 0 ? (
            <div className="text-sm text-slate-400 py-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> No audit entries found for this policy.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {auditEntries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 text-sm border-l-2 border-primary-200 pl-4 py-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-xs font-medium px-1.5 py-0.5 rounded',
                        entry.changeType === 'ENABLED' && 'bg-green-100 text-green-700',
                        entry.changeType === 'DISABLED' && 'bg-red-100 text-red-700',
                        entry.changeType === 'SETTINGS_UPDATED' && 'bg-blue-100 text-blue-700',
                        entry.changeType === 'CREATED' && 'bg-violet-100 text-violet-700',
                      )}>
                        {entry.changeType}
                      </span>
                      <span className="text-slate-400">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {entry.reason && (
                      <p className="text-slate-600 mt-1">{entry.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
