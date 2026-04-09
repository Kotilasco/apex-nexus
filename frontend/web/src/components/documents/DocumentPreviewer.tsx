'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';

interface DocumentPreviewerProps {
  documentId: string;
  mimeType?: string;
  title?: string;
  onClose: () => void;
}

const PREVIEWABLE_TYPES = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'text/plain', 'text/html', 'text/csv', 'text/markdown',
  'application/json',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
];

export function isPreviewable(mimeType?: string): boolean {
  if (!mimeType) return false;
  return PREVIEWABLE_TYPES.some(t => mimeType.startsWith(t.split('/')[0]) || mimeType === t);
}

export default function DocumentPreviewer({ documentId, mimeType, title, onClose }: DocumentPreviewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPreview = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/documents/${documentId}/preview`, {
          responseType: 'blob',
        });

        if (cancelled) return;

        const blob = response.data as Blob;
        const type = mimeType || blob.type;

        // Text content — read as string
        if (type?.startsWith('text/') || type === 'application/json') {
          const text = await blob.text();
          setTextContent(text);
        } else {
          // Binary content — create blob URL
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load preview');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPreview();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-500">Loading preview...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-500">
          <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p>{error}</p>
        </div>
      );
    }

    // PDF
    if (mimeType === 'application/pdf' && blobUrl) {
      return <iframe src={blobUrl} className="w-full h-full border-0" title={title || 'Document Preview'} />;
    }

    // Images
    if (mimeType?.startsWith('image/') && blobUrl) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-100 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={blobUrl} alt={title || 'Image preview'} className="max-w-full max-h-full object-contain" />
        </div>
      );
    }

    // Video
    if (mimeType?.startsWith('video/') && blobUrl) {
      return (
        <div className="flex items-center justify-center h-full bg-black">
          <video src={blobUrl} controls className="max-w-full max-h-full">
            Your browser does not support video playback.
          </video>
        </div>
      );
    }

    // Audio
    if (mimeType?.startsWith('audio/') && blobUrl) {
      return (
        <div className="flex items-center justify-center h-full">
          <audio src={blobUrl} controls>
            Your browser does not support audio playback.
          </audio>
        </div>
      );
    }

    // Text / JSON / Markdown
    if (textContent !== null) {
      return (
        <pre className="p-6 overflow-auto h-full bg-gray-50 text-sm font-mono whitespace-pre-wrap break-words">
          {textContent}
        </pre>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>Preview not available for this file type</p>
        <p className="text-sm mt-1">{mimeType}</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 text-white">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="font-medium">{title || 'Document Preview'}</span>
          {mimeType && <span className="text-gray-400 text-sm">({mimeType})</span>}
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition-colors" title="Close preview">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}
