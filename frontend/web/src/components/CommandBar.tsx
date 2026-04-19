'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Command, Loader2, X, ArrowRight, Bot, FileText } from 'lucide-react';
import { askApi } from '@/lib/api';


/**
 * Global intent-based Command Bar. Press Cmd+K / Ctrl+K anywhere in the app to open.
 * Routes natural-language prompts to: search, ask, synthesize, notify, workflow.
 */
export default function CommandBar() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const submit = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await askApi.intent(prompt.trim());
      setResult(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Request failed');
    }
    setLoading(false);
  };

  const runAction = (a: { type: string }) => {
    if (a.type === 'search') {
      router.push(`/search?q=${encodeURIComponent(prompt)}`);
      setOpen(false);
    } else if (a.type === 'synthesize') {
      router.push(`/search?mode=synthesize&q=${encodeURIComponent(prompt)}`);
      setOpen(false);
    } else if (a.type === 'workflow') {
      router.push('/workflow');
      setOpen(false);
    } else if (a.type === 'notify') {
      alert('Notification drafted — review before sending (stub in demo).');
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-700 transition text-sm"
        title="Open Command Bar (Ctrl+K)"
      >
        <Sparkles className="h-4 w-4 text-amber-300" />
        <span>Ask or command</span>
        <kbd className="ml-1 px-1.5 py-0.5 bg-slate-700 text-slate-200 rounded text-[10px] font-mono">⌘K</kbd>
      </button>
    );
  }

  const answer = result?.answer;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <Sparkles className="h-5 w-5 text-primary-600 shrink-0" />
          <input
            ref={inputRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder='Try: "Summarize ZETDC invoices over $5,000 and notify Finance"'
            className="flex-1 outline-none text-slate-800 placeholder-slate-400 text-base"
          />
          {loading && <Loader2 className="h-5 w-5 animate-spin text-primary-600" />}
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Empty state / suggestions */}
        {!result && !error && !loading && (
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">Try these</p>
            {[
              'Summarize all risks in Project Alpha',
              'Find pending invoices over $5,000',
              'Show contracts expiring this quarter',
              'Brief me on POTRAZ compliance status',
            ].map(s => (
              <button key={s}
                onClick={() => { setPrompt(s); setTimeout(submit, 50); }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2 group">
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-primary-600" />
                {s}
              </button>
            ))}
            <div className="text-[11px] text-slate-400 pt-2 px-1 flex items-center gap-2">
              <Command className="h-3 w-3" />
              Press Ctrl+K anywhere to open this
            </div>
          </div>
        )}

        {error && <div className="p-4 text-sm text-red-600 bg-red-50">{error}</div>}

        {/* Result */}
        {result && (
          <div className="max-h-[60vh] overflow-auto p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full font-semibold uppercase">
                {result.intent}
              </span>
              <span className="text-slate-400">{result.latencyMs}ms</span>
            </div>

            {answer?.answer && (
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-800 whitespace-pre-wrap border border-slate-100">
                <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 mb-2">
                  <Bot className="h-3.5 w-3.5" />
                  {answer.modelStatus === 'OK' ? `AI · ${answer.model}` : 'Fallback'}
                </div>
                {answer.answer}
              </div>
            )}
            {answer?.summary && (
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-800 whitespace-pre-wrap border border-slate-100">
                {answer.summary}
              </div>
            )}

            {answer?.sources?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sources</p>
                <div className="space-y-1.5">
                  {answer.sources.slice(0, 5).map((s: any) => (
                    <button key={s.index}
                      onClick={() => { router.push(`/documents?doc=${s.documentId}`); setOpen(false); }}
                      className="w-full flex items-start gap-2 text-left px-3 py-2 rounded-lg hover:bg-slate-50">
                      <span className="text-[10px] font-bold text-primary-600 mt-0.5">[{s.index}]</span>
                      <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{s.title}</p>
                        <p className="text-xs text-slate-500 line-clamp-1">{s.snippet}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {result.actions?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                {result.actions.map((a: any) => (
                  <button key={a.type} onClick={() => runAction(a)}
                    className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700">
                    {a.label} →
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
