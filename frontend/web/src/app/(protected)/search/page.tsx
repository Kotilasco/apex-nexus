'use client';

import { useState } from 'react';
import { searchApi } from '@/lib/api';
import type { SearchResult, SearchResponse } from '@/lib/types';
import { formatDate, getFileIcon } from '@/lib/utils';
import {
  Search as SearchIcon, SlidersHorizontal, X, FileText, Tag, Calendar,
} from 'lucide-react';
import Link from 'next/link';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [facets, setFacets] = useState<Record<string, Record<string, number>>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
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
      setResults(data.results ?? []);
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
      const hitCount = data.totalHits ?? data.total ?? 0;
      setTotal(hitCount);
      setTotalPages(data.totalPages ?? Math.ceil(hitCount / 20));
      setSearched(true);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setFacets({});
    setTotal(0);
    setSearched(false);
    setFilters({ tags: '', mimeType: '', status: '', folderPath: '', dateFrom: '', dateTo: '' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Search</h1>
        <p className="text-slate-500 mt-1">Find documents across the entire archive</p>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search documents by title, content, tags..."
              className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              autoFocus
            />
            {query && (
              <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-4 py-3 border rounded-lg text-sm font-medium flex items-center gap-2 transition ${showAdvanced ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </button>
          <button onClick={() => doSearch()} disabled={loading || !query.trim()}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            Search
          </button>
        </div>

        {/* Advanced filters */}
        {showAdvanced && (
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

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : searched ? (
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
              results.map(r => {
                const docId = r.documentId || r.id || '';
                const hlValues = r.highlights ?? (r.highlight ? Object.values(r.highlight).flat() : []);
                return (
                <Link key={docId} href={`/documents?doc=${docId}`}
                  className="block bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{getFileIcon(r.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900">{r.title}</h3>
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
                      {r.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Tag className="h-3 w-3 text-slate-400" />
                          {r.tags.map(tag => (
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
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <SearchIcon className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700">Search your archive</h2>
          <p className="text-slate-400 mt-1">Enter a search term to find documents by title, content, or tags</p>
        </div>
      )}
    </div>
  );
}
