'use client';

import { useEffect, useState } from 'react';
import { pluginApi } from '@/lib/api';
import type { Plugin } from '@/lib/types';
import {
  Plug, Search, Filter, Download, Power, PowerOff,
  Star, ExternalLink, Tag, Layers,
} from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  CONNECTOR: 'bg-blue-100 text-blue-700',
  PROCESSOR: 'bg-violet-100 text-violet-700',
  UI_EXTENSION: 'bg-teal-100 text-teal-700',
  INDUSTRY_PACK: 'bg-amber-100 text-amber-700',
  INTEGRATION: 'bg-emerald-100 text-emerald-700',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-slate-100 text-slate-500',
  DEPRECATED: 'bg-red-100 text-red-600',
  BETA: 'bg-yellow-100 text-yellow-700',
};

export default function MarketplacePage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const loadPlugins = async () => {
    try {
      const res = await pluginApi.getAll();
      setPlugins(res.data?.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadPlugins(); }, []);

  const types = Array.from(new Set(plugins.map(p => p.pluginType))).sort();
  const categories = Array.from(new Set(plugins.map(p => p.category))).sort();

  const filtered = plugins.filter(p => {
    if (typeFilter && p.pluginType !== typeFilter) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.displayName.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.vendor?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const togglePlugin = async (plugin: Plugin) => {
    setActivating(plugin.id);
    try {
      if (plugin.status === 'ACTIVE') {
        await pluginApi.deactivate(plugin.id);
      } else {
        await pluginApi.activate(plugin.id);
      }
      await loadPlugins();
    } catch { /* ignore */ }
    setActivating(null);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plugin Marketplace</h1>
          <p className="text-slate-500 mt-1">
            Connectors, compliance packs, and extensions for your ECM
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Plug className="h-4 w-4" />
          {plugins.filter(p => p.status === 'ACTIVE').length} / {plugins.length} active
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search plugins..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="relative">
          <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <select
            title="Filter by type"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
          >
            <option value="">All Types</option>
            {types.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <select
            title="Filter by category"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Plugin cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full flex flex-col items-center py-16 text-slate-400">
            <Plug className="h-10 w-10 mb-2 text-slate-300" />
            <p>No plugins match your filters</p>
          </div>
        ) : (
          filtered.map(p => (
            <div
              key={p.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition"
            >
              {/* Top row */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {p.iconUrl ? (
                    <img src={p.iconUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Plug className="h-5 w-5 text-slate-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-slate-900 leading-tight">{p.displayName}</h3>
                    <span className="text-xs text-slate-400">{p.vendor} · v{p.version}</span>
                  </div>
                </div>
                {p.isPremium && (
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400 flex-shrink-0" />
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-slate-600 line-clamp-2">{p.description}</p>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[p.pluginType] || 'bg-slate-100 text-slate-600'}`}>
                  {p.pluginType.replace(/_/g, ' ')}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-slate-100 text-slate-500'}`}>
                  {p.status}
                </span>
                {p.category && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                    {p.category}
                  </span>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Download className="h-3 w-3" /> {p.installedCount ?? 0}
                  </span>
                  {p.documentationUrl && (
                    <a
                      href={p.documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary-500 transition"
                    >
                      <ExternalLink className="h-3 w-3" /> Docs
                    </a>
                  )}
                </div>
                <button
                  onClick={() => togglePlugin(p)}
                  disabled={activating === p.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    p.status === 'ACTIVE'
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  } disabled:opacity-50`}
                >
                  {activating === p.id ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                  ) : p.status === 'ACTIVE' ? (
                    <><PowerOff className="h-3 w-3" /> Deactivate</>
                  ) : (
                    <><Power className="h-3 w-3" /> Activate</>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
