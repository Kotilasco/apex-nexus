'use client';

import { useEffect, useState, useCallback } from 'react';
import { workflowApi, documentApi, aiApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { WorkflowInstance, WorkflowTransition, WorkflowDefinition, Document } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import {
  GitBranch, Clock, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, MessageSquare, Send, RotateCcw, X, Plus, FileText,
  Lightbulb, ShieldAlert, Settings, Sparkles, Edit, Trash2, Eye, Loader2,
} from 'lucide-react';

type Tab = 'types' | 'active' | 'pending';

const ALL_STATES = ['DRAFT', 'REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CORRECTION', 'ARCHIVED', 'CANCELLED', 'ESCALATED'];

const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  REVIEW: 'bg-blue-100 text-blue-700',
  IN_REVIEW: 'bg-blue-100 text-blue-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CORRECTION: 'bg-orange-100 text-orange-700',
  ARCHIVED: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
  ESCALATED: 'bg-pink-100 text-pink-700',
};

export default function WorkflowPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('types');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    workflowApi.getPendingCount().then(r => setPendingCount(r.data?.data ?? 0)).catch(() => {});
  }, []);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'types', label: 'Workflow Types' },
    { key: 'active', label: 'My Workflows' },
    { key: 'pending', label: 'Pending Approvals', count: pendingCount },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Workflows</h1>
        <p className="text-slate-500 mt-1">Manage workflow types, run approvals, and track document workflows</p>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === t.key ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'types' && <WorkflowTypesTab />}
      {tab === 'active' && <ActiveWorkflowsTab onCountChange={setPendingCount} />}
      {tab === 'pending' && <PendingApprovalsTab onCountChange={setPendingCount} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/* WORKFLOW TYPES TAB                                  */
/* ═══════════════════════════════════════════════════ */
function WorkflowTypesTab() {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingDef, setEditingDef] = useState<WorkflowDefinition | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', description: '', states: ['DRAFT', 'REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED'] as string[],
    transitions: [
      { from: 'DRAFT', to: 'REVIEW', action: 'submit' },
      { from: 'REVIEW', to: 'PENDING_APPROVAL', action: 'approve' },
      { from: 'REVIEW', to: 'CORRECTION', action: 'reject' },
      { from: 'PENDING_APPROVAL', to: 'APPROVED', action: 'approve' },
      { from: 'PENDING_APPROVAL', to: 'CORRECTION', action: 'reject' },
      { from: 'CORRECTION', to: 'REVIEW', action: 'resubmit' },
    ] as { from: string; to: string; action: string }[],
    initialState: 'DRAFT', humanReviewRequired: false,
    escalationRules: [] as { state: string; slaHours: number; maxLevel?: number }[],
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workflowApi.getDefinitions();
      setDefinitions(res.data?.data ?? res.data ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingDef(null);
    setForm({
      name: '', description: '', states: ['DRAFT', 'REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED'],
      transitions: [
        { from: 'DRAFT', to: 'REVIEW', action: 'submit' },
        { from: 'REVIEW', to: 'PENDING_APPROVAL', action: 'approve' },
        { from: 'REVIEW', to: 'CORRECTION', action: 'reject' },
        { from: 'PENDING_APPROVAL', to: 'APPROVED', action: 'approve' },
        { from: 'PENDING_APPROVAL', to: 'CORRECTION', action: 'reject' },
        { from: 'CORRECTION', to: 'REVIEW', action: 'resubmit' },
      ],
      initialState: 'DRAFT', humanReviewRequired: false, escalationRules: [],
    });
    setShowEditor(true);
  };

  const openEdit = (def: WorkflowDefinition) => {
    setEditingDef(def);
    const states = Array.isArray(def.states) ? def.states : [];
    const transitions = Array.isArray(def.transitions) ? def.transitions.map((t: any) => ({
      from: t.from || '', to: t.to || '', action: t.action || '',
    })) : [];
    const escalation = Array.isArray(def.escalationRules) ? def.escalationRules.map((e: any) => ({
      state: e.state || '', slaHours: e.slaHours || 24, maxLevel: e.maxLevel,
    })) : [];
    setForm({
      name: def.name, description: def.description || '',
      states, transitions, initialState: def.initialState || 'DRAFT',
      humanReviewRequired: def.humanReviewRequired || false, escalationRules: escalation,
    });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!form.name || form.states.length === 0) return;
    setSaving(true);
    try {
      const payload = { ...form };
      if (editingDef) {
        await workflowApi.updateDefinition(editingDef.id, payload);
      } else {
        await workflowApi.createDefinition(payload);
      }
      setShowEditor(false);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to save');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this workflow type?')) return;
    try {
      await workflowApi.deleteDefinition(id);
      load();
    } catch { alert('Failed to delete'); }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await aiApi.generateWorkflow(aiPrompt);
      const generated = res.data?.data ?? res.data;
      if (generated) {
        setForm({
          name: generated.name || '',
          description: generated.description || '',
          states: Array.isArray(generated.states) ? generated.states : ['DRAFT', 'APPROVED', 'CANCELLED'],
          transitions: Array.isArray(generated.transitions) ? generated.transitions.map((t: any) => ({
            from: t.from || '', to: t.to || '', action: t.action || '',
          })) : [],
          initialState: generated.initialState || 'DRAFT',
          humanReviewRequired: generated.humanReviewRequired || false,
          escalationRules: Array.isArray(generated.escalationRules) ? generated.escalationRules : [],
        });
        setShowAi(false);
        setShowEditor(true);
        setEditingDef(null);
        setAiPrompt('');
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'AI generation failed. Make sure Ollama is running.');
    }
    setAiLoading(false);
  };

  const toggleState = (state: string) => {
    setForm(f => {
      const has = f.states.includes(state);
      const states = has ? f.states.filter(s => s !== state) : [...f.states, state];
      const transitions = has ? f.transitions.filter(t => t.from !== state && t.to !== state) : f.transitions;
      return { ...f, states, transitions };
    });
  };

  const addTransition = () => {
    setForm(f => ({ ...f, transitions: [...f.transitions, { from: f.states[0] || 'DRAFT', to: f.states[1] || 'APPROVED', action: '' }] }));
  };

  const removeTransition = (idx: number) => {
    setForm(f => ({ ...f, transitions: f.transitions.filter((_, i) => i !== idx) }));
  };

  const updateTransition = (idx: number, field: string, value: string) => {
    setForm(f => ({
      ...f, transitions: f.transitions.map((t, i) => i === idx ? { ...t, [field]: value } : t),
    }));
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <button onClick={openCreate} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" /> New Workflow Type
        </button>
        <button onClick={() => setShowAi(true)} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4" /> AI Generate
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : definitions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Settings className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No workflow types defined yet</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {definitions.map(def => (
            <div key={def.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-5 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-semibold text-slate-900">{def.name}</h3>
                    {def.isActive === false && <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Inactive</span>}
                    {def.humanReviewRequired && <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Human Review</span>}
                  </div>
                  {def.description && <p className="text-sm text-slate-500 mb-2">{def.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(def.states) ? def.states : []).map((s: string) => (
                      <span key={s} className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || 'bg-slate-100 text-slate-700'}`}>
                        {s.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setExpandedId(expandedId === def.id ? null : def.id)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="View details">
                    {expandedId === def.id ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(def)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Edit">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(def.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600" title="Deactivate">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {expandedId === def.id && (
                <div className="border-t border-slate-100 bg-slate-50 p-4">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Transitions</h4>
                  <div className="space-y-1.5">
                    {(Array.isArray(def.transitions) ? def.transitions : []).map((t: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[t.from] || 'bg-slate-100'}`}>{t.from}</span>
                        <span className="text-slate-400">&rarr;</span>
                        <span className="text-xs text-slate-600 font-medium bg-slate-200 px-2 py-0.5 rounded">{t.action}</span>
                        <span className="text-slate-400">&rarr;</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[t.to] || 'bg-slate-100'}`}>{t.to}</span>
                      </div>
                    ))}
                  </div>
                  {def.escalationRules && (def.escalationRules as any[]).length > 0 && (
                    <>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-4 mb-2">Escalation Rules</h4>
                      <div className="space-y-1">
                        {(def.escalationRules as any[]).map((rule: any, i: number) => (
                          <p key={i} className="text-sm text-slate-600">
                            <span className="font-medium">{rule.state}</span>: SLA {rule.slaHours}h, max level {rule.maxLevel ?? 3}
                          </p>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* AI Generate Modal */}
      {showAi && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-600" />
                <h3 className="text-lg font-semibold text-slate-900">AI Workflow Generator</h3>
              </div>
              <button onClick={() => setShowAi(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600">
                Describe the workflow you need in plain language. The AI will generate a workflow definition for you to review and customize.
              </p>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g., A simple approval workflow where documents go through a manager review, then a director signs off. If rejected, the author must revise and resubmit..."
                rows={5}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none resize-none"
              />
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                <p className="text-xs text-violet-700">
                  <strong>Tips:</strong> Mention specific steps (review, approval, correction), who should be involved,
                  and any special requirements like escalation after a certain time.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button onClick={() => setShowAi(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleAiGenerate} disabled={aiLoading || !aiPrompt.trim()}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiLoading ? 'Generating...' : 'Generate Workflow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingDef ? 'Edit Workflow Type' : 'New Workflow Type'}
              </h3>
              <button onClick={() => setShowEditor(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">States</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_STATES.map(s => (
                    <button key={s} onClick={() => toggleState(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                        form.states.includes(s)
                          ? `${statusColors[s] || 'bg-slate-100'} border-transparent ring-2 ring-primary-300`
                          : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}>
                      {s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">Transitions</label>
                  <button onClick={addTransition} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Add Transition
                  </button>
                </div>
                <div className="space-y-2">
                  {form.transitions.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                      <select value={t.from} onChange={e => updateTransition(i, 'from', e.target.value)}
                        className="px-2 py-1 border border-slate-300 rounded text-xs bg-white">
                        {form.states.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span className="text-slate-400 text-xs">&rarr;</span>
                      <input value={t.action} onChange={e => updateTransition(i, 'action', e.target.value)}
                        placeholder="action" className="px-2 py-1 border border-slate-300 rounded text-xs w-24 bg-white" />
                      <span className="text-slate-400 text-xs">&rarr;</span>
                      <select value={t.to} onChange={e => updateTransition(i, 'to', e.target.value)}
                        className="px-2 py-1 border border-slate-300 rounded text-xs bg-white">
                        {form.states.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={() => removeTransition(i)} className="p-1 rounded hover:bg-red-50 text-red-400">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.humanReviewRequired}
                    onChange={e => setForm(f => ({ ...f, humanReviewRequired: e.target.checked }))}
                    className="rounded border-slate-300" />
                  <span className="text-slate-700">Require Human Review</span>
                </label>
              </div>

              {/* Escalation Rules */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">Escalation Rules</label>
                  <button onClick={() => setForm(f => ({
                    ...f,
                    escalationRules: [...f.escalationRules, { state: f.states[0] || 'PENDING_APPROVAL', slaHours: 24, maxLevel: 3 }],
                  }))}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Add Rule
                  </button>
                </div>
                {form.escalationRules.length === 0 ? (
                  <p className="text-xs text-slate-400">No escalation rules. Add rules to auto-escalate when SLA deadlines are exceeded.</p>
                ) : (
                  <div className="space-y-2">
                    {form.escalationRules.map((rule, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                        <select value={rule.state} onChange={e => setForm(f => ({
                          ...f, escalationRules: f.escalationRules.map((r, idx) => idx === i ? { ...r, state: e.target.value } : r),
                        }))}
                          className="px-2 py-1 border border-slate-300 rounded text-xs bg-white">
                          {form.states.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400">SLA:</span>
                          <input type="number" min={1} value={rule.slaHours} onChange={e => setForm(f => ({
                            ...f, escalationRules: f.escalationRules.map((r, idx) => idx === i ? { ...r, slaHours: parseInt(e.target.value) || 1 } : r),
                          }))}
                            className="w-16 px-2 py-1 border border-slate-300 rounded text-xs bg-white" />
                          <span className="text-xs text-slate-400">hrs</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400">Max Lvl:</span>
                          <input type="number" min={1} max={10} value={rule.maxLevel ?? 3} onChange={e => setForm(f => ({
                            ...f, escalationRules: f.escalationRules.map((r, idx) => idx === i ? { ...r, maxLevel: parseInt(e.target.value) || 1 } : r),
                          }))}
                            className="w-14 px-2 py-1 border border-slate-300 rounded text-xs bg-white" />
                        </div>
                        <button onClick={() => setForm(f => ({
                          ...f, escalationRules: f.escalationRules.filter((_, idx) => idx !== i),
                        }))} className="p-1 rounded hover:bg-red-50 text-red-400">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button onClick={() => setShowEditor(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name || form.states.length === 0}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {editingDef ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════ */
/* ACTIVE WORKFLOWS TAB                                */
/* ═══════════════════════════════════════════════════ */
function ActiveWorkflowsTab({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<WorkflowTransition[]>([]);
  const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [showStart, setShowStart] = useState(false);
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [startForm, setStartForm] = useState({ documentId: '', definitionId: '', notes: '' });
  const [startLoading, setStartLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workflowApi.getMyInstances(page, 20);
      const data = res.data?.data ?? res.data;
      setInstances(data?.content ?? []);
      setTotalPages(data?.totalPages ?? 0);
      const countRes = await workflowApi.getPendingCount();
      onCountChange(countRes.data?.data ?? 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, onCountChange]);

  useEffect(() => { loadData(); }, [loadData]);

  const openStartModal = async () => {
    setShowStart(true);
    try {
      const [defRes, docRes] = await Promise.all([
        workflowApi.getDefinitions(),
        documentApi.list(undefined, 0, 100),
      ]);
      setDefinitions(defRes.data?.data ?? defRes.data ?? []);
      const docData = docRes.data?.data ?? docRes.data;
      setDocuments(docData?.content ?? docData ?? []);
    } catch { /* ignore */ }
  };

  const handleStartWorkflow = async () => {
    if (!startForm.documentId || !startForm.definitionId) return;
    setStartLoading(true);
    try {
      await workflowApi.startInstance(startForm);
      setShowStart(false);
      setStartForm({ documentId: '', definitionId: '', notes: '' });
      loadData();
    } catch (err: any) { alert(err?.response?.data?.message || 'Failed to start workflow'); }
    setStartLoading(false);
  };

  const loadHistory = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    try {
      const res = await workflowApi.getHistory(id);
      setHistory(res.data?.data ?? res.data ?? []);
      setExpanded(id);
    } catch { /* ignore */ }
  };

  const getDocumentHash = async (documentId: string): Promise<string | undefined> => {
    try {
      const res = await documentApi.get(documentId);
      const doc = res.data?.data ?? res.data;
      return doc?.sha256Hash;
    } catch { return undefined; }
  };

  const doAction = async (id: string, type: 'approve' | 'reject' | 'transition' | 'cancel', action?: string) => {
    setActionLoading(true);
    try {
      const inst = instances.find(i => i.id === id);
      if (type === 'approve') {
        await workflowApi.transition(id, 'approve', actionNotes || undefined);
      } else if (type === 'reject') {
        const hash = inst?.documentId ? await getDocumentHash(inst.documentId) : undefined;
        await workflowApi.transition(id, 'reject', actionNotes || undefined, hash);
      } else if (type === 'cancel') {
        await workflowApi.cancel(id, actionNotes || undefined);
      } else if (action === 'RESUBMIT') {
        const hash = inst?.documentId ? await getDocumentHash(inst.documentId) : undefined;
        await workflowApi.transition(id, action, actionNotes || undefined, hash);
      } else if (action) {
        await workflowApi.transition(id, action, actionNotes || undefined);
      }
      setActionNotes('');
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.response?.data?.error || 'Action failed');
    }
    setActionLoading(false);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Your initiated workflows</p>
        <button onClick={openStartModal} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" /> Start Workflow
        </button>
      </div>

      <WorkflowInstanceList
        instances={instances} loading={loading}
        expanded={expanded} history={history}
        actionNotes={actionNotes} actionLoading={actionLoading}
        onActionNotesChange={setActionNotes}
        onLoadHistory={loadHistory}
        onDoAction={doAction}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50">Previous</button>
          <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50">Next</button>
        </div>
      )}

      {/* Start Workflow Modal */}
      {showStart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Start New Workflow</h3>
              <button onClick={() => setShowStart(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Workflow Type</label>
                <select value={startForm.definitionId} onChange={e => setStartForm(f => ({ ...f, definitionId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                  <option value="">Select a workflow type...</option>
                  {definitions.map(d => <option key={d.id} value={d.id}>{d.name}{d.description ? ` — ${d.description}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Document</label>
                <select value={startForm.documentId} onChange={e => setStartForm(f => ({ ...f, documentId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                  <option value="">Select a document...</option>
                  {documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <textarea value={startForm.notes} onChange={e => setStartForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Add notes..." rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button onClick={() => setShowStart(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleStartWorkflow} disabled={startLoading || !startForm.documentId || !startForm.definitionId}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                {startLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Start Workflow
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════ */
/* PENDING APPROVALS TAB                               */
/* ═══════════════════════════════════════════════════ */
function PendingApprovalsTab({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<WorkflowTransition[]>([]);
  const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workflowApi.getPendingApprovals(page, 20);
      const data = res.data?.data ?? res.data;
      setInstances(data?.content ?? []);
      setTotalPages(data?.totalPages ?? 0);
      const countRes = await workflowApi.getPendingCount();
      onCountChange(countRes.data?.data ?? 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, onCountChange]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadHistory = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    try {
      const res = await workflowApi.getHistory(id);
      setHistory(res.data?.data ?? res.data ?? []);
      setExpanded(id);
    } catch { /* ignore */ }
  };

  const getDocumentHash = async (documentId: string): Promise<string | undefined> => {
    try {
      const res = await documentApi.get(documentId);
      const doc = res.data?.data ?? res.data;
      return doc?.sha256Hash;
    } catch { return undefined; }
  };

  const doAction = async (id: string, type: 'approve' | 'reject' | 'transition' | 'cancel', action?: string) => {
    setActionLoading(true);
    try {
      const inst = instances.find(i => i.id === id);
      if (type === 'approve') {
        await workflowApi.transition(id, 'approve', actionNotes || undefined);
      } else if (type === 'reject') {
        const hash = inst?.documentId ? await getDocumentHash(inst.documentId) : undefined;
        await workflowApi.transition(id, 'reject', actionNotes || undefined, hash);
      } else if (type === 'cancel') {
        await workflowApi.cancel(id, actionNotes || undefined);
      } else if (action) {
        await workflowApi.transition(id, action, actionNotes || undefined);
      }
      setActionNotes('');
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Action failed');
    }
    setActionLoading(false);
  };

  return (
    <>
      <WorkflowInstanceList
        instances={instances} loading={loading}
        expanded={expanded} history={history}
        actionNotes={actionNotes} actionLoading={actionLoading}
        onActionNotesChange={setActionNotes}
        onLoadHistory={loadHistory}
        onDoAction={doAction}
      />
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50">Previous</button>
          <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50">Next</button>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════ */
/* SHARED WORKFLOW INSTANCE LIST                       */
/* ═══════════════════════════════════════════════════ */
function WorkflowInstanceList({
  instances, loading, expanded, history,
  actionNotes, actionLoading,
  onActionNotesChange, onLoadHistory, onDoAction,
}: {
  instances: WorkflowInstance[];
  loading: boolean;
  expanded: string | null;
  history: WorkflowTransition[];
  actionNotes: string;
  actionLoading: boolean;
  onActionNotesChange: (v: string) => void;
  onLoadHistory: (id: string) => void;
  onDoAction: (id: string, type: 'approve' | 'reject' | 'transition' | 'cancel', action?: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <GitBranch className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">No workflow instances found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {instances.map(inst => (
        <div key={inst.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[inst.currentState] || 'bg-slate-100'}`}>
                    {(inst.currentState ?? 'UNKNOWN').replace(/_/g, ' ')}
                  </span>
                  {(inst.correctionCount ?? 0) > 0 && (
                    <span className="flex items-center gap-1 text-xs text-orange-600">
                      <RotateCcw className="h-3 w-3" /> {inst.correctionCount} correction(s)
                    </span>
                  )}
                  {(inst.escalationLevel ?? 0) > 0 && (
                    <span className="flex items-center gap-1 text-xs text-pink-600 font-semibold">
                      <AlertTriangle className="h-3 w-3" /> Escalation Level {inst.escalationLevel}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {inst.definitionName && <span className="font-medium text-slate-700">{inst.definitionName} — </span>}
                  Document: <span className="font-medium text-slate-700">{inst.documentId}</span>
                </p>
                {inst.notes && (
                  <p className="text-sm text-slate-500 mt-1"><MessageSquare className="h-3 w-3 inline mr-1" />{inst.notes}</p>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  Started {formatDateTime(inst.createdAt)} &middot; Updated {formatDateTime(inst.updatedAt)}
                  {inst.slaDeadline && (
                    <>
                      {' '}&middot; SLA: <span className={new Date(inst.slaDeadline) < new Date() ? 'text-red-500 font-semibold' : 'text-slate-500'}>
                        {formatDateTime(inst.slaDeadline)}
                      </span>
                    </>
                  )}
                </p>

                {(inst.currentState === 'CORRECTION' || inst.currentState === 'REJECTED') && inst.rejectionComments && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-red-700">Rejection Reason</p>
                        <p className="text-sm text-red-600 mt-0.5">{inst.rejectionComments}</p>
                      </div>
                    </div>
                    {inst.currentState === 'CORRECTION' && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-amber-800">Correction Guidance</p>
                            <ul className="text-sm text-amber-700 mt-1 space-y-1 list-disc list-inside">
                              <li>Review the rejection reason carefully</li>
                              <li>Modify the document before resubmitting</li>
                              <li>The system verifies the document has been changed (SHA-256)</li>
                              {(inst.correctionCount ?? 0) >= 2 && (
                                <li className="text-red-600 font-medium">Corrected {inst.correctionCount} times — consider consulting with the reviewer</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {inst.currentState === 'DRAFT' && (
                  <button onClick={() => onDoAction(inst.id, 'transition', 'SUBMIT')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1">
                    <Send className="h-3.5 w-3.5" /> Submit
                  </button>
                )}
                {(inst.currentState === 'REVIEW' || inst.currentState === 'PENDING_APPROVAL') && (
                  <>
                    <button onClick={() => onDoAction(inst.id, 'approve')} disabled={actionLoading}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button onClick={() => onDoAction(inst.id, 'reject')} disabled={actionLoading}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </>
                )}
                {inst.currentState === 'CORRECTION' && (
                  <button onClick={() => onDoAction(inst.id, 'transition', 'RESUBMIT')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1">
                    <Send className="h-3.5 w-3.5" /> Resubmit
                  </button>
                )}
                {inst.currentState === 'APPROVED' && (
                  <button onClick={() => onDoAction(inst.id, 'transition', 'ARCHIVE')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-slate-600 text-white text-xs font-medium rounded-lg hover:bg-slate-700 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> Archive
                  </button>
                )}
                {!['APPROVED', 'ARCHIVED', 'CANCELLED', 'REJECTED'].includes(inst.currentState ?? '') && (
                  <button onClick={() => onDoAction(inst.id, 'cancel')} disabled={actionLoading}
                    className="px-3 py-1.5 border border-slate-300 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 flex items-center gap-1">
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                )}
                <button onClick={() => onLoadHistory(inst.id)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 flex items-center gap-1">
                  {expanded === inst.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  History
                </button>
              </div>
            </div>

            {!['ARCHIVED', 'CANCELLED'].includes(inst.currentState ?? '') && (
              <div className="mt-3">
                <input value={actionNotes} onChange={e => onActionNotesChange(e.target.value)}
                  placeholder="Add notes (optional)..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
            )}
          </div>

          {expanded === inst.id && history.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50 p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Transition History</h4>
              <div className="space-y-2">
                {history.map(t => (
                  <div key={t.id} className="flex items-center gap-3 text-sm">
                    <span className="text-slate-400 text-xs w-36 shrink-0">{formatDateTime(t.createdAt)}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[t.fromState] || 'bg-slate-100'}`}>{t.fromState}</span>
                    <span className="text-slate-400">&rarr;</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[t.toState] || 'bg-slate-100'}`}>{t.toState}</span>
                    <span className="text-xs text-slate-500">{t.action}</span>
                    {t.notes && <span className="text-xs text-slate-400 italic">&mdash; {t.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
