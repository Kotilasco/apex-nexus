'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { workflowApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  FileCheck, Receipt, ShieldAlert, Briefcase, GitBranch, PenLine,
  Sparkles, Building2, Package, ArrowRight, Plus,
} from 'lucide-react';

interface AppTemplate {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  blocks: string[];
  workflow: {
    name: string;
    states: string[];
    transitions: { from: string; to: string; action: string }[];
    initialState: string;
  };
}

const TEMPLATES: AppTemplate[] = [
  {
    id: 'contract-approval',
    name: 'Contract Approval',
    description: 'Upload → Legal review → Sign-off → Digital signature → Archive.',
    icon: FileCheck,
    color: 'from-emerald-500 to-teal-600',
    blocks: ['Document Upload', 'Legal Review', 'Approval', 'Digital Signature', 'Archive'],
    workflow: {
      name: 'Contract Approval',
      states: ['DRAFT', 'REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'ARCHIVED'],
      transitions: [
        { from: 'DRAFT', to: 'REVIEW', action: 'Submit for review' },
        { from: 'REVIEW', to: 'PENDING_APPROVAL', action: 'Send to approver' },
        { from: 'PENDING_APPROVAL', to: 'APPROVED', action: 'Approve' },
        { from: 'PENDING_APPROVAL', to: 'REVIEW', action: 'Request changes' },
        { from: 'APPROVED', to: 'ARCHIVED', action: 'Archive' },
      ],
      initialState: 'DRAFT',
    },
  },
  {
    id: 'expense-claim',
    name: 'Expense Claim',
    description: 'Employee submits receipts → Manager approves → Finance reimburses.',
    icon: Receipt,
    color: 'from-amber-500 to-orange-600',
    blocks: ['Receipt Upload', 'Validation', 'Manager Approval', 'Payment', 'Closed'],
    workflow: {
      name: 'Expense Claim',
      states: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED'],
      transitions: [
        { from: 'DRAFT', to: 'PENDING_APPROVAL', action: 'Submit' },
        { from: 'PENDING_APPROVAL', to: 'APPROVED', action: 'Approve & pay' },
        { from: 'PENDING_APPROVAL', to: 'REJECTED', action: 'Reject' },
        { from: 'APPROVED', to: 'ARCHIVED', action: 'Close' },
      ],
      initialState: 'DRAFT',
    },
  },
  {
    id: 'incident-report',
    name: 'Incident Report',
    description: 'Log an incident → Triage → Investigate → Remediate → Post-mortem.',
    icon: ShieldAlert,
    color: 'from-rose-500 to-red-600',
    blocks: ['Incident Log', 'Triage', 'Investigation', 'Remediation', 'Post-mortem'],
    workflow: {
      name: 'Incident Report',
      states: ['DRAFT', 'REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'ESCALATED', 'ARCHIVED'],
      transitions: [
        { from: 'DRAFT', to: 'REVIEW', action: 'Triage' },
        { from: 'REVIEW', to: 'PENDING_APPROVAL', action: 'Investigate' },
        { from: 'REVIEW', to: 'ESCALATED', action: 'Escalate' },
        { from: 'PENDING_APPROVAL', to: 'APPROVED', action: 'Remediate' },
        { from: 'APPROVED', to: 'ARCHIVED', action: 'Close' },
      ],
      initialState: 'DRAFT',
    },
  },
  {
    id: 'vendor-onboarding',
    name: 'Vendor Onboarding',
    description: 'KYC checks → Due diligence → Contract → Payment terms → Active.',
    icon: Briefcase,
    color: 'from-indigo-500 to-violet-600',
    blocks: ['KYC Upload', 'Due Diligence', 'Contract', 'Approval', 'Active'],
    workflow: {
      name: 'Vendor Onboarding',
      states: ['DRAFT', 'REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED'],
      transitions: [
        { from: 'DRAFT', to: 'REVIEW', action: 'KYC check' },
        { from: 'REVIEW', to: 'PENDING_APPROVAL', action: 'Due diligence pass' },
        { from: 'PENDING_APPROVAL', to: 'APPROVED', action: 'Activate vendor' },
        { from: 'PENDING_APPROVAL', to: 'REJECTED', action: 'Reject' },
        { from: 'APPROVED', to: 'ARCHIVED', action: 'Close' },
      ],
      initialState: 'DRAFT',
    },
  },
  {
    id: 'policy-review',
    name: 'Policy Review',
    description: 'Annual policy review: Owner drafts → Legal/HR review → Board approves.',
    icon: PenLine,
    color: 'from-blue-500 to-cyan-600',
    blocks: ['Draft', 'Legal Review', 'HR Review', 'Board Approval', 'Published'],
    workflow: {
      name: 'Policy Review',
      states: ['DRAFT', 'REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'ARCHIVED'],
      transitions: [
        { from: 'DRAFT', to: 'REVIEW', action: 'Submit for review' },
        { from: 'REVIEW', to: 'PENDING_APPROVAL', action: 'Send to board' },
        { from: 'PENDING_APPROVAL', to: 'APPROVED', action: 'Publish' },
        { from: 'PENDING_APPROVAL', to: 'DRAFT', action: 'Request revisions' },
        { from: 'APPROVED', to: 'ARCHIVED', action: 'Supersede' },
      ],
      initialState: 'DRAFT',
    },
  },
  {
    id: 'purchase-order',
    name: 'Purchase Order',
    description: 'Requisition → Budget check → PO generation → Delivery → Invoice match.',
    icon: Package,
    color: 'from-purple-500 to-fuchsia-600',
    blocks: ['Requisition', 'Budget Check', 'PO Generate', 'Delivery', 'Invoice Match'],
    workflow: {
      name: 'Purchase Order',
      states: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED'],
      transitions: [
        { from: 'DRAFT', to: 'PENDING_APPROVAL', action: 'Submit PO' },
        { from: 'PENDING_APPROVAL', to: 'APPROVED', action: 'Approve' },
        { from: 'PENDING_APPROVAL', to: 'REJECTED', action: 'Reject' },
        { from: 'APPROVED', to: 'ARCHIVED', action: 'Close' },
      ],
      initialState: 'DRAFT',
    },
  },
];

export default function AppsPage() {
  const router = useRouter();
  const [installing, setInstalling] = useState<string | null>(null);

  const install = async (tpl: AppTemplate) => {
    setInstalling(tpl.id);
    try {
      await workflowApi.createDefinition({
        name: tpl.workflow.name,
        description: tpl.description,
        states: tpl.workflow.states,
        transitions: tpl.workflow.transitions,
        initialState: tpl.workflow.initialState,
      } as any);
      toast.success(`${tpl.name} app installed`);
      router.push('/workflow-designer');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to install app');
    }
    setInstalling(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-gradient-to-r from-violet-600 to-pink-600 text-white rounded text-xs font-bold tracking-wide">
              ✨ NEW
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Content Apps</h1>
          </div>
          <p className="text-slate-500">
            Composable apps built from document templates, workflows, and approvals.
            No code required.
          </p>
        </div>
        <button
          onClick={() => router.push('/workflow-designer')}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Build custom
        </button>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-violet-900 to-indigo-900 text-white rounded-2xl p-6 flex items-center gap-6">
        <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-amber-300" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold mb-1">Build your process in minutes</h2>
          <p className="text-sm text-slate-200">
            Install a pre-built app, then drag blocks in the designer to customize.
            Every app comes with a workflow, approval rules, and audit trail.
          </p>
        </div>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATES.map(t => {
          const Icon = t.icon;
          return (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition group">
              <div className={`bg-gradient-to-br ${t.color} p-5 text-white`}>
                <Icon className="h-8 w-8 mb-2" />
                <h3 className="font-semibold">{t.name}</h3>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-slate-600">{t.description}</p>
                <div className="flex flex-wrap gap-1">
                  {t.blocks.map(b => (
                    <span key={b} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px]">
                      {b}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-100">
                  <GitBranch className="h-3 w-3" />
                  {t.workflow.states.length} states · {t.workflow.transitions.length} transitions
                </div>
                <button
                  onClick={() => install(t)}
                  disabled={installing === t.id}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50 group-hover:bg-primary-600 transition"
                >
                  {installing === t.id ? 'Installing…' : (<>Install app <ArrowRight className="h-3.5 w-3.5" /></>)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Need a bespoke app?</h3>
            <p className="text-sm text-slate-500 mt-1">
              Combine document uploads, approval blocks, digital signatures, notifications and external integrations
              in the visual designer. Save it as a reusable template for your organization.
            </p>
            <button
              onClick={() => router.push('/workflow-designer')}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
            >
              Open designer <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
