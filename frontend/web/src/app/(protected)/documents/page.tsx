'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { documentApi, lockApi, wopiApi, workflowApi, projectApi, signatureApi, authApi } from '@/lib/api';
import type { WorkflowDefinition, WorkflowInstance } from '@/lib/types';
import { useProjectStore } from '@/lib/project-store';
import type { Document, Folder, VersionPreCheckResult } from '@/lib/types';
import { formatBytes, formatDate, getFileIcon } from '@/lib/utils';
import {
  Upload, FolderPlus, ChevronRight, Home, Download, Lock,
  Unlock, Trash2, FileText, StickyNote, MoreVertical, Eye, Bot, Shield, ExternalLink,
  Edit3, Heart, UploadCloud, AlertTriangle, GitBranch, Send, Loader2, Save, X, PenTool, Search,
} from 'lucide-react';
import UploadModal from '@/components/documents/UploadModal';
import NotesPanel from '@/components/documents/NotesPanel';
import VersionsPanel from '@/components/documents/VersionsPanel';
import DocumentRetentionPanel from '@/components/documents/DocumentRetentionPanel';
import SignaturePanel from '@/components/documents/SignaturePanel';
import dynamic from 'next/dynamic';

const DocxViewer = dynamic(() => import('@/components/documents/DocxViewer'), { ssr: false });

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const { activeProject } = useProjectStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | undefined>();
  const [breadcrumbs, setBreadcrumbs] = useState<{ id?: string; name: string }[]>([{ name: 'Root' }]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showUpload, setShowUpload] = useState(searchParams.get('action') === 'upload');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ── Editing / Lock / Heartbeat state ──
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [lockToken, setLockToken] = useState<string | null>(null);
  const [heartbeatCount, setHeartbeatCount] = useState(0);
  const [editStartTime, setEditStartTime] = useState<number | null>(null);
  const [editElapsed, setEditElapsed] = useState('');
  const [wordUrl, setWordUrl] = useState<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-check warning modal state
  const [preCheckResult, setPreCheckResult] = useState<VersionPreCheckResult | null>(null);
  const [pendingCheckinFile, setPendingCheckinFile] = useState<File | null>(null);
  const [preCheckLoading, setPreCheckLoading] = useState(false);

  // Context menu positioning
  const [contextMenuPos, setContextMenuPos] = useState<{ top: number; left: number } | null>(null);

  // Text editing state
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [savingContent, setSavingContent] = useState(false);

  // Signature modal state
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureSignerId, setSignatureSignerId] = useState('');
  const [signatureProvider, setSignatureProvider] = useState<'INTERNAL' | 'DOCUSIGN'>('INTERNAL');
  const [signerUsers, setSignerUsers] = useState<{ id: string; username: string; email: string; firstName: string; lastName: string }[]>([]);
  const [signerSearch, setSignerSearch] = useState('');
  const [signerDropdownOpen, setSignerDropdownOpen] = useState(false);
  const signerRef = useRef<HTMLDivElement>(null);

  // Workflow state
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [showRetention, setShowRetention] = useState(false);
  const [workflowDefs, setWorkflowDefs] = useState<WorkflowDefinition[]>([]);
  const [docWorkflows, setDocWorkflows] = useState<WorkflowInstance[]>([]);
  const [workflowDefId, setWorkflowDefId] = useState('');
  const [startingWorkflow, setStartingWorkflow] = useState(false);

  // Heartbeat sender — runs every 30s while editing
  const startHeartbeat = useCallback((docId: string) => {
    // Clear any previous heartbeat
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    setHeartbeatCount(0);
    heartbeatRef.current = setInterval(async () => {
      try {
        await lockApi.heartbeat(docId);
        setHeartbeatCount(c => c + 1);
        console.log(`[Heartbeat] sent for ${docId}`);
      } catch (err) {
        console.error('[Heartbeat] failed:', err);
      }
    }, 30_000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Elapsed timer — updates every second
  const startTimer = useCallback(() => {
    const start = Date.now();
    setEditStartTime(start);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      setEditElapsed(`${m}:${String(s).padStart(2, '0')}`);
    }, 1000);
  }, []);

  // ── Edit in Word: Download .docx via WOPI so user can open in Word ──
  // ── Edit in Word: Generate WebDAV URL with token → open via ms-word:ofe protocol ──
  // Map mime types to Office protocol prefixes and default extensions
  const OFFICE_MIME_MAP: Record<string, { protocol: string; ext: string; label: string }> = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { protocol: 'ms-word', ext: '.docx', label: 'Word' },
    'application/msword': { protocol: 'ms-word', ext: '.doc', label: 'Word' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { protocol: 'ms-excel', ext: '.xlsx', label: 'Excel' },
    'application/vnd.ms-excel': { protocol: 'ms-excel', ext: '.xls', label: 'Excel' },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': { protocol: 'ms-powerpoint', ext: '.pptx', label: 'PowerPoint' },
    'application/vnd.ms-powerpoint': { protocol: 'ms-powerpoint', ext: '.ppt', label: 'PowerPoint' },
  };

  const openInOfficeApp = async (docId: string, mime: string) => {
    const mapping = OFFICE_MIME_MAP[mime];
    if (!mapping) return;
    try {
      const tokenRes = await wopiApi.generateToken(docId);
      const tokenData = tokenRes.data?.data ?? tokenRes.data;
      const title = selectedDoc?.title || 'document';
      const filename = encodeURIComponent(title.toLowerCase().endsWith(mapping.ext) ? title : title + mapping.ext);
      const webdavUrl = `${window.location.protocol}//${window.location.hostname}:8200/api/webdav/documents/${docId}/${filename}?access_token=${tokenData.accessToken}`;
      const officeUrl = `${mapping.protocol}:ofe|u|${webdavUrl}`;
      setWordUrl(officeUrl);
    } catch (e) {
      console.warn(`[Edit] Failed to generate ${mapping.label} URL:`, e);
      alert(`Lock acquired but could not generate ${mapping.label} URL. Use Download instead.`);
    }
  };

  const openInWord = async (docId: string) => {
    await openInOfficeApp(docId, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  };

  const handleEditInWord = async (doc: Document) => {
    const mime = doc.mimeType || '';
    try {
      const res = await lockApi.acquire(doc.id);
      const data = res.data?.data ?? res.data;
      setLockToken(data?.lockToken ?? null);
      setEditingDocId(doc.id);
      startHeartbeat(doc.id);
      startTimer();
      await openInOfficeApp(doc.id, mime);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || 'Failed to acquire lock';
      if (status === 423) {
        alert(`Document is locked by another user.\n${msg}`);
      } else if (status === 409) {
        if (confirm(`Stale lock detected.\n${msg}\n\nTake over the lock?`)) {
          try {
            const takeRes = await lockApi.takeover(doc.id);
            const takeData = takeRes.data?.data ?? takeRes.data;
            setLockToken(takeData?.lockToken ?? null);
            setEditingDocId(doc.id);
            startHeartbeat(doc.id);
            startTimer();
            await openInOfficeApp(doc.id, mime);
          } catch (takeErr) {
            console.error('[Edit] takeover failed:', takeErr);
            alert('Failed to take over the lock');
          }
        }
      } else {
        alert(msg);
      }
    }
  };

  // ── Check In: Upload edited file → pre-check → warning modal if needed → commit ──
  const handleCheckinEdited = async () => {
    if (!editingDocId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      // Run pre-check first
      setPreCheckLoading(true);
      try {
        const precheckForm = new FormData();
        precheckForm.append('file', file);
        const res = await documentApi.checkinPrecheck(editingDocId, precheckForm);
        const result: VersionPreCheckResult = res.data?.data ?? res.data;

        if (result && result.warnings && result.warnings.length > 0) {
          // Show warning modal — user must confirm
          setPreCheckResult(result);
          setPendingCheckinFile(file);
          setPreCheckLoading(false);
          return;
        }
      } catch (err) {
        console.warn('[PreCheck] failed, proceeding with check-in:', err);
      }
      setPreCheckLoading(false);

      // No warnings — proceed directly
      await performCheckin(file);
    };
    input.click();
  };

  const performCheckin = async (file: File) => {
    if (!editingDocId) return;
    try {
      const form = new FormData();
      form.append('file', file);
      await documentApi.checkin(editingDocId, form);
      await lockApi.release(editingDocId);
      stopHeartbeat();
      setEditingDocId(null);
      setLockToken(null);
      setWordUrl(null);
      setEditElapsed('');
      setHeartbeatCount(0);
      setPreCheckResult(null);
      setPendingCheckinFile(null);
      loadData();
      alert('Document checked in successfully!');
    } catch (err) {
      console.error('[Checkin] failed:', err);
      alert('Check-in failed — see console');
    }
  };

  const handlePreCheckConfirm = async () => {
    if (pendingCheckinFile) {
      await performCheckin(pendingCheckinFile);
    }
  };

  const handlePreCheckCancel = () => {
    setPreCheckResult(null);
    setPendingCheckinFile(null);
  };

  // ── Cancel Edit: Release lock without checking in ──
  const handleCancelEdit = async () => {
    if (!editingDocId) return;
    if (!confirm('Cancel editing? Any unsaved changes in your local file will be lost on the server side.')) return;
    try {
      await lockApi.release(editingDocId);
    } catch {} // best-effort
    stopHeartbeat();
    setEditingDocId(null);
    setLockToken(null);
    setWordUrl(null);
    setEditElapsed('');
    setHeartbeatCount(0);
  };

  // ── Text editing helpers ──
  const handleEditText = async () => {
    if (!selectedDoc) return;
    try {
      const res = await documentApi.getContent(selectedDoc.id);
      const data = res.data?.data ?? res.data;
      setEditedContent(data?.content ?? '');
      setIsTextEditing(true);
    } catch {
      alert('Failed to load text content for editing');
    }
  };

  const handleSaveText = async () => {
    if (!selectedDoc) return;
    setSavingContent(true);
    try {
      const res = await documentApi.updateContent(selectedDoc.id, editedContent);
      const updated = res.data?.data ?? res.data;
      setIsTextEditing(false);
      setTextContent(editedContent);
      if (updated) setSelectedDoc(updated);
      loadData();
    } catch {
      alert('Failed to save content');
    }
    setSavingContent(false);
  };

  const handleCancelTextEdit = () => {
    setIsTextEditing(false);
    setEditedContent('');
  };

  const handleRequestSignature = async (doc: Document, provider: 'INTERNAL' | 'DOCUSIGN') => {
    setSignatureProvider(provider);
    setSignatureSignerId('');
    setSignerSearch('');
    setSignerDropdownOpen(false);
    setSignatureError(null);
    setShowSignatureModal(true);
    try {
      const res = await authApi.getUsers(0, 100);
      setSignerUsers(res.data?.data || []);
    } catch { setSignerUsers([]); }
  };

  const [signatureError, setSignatureError] = useState<string | null>(null);
  const handleSubmitSignatureRequest = async () => {
    if (!selectedDoc || !signatureSignerId.trim()) return;
    setSignatureError(null);
    try {
      await signatureApi.request(selectedDoc.id, signatureSignerId.trim(), signatureProvider);
      setShowSignatureModal(false);
      setSignatureSignerId('');
      loadData();
    } catch (e: any) {
      setSignatureError(e?.response?.data?.message || 'Failed to request signature');
    }
  };

  // Cleanup heartbeat on unmount or navigation
  useEffect(() => {
    return () => { stopHeartbeat(); };
  }, [stopHeartbeat]);

  // Load preview blob when selectedDoc changes
  useEffect(() => {
    if (!selectedDoc || showNotes || showVersions) {
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      setTextContent(null);
      setIsTextEditing(false);
      return;
    }
    const mime = selectedDoc.mimeType || '';
    const isDocx = mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isText = mime.startsWith('text/') || mime === 'application/json';
    const isBinary = mime.startsWith('image/') || mime === 'application/pdf' || isDocx
      || mime.startsWith('video/') || mime.startsWith('audio/');

    if (isText) {
      // Fetch raw text content
      documentApi.getContent(selectedDoc.id).then(res => {
        const data = res.data?.data ?? res.data;
        setTextContent(data?.content ?? '');
      }).catch(() => setTextContent(null));
      return;
    }
    if (!isBinary) return;
    let cancelled = false;
    documentApi.download(selectedDoc.id).then(res => {
      if (cancelled) return;
      const url = URL.createObjectURL(res.data);
      setPreviewUrl(url);
    }).catch(() => {});
    return () => { cancelled = true; if (previewUrl) URL.revokeObjectURL(previewUrl); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoc?.id, showNotes, showVersions]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let docRes, folderRes;
      if (activeProject) {
        [docRes, folderRes] = await Promise.all([
          currentFolder
            ? documentApi.listByProject(activeProject.id, currentFolder, page, 20)
            : documentApi.listByProject(activeProject.id, undefined, page, 20),
          documentApi.getFoldersByProject(activeProject.id, currentFolder),
        ]);
      } else {
        [docRes, folderRes] = await Promise.all([
          documentApi.list(currentFolder, page, 20),
          documentApi.getFolders(currentFolder),
        ]);
      }
      const docData = docRes.data?.data ?? docRes.data;
      setDocuments(docData?.content ?? []);
      setTotalPages(docData?.totalPages ?? 0);
      setFolders(folderRes.data?.data ?? folderRes.data ?? []);
    } catch (err) { console.error('[Documents] loadData failed:', err); }
    setLoading(false);
  }, [currentFolder, page, activeProject]);

  useEffect(() => { loadData(); }, [loadData]);

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => { setContextMenu(null); setContextMenuPos(null); };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [contextMenu]);

  // Reset folder navigation when project changes
  useEffect(() => {
    setCurrentFolder(undefined);
    setBreadcrumbs([{ name: 'Root' }]);
    setPage(0);
    setSelectedDoc(null);
  }, [activeProject?.id]);

  // Auto-open document when navigated from search results (?doc=<id>)
  useEffect(() => {
    const docId = searchParams.get('doc');
    if (!docId) return;
    documentApi.get(docId).then(res => {
      const doc = res.data?.data ?? res.data;
      if (doc) setSelectedDoc(doc);
    }).catch(() => {});
  }, [searchParams]);

  const navigateToFolder = (folderId?: string, folderName?: string) => {
    if (folderId) {
      setBreadcrumbs(prev => [...prev, { id: folderId, name: folderName || 'Folder' }]);
    } else {
      setBreadcrumbs([{ name: 'Root' }]);
    }
    setCurrentFolder(folderId);
    setPage(0);
  };

  const navigateBreadcrumb = (index: number) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1));
    setCurrentFolder(breadcrumbs[index]?.id);
    setPage(0);
  };

  const handleDownload = async (doc: Document) => {
    try {
      const res = await documentApi.download(doc.id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.title;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Documents] download failed:', err);
      alert('Download failed — check console for details');
    }
  };

  const handleCheckout = async (doc: Document) => {
    try {
      await documentApi.checkout(doc.id);
      loadData();
    } catch (err) { console.error('[Documents] checkout failed:', err); }
  };

  const handleCancelCheckout = async (doc: Document) => {
    try {
      await documentApi.cancelCheckout(doc.id);
      loadData();
    } catch (err) { console.error('[Documents] cancel checkout failed:', err); }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    try {
      await documentApi.delete(doc.id);
      loadData();
    } catch (err) { console.error('[Documents] delete failed:', err); }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await documentApi.createFolder({ name: newFolderName.trim(), parentId: currentFolder, projectId: activeProject?.id });
      setShowNewFolder(false);
      setNewFolderName('');
      loadData();
    } catch (err) { console.error('[Documents] createFolder failed:', err); alert('Failed to create folder'); }
  };

  const handleOpenInNewTab = async (doc: Document) => {
    try {
      const res = await documentApi.download(doc.id);
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch (err) {
      console.error('[Documents] open in new tab failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 mt-2 text-sm">
            {breadcrumbs.map((bc, i) => (
              <span key={i} className="flex items-center">
                {i > 0 && <ChevronRight className="h-3 w-3 text-slate-400 mx-1" />}
                <button onClick={() => navigateBreadcrumb(i)} className="text-primary-600 hover:underline">
                  {i === 0 ? <Home className="h-4 w-4 inline" /> : bc.name}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowNewFolder(true)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2">
            <FolderPlus className="h-4 w-4" /> New Folder
          </button>
          <button onClick={() => setShowUpload(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 flex items-center gap-2">
            <Upload className="h-4 w-4" /> Upload
          </button>
        </div>
      </div>

      {/* New folder dialog */}
      {showNewFolder && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
          <FolderPlus className="h-5 w-5 text-amber-500" />
          <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Folder name"
            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} autoFocus />
          <button onClick={handleCreateFolder} className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">Create</button>
          <button onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
        </div>
      )}

      {/* Global editing banner — visible even when detail panel is closed */}
      {editingDocId && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <Edit3 className="h-5 w-5 text-emerald-600 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800">Editing document in Word</p>
              <p className="text-xs text-emerald-600">
                Lock held &middot; {editElapsed} &middot; <Heart className="h-3 w-3 inline" /> {heartbeatCount} heartbeats sent
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wordUrl && (
              <a href={wordUrl}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2 font-semibold">
                📝 Open in Word
              </a>
            )}
            <button onClick={handleCheckinEdited}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2">
              <UploadCloud className="h-4 w-4" /> Check In
            </button>
            <button onClick={handleCancelEdit}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50">
              Cancel Edit
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <>
            {/* Folders */}
            {folders.length > 0 && (
              <div className="p-4 border-b border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Folders</p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {folders.map(folder => (
                    <button key={folder.id} onClick={() => navigateToFolder(folder.id, folder.name)}
                      className="flex flex-col items-center p-3 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition text-center">
                      <FolderPlus className="h-8 w-8 text-amber-500 mb-1" />
                      <span className="text-xs font-medium text-slate-700 truncate w-full">{folder.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Documents Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="px-4 py-3 font-medium text-slate-500">Name</th>
                    <th className="px-4 py-3 font-medium text-slate-500 hidden md:table-cell">Size</th>
                    <th className="px-4 py-3 font-medium text-slate-500 hidden lg:table-cell">Status</th>
                    <th className="px-4 py-3 font-medium text-slate-500 hidden lg:table-cell">Version</th>
                    <th className="px-4 py-3 font-medium text-slate-500 hidden md:table-cell">Modified</th>
                    <th className="px-4 py-3 font-medium text-slate-500 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No documents in this folder</td></tr>
                  )}
                  {documents.map(doc => (
                    <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer"
                      onClick={() => setSelectedDoc(doc)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{getFileIcon(doc.mimeType)}</span>
                          <div>
                            <p className="font-medium text-slate-900 flex items-center gap-2">
                              {doc.title}
                              {(doc.isCheckedOut || doc.checkedOut) && <Lock className="h-3.5 w-3.5 text-amber-500" />}
                              {doc.legalHold && <Shield className="h-3.5 w-3.5 text-red-500" />}
                              {(doc as any).aiGenerated && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px] font-semibold" title={`AI Confidence: ${((doc as any).aiConfidence * 100)?.toFixed(1) ?? '?'}%`}>
                                  <Bot className="h-3 w-3" /> AI
                                </span>
                              )}
                              {doc.classificationLabel && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded text-[10px] font-semibold">
                                  {doc.classificationLabel}
                                </span>
                              )}
                              {doc.m365Link && (
                                <a href={doc.m365Link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold hover:bg-blue-200 transition-colors cursor-pointer" title={`Open in SharePoint: ${doc.m365Link}`}>
                                  M365
                                </a>
                              )}
                              {doc.docusignEnvelopeId && (
                                <a href={`https://app.docusign.com/documents/details/${doc.docusignEnvelopeId}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-semibold hover:bg-yellow-200 transition-colors cursor-pointer" title={`View DocuSign Envelope: ${doc.docusignEnvelopeId}`}>
                                  DocuSign
                                </a>
                              )}
                              {doc.sapDocumentNumber && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-semibold" title={`SAP Document: ${doc.sapDocumentNumber}`}>
                                  SAP {doc.sapDocumentNumber}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400">{doc.mimeType}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{formatBytes(doc.fileSizeBytes ?? doc.fileSize ?? 0)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          doc.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                          doc.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
                          doc.status === 'ARCHIVED' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                        }`}>{doc.status}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">v{doc.currentVersion ?? doc.version ?? 1}</td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{formatDate(doc.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button onClick={(e) => {
                            e.stopPropagation();
                            if (contextMenu === doc.id) {
                              setContextMenu(null);
                              setContextMenuPos(null);
                            } else {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setContextMenuPos({ top: rect.bottom + 4, left: rect.right - 192 });
                              setContextMenu(doc.id);
                            }
                          }}
                            className="p-1 rounded hover:bg-slate-200">
                            <MoreVertical className="h-4 w-4 text-slate-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fixed-position context menu (rendered outside table to avoid overflow clip) */}
            {contextMenu && contextMenuPos && (() => {
              const doc = documents.find(d => d.id === contextMenu);
              if (!doc) return null;
              return (
                <div className="fixed w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-[9999] py-1"
                  style={{ top: contextMenuPos.top, left: Math.max(0, contextMenuPos.left) }}
                  onClick={e => e.stopPropagation()}>
                  <button onClick={() => { handleDownload(doc); setContextMenu(null); setContextMenuPos(null); }}
                    className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50">
                    <Download className="h-4 w-4 mr-2" /> Download
                  </button>
                  <button onClick={() => { setSelectedDoc(doc); setShowNotes(true); setContextMenu(null); setContextMenuPos(null); }}
                    className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50">
                    <StickyNote className="h-4 w-4 mr-2" /> Notes
                  </button>
                  <button onClick={() => { setSelectedDoc(doc); setShowVersions(true); setContextMenu(null); setContextMenuPos(null); }}
                    className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50">
                    <Eye className="h-4 w-4 mr-2" /> Versions
                  </button>
                  {!(doc.isCheckedOut || doc.checkedOut) ? (
                    <button onClick={() => { handleCheckout(doc); setContextMenu(null); setContextMenuPos(null); }}
                      className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50">
                      <Lock className="h-4 w-4 mr-2" /> Check Out
                    </button>
                  ) : (
                    <button onClick={() => { handleCancelCheckout(doc); setContextMenu(null); setContextMenuPos(null); }}
                      className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50">
                      <Unlock className="h-4 w-4 mr-2" /> Cancel Checkout
                    </button>
                  )}
                  <button onClick={() => { setSelectedDoc(doc); setShowWorkflow(true); setContextMenu(null); setContextMenuPos(null); }}
                    className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50">
                    <GitBranch className="h-4 w-4 mr-2" /> Workflow
                  </button>
                  <button onClick={() => { setSelectedDoc(doc); setShowRetention(true); setContextMenu(null); setContextMenuPos(null); }}
                    className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50">
                    <Shield className="h-4 w-4 mr-2" /> Retention
                  </button>
                  <button onClick={() => { handleDelete(doc); setContextMenu(null); setContextMenuPos(null); }}
                    className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </button>
                </div>
              );
            })()}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-100">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">Previous</button>
                <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals / Panels */}
      {showUpload && <UploadModal folderId={currentFolder} projectId={activeProject?.id} onClose={() => setShowUpload(false)} onComplete={() => { setShowUpload(false); loadData(); }} />}
      {showNotes && selectedDoc && <NotesPanel document={selectedDoc} onClose={() => { setShowNotes(false); setSelectedDoc(null); }} />}
      {showVersions && selectedDoc && <VersionsPanel document={selectedDoc} onClose={() => { setShowVersions(false); setSelectedDoc(null); }} />}

      {/* Document Workflow Panel */}
      {showWorkflow && selectedDoc && (
        <DocumentWorkflowPanel
          document={selectedDoc}
          projectId={activeProject?.id}
          onClose={() => { setShowWorkflow(false); }}
        />
      )}

      {/* Signature Request Modal */}
      {showSignatureModal && selectedDoc && (() => {
        const selectedUser = signerUsers.find(u => u.id === signatureSignerId);
        const filteredUsers = signerUsers.filter(u => {
          if (!signerSearch) return true;
          const q = signerSearch.toLowerCase();
          return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
            || `${u.firstName} ${u.lastName}`.toLowerCase().includes(q);
        });
        return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[420px]">
            <h3 className="text-lg font-semibold mb-4">Request Signature</h3>
            <p className="text-sm text-gray-600 mb-2">Document: {selectedDoc.title}</p>
            {signatureError && <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{signatureError}</div>}
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Signer</label>
            <div ref={signerRef} className="relative mb-3">
              {/* Selected user or search input */}
              {selectedUser && !signerDropdownOpen ? (
                <button
                  onClick={() => setSignerDropdownOpen(true)}
                  className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <span>
                    <span className="font-medium">{selectedUser.firstName} {selectedUser.lastName}</span>
                    <span className="text-gray-400 ml-1">({selectedUser.username})</span>
                  </span>
                  <X className="h-4 w-4 text-gray-400" onClick={e => { e.stopPropagation(); setSignatureSignerId(''); setSignerSearch(''); }} />
                </button>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    value={signerSearch}
                    onChange={e => { setSignerSearch(e.target.value); setSignerDropdownOpen(true); }}
                    onFocus={() => setSignerDropdownOpen(true)}
                    placeholder="Search by name, username, or email..."
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    autoFocus
                  />
                </div>
              )}
              {/* Dropdown */}
              {signerDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-400">No users found</div>
                  ) : filteredUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => { setSignatureSignerId(u.id); setSignerSearch(''); setSignerDropdownOpen(false); }}
                      className="w-full flex items-start gap-2 px-3 py-2 hover:bg-violet-50 text-left text-sm transition"
                    >
                      <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700">
                        {u.firstName?.[0]}{u.lastName?.[0]}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800">{u.firstName} {u.lastName}</div>
                        <div className="text-xs text-gray-400">{u.username} &middot; {u.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              value={signatureProvider}
              onChange={e => setSignatureProvider(e.target.value as 'INTERNAL' | 'DOCUSIGN')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="INTERNAL">Internal</option>
              <option value="DOCUSIGN">DocuSign</option>
            </select>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSignatureModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleSubmitSignatureRequest}
                disabled={!signatureSignerId}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50"
              >Send Request</button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Document Retention Panel */}
      {showRetention && selectedDoc && (
        <DocumentRetentionPanel
          document={selectedDoc}
          projectId={activeProject?.id}
          onClose={() => { setShowRetention(false); }}
        />
      )}

      {/* Pre-Check Warning Modal */}
      {preCheckResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={handlePreCheckCancel} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Version Check Warning</h3>
                <p className="text-sm text-slate-500">Review the following issues before check-in</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {preCheckResult.duplicateFound && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-red-500 text-lg">🔴</span>
                  <div>
                    <p className="text-sm font-semibold text-red-800">Duplicate Detected</p>
                    <p className="text-xs text-red-600">
                      This file is identical to &quot;{preCheckResult.duplicateDocumentTitle}&quot;
                      (Version {preCheckResult.duplicateVersionNumber})
                    </p>
                  </div>
                </div>
              )}
              {preCheckResult.formatMismatch && (
                <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <span className="text-orange-500 text-lg">🟠</span>
                  <div>
                    <p className="text-sm font-semibold text-orange-800">Format Mismatch</p>
                    <p className="text-xs text-orange-600">
                      Previous version: {preCheckResult.previousFormat}<br/>
                      New file: {preCheckResult.newFormat}
                    </p>
                    <p className="text-xs text-orange-500 mt-1 italic">Are you sure this is the same document?</p>
                  </div>
                </div>
              )}
              {preCheckResult.highRisk && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-red-500 text-lg">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-red-800">High-Risk Version</p>
                    <p className="text-xs text-red-600">
                      Content similarity: {preCheckResult.similarityScore != null ? `${(preCheckResult.similarityScore * 100).toFixed(0)}%` : 'N/A'}
                    </p>
                    <p className="text-xs text-red-500 mt-1">This appears to be a completely different document.</p>
                  </div>
                </div>
              )}
              {preCheckResult.warnings && preCheckResult.warnings.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs font-semibold text-slate-700 mb-2">All Warnings:</p>
                  <ul className="space-y-1">
                    {preCheckResult.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handlePreCheckCancel}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50 font-medium"
              >
                Cancel Check-In
              </button>
              <button
                onClick={handlePreCheckConfirm}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 font-medium"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Check Loading Overlay */}
      {preCheckLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl p-6 flex items-center gap-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            <span className="text-sm text-slate-700">Analyzing document for anomalies...</span>
          </div>
        </div>
      )}

      {/* Document Detail / Preview Panel */}
      {selectedDoc && !showNotes && !showVersions && !showWorkflow && !showRetention && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedDoc(null)} />
          <div className="relative w-3/4 bg-white shadow-xl flex flex-col h-full animate-in slide-in-from-right">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900 truncate">{selectedDoc.title}</h2>
              <button onClick={() => setSelectedDoc(null)} className="p-1 rounded hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-auto p-4 space-y-4 relative z-0">
              {/* ── Preview area ── */}

              {/* Image preview */}
              {selectedDoc.mimeType?.startsWith('image/') && previewUrl && (
                <div className="bg-slate-100 rounded-lg p-2 flex items-center justify-center overflow-auto">
                  <img src={previewUrl} alt={selectedDoc.title} className="max-h-[500px] rounded" />
                </div>
              )}

              {/* PDF preview */}
              {selectedDoc.mimeType === 'application/pdf' && previewUrl && (
                <div className="bg-slate-100 rounded-lg overflow-hidden" style={{ height: 500 }}>
                  <iframe src={previewUrl} className="w-full h-full border-0" title="PDF Preview" />
                </div>
              )}

              {/* DOCX preview */}
              {selectedDoc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && previewUrl && (
                <DocxViewer blobUrl={previewUrl} />
              )}

              {/* Legacy .doc Word placeholder */}
              {selectedDoc.mimeType === 'application/msword' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 flex flex-col items-center justify-center gap-3">
                  <div className="h-14 w-14 rounded-xl bg-blue-100 flex items-center justify-center">
                    <span className="text-2xl">📝</span>
                  </div>
                  <p className="text-sm font-medium text-blue-800">Word Document (.doc)</p>
                  <p className="text-xs text-blue-600">{selectedDoc.title}</p>
                  <button onClick={() => handleDownload(selectedDoc)}
                    className="text-sm text-blue-700 hover:underline flex items-center gap-1 mt-1">
                    <Download className="h-3.5 w-3.5" /> Download to view
                  </button>
                </div>
              )}

              {/* Excel / Spreadsheet placeholder */}
              {(selectedDoc.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                selectedDoc.mimeType === 'application/vnd.ms-excel') && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 flex flex-col items-center justify-center gap-3">
                  <div className="h-14 w-14 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <span className="text-2xl">📊</span>
                  </div>
                  <p className="text-sm font-medium text-emerald-800">Excel Spreadsheet</p>
                  <p className="text-xs text-emerald-600">{selectedDoc.title}</p>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => handleDownload(selectedDoc)}
                      className="text-sm text-emerald-700 hover:underline flex items-center gap-1">
                      <Download className="h-3.5 w-3.5" /> Download to view
                    </button>
                  </div>
                </div>
              )}

              {/* PowerPoint / Presentation placeholder */}
              {(selectedDoc.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                selectedDoc.mimeType === 'application/vnd.ms-powerpoint') && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-8 flex flex-col items-center justify-center gap-3">
                  <div className="h-14 w-14 rounded-xl bg-orange-100 flex items-center justify-center">
                    <span className="text-2xl">📽️</span>
                  </div>
                  <p className="text-sm font-medium text-orange-800">PowerPoint Presentation</p>
                  <p className="text-xs text-orange-600">{selectedDoc.title}</p>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => handleDownload(selectedDoc)}
                      className="text-sm text-orange-700 hover:underline flex items-center gap-1">
                      <Download className="h-3.5 w-3.5" /> Download to view
                    </button>
                  </div>
                </div>
              )}

              {/* Video preview */}
              {selectedDoc.mimeType?.startsWith('video/') && previewUrl && (
                <div className="bg-black rounded-lg overflow-hidden">
                  <video src={previewUrl} controls className="w-full max-h-[500px]" />
                </div>
              )}

              {/* Audio preview */}
              {selectedDoc.mimeType?.startsWith('audio/') && previewUrl && (
                <div className="bg-slate-100 rounded-lg p-6 flex items-center justify-center">
                  <audio src={previewUrl} controls className="w-full" />
                </div>
              )}

              {/* Text / JSON / code preview or inline editor */}
              {(selectedDoc.mimeType?.startsWith('text/') || selectedDoc.mimeType === 'application/json') && (
                <>
                  {isTextEditing ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Editing — {selectedDoc.title}</span>
                        <div className="flex gap-2">
                          <button onClick={handleSaveText} disabled={savingContent}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-50">
                            {savingContent ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            {savingContent ? 'Saving...' : 'Save'}
                          </button>
                          <button onClick={handleCancelTextEdit}
                            className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-xs hover:bg-slate-50">
                            <X className="h-3 w-3" /> Cancel
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={editedContent}
                        onChange={e => setEditedContent(e.target.value)}
                        className="w-full h-[450px] p-3 bg-slate-50 border border-slate-300 rounded-lg font-mono text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        spellCheck={false}
                      />
                    </div>
                  ) : textContent !== null ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-auto" style={{ maxHeight: 500 }}>
                      <pre className="p-4 text-sm font-mono text-slate-800 whitespace-pre-wrap break-words">{textContent}</pre>
                    </div>
                  ) : (
                    <div className="bg-slate-100 rounded-lg p-8 flex items-center justify-center text-slate-400 text-sm">
                      Loading preview...
                    </div>
                  )}
                </>
              )}

              {/* Binary blob loading state */}
              {(selectedDoc.mimeType?.startsWith('image/') || selectedDoc.mimeType === 'application/pdf' ||
                selectedDoc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                selectedDoc.mimeType?.startsWith('video/') || selectedDoc.mimeType?.startsWith('audio/')) && !previewUrl && (
                <div className="bg-slate-100 rounded-lg p-8 flex items-center justify-center text-slate-400 text-sm">
                  Loading preview...
                </div>
              )}

              {/* Non-previewable file type fallback */}
              {(() => {
                const m = selectedDoc.mimeType || '';
                const previewable = m.startsWith('image/') || m === 'application/pdf' || m.startsWith('text/')
                  || m === 'application/json' || m.startsWith('video/') || m.startsWith('audio/')
                  || m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                  || m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                  || m === 'application/vnd.ms-excel'
                  || m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                  || m === 'application/vnd.ms-powerpoint'
                  || m === 'application/msword';
                if (previewable) return null;
                return (
                  <div className="bg-slate-100 rounded-lg p-8 flex flex-col items-center justify-center gap-3">
                    <FileText className="h-12 w-12 text-slate-300" />
                    <p className="text-sm text-slate-400">Preview not available for this file type</p>
                    <p className="text-xs text-slate-400">{m || 'Unknown type'}</p>
                    <button onClick={() => handleOpenInNewTab(selectedDoc)}
                      className="text-sm text-primary-600 hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3.5 w-3.5" /> Open in browser
                    </button>
                  </div>
                );
              })()}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">Type</p>
                  <p className="text-slate-700">{selectedDoc.mimeType}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Size</p>
                  <p className="text-slate-700">{formatBytes(selectedDoc.fileSizeBytes ?? selectedDoc.fileSize ?? 0)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Version</p>
                  <p className="text-slate-700">v{selectedDoc.currentVersion ?? selectedDoc.version ?? 1}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Status</p>
                  <p className="text-slate-700">{selectedDoc.status}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Created</p>
                  <p className="text-slate-700">{formatDate(selectedDoc.createdAt)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Modified</p>
                  <p className="text-slate-700">{formatDate(selectedDoc.updatedAt)}</p>
                </div>
                {selectedDoc.description && (
                  <div className="col-span-2">
                    <p className="text-slate-400 text-xs">Description</p>
                    <p className="text-slate-700">{selectedDoc.description}</p>
                  </div>
                )}
              </div>

              {/* Plugin Integrations */}
              {(selectedDoc.m365Link || selectedDoc.docusignEnvelopeId || selectedDoc.sapDocumentNumber) && (
                <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Integrations</p>
                  {selectedDoc.m365Link && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">M365</span>
                        <span className="text-xs text-slate-600 truncate max-w-[200px]" title={selectedDoc.m365Link}>SharePoint Linked</span>
                      </div>
                      <a href={selectedDoc.m365Link} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Open in SharePoint
                      </a>
                    </div>
                  )}
                  {selectedDoc.docusignEnvelopeId && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-semibold">DocuSign</span>
                        <span className="text-xs text-slate-600 truncate max-w-[200px]" title={selectedDoc.docusignEnvelopeId}>{selectedDoc.docusignEnvelopeId}</span>
                      </div>
                      <a href={`https://app.docusign.com/documents/details/${selectedDoc.docusignEnvelopeId}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-yellow-700 hover:underline flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> View Envelope
                      </a>
                    </div>
                  )}
                  {selectedDoc.sapDocumentNumber && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-semibold">SAP</span>
                        <span className="text-xs text-slate-600">{selectedDoc.sapDocumentNumber}</span>
                      </div>
                      <span className="text-xs text-orange-600 flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Linked
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Signatures */}
            <div className="px-4 pb-2">
              <SignaturePanel documentId={selectedDoc.id} />
            </div>

            {/* Actions bar */}
            <div className="relative z-10 p-4 border-t border-slate-200 space-y-2 bg-white">
              {/* Editing status banner */}
              {editingDocId === selectedDoc.id && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                      <Edit3 className="h-4 w-4 animate-pulse" />
                      Editing in {OFFICE_MIME_MAP[selectedDoc.mimeType || '']?.label || 'Word'}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-emerald-600">
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {heartbeatCount} heartbeats</span>
                      <span>{editElapsed}</span>
                    </div>
                  </div>
                  {wordUrl ? (
                    <a href={wordUrl}
                      className="block mt-2 w-full text-center px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                      onClick={() => console.log('[Edit] User clicked Open in Office link')}>
                      📝 Click Here to Open in {OFFICE_MIME_MAP[selectedDoc.mimeType || '']?.label || 'Office'}
                    </a>
                  ) : (
                    <p className="text-xs text-emerald-600 mt-1">Generating link...</p>
                  )}
                  <p className="text-xs text-emerald-600 mt-1">Lock held — saves in Word auto-upload to server. Click Cancel Edit when done.</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleCheckinEdited}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700">
                      <UploadCloud className="h-3.5 w-3.5" /> Check In Edited File
                    </button>
                    <button onClick={handleCancelEdit}
                      className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs hover:bg-red-50">
                      Cancel Edit
                    </button>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => handleDownload(selectedDoc)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                  <Download className="h-4 w-4" /> Download
                </button>
                {/* Smart Edit button: text → notepad, Office → respective app, others → hidden */}
                {editingDocId !== selectedDoc.id && !isTextEditing && (() => {
                  const mime = selectedDoc.mimeType || '';
                  const isText = mime.startsWith('text/') || mime === 'application/json';
                  const officeMapping = OFFICE_MIME_MAP[mime];
                  if (isText) return (
                    <button onClick={handleEditText}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-1" title="Edit text content">
                      <Edit3 className="h-4 w-4" />
                    </button>
                  );
                  if (officeMapping) return (
                    <button onClick={() => handleEditInWord(selectedDoc)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1" title={`Edit in ${officeMapping.label}`}>
                      <Edit3 className="h-4 w-4" />
                    </button>
                  );
                  return null;
                })()}
                <button onClick={() => handleOpenInNewTab(selectedDoc)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50" title="Open in New Tab">
                  <ExternalLink className="h-4 w-4" />
                </button>
                <button onClick={() => { setShowVersions(true); }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50" title="Versions">
                  <Eye className="h-4 w-4" />
                </button>
                <button onClick={() => { setShowNotes(true); }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50" title="Notes">
                  <StickyNote className="h-4 w-4" />
                </button>
                <button onClick={() => { setShowWorkflow(true); }}
                  className="px-4 py-2 border border-purple-300 text-purple-600 rounded-lg text-sm hover:bg-purple-50" title="Start Workflow">
                  <GitBranch className="h-4 w-4" />
                </button>
                <button onClick={() => { setShowRetention(true); }}
                  className="px-4 py-2 border border-emerald-300 text-emerald-600 rounded-lg text-sm hover:bg-emerald-50" title="Retention & Compliance">
                  <Shield className="h-4 w-4" />
                </button>
                <button onClick={() => handleRequestSignature(selectedDoc, 'INTERNAL')}
                  className="px-4 py-2 border border-violet-300 text-violet-600 rounded-lg text-sm hover:bg-violet-50" title="Request Signature">
                  <PenTool className="h-4 w-4" />
                </button>
              </div>
              {editingDocId !== selectedDoc.id && (
                <div className="flex gap-2">
                  {!(selectedDoc.isCheckedOut || selectedDoc.checkedOut) ? (
                    <button onClick={() => { handleCheckout(selectedDoc); setSelectedDoc(null); }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm hover:bg-amber-50">
                      <Lock className="h-4 w-4" /> Check Out
                    </button>
                  ) : (
                    <button onClick={() => { handleCancelCheckout(selectedDoc); setSelectedDoc(null); }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg text-sm hover:bg-green-50">
                      <Unlock className="h-4 w-4" /> Cancel Checkout
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/* DOCUMENT WORKFLOW PANEL                             */
/* ═══════════════════════════════════════════════════ */
const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  REVIEW: 'bg-blue-100 text-blue-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CORRECTION: 'bg-orange-100 text-orange-700',
  ARCHIVED: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
  ESCALATED: 'bg-pink-100 text-pink-700',
};

function DocumentWorkflowPanel({
  document: doc, projectId, onClose,
}: {
  document: Document;
  projectId?: string;
  onClose: () => void;
}) {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [selectedDefId, setSelectedDefId] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [projectDefaultWfId, setProjectDefaultWfId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [defRes, instRes] = await Promise.all([
          workflowApi.getDefinitions(),
          workflowApi.getByDocument(doc.id),
        ]);
        const defs = defRes.data?.data ?? defRes.data ?? [];
        setDefinitions(defs);
        setInstances(instRes.data?.data ?? instRes.data ?? []);

        // Fetch project default workflow if applicable
        if (projectId) {
          try {
            const projRes = await projectApi.get(projectId);
            const proj = projRes.data?.data ?? projRes.data;
            if (proj?.defaultWorkflowDefinitionId) {
              setProjectDefaultWfId(proj.defaultWorkflowDefinitionId);
              setSelectedDefId(proj.defaultWorkflowDefinitionId);
            }
          } catch { /* ignore */ }
        }

        if (!selectedDefId && defs.length > 0) {
          setSelectedDefId(defs[0].id);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [doc.id, projectId]);

  const handleStart = async () => {
    if (!selectedDefId) return;
    setStarting(true);
    try {
      await workflowApi.startInstance({
        documentId: doc.id,
        definitionId: selectedDefId,
        projectId: projectId,
        projectDefaultWorkflowId: projectDefaultWfId || undefined,
      });
      // Reload instances
      const res = await workflowApi.getByDocument(doc.id);
      setInstances(res.data?.data ?? res.data ?? []);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to start workflow');
    }
    setStarting(false);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-slate-900">Document Workflow</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
          <span className="sr-only">Close</span>&times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* Start new workflow */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-slate-700">Start Workflow</h4>
              {projectDefaultWfId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                  <p className="text-xs text-blue-700">
                    Project default workflow is pre-selected. You can choose a more restrictive one.
                  </p>
                </div>
              )}
              <select value={selectedDefId} onChange={e => setSelectedDefId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none">
                <option value="">Select workflow type...</option>
                {definitions.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.id === projectDefaultWfId ? ' (Project Default)' : ''}
                  </option>
                ))}
              </select>
              <button onClick={handleStart} disabled={starting || !selectedDefId}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Start Workflow
              </button>
            </div>

            {/* Existing workflows */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">
                Active Workflows ({instances.length})
              </h4>
              {instances.length === 0 ? (
                <p className="text-sm text-slate-400">No workflows for this document</p>
              ) : (
                <div className="space-y-2">
                  {instances.map(inst => (
                    <div key={inst.id} className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[inst.currentState] || 'bg-slate-100'}`}>
                          {(inst.currentState ?? 'UNKNOWN').replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-slate-400">
                          {inst.createdAt ? new Date(inst.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                      {inst.definitionName && (
                        <p className="text-xs text-slate-500 mt-1">{inst.definitionName}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
