'use client';

import { useEffect, useRef, useState } from 'react';

interface DocxViewerProps {
  blobUrl: string;
}

export default function DocxViewer({ blobUrl }: DocxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || !blobUrl) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(blobUrl);
        const arrayBuffer = await res.arrayBuffer();
        const { renderAsync } = await import('docx-preview');
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = '';
        await renderAsync(arrayBuffer, containerRef.current, undefined, {
          className: 'docx-preview',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          console.error('[DocxViewer] render failed:', e);
          setError('Could not render document preview');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [blobUrl]);

  if (error) {
    return (
      <div className="bg-slate-100 rounded-lg p-8 flex items-center justify-center text-slate-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden" style={{ maxHeight: 400 }}>
      {loading && (
        <div className="flex items-center justify-center p-8 text-slate-400 text-sm">
          Rendering document...
        </div>
      )}
      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ maxHeight: 400 }}
      />
    </div>
  );
}
