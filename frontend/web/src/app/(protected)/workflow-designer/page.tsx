'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { workflowTemplateApi, workflowApi } from '@/lib/api';
import {
  Play, Square, Circle, ArrowRight, Trash2, Save, Undo2, 
  Layout, ZoomIn, ZoomOut, GripVertical, Plus, ChevronDown,
  FileCheck, GitBranch, Settings, Palette, Clock, AlertTriangle,
  Edit3, List, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── Constants ─── */
const WORKFLOW_STATES = [
  'DRAFT', 'REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
  'CORRECTION', 'ARCHIVED', 'CANCELLED', 'ESCALATED',
];

/* ─── Types ─── */
interface CanvasNode {
  id: string;
  type: 'state';
  label: string;
  x: number;
  y: number;
  color: string;
  isInitial?: boolean;
  isFinal?: boolean;
}

interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  action: string;
}

interface EscalationRule {
  state: string;
  slaHours: number;
  maxLevel: number;
  notifyRole: string;
}

interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  states: string[];
  transitions: { from: string; to: string; action: string; requiredRole?: string }[];
  initialState: string;
  escalationRules?: EscalationRule[];
  isActive: boolean;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  states: string;
  transitions: string;
  initialState: string;
  canvasLayout: string;
  estimatedDurationHours: number;
}

const STATE_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  REVIEW: '#3b82f6',
  PENDING_APPROVAL: '#f59e0b',
  APPROVED: '#22c55e',
  REJECTED: '#ef4444',
  CORRECTION: '#f97316',
  ARCHIVED: '#6366f1',
  CANCELLED: '#64748b',
  ESCALATED: '#ec4899',
};
const COLOR_LIST = Object.values(STATE_COLORS);

const PALETTE_ITEMS = [
  { type: 'state', label: 'State', icon: Circle, color: '#3b82f6' },
  { type: 'start', label: 'Start State', icon: Play, color: '#22c55e' },
  { type: 'end', label: 'End State', icon: Square, color: '#ef4444' },
];

