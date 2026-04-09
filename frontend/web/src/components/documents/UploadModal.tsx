'use client';

import { useState, useCallback } from 'react';
import { documentApi } from '@/lib/api';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

interface Props {
  folderId?: string;
  projectId?: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function UploadModal({ folderId, projectId, onClose, onComplete }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(accepted);
    if (!title && accepted.length > 0) setTitle(accepted[0].name);
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: false, maxSize: 100 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      const metadata: Record<string, unknown> = { title: title || files[0].name };
      if (description) metadata.description = description;
      if (folderId) metadata.folderId = folderId;
      if (projectId) metadata.projectId = projectId;
      if (tags) metadata.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      await documentApi.upload(formData);
      onComplete();
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.message || err?.message || 'Unknown error';
      console.error('[Upload] failed:', status, detail, err);
      alert(`Upload failed (${status || 'network error'}): ${detail}`);
    }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Upload Document</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Dropzone */}
          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            isDragActive ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-primary-400'
          }`}>
            <input {...getInputProps()} />
            {files.length > 0 ? (
              <div className="flex items-center justify-center gap-3">
                <File className="h-8 w-8 text-primary-600" />
                <div className="text-left">
                  <p className="font-medium text-slate-900">{files[0].name}</p>
                  <p className="text-sm text-slate-500">{formatBytes(files[0].size)}</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600">Drop a file here or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">Max 100 MB</p>
              </>
            )}
          </div>

          {/* Fields */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="invoice, finance, 2024"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={handleUpload} disabled={uploading || files.length === 0}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
