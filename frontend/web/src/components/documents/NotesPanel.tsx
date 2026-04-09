'use client';

import { useState, useEffect } from 'react';
import { documentApi } from '@/lib/api';
import type { Document, DocumentNote } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { X, StickyNote, Send, Pin, Trash2 } from 'lucide-react';

interface Props {
  document: Document;
  onClose: () => void;
}

const NOTE_COLORS = ['#FEF3C7', '#DBEAFE', '#D1FAE5', '#FCE7F3', '#EDE9FE', '#FEE2E2'];

export default function NotesPanel({ document: doc, onClose }: Props) {
  const [notes, setNotes] = useState<DocumentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0]);

  const loadNotes = async () => {
    try {
      const res = await documentApi.getNotes(doc.id);
      setNotes(res.data?.data ?? res.data ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadNotes(); }, [doc.id]);

  const handleAddNote = async () => {
    if (!content.trim()) return;
    try {
      await documentApi.addNote(doc.id, { content: content.trim(), color: selectedColor });
      setContent('');
      loadNotes();
    } catch { /* ignore */ }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await documentApi.deleteNote(doc.id, noteId);
      loadNotes();
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-amber-500" />
          <h2 className="font-semibold text-slate-900">Notes — {doc.title}</h2>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-center text-slate-400 py-8">No notes yet. Add one below!</p>
        ) : (
          notes.map(note => (
            <div key={note.id} className="rounded-lg p-3 shadow-sm border border-slate-100" style={{ backgroundColor: note.color || '#FEF3C7' }}>
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">{note.authorName}</span>
                <div className="flex items-center gap-1">
                  {note.pinned && <Pin className="h-3 w-3 text-amber-600" />}
                  <button onClick={() => handleDelete(note.id)} className="p-0.5 rounded hover:bg-black/10">
                    <Trash2 className="h-3 w-3 text-slate-500" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{note.content}</p>
              <p className="text-[10px] text-slate-400 mt-2">{formatDateTime(note.createdAt)}</p>
            </div>
          ))
        )}
      </div>

      {/* New note input */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex gap-1.5 mb-2">
          {NOTE_COLORS.map(c => (
            <button key={c} onClick={() => setSelectedColor(c)}
              className={`w-6 h-6 rounded-full border-2 ${selectedColor === c ? 'border-slate-600' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex gap-2">
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={2} placeholder="Add a note..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary-500 outline-none"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }} />
          <button onClick={handleAddNote} className="px-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
