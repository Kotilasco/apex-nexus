'use client';

import { useEffect, useState } from 'react';
import { jurisdictionApi } from '@/lib/api';
import {
  Globe, Scale, BookOpen, AlertTriangle,
  ChevronDown, ChevronRight, Search, Filter,
} from 'lucide-react';
import type { Jurisdiction, LegalFramework, JurisdictionRetentionRule } from '@/lib/types';

export default function CompliancePage() {
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [frameworks, setFrameworks] = useState<LegalFramework[]>([]);
  const [rules, setRules] = useState<JurisdictionRetentionRule[]>([]);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedFramework, setExpandedFramework] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [jRes, fRes, rRes] = await Promise.allSettled([
          jurisdictionApi.getJurisdictions(),
          jurisdictionApi.getAllFrameworks(),
          jurisdictionApi.getAllRules(),
        ]);
        if (jRes.status === 'fulfilled') setJurisdictions(jRes.value.data?.data || []);
        if (fRes.status === 'fulfilled') setFrameworks(fRes.value.data?.data || []);
        if (rRes.status === 'fulfilled') setRules(rRes.value.data?.data || []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  const categories = Array.from(new Set(rules.map(r => r.documentCategory))).sort();
  const filteredRules = rules.filter(r => {
    if (selectedJurisdiction && r.jurisdictionCode !== selectedJurisdiction) return false;
    if (filterCategory && r.documentCategory !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.description?.toLowerCase().includes(q) ||
        r.legalCitation?.toLowerCase().includes(q) ||
        r.documentCategory.toLowerCase().includes(q) ||
        r.jurisdictionName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const severityColor = (years: number) => {
    if (years >= 10) return 'bg-red-100 text-red-700';
    if (years >= 6) return 'bg-amber-100 text-amber-700';
    if (years >= 3) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

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
        <h1 className="text-2xl font-bold text-slate-900">Compliance & Jurisdiction Rules</h1>
        <p className="text-slate-500 mt-1">
          Country-specific retention requirements and legal frameworks
        </p>
      </div>

      {/* Jurisdiction cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <button
          onClick={() => setSelectedJurisdiction(null)}
          className={`rounded-lg border p-3 text-center transition ${
            !selectedJurisdiction ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          <Globe className="h-5 w-5 mx-auto mb-1" />
          <span className="text-sm font-medium">All</span>
          <span className="block text-xs text-slate-400">{rules.length} rules</span>
        </button>
        {jurisdictions.map(j => {
          const count = rules.filter(r => r.jurisdictionCode === j.code).length;
          return (
            <button
              key={j.code}
              onClick={() => setSelectedJurisdiction(j.code === selectedJurisdiction ? null : j.code)}
              className={`rounded-lg border p-3 text-center transition ${
                selectedJurisdiction === j.code
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className="text-lg font-bold">{j.code}</span>
              <span className="block text-xs font-medium mt-0.5">{j.name}</span>
              <span className="block text-xs text-slate-400">{count} rules</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search rules, citations, descriptions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <select
            title="Filter by category"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legal Frameworks */}
      {frameworks.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary-500" /> Legal Frameworks
          </h2>
          <div className="space-y-2">
            {frameworks
              .filter(f => !selectedJurisdiction || f.jurisdictionCode === selectedJurisdiction)
              .map(f => (
                <div key={f.id} className="border border-slate-100 rounded-lg">
                  <button
                    onClick={() => setExpandedFramework(expandedFramework === f.id ? null : f.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-600 rounded">
                        {f.jurisdictionCode}
                      </span>
                      <span className="font-medium text-slate-900">{f.code}</span>
                      <span className="text-sm text-slate-500">{f.name}</span>
                    </div>
                    {expandedFramework === f.id ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  </button>
                  {expandedFramework === f.id && (
                    <div className="px-3 pb-3 text-sm text-slate-600 border-t border-slate-100 pt-2 space-y-1">
                      {f.description && <p>{f.description}</p>}
                      {f.authority && <p className="text-xs text-slate-400">Authority: {f.authority}</p>}
                      {f.effectiveDate && <p className="text-xs text-slate-400">Effective: {f.effectiveDate}</p>}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Retention Rules Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Scale className="h-5 w-5 text-amber-500" /> Retention Rules
            <span className="text-sm font-normal text-slate-400">({filteredRules.length})</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Jurisdiction</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Framework</th>
                <th className="px-4 py-3 text-center">Min Years</th>
                <th className="px-4 py-3 text-center">Max Years</th>
                <th className="px-4 py-3 text-left">Legal Citation</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-center">Mandatory</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    No retention rules match your filters
                  </td>
                </tr>
              ) : (
                filteredRules.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        <span className="font-bold text-slate-700">{r.jurisdictionCode}</span>
                        <span className="text-slate-400 text-xs hidden lg:inline">{r.jurisdictionName}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                        {r.documentCategory.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.legalFrameworkCode && (
                        <span className="font-medium">{r.legalFrameworkCode}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${severityColor(r.minRetentionYears)}`}>
                        {r.minRetentionYears}y
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {r.maxRetentionYears != null ? `${r.maxRetentionYears}y` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                      {r.legalCitation || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {r.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.isMandatory ? (
                        <span title="Mandatory"><AlertTriangle className="h-4 w-4 text-red-500 mx-auto" /></span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
