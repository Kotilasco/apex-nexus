'use client';

import { useState } from 'react';
import { searchApi } from '@/lib/api';

interface SearchResult {
  documentId: string;
  title: string;
  description: string;
  mimeType: string;
  score: number;
  highlights: string[];
}

export default function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await searchApi.semantic(query);
      setResults(res.data.data.results || []);
    } catch (err: any) {
      setResults([]);
      setError(err?.response?.data?.message || err?.message || 'Semantic search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Semantic Search</h3>
      <p className="text-sm text-gray-500 mb-4">
        Find documents by meaning — describe what you&apos;re looking for in natural language.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="e.g., contracts related to cloud services renewal..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="bg-indigo-600 text-white rounded-lg px-5 py-2 font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Searching...' : 'Find Similar'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mb-4">{error}</div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => (
            <div key={r.documentId} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-gray-900">{r.title}</h4>
                <span className="text-xs bg-indigo-50 text-indigo-700 rounded px-2 py-0.5">
                  {(r.score * 100).toFixed(0)}% match
                </span>
              </div>
              <p className="text-sm text-gray-500">{r.description}</p>
              <span className="text-xs text-gray-400">{r.mimeType}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
