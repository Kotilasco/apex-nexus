'use client';

import { useState } from 'react';
import { searchApi, askApi } from '@/lib/api';
import type { SearchResult, SearchResponse } from '@/lib/types';
import { formatDate, getFileIcon } from '@/lib/utils';
import {
  Search as SearchIcon, SlidersHorizontal, X, FileText, Tag, Calendar,
  Sparkles, Globe, Loader2, Bot, ExternalLink, Brain,
} from 'lucide-react';
import Link from 'next/link';

type Mode = 'keyword' | 'ask' | 'federated' | 'synthesize';
const FED_SOURCES = [
  { id: 'internal',   label: 'Internal',   icon: '📄' },
  { id: 'outlook',    label: 'Outlook',    icon: '📧' },
  { id: 'sharepoint', label: 'SharePoint', icon: '🗂' },
  { id: 'drive',      label: 'Drive',      icon: '🟢' },
  { id: 'confluence', label: 'Confluence', icon: '🟦' },
];

export default function SearchPage() {
  const [mode, setMode] = useState<Mode>('keyword');
  // Ask AI state
  const [askAnswer, setAskAnswer] = useState<any>(null);
  const [askLoading, setAskLoading] = useState(false);
  // Federated state
  const [fedResults, setFedResults] = useState<any[]>([]);
  const [fedCounts, setFedCounts] = useState<Record<string, number>>({});
  const [fedLoading, setFedLoading] = useState(false);
  const [fedSources, setFedSources] = useState<string[]>(['internal', 'outlook', 'sharepoint']);
  // Synthesis state
  const [synthResult, setSynthResult] = useState<any>(null);
  const [synthLoading, setSynthLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [facets, setFacets] = useState<Record<string, Record<string, number>>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState({
    tags: '',
    mimeType: '',
    status: '',
    folderPath: '',
    dateFrom: '',
    dateTo: '',
  });

  const doSearch = async (p = 0) => {
    if (!query.trim()) return;
    setLoading(true);
    setPage(p);
    setError('');
    try {
      let res;
      if (showAdvanced && Object.values(filters).some(v => v)) {
        res = await searchApi.advanced({
          query: query.trim(),
          tags: filters.tags ? filters.tags.split(',').map(t => t.trim()) : undefined,
          mimeType: filters.mimeType || undefined,
          status: filters.status || undefined,
          folderPath: filters.folderPath || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          page: p,
          size: 20,
        });
      } else {
        res = await searchApi.quick(query.trim(), p, 20);
      }
      const data: SearchResponse = res.data?.data ?? res.data;
      const keywordResults = (data.results ?? []).filter((r: any) => r.documentId || r.id);

      // Also run semantic search in parallel (only on first page, non-advanced) and merge.
      let merged = keywordResults;
      if (p === 0 && !showAdvanced) {
        try {
          const semRes = await searchApi.semantic(query.trim(), 10);
          const semData = semRes.data?.data ?? semRes.data;
          const semResults = (semData.results ?? []).filter((r: any) => r.documentId || r.id);
          // Merge: dedupe by documentId, keyword first then semantic extras
          const seen = new Set(keywordResults.map((r: any) => r.documentId || r.id));
          const extras = semResults
            .filter((r: any) => !seen.has(r.documentId || r.id))
            .map((r: any) => ({ ...r, _semantic: true }));
          merged = [...keywordResults, ...extras];
        } catch {
          /* semantic optional — ignore failures */
        }
      }
      setResults(merged);

      // Normalize facets: API returns [{key,count}] arrays, convert to Record<string,number>
      const rawFacets = data.facets ?? {};
      const normalizedFacets: Record<string, Record<string, number>> = {};
      for (const [name, buckets] of Object.entries(rawFacets)) {
        if (Array.isArray(buckets)) {
          normalizedFacets[name] = {};
          for (const b of buckets as any[]) normalizedFacets[name][b.key] = b.count;
        } else {
          normalizedFacets[name] = buckets as Record<string, number>;
        }
      }
      setFacets(normalizedFacets);
      const hitCount = merged.length;
      setTotal(hitCount);
      setTotalPages(data.totalPages ?? Math.ceil(hitCount / 20));
      setSearched(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Search failed. Please try again.');
      setResults([]);
    }
    setLoading(false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setFacets({});
    setTotal(0);
    setSearched(false);
    setAskAnswer(null);
    setFedResults([]);
    setFedCounts({});
    setSynthResult(null);
    setFilters({ tags: '', mimeType: '', status: '', folderPath: '', dateFrom: '', dateTo: '' });
  };

  const runAsk = async () => {
    if (!query.trim()) return;
    setAskLoading(true); setError(''); setAskAnswer(null);
    try {
      const res = await askApi.ask(query.trim(), 5);
      setAskAnswer(res.data?.data ?? res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ask failed');
    }
    setAskLoading(false);
  };

  const runFederated = async () => {
    if (!query.trim()) return;
    setFedLoading(true); setError(''); setFedResults([]);
    try {
      const res = await askApi.federated(query.trim(), fedSources, 10);
      const d = res.data?.data ?? res.data;
      setFedResults(d.results ?? []);
      setFedCounts(d.sourceCounts ?? {});
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Federated search failed');
    }
    setFedLoading(false);
  };

  const runSynthesize = async () => {
    if (!query.trim()) return;
    setSynthLoading(true); setError(''); setSynthResult(null);
    try {
      const res = await askApi.synthesize(query.trim(), 8);
      setSynthResult(res.data?.data ?? res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Synthesis failed');
    }
    setSynthLoading(false);
  };

  const runActive = () => {
    if (mode === 'ask') return runAsk();
    if (mode === 'federated') return runFederated();
    if (mode === 'synthesize') return runSynthesize();
    return doSearch(0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Search</h1>
        <p className="text-slate-500 mt-1">Find documents across the entire archive</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 w-fit">
        {[
          { id: 'keyword',    label: 'Keyword',      icon: SearchIcon },
          { id: 'ask',        label: 'Ask AI',       icon: Sparkles },
          { id: 'synthesize', label: 'Synthesize',   icon: Brain },
          { id: 'federated',  label: 'Federated',    icon: Globe },
        ].map(t => {
          const Icon = t.icon;
          const active = mode === t.id;
          return (
            <button key={t.id} onClick={() => setMode(t.id as Mode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                active ? 'bg-primary-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              <Icon className="h-4 w-4" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runActive()}
              placeholder={
                mode === 'ask'
                  ? 'Ask a question about your documents...'
                  : mode === 'federated'
                    ? 'Search across internal + connected sources...'
                    : mode === 'synthesize'
                      ? 'Topic to synthesize — e.g. "Project Alpha risks"...'
                      : 'Search documents by title, content, tags...'
              }
              className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              autoFocus
            />
            {query && (
              <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {mode === 'keyword' && (
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className={`px-4 py-3 border rounded-lg text-sm font-medium flex items-center gap-2 transition ${showAdvanced ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </button>
          )}
          <button onClick={runActive} disabled={(loading || askLoading || fedLoading || synthLoading) || !query.trim()}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
            {(loading || askLoading || fedLoading || synthLoading) && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'ask' ? 'Ask' : mode === 'synthesize' ? 'Synthesize' : 'Search'}
          </button>
        </div>

        {/* Federated source chips */}
        {mode === 'federated' && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
            {FED_SOURCES.map(s => {
              const active = fedSources.includes(s.id);
              return (
                <button key={s.id}
                  onClick={() => setFedSources(prev =>
                    active ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    active ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}>
                  <span>{s.icon}</span>{s.label}
                  {fedCounts[s.id] != null && (
                    <span className="bg-white/70 px-1.5 py-0.5 rounded-full text-[10px]">{fedCounts[s.id]}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Advanced filters */}
        {mode === 'keyword' && showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tags (comma-separated)</label>
              <input value={filters.tags} onChange={e => setFilters(f => ({ ...f, tags: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="e.g. contract, legal" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">MIME Type</label>
              <select value={filters.mimeType} onChange={e => setFilters(f => ({ ...f, mimeType: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                <option value="">Any</option>
                <option value="application/pdf">PDF</option>
                <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">Word</option>
                <option value="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">Excel</option>
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                <option value="">Any</option>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Folder Path</label>
              <input value={filters.folderPath} onChange={e => setFilters(f => ({ ...f, folderPath: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="e.g. /contracts" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date From</label>
              <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date To</label>
              <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
          </div>
        )}
      </div>

      {/* Ask AI panel */}
      {mode === 'ask' && (askLoading || askAnswer) && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          {askLoading ? (
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <Loader2 className="h-5 w-5 animate-spin" /> Thinking across your document corpus...
            </div>
          ) : askAnswer && (
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-semibold ${
                  askAnswer.modelStatus === 'OK' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  <Bot className="inline h-3 w-3 mr-1" />
                  {askAnswer.modelStatus === 'OK' ? `AI · ${askAnswer.model}` : 'Fallback (LLM unavailable)'}
                </span>
                <span className="text-slate-400">{askAnswer.latencyMs}ms</span>
              </div>
              <div className="prose prose-sm max-w-none text-slate-800 whitespace-pre-wrap">
                {askAnswer.answer}
              </div>
              {askAnswer.sources?.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sources</h4>
                  <div className="space-y-2">
                    {askAnswer.sources.map((s: any) => (
                      <Link key={s.index} href={`/documents?doc=${s.documentId}`}
                        className="block bg-slate-50 hover:bg-slate-100 rounded-lg p-3 transition">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-bold text-primary-600 shrink-0">[{s.index}]</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{s.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{s.snippet}</p>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">{s.score?.toFixed(2)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Federated results */}
      {mode === 'federated' && (fedLoading || fedResults.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          {fedLoading ? (
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <Loader2 className="h-5 w-5 animate-spin" /> Searching across connected systems...
            </div>
          ) : (
            fedResults.map((r: any, idx: number) => (
              <div key={`${r.source}-${r.id}-${idx}`} className="flex items-start gap-3 p-3 border border-slate-100 rounded-lg hover:border-primary-200 hover:bg-slate-50 transition">
                <span className="text-xl">{r.sourceIcon || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium uppercase">{r.source}</span>
                    {r.source === 'internal' ? (
                      <Link href={`/documents?doc=${r.id}`} className="font-medium text-slate-900 hover:text-primary-600 truncate">{r.title}</Link>
                    ) : (
                      <a href={r.url || '#'} target="_blank" rel="noreferrer" className="font-medium text-slate-900 hover:text-primary-600 truncate flex items-center gap-1">
                        {r.title}<ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  {r.snippet && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{r.snippet}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                    {r.author && <span>{r.author}</span>}
                    {r.createdAt && <span>{formatDate(r.createdAt)}</span>}
                    <span>Score: {r.score?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Synthesize panel */}
      {mode === 'synthesize' && (synthLoading || synthResult) && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          {synthLoading ? (
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <Loader2 className="h-5 w-5 animate-spin" /> Synthesizing briefing across {8} documents...
            </div>
          ) : synthResult && (
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-semibold ${
                  synthResult.modelStatus === 'OK' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  <Brain className="inline h-3 w-3 mr-1" />
                  {synthResult.modelStatus === 'OK' ? `AI briefing · ${synthResult.model}` : 'Fallback'}
                </span>
                <span className="text-slate-400">{synthResult.sourceCount} sources · {synthResult.latencyMs}ms</span>
              </div>
              <div className="prose prose-sm max-w-none text-slate-800 whitespace-pre-wrap">
                {synthResult.summary}
              </div>
              {synthResult.sources?.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Citations</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {synthResult.sources.map((s: any) => (
                      <Link key={s.index} href={`/documents?doc=${s.documentId}`}
                        className="block bg-slate-50 hover:bg-slate-100 rounded-lg p-3 transition">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-bold text-primary-600 shrink-0">[{s.index}]</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{s.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{s.snippet}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Results */}
      {mode === 'keyword' && loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : searched && mode === 'keyword' ? (
        <div className="flex gap-6">
          {/* Main results */}
          <div className="flex-1 space-y-3">
            <p className="text-sm text-slate-500">
              {total} result{total !== 1 && 's'} found
            </p>
            {results.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <SearchIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No documents match your search</p>
              </div>
            ) : (
              results
                .filter(r => (r as any).documentId || (r as any).id)
                .map(r => {
                const docId = r.documentId || r.id || '';
                const hlValues = r.highlights ?? (r.highlight ? Object.values(r.highlight).flat() : []);
                const tags = r.tags ?? [];
                return (
                <Link key={docId} href={`/documents?doc=${docId}`}
                  className="block bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{getFileIcon(r.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{r.title}</h3>
                        {(r as any)._semantic && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-semibold uppercase tracking-wide">
                            ✨ Semantic
                          </span>
                        )}
                      </div>
                      {r.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{r.description}</p>}
                      {hlValues.length > 0 && (
                        <div className="mt-2 text-sm text-slate-600 bg-amber-50 rounded-lg p-2 border border-amber-100"
                          dangerouslySetInnerHTML={{ __html: hlValues[0] }} />
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{r.folderPath || '/'}</span>
                        <span>{r.authorName || 'Unknown'}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(r.createdAt)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {r.status}
                        </span>
                      </div>
                      {tags.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Tag className="h-3 w-3 text-slate-400" />
                          {tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">Score: {r.score?.toFixed(2) ?? '—'}</span>
                  </div>
                </Link>
              );})
            )}
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button onClick={() => doSearch(page - 1)} disabled={page === 0}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50">Previous</button>
                <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
                <button onClick={() => doSearch(page + 1)} disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50">Next</button>
              </div>
            )}
          </div>

          {/* Facets sidebar */}
          {Object.keys(facets).length > 0 && (
            <div className="w-64 shrink-0 hidden lg:block space-y-4">
              {Object.entries(facets).map(([facetName, buckets]) => (
                <div key={facetName} className="bg-white rounded-xl border border-slate-200 p-4">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    {facetName.replace(/([A-Z])/g, ' $1').trim()}
                  </h4>
                  <div className="space-y-1.5">
                    {Object.entries(buckets).slice(0, 10).map(([value, count]) => (
                      <button key={value}
                        onClick={() => { setFilters(f => ({ ...f, [facetName === 'mimeTypes' ? 'mimeType' : facetName === 'statuses' ? 'status' : facetName]: value })); setShowAdvanced(true); }}
                        className="flex items-center justify-between w-full text-sm text-slate-600 hover:text-primary-600 transition">
                        <span className="truncate">{value}</span>
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full ml-2">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : !searched && mode === 'keyword' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <SearchIcon className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700">Search your archive</h2>
          <p className="text-slate-400 mt-1">Enter a search term to find documents by title, content, or tags</p>
        </div>
      ) : mode === 'ask' && !askAnswer && !askLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <Sparkles className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700">Ask your documents anything</h2>
          <p className="text-slate-400 mt-1">AI answers questions using your archive as context, with citations</p>
        </div>
      ) : mode === 'federated' && fedResults.length === 0 && !fedLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <Globe className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700">Search across every connected system</h2>
          <p className="text-slate-400 mt-1">Internal archive + Outlook, SharePoint, Drive, Confluence</p>
        </div>
      ) : mode === 'synthesize' && !synthResult && !synthLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <Brain className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700">Synthesize knowledge across documents</h2>
          <p className="text-slate-400 mt-1">Get an executive briefing with themes, risks, and cited sources — instead of 20 separate files.</p>
        </div>
      ) : null}
    </div>
  );
}