export default function WorkflowDesignerPage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [existingDefs, setExistingDefs] = useState<WorkflowDef[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showTemplates, setShowTemplates] = useState(true);
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [workflowDesc, setWorkflowDesc] = useState('');
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  const [editingDefId, setEditingDefId] = useState<string | null>(null);

  const canvasExtent = useMemo(() => {
    if (nodes.length === 0) return { w: 2000, h: 1200 };
    const maxX = Math.max(...nodes.map(n => n.x)) + 300;
    const maxY = Math.max(...nodes.map(n => n.y)) + 200;
    return { w: Math.max(2000, maxX), h: Math.max(1200, maxY) };
  }, [nodes]);
  const [saving, setSaving] = useState(false);
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>([]);
  const [showEscalation, setShowEscalation] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadExistingDefinitions();
  }, []);

  async function loadTemplates() {
    try {
      const res = await workflowTemplateApi.getAll();
      setTemplates(res.data?.data || []);
    } catch { /* ignore */ }
  }

  async function loadExistingDefinitions() {
    try {
      const res = await workflowApi.getDefinitions();
      setExistingDefs(res.data?.data || []);
    } catch { /* ignore */ }
  }

  function loadFromDefinition(def: WorkflowDef) {
    const stateList = def.states || [];
    const newNodes: CanvasNode[] = stateList.map((state, i) => ({
      id: state,
      type: 'state' as const,
      label: state.replace(/_/g, ' '),
      x: 150 + (i % 4) * 220,
      y: 100 + Math.floor(i / 4) * 160,
      color: STATE_COLORS[state] || COLOR_LIST[i % COLOR_LIST.length],
      isInitial: state === def.initialState,
      isFinal: state === 'ARCHIVED' || state === 'CANCELLED' || state === 'APPROVED',
    }));
    const newEdges: CanvasEdge[] = (def.transitions || []).map((t, i) => ({
      id: `edge-${i}-${Date.now()}`,
      from: t.from,
      to: t.to,
      label: t.action,
      action: t.action,
    }));
    setNodes(newNodes);
    setEdges(newEdges);
    setWorkflowName(def.name);
    setWorkflowDesc(def.description || '');
    setEditingDefId(def.id);
    setEscalationRules(def.escalationRules || []);
    setShowTemplates(false);
    toast.success(`Loaded: ${def.name}`);
  }

  function loadFromTemplate(template: Template) {
    try {
      const layout = template.canvasLayout ? JSON.parse(template.canvasLayout) : null;
      const states = template.states ? JSON.parse(template.states) : {};
      const transitions = template.transitions ? JSON.parse(template.transitions) : {};
      const stateNames = Object.keys(states);
      const newNodes: CanvasNode[] = stateNames.map((name, i) => {
        const nodeLayout = layout?.nodes?.find((n: { id: string }) => n.id === name);
        return {
          id: name,
          type: 'state' as const,
          label: states[name]?.label || name,
          x: nodeLayout?.x ?? 150 + (i % 4) * 220,
          y: nodeLayout?.y ?? 100 + Math.floor(i / 4) * 160,
          color: states[name]?.color || COLOR_LIST[i % COLOR_LIST.length],
          isInitial: name === template.initialState,
          isFinal: states[name]?.isFinal || false,
        };
      });
      const newEdges: CanvasEdge[] = [];
      Object.entries(transitions).forEach(([key, value]: [string, unknown]) => {
        const trans = value as { from: string; to: string; action: string; label?: string };
        newEdges.push({ id: `edge-${key}`, from: trans.from, to: trans.to, label: trans.label || trans.action || key, action: trans.action || key });
      });
      setNodes(newNodes);
      setEdges(newEdges);
      setWorkflowName(template.displayName || template.name);
      setWorkflowDesc(template.description || '');
      setEditingDefId(null);
      setEscalationRules([]);
      setShowTemplates(false);
      toast.success(`Loaded template: ${template.displayName}`);
    } catch { toast.error('Failed to parse template'); }
  }

  function addStateNode(stateName: string) {
    if (nodes.find(n => n.id === stateName)) {
      toast.error(`State ${stateName} already exists`);
      return;
    }
    const newNode: CanvasNode = {
      id: stateName,
      type: 'state',
      label: stateName.replace(/_/g, ' '),
      x: 200 + Math.random() * 300,
      y: 150 + Math.random() * 200,
      color: STATE_COLORS[stateName] || COLOR_LIST[nodes.length % COLOR_LIST.length],
      isInitial: stateName === 'DRAFT',
      isFinal: stateName === 'ARCHIVED' || stateName === 'CANCELLED',
    };
    setNodes(prev => [...prev, newNode]);
  }

  function addNode(type: string) {
    const id = type === 'start' ? 'DRAFT' : type === 'end' ? 'ARCHIVED' : `STATE_${Date.now()}`;
    if (nodes.find(n => n.id === id)) {
      toast.error(`State ${id} already on canvas`);
      return;
    }
    const newNode: CanvasNode = {
      id,
      type: 'state',
      label: type === 'start' ? 'DRAFT' : type === 'end' ? 'ARCHIVED' : 'New State',
      x: 200 + Math.random() * 300,
      y: 150 + Math.random() * 200,
      color: type === 'start' ? '#22c55e' : type === 'end' ? '#ef4444' : COLOR_LIST[nodes.length % COLOR_LIST.length],
      isInitial: type === 'start',
      isFinal: type === 'end',
    };
    setNodes(prev => [...prev, newNode]);
  }

  function deleteNode(id: string) {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
    setEscalationRules(prev => prev.filter(r => r.state !== id));
    setSelectedNode(null);
  }

  function deleteEdge(id: string) {
    setEdges(prev => prev.filter(e => e.id !== id));
    setSelectedEdge(null);
  }

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'DIV' && !(e.target as HTMLElement).closest('[data-node]')) {
      setSelectedNode(null);
      setSelectedEdge(null);
      setConnectingFrom(null);
    }
  }, []);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (connectingFrom) {
      if (connectingFrom !== nodeId) {
        const edgeId = `edge-${Date.now()}`;
        setEdges(prev => [...prev, { id: edgeId, from: connectingFrom, to: nodeId, label: 'transition', action: 'transition' }]);
      }
      setConnectingFrom(null);
      return;
    }
    setDraggingNode(nodeId);
    setSelectedNode(nodeId);
    setSelectedEdge(null);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const sl = canvasRef.current?.scrollLeft || 0;
      const st = canvasRef.current?.scrollTop || 0;
      setDragOffset({ x: e.clientX - rect.left + sl - node.x * zoom, y: e.clientY - rect.top + st - node.y * zoom });
    }
  }, [nodes, connectingFrom, zoom, pan]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingNode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const sl = canvasRef.current.scrollLeft;
    const st = canvasRef.current.scrollTop;
    const x = (e.clientX - rect.left + sl - dragOffset.x) / zoom;
    const y = (e.clientY - rect.top + st - dragOffset.y) / zoom;
    setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x: Math.max(0, x), y: Math.max(0, y) } : n));
  }, [draggingNode, dragOffset, zoom]);

  const handleCanvasMouseUp = useCallback(() => {
    setDraggingNode(null);
  }, []);

  function startConnect(nodeId: string) {
    setConnectingFrom(nodeId);
  }

  function getNodeCenter(node: CanvasNode) {
    return { x: node.x + 70, y: node.y + 25 };
  }

  function startEditLabel(nodeId: string) {
    const node = nodes.find(n => n.id === nodeId);
    if (node) { setEditingLabel(nodeId); setEditLabelValue(node.label); }
  }

  function commitEditLabel() {
    if (editingLabel) {
      setNodes(prev => prev.map(n => n.id === editingLabel ? { ...n, label: editLabelValue || n.label } : n));
      setEditingLabel(null);
    }
  }

  async function saveWorkflow() {
    if (nodes.length === 0) { toast.error('Add at least one state'); return; }
    const initialNode = nodes.find(n => n.isInitial);
    if (!initialNode) { toast.error('Mark one state as Initial'); return; }

    setSaving(true);
    try {
      const stateNames = nodes.map(n => n.id);
      const transitionData = edges.map(e => ({
        from: e.from, to: e.to, action: e.action,
      }));

      const payload = {
        name: workflowName,
        description: workflowDesc,
        states: stateNames,
        transitions: transitionData,
        initialState: initialNode.id,
        escalationRules: escalationRules.length > 0 ? escalationRules : undefined,
      };

      if (editingDefId) {
        await workflowApi.updateDefinition(editingDefId, payload);
        toast.success('Workflow definition updated!');
      } else {
        const res = await workflowApi.createDefinition(payload);
        setEditingDefId(res.data?.data?.id || null);
        toast.success('Workflow definition created!');
      }
      loadExistingDefinitions();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Save failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDef(id: string) {
    try {
      await workflowApi.deleteDefinition(id);
      toast.success('Definition deactivated');
      loadExistingDefinitions();
    } catch { toast.error('Delete failed'); }
  }

  function addEscalationRule() {
    const availableStates = nodes.filter(n => !n.isFinal && !escalationRules.find(r => r.state === n.id));
    if (availableStates.length === 0) { toast.error('All states have rules'); return; }
    setEscalationRules(prev => [...prev, { state: availableStates[0].id, slaHours: 24, maxLevel: 3, notifyRole: 'MANAGER' }]);
  }

  // Template/definition selection view
  if (showTemplates) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Workflow Designer</h1>
            <p className="text-slate-500 mt-1">Create, edit, or start from a template</p>
          </div>
          <button onClick={() => { setEditingDefId(null); setNodes([]); setEdges([]); setEscalationRules([]); setWorkflowName('New Workflow'); setWorkflowDesc(''); setShowTemplates(false); }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center gap-2">
            <Plus className="h-4 w-4" />Start from Scratch
          </button>
        </div>

        {/* Existing Definitions */}
        {existingDefs.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <List className="h-5 w-5 text-primary-500" />Existing Definitions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {existingDefs.map(def => (
                <div key={def.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-900">{def.name}</h3>
                    <div className="flex gap-1">
                      <button onClick={() => loadFromDefinition(def)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600" title="Edit">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteDef(def.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Deactivate">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mb-3 line-clamp-2">{def.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {def.states?.slice(0, 5).map(s => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (STATE_COLORS[s] || '#94a3b8') + '20', color: STATE_COLORS[s] || '#94a3b8' }}>{s}</span>
                    ))}
                    {(def.states?.length || 0) > 5 && <span className="text-[10px] text-slate-400 px-1">+{def.states.length - 5}</span>}
                  </div>
                  {def.escalationRules && def.escalationRules.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{def.escalationRules.length} escalation rule{def.escalationRules.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Templates */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary-500" />Templates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <button key={t.id} onClick={() => loadFromTemplate(t)}
                className="bg-white rounded-xl border border-slate-200 p-6 text-left hover:shadow-lg hover:border-primary-300 transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary-50 group-hover:bg-primary-100 transition">
                    <GitBranch className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{t.displayName}</h3>
                    <span className="text-xs text-slate-400">{t.category}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{t.description}</p>
                {t.estimatedDurationHours > 0 && (
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" /><span>~{t.estimatedDurationHours}h avg.</span>
                  </div>
                )}
              </button>
            ))}
            <button onClick={() => { setEditingDefId(null); setNodes([]); setEdges([]); setEscalationRules([]); setWorkflowName('New Workflow'); setWorkflowDesc(''); setShowTemplates(false); }}
              className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-primary-400 hover:bg-primary-50 transition-all group min-h-[180px] flex flex-col items-center justify-center">
              <Plus className="h-10 w-10 text-slate-400 group-hover:text-primary-500 mb-2" />
              <span className="font-medium text-slate-600 group-hover:text-primary-600">Blank Workflow</span>
              <span className="text-xs text-slate-400 mt-1">Start from scratch</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Designer view
  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-t-xl px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowTemplates(true)} className="text-sm text-slate-500 hover:text-primary-600 flex items-center gap-1">
            <Layout className="h-4 w-4" />Back
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <input value={workflowName} onChange={(e) => setWorkflowName(e.target.value)}
            className="text-lg font-semibold text-slate-900 bg-transparent border-none outline-none focus:ring-0 w-60" />
          {editingDefId && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Editing</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowEscalation(!showEscalation)} className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 border ${showEscalation ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <AlertTriangle className="h-4 w-4" />Escalation{escalationRules.length > 0 && ` (${escalationRules.length})`}
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1.5 rounded hover:bg-slate-100" title="Zoom In"><ZoomIn className="h-4 w-4 text-slate-500" /></button>
          <span className="text-xs text-slate-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-1.5 rounded hover:bg-slate-100" title="Zoom Out"><ZoomOut className="h-4 w-4 text-slate-500" /></button>
          <div className="h-5 w-px bg-slate-200" />
          <button onClick={saveWorkflow} disabled={saving}
            className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 flex items-center gap-1 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Escalation Rules Panel */}
      {showEscalation && (
        <div className="bg-amber-50 border-x border-slate-200 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />Escalation Rules — Auto-escalate when SLA expires
            </h3>
            <button onClick={addEscalationRule} className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 flex items-center gap-1">
              <Plus className="h-3 w-3" />Add Rule
            </button>
          </div>
          {escalationRules.length === 0 && <p className="text-xs text-amber-600">No escalation rules. Workflows will not auto-escalate.</p>}
          {escalationRules.map((rule, i) => (
            <div key={i} className="flex items-center gap-3 bg-white rounded-lg border border-amber-200 px-3 py-2">
              <select value={rule.state} onChange={e => setEscalationRules(prev => prev.map((r, idx) => idx === i ? { ...r, state: e.target.value } : r))}
                className="text-xs border border-slate-200 rounded px-2 py-1 bg-white">
                {nodes.filter(n => !n.isFinal).map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
              </select>
              <label className="text-xs text-slate-500">SLA:</label>
              <input type="number" min={1} value={rule.slaHours} onChange={e => setEscalationRules(prev => prev.map((r, idx) => idx === i ? { ...r, slaHours: parseInt(e.target.value) || 24 } : r))}
                className="w-16 text-xs border border-slate-200 rounded px-2 py-1" />
              <span className="text-xs text-slate-400">hours</span>
              <label className="text-xs text-slate-500">Max Level:</label>
              <input type="number" min={1} max={5} value={rule.maxLevel} onChange={e => setEscalationRules(prev => prev.map((r, idx) => idx === i ? { ...r, maxLevel: parseInt(e.target.value) || 3 } : r))}
                className="w-14 text-xs border border-slate-200 rounded px-2 py-1" />
              <label className="text-xs text-slate-500">Notify:</label>
              <input value={rule.notifyRole} onChange={e => setEscalationRules(prev => prev.map((r, idx) => idx === i ? { ...r, notifyRole: e.target.value } : r))}
                className="w-28 text-xs border border-slate-200 rounded px-2 py-1" placeholder="MANAGER" />
              <button onClick={() => setEscalationRules(prev => prev.filter((_, idx) => idx !== i))} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden border-x border-b border-slate-200 rounded-b-xl">
        {/* Left palette */}
        <div className="w-56 bg-slate-50 border-r border-slate-200 p-3 space-y-3 overflow-y-auto">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Add States</h3>
          <div className="space-y-1.5">
            {WORKFLOW_STATES.map(state => {
              const onCanvas = nodes.some(n => n.id === state);
              return (
                <button key={state} onClick={() => addStateNode(state)} disabled={onCanvas}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left text-xs font-medium transition ${onCanvas ? 'bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-primary-300 hover:shadow-sm cursor-pointer text-slate-700'}`}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: STATE_COLORS[state] || '#94a3b8' }} />
                  {state}
                  {onCanvas && <span className="ml-auto text-[9px] text-slate-400">on canvas</span>}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Actions</h3>
            <button
              onClick={() => {
                if (connectingFrom) { setConnectingFrom(null); toast('Connection cancelled'); }
                else { toast('Click a source node, then a target node'); setConnectingFrom('__awaiting__'); }
              }}
              className={`w-full flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm ${connectingFrom ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-200 hover:border-primary-300 text-slate-700'}`}>
              <ArrowRight className="h-4 w-4" />{connectingFrom ? 'Cancel Connect' : 'Add Connection'}
            </button>
          </div>

          {/* Workflow Description */}
          <div className="pt-3 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</h3>
            <textarea value={workflowDesc} onChange={e => setWorkflowDesc(e.target.value)} rows={3}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 resize-none" placeholder="Describe this workflow..." />
          </div>

          {/* Properties panel */}
          {selectedNode && (() => {
            const node = nodes.find(n => n.id === selectedNode);
            if (!node) return null;
            return (
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">State: {node.id}</h3>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={node.isInitial || false} onChange={(e) => setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, isInitial: e.target.checked } : n))} className="rounded" />
                  <span className="text-xs text-slate-600">Initial State</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={node.isFinal || false} onChange={(e) => setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, isFinal: e.target.checked } : n))} className="rounded" />
                  <span className="text-xs text-slate-600">Final State</span>
                </div>
                <button onClick={() => startConnect(selectedNode)} className="w-full text-xs py-1 px-2 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100">Connect From Here</button>
                <button onClick={() => deleteNode(selectedNode)} className="w-full text-xs py-1 px-2 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100">Delete State</button>
              </div>
            );
          })()}

          {selectedEdge && (() => {
            const edge = edges.find(e => e.id === selectedEdge);
            if (!edge) return null;
            return (
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Connection</h3>
                <div className="text-xs text-slate-500">{edge.from} → {edge.to}</div>
                <div>
                  <label className="text-xs text-slate-500">Action</label>
                  <input value={edge.action} onChange={(e) => setEdges(prev => prev.map(ed => ed.id === selectedEdge ? { ...ed, action: e.target.value, label: e.target.value } : ed))}
                    className="w-full text-sm border border-slate-200 rounded px-2 py-1 mt-0.5" />
                </div>
                <button onClick={() => deleteEdge(selectedEdge)} className="w-full text-xs py-1 px-2 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100">Delete Connection</button>
              </div>
            );
          })()}
        </div>

        {/* Canvas */}
        <div ref={canvasRef} className="flex-1 relative overflow-auto bg-[#f8fafc]"
          onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}>
          <div style={{ width: canvasExtent.w * zoom, height: canvasExtent.h * zoom, minWidth: '100%', minHeight: '100%', position: 'relative', backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)', backgroundSize: `${20 * zoom}px ${20 * zoom}px` }}>
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
            <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#64748b" /></marker></defs>
            {edges.map(edge => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              const from = getNodeCenter(fromNode);
              const to = getNodeCenter(toNode);
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const offsetX = len > 0 ? (dx / len) * 35 : 0;
              const offsetY = len > 0 ? (dy / len) * 35 : 0;
              return (
                <g key={edge.id}>
                  <line x1={from.x + offsetX} y1={from.y + offsetY} x2={to.x - offsetX} y2={to.y - offsetY}
                    stroke={selectedEdge === edge.id ? '#3b82f6' : '#94a3b8'} strokeWidth={selectedEdge === edge.id ? 2.5 : 1.5}
                    markerEnd="url(#arrowhead)" style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedEdge(edge.id); setSelectedNode(null); }} />
                  <text x={midX} y={midY - 8} textAnchor="middle" className="text-[10px] fill-slate-500 select-none" style={{ pointerEvents: 'none' }}>{edge.label}</text>
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
            {nodes.map(node => (
              <div key={node.id} data-node
                className={`absolute select-none cursor-grab active:cursor-grabbing group transition-shadow ${selectedNode === node.id ? 'ring-2 ring-primary-400 ring-offset-2' : ''}`}
                style={{ left: node.x, top: node.y, minWidth: 140 }} onMouseDown={(e) => handleNodeMouseDown(e, node.id)} onDoubleClick={() => startEditLabel(node.id)}>
                <div className="rounded-xl px-4 py-3 shadow-sm border-2 bg-white" style={{ borderColor: node.color }}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: node.color }} />
                    <span className="text-sm font-medium text-slate-800">{node.id}</span>
                  </div>
                  {node.isInitial && <span className="text-[10px] text-green-600 font-medium mt-1 block">INITIAL</span>}
                  {node.isFinal && <span className="text-[10px] text-red-500 font-medium mt-1 block">FINAL</span>}
                  {escalationRules.some(r => r.state === node.id) && (
                    <span className="text-[10px] text-amber-600 font-medium mt-0.5 block flex items-center gap-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" />SLA
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {connectingFrom && connectingFrom !== '__awaiting__' && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-100 text-amber-700 border border-amber-300 rounded-lg px-4 py-2 text-sm font-medium shadow-sm z-10">
              Click a target node to connect from &quot;{connectingFrom}&quot;
            </div>
          )}

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <GitBranch className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Start designing your workflow</p>
                <p className="text-sm mt-1">Add states from the palette on the left</p>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
