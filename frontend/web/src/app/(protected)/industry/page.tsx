'use client';

import { useEffect, useState } from 'react';
import { industryTemplateApi } from '@/lib/api';
import type { IndustryTemplate } from '@/lib/types';
import {
  Factory, Heart, Landmark, Scale, Wrench, Building2,
  Plug, GitBranch, Shield, FileText, ChevronDown, ChevronRight,
} from 'lucide-react';

const INDUSTRY_ICONS: Record<string, React.ReactNode> = {
  healthcare: <Heart className="h-6 w-6 text-pink-500" />,
  banking: <Landmark className="h-6 w-6 text-blue-500" />,
  legal: <Scale className="h-6 w-6 text-amber-500" />,
  manufacturing: <Wrench className="h-6 w-6 text-slate-500" />,
  public_sector: <Building2 className="h-6 w-6 text-emerald-500" />,
};

const INDUSTRY_COLORS: Record<string, string> = {
  healthcare: 'border-pink-200 bg-pink-50',
  banking: 'border-blue-200 bg-blue-50',
  legal: 'border-amber-200 bg-amber-50',
  manufacturing: 'border-slate-200 bg-slate-50',
  public_sector: 'border-emerald-200 bg-emerald-50',
};

export default function IndustryPage() {
  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await industryTemplateApi.getAll();
        setTemplates(res.data?.data || []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Industry Solutions</h1>
        <p className="text-slate-500 mt-1">
          Pre-configured templates with workflows, compliance, and plugins for your sector
        </p>
      </div>

      {/* Template cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {templates.length === 0 ? (
          <div className="col-span-full flex flex-col items-center py-16 text-slate-400">
            <Factory className="h-10 w-10 mb-2 text-slate-300" />
            <p>No industry templates available</p>
          </div>
        ) : (
          templates.map(t => {
            const key = t.industry?.toLowerCase().replace(/\s+/g, '_') || '';
            const isExpanded = expanded === t.id;
            return (
              <div
                key={t.id}
                className={`rounded-xl border-2 overflow-hidden transition ${INDUSTRY_COLORS[key] || 'border-slate-200 bg-white'}`}
              >
                {/* Card header */}
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                      {INDUSTRY_ICONS[key] || <Factory className="h-6 w-6 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900">{t.displayName || t.name}</h3>
                      <p className="text-sm text-slate-600 mt-1">{t.description}</p>
                    </div>
                  </div>

                  {/* Summary stats */}
                  <div className="flex flex-wrap gap-3 mt-4">
                    {t.includedPlugins && (
                      <span className="flex items-center gap-1.5 text-xs bg-white/70 rounded-lg px-2.5 py-1.5 font-medium text-slate-600">
                        <Plug className="h-3.5 w-3.5" /> {Array.isArray(t.includedPlugins) ? t.includedPlugins.length : 0} Plugins
                      </span>
                    )}
                    {t.defaultWorkflows && (
                      <span className="flex items-center gap-1.5 text-xs bg-white/70 rounded-lg px-2.5 py-1.5 font-medium text-slate-600">
                        <GitBranch className="h-3.5 w-3.5" /> {Array.isArray(t.defaultWorkflows) ? t.defaultWorkflows.length : 0} Workflows
                      </span>
                    )}
                    {t.complianceFrameworks && (
                      <span className="flex items-center gap-1.5 text-xs bg-white/70 rounded-lg px-2.5 py-1.5 font-medium text-slate-600">
                        <Shield className="h-3.5 w-3.5" /> {Array.isArray(t.complianceFrameworks) ? t.complianceFrameworks.length : 0} Frameworks
                      </span>
                    )}
                    {t.retentionRules && (
                      <span className="flex items-center gap-1.5 text-xs bg-white/70 rounded-lg px-2.5 py-1.5 font-medium text-slate-600">
                        <FileText className="h-3.5 w-3.5" /> {Array.isArray(t.retentionRules) ? t.retentionRules.length : 0} Retention Rules
                      </span>
                    )}
                  </div>
                </div>

                {/* Expandable details */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : t.id)}
                  className="w-full flex items-center justify-center gap-1 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 bg-white/40 border-t border-white/60 transition"
                >
                  {isExpanded ? 'Hide details' : 'Show details'}
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
                {isExpanded && (
                  <div className="px-6 pb-6 space-y-4 bg-white/30">
                    {/* Plugins */}
                    {Array.isArray(t.includedPlugins) && t.includedPlugins.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                          Included Plugins
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {t.includedPlugins.map((p: string) => (
                            <span key={p} className="px-2 py-0.5 bg-white rounded text-xs text-slate-600 border border-slate-200">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Workflows */}
                    {Array.isArray(t.defaultWorkflows) && t.defaultWorkflows.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                          Default Workflows
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {t.defaultWorkflows.map((w: string) => (
                            <span key={w} className="px-2 py-0.5 bg-white rounded text-xs text-slate-600 border border-slate-200">
                              {w}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Compliance Frameworks */}
                    {Array.isArray(t.complianceFrameworks) && t.complianceFrameworks.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                          Compliance Frameworks
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {t.complianceFrameworks.map((f: string) => (
                            <span key={f} className="px-2 py-0.5 bg-white rounded text-xs text-slate-600 border border-slate-200">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Retention Rules */}
                    {Array.isArray(t.retentionRules) && t.retentionRules.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                          Retention Rules
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {t.retentionRules.map((r: string) => (
                            <span key={r} className="px-2 py-0.5 bg-white rounded text-xs text-slate-600 border border-slate-200">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
