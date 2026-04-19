"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  documentApi,
  lockApi,
  wopiApi,
  workflowApi,
  projectApi,
  signatureApi,
  authApi,
  aiApi,
  documentConversationApi,
  presenceApi,
  searchApi
} from "@/lib/api";
import type { WorkflowDefinition, WorkflowInstance } from "@/lib/types";
import { useProjectStore } from "@/lib/project-store";
import type { Document, Folder, VersionPreCheckResult } from "@/lib/types";
import { formatBytes, formatDate, getFileIcon } from "@/lib/utils";
import {
  Upload,
  FolderPlus,
  ChevronRight,
  Home,
  Download,
  Lock,
  Unlock,
  Trash2,
  FileText,
  StickyNote,
  MoreVertical,
  Eye,
  Bot,
  Shield,
  ExternalLink,
  Edit3,
  Heart,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Send,
  Loader2,
  Save,
  X,
  PenTool,
  Search,
  FolderInput,
  Clock,
  User,
  Users,
  MessageSquare,
  Sparkles,
  Bookmark,
  Check
} from "lucide-react";
import UploadModal from "@/components/documents/UploadModal";
import NotesPanel from "@/components/documents/NotesPanel";
import VersionsPanel from "@/components/documents/VersionsPanel";
import DocumentRetentionPanel from "@/components/documents/DocumentRetentionPanel";
import SignaturePanel from "@/components/documents/SignaturePanel";
import NotarizationBadge from "@/components/documents/NotarizationBadge";
import AppDialog from "@/components/ui/AppDialog";
import type { DialogVariant } from "@/components/ui/AppDialog";
import { useAuthStore } from "@/lib/auth-store";
import dynamic from "next/dynamic";

const DocxViewer = dynamic(() => import("@/components/documents/DocxViewer"), {
  ssr: false
});

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const { activeProject } = useProjectStore();
  const { user: currentUser } = useAuthStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | undefined>();
  const [currentFolderProjectId, setCurrentFolderProjectId] = useState<
    string | undefined
  >();
  const [breadcrumbs, setBreadcrumbs] = useState<
    { id?: string; name: string }[]
  >([{ name: "Root" }]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showUpload, setShowUpload] = useState(
    searchParams.get("action") === "upload"
  );
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [contextMenu, setContextMenu] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ── Presence (who is currently viewing the selected doc) ──
  const [viewers, setViewers] = useState<
    Array<{ userId: string; username: string; displayName: string }>
  >([]);
  const presenceTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Document Links (cross-document relationships) ──
  const [docLinks, setDocLinks] = useState<any[]>([]);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkPickerQuery, setLinkPickerQuery] = useState("");
  const [linkPickerResults, setLinkPickerResults] = useState<Document[]>([]);
  const [linkPickerType, setLinkPickerType] = useState("RELATED");

  // ── Editing / Lock / Heartbeat state ──
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [lockToken, setLockToken] = useState<string | null>(null);
  const [heartbeatCount, setHeartbeatCount] = useState(0);
  const [editStartTime, setEditStartTime] = useState<number | null>(null);
  const [editElapsed, setEditElapsed] = useState("");
  const [wordUrl, setWordUrl] = useState<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── App Dialog (replaces browser alert/confirm) ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogProps, setDialogProps] = useState<{
    title: string;
    message: string;
    variant: DialogVariant;
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  }>({ title: "", message: "", variant: "info" });

  const showDialog = useCallback(
    (
      title: string,
      message: string,
      variant: DialogVariant = "info",
      opts?: {
        onConfirm?: () => void;
        confirmLabel?: string;
        cancelLabel?: string;
        destructive?: boolean;
      }
    ) => {
      setDialogProps({ title, message, variant, ...opts });
      setDialogOpen(true);
    },
    []
  );

  // ── My Checkouts view ──
  const [viewMode, setViewMode] = useState<"browse" | "checkouts">("browse");
  const [myCheckouts, setMyCheckouts] = useState<Document[]>([]);
  const [checkoutsLoading, setCheckoutsLoading] = useState(false);

  // ── Email child documents (attachments linked to parent email) ──
  const [emailChildren, setEmailChildren] = useState<Document[]>([]);
  const [emailParent, setEmailParent] = useState<Document | null>(null);

  const loadMyCheckouts = useCallback(async () => {
    setCheckoutsLoading(true);
    try {
      const res = await documentApi.myCheckouts();
      setMyCheckouts(res.data?.data ?? res.data ?? []);
    } catch {
      setMyCheckouts([]);
    }
    setCheckoutsLoading(false);
  }, []);

  // Pre-check warning modal state
  const [preCheckResult, setPreCheckResult] =
    useState<VersionPreCheckResult | null>(null);
  const [pendingCheckinFile, setPendingCheckinFile] = useState<File | null>(
    null
  );
  const [preCheckLoading, setPreCheckLoading] = useState(false);
  const [standaloneCheckinDocId, setStandaloneCheckinDocId] = useState<string | null>(null);

  // Context menu positioning
  const [contextMenuPos, setContextMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Assign to Project modal state
  const [showAssignProject, setShowAssignProject] = useState(false);
  const [assignProjectList, setAssignProjectList] = useState<
    { id: string; name: string }[]
  >([]);
  const [assignProjectId, setAssignProjectId] = useState("");
  const [assigningProject, setAssigningProject] = useState(false);

  // Text editing state
  const [textContent, setTextContent] = useState<string | null>(null);
  const [piiMasked, setPiiMasked] = useState(false);
  const [redactedContent, setRedactedContent] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [savingContent, setSavingContent] = useState(false);

  // Signature modal state
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureSignerId, setSignatureSignerId] = useState("");
  const [signatureProvider, setSignatureProvider] = useState<
    "INTERNAL" | "DOCUSIGN"
  >("INTERNAL");
  const [signerUsers, setSignerUsers] = useState<
    {
      id: string;
      username: string;
      email: string;
      firstName: string;
      lastName: string;
    }[]
  >([]);
  const [signerSearch, setSignerSearch] = useState("");
  const [signerDropdownOpen, setSignerDropdownOpen] = useState(false);
  const signerRef = useRef<HTMLDivElement>(null);

  // Workflow state
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [showRetention, setShowRetention] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [workflowDefs, setWorkflowDefs] = useState<WorkflowDefinition[]>([]);
  const [docWorkflows, setDocWorkflows] = useState<WorkflowInstance[]>([]);
  const [workflowDefId, setWorkflowDefId] = useState("");
  const [startingWorkflow, setStartingWorkflow] = useState(false);

  // Heartbeat sender — runs every 30s while editing
  const startHeartbeat = useCallback((docId: string) => {
    // Clear any previous heartbeat
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    setHeartbeatCount(0);
    heartbeatRef.current = setInterval(async () => {
      try {
        await lockApi.heartbeat(docId);
        setHeartbeatCount((c) => c + 1);
        console.log(`[Heartbeat] sent for ${docId}`);
      } catch (err) {
        console.error("[Heartbeat] failed:", err);
      }
    }, 30_000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
      setEditElapsed(`${m}:${String(s).padStart(2, "0")}`);
    }, 1000);
  }, []);

  // ── Edit in Word: Download .docx via WOPI so user can open in Word ──
  // ── Edit in Word: Generate WebDAV URL with token → open via ms-word:ofe protocol ──
  // Map mime types to Office protocol prefixes and default extensions
  const OFFICE_MIME_MAP: Record<
    string,
    { protocol: string; ext: string; label: string }
  > = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      protocol: "ms-word",
      ext: ".docx",
      label: "Word"
    },
    "application/msword": { protocol: "ms-word", ext: ".doc", label: "Word" },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      protocol: "ms-excel",
      ext: ".xlsx",
      label: "Excel"
    },
    "application/vnd.ms-excel": {
      protocol: "ms-excel",
      ext: ".xls",
      label: "Excel"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      { protocol: "ms-powerpoint", ext: ".pptx", label: "PowerPoint" },
    "application/vnd.ms-powerpoint": {
      protocol: "ms-powerpoint",
      ext: ".ppt",
      label: "PowerPoint"
    }
  };

  // Launch Office app via hidden iframe — most reliable cross-browser method
  const launchOfficeProtocol = (url: string) => {
    console.log("[Edit] Launching Office protocol:", url);
    // Method 1: Try hidden iframe (works in Chrome, Edge, Firefox)
    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = url;
      document.body.appendChild(iframe);
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch { /* already removed */ }
      }, 5000);
    } catch {
      // Method 2: Fallback to window.location
      window.location.href = url;
    }
  };

  const openInOfficeApp = async (docId: string, mime: string) => {
    const mapping = OFFICE_MIME_MAP[mime];
    if (!mapping) return;
    try {
      const tokenRes = await wopiApi.generateToken(docId);
      const tokenData = tokenRes.data?.data ?? tokenRes.data;
      const title = selectedDoc?.title || "document";
      const filename = encodeURIComponent(
        title.toLowerCase().endsWith(mapping.ext) ? title : title + mapping.ext
      );
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ||
        `${window.location.protocol}//${window.location.hostname}:8200/api`;
      const webdavUrl = `${apiBase}/webdav/documents/${docId}/${filename}?access_token=${tokenData.accessToken}`;
      const officeUrl = `${mapping.protocol}:ofe|u|${webdavUrl}`;
      setWordUrl(officeUrl);
      // Auto-launch Word immediately
      launchOfficeProtocol(officeUrl);
    } catch (e) {
      console.warn(`[Edit] Failed to generate ${mapping.label} URL:`, e);
      showDialog(
        "Link Generation Failed",
        `Lock acquired but could not generate ${mapping.label} URL. Use Download instead.`,
        "warning"
      );
    }
  };

  const openInWord = async (docId: string) => {
    await openInOfficeApp(
      docId,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  };

  // ── Open in WPS Office: download file so the OS default handler (WPS) opens it ──
  const openInWps = async (docId: string) => {
    try {
      const res = await documentApi.download(docId);
      const blob = res.data;
      const title = selectedDoc?.title || "document";
      const ext = OFFICE_MIME_MAP[selectedDoc?.mimeType || ""]?.ext || ".docx";
      const filename = title.toLowerCase().endsWith(ext) ? title : title + ext;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showDialog(
        "Opening in WPS Office",
        `"${filename}" has been downloaded. It should open automatically in WPS Office.\n\nEdit the file locally, then use the Check In button to upload your changes.`,
        "info"
      );
    } catch (e) {
      console.warn("[Edit] Failed to download for WPS:", e);
      showDialog("Download Failed", "Could not download the document for WPS Office.", "error");
    }
  };

  const handleEditInWord = async (doc: Document) => {
    const mime = doc.mimeType || "";
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
      const msg = err?.response?.data?.message || "Failed to acquire lock";
      if (status === 423) {
        showDialog(
          "Document Locked",
          `This document is currently being edited by another user.\n\n${msg}`,
          "warning"
        );
      } else if (status === 409) {
        showDialog(
          "Stale Lock Detected",
          `${msg}\n\nWould you like to take over the lock?`,
          "confirm",
          {
            confirmLabel: "Take Over",
            cancelLabel: "Cancel",
            onConfirm: async () => {
              setDialogOpen(false);
              try {
                const takeRes = await lockApi.takeover(doc.id);
                const takeData = takeRes.data?.data ?? takeRes.data;
                setLockToken(takeData?.lockToken ?? null);
                setEditingDocId(doc.id);
                startHeartbeat(doc.id);
                startTimer();
                await openInOfficeApp(doc.id, mime);
              } catch (takeErr) {
                console.error("[Edit] takeover failed:", takeErr);
                showDialog(
                  "Takeover Failed",
                  "Failed to take over the lock. Please try again later.",
                  "error"
                );
              }
            }
          }
        );
      } else {
        showDialog("Edit Failed", msg, "error");
      }
    }
  };

  // ── Check In: Upload edited file → pre-check → warning modal if needed → commit ──
  const handleCheckinEdited = async () => {
    if (!editingDocId) return;
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      // Run pre-check first
      setPreCheckLoading(true);
      try {
        const precheckForm = new FormData();
        precheckForm.append("file", file);
        const res = await documentApi.checkinPrecheck(
          editingDocId,
          precheckForm
        );
        const result: VersionPreCheckResult = res.data?.data ?? res.data;

        if (result && result.warnings && result.warnings.length > 0) {
          // Show warning modal — user must confirm
          setPreCheckResult(result);
          setPendingCheckinFile(file);
          setPreCheckLoading(false);
          return;
        }
      } catch (err) {
        console.warn("[PreCheck] failed, proceeding with check-in:", err);
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
      form.append("file", file);
      await documentApi.checkin(editingDocId, form);
      await lockApi.release(editingDocId);
      stopHeartbeat();
      setEditingDocId(null);
      setLockToken(null);
      setWordUrl(null);
      setEditElapsed("");
      setHeartbeatCount(0);
      setPreCheckResult(null);
      setPendingCheckinFile(null);
      loadData();
      showDialog(
        "Check-In Successful",
        "The document has been checked in with a new version.",
        "success"
      );
    } catch (err) {
      console.error("[Checkin] failed:", err);
      showDialog(
        "Check-In Failed",
        "Failed to check in the document. Please check the console for details.",
        "error"
      );
    }
  };

  const handlePreCheckConfirm = async () => {
    if (pendingCheckinFile && standaloneCheckinDocId) {
      await performStandaloneCheckin(standaloneCheckinDocId, pendingCheckinFile);
    } else if (pendingCheckinFile) {
      await performCheckin(pendingCheckinFile);
    }
  };

  const handlePreCheckCancel = () => {
    setPreCheckResult(null);
    setPendingCheckinFile(null);
    setStandaloneCheckinDocId(null);
  };

  // ── Cancel Edit: Release lock without checking in ──
  const handleCancelEdit = () => {
    if (!editingDocId) return;
    showDialog(
      "Cancel Editing?",
      "Any unsaved changes in your local file will be lost on the server side.",
      "confirm",
      {
        confirmLabel: "Cancel Edit",
        cancelLabel: "Keep Editing",
        destructive: true,
        onConfirm: async () => {
          setDialogOpen(false);
          try {
            await lockApi.release(editingDocId);
          } catch { } // best-effort
          stopHeartbeat();
          setEditingDocId(null);
          setLockToken(null);
          setWordUrl(null);
          setEditElapsed("");
          setHeartbeatCount(0);
        }
      }
    );
  };

  // ── Done: WebDAV auto-saves have already persisted — just release lock & refresh.
  //    Works for Word (auto-save via WebDAV) and any editor that writes back to the
  //    WebDAV URL. For WPS/downloaded copies the user should still use "Check In".
  const handleDoneEditing = async () => {
    if (!editingDocId) return;
    const docId = editingDocId;
    try {
      // Fetch latest doc state so we can show the user the final version number
      // that was captured from their Word auto-saves.
      let finalVersion: number | string = "latest";
      try {
        const res = await documentApi.get(docId);
        const data = res.data?.data ?? res.data;
        if (data?.currentVersion != null) finalVersion = data.currentVersion;
      } catch { /* best-effort */ }

      try {
        await lockApi.release(docId);
      } catch { /* best-effort */ }

      stopHeartbeat();
      setEditingDocId(null);
      setLockToken(null);
      setWordUrl(null);
      setEditElapsed("");
      setHeartbeatCount(0);
      loadData();

      showDialog(
        "Done — Changes Captured",
        `Your edits were auto-saved via WebDAV. The document is now at version ${finalVersion}.\n\n` +
        `If you were editing via WPS or a downloaded copy, use "Check In" instead to upload your file.`,
        "success"
      );
    } catch (err) {
      console.error("[Done] failed:", err);
      showDialog(
        "Done Failed",
        "Failed to finalize the edit session. Please try again or use Cancel Edit.",
        "error"
      );
    }
  };

  // ── Text editing helpers ──
  const handleEditText = async () => {
    if (!selectedDoc) return;
    try {
      const res = await documentApi.getContent(selectedDoc.id);
      const data = res.data?.data ?? res.data;
      setEditedContent(data?.content ?? "");
      setIsTextEditing(true);
    } catch {
      showDialog(
        "Load Failed",
        "Failed to load text content for editing.",
        "error"
      );
    }
  };

  const handleSaveText = async () => {
    if (!selectedDoc) return;
    setSavingContent(true);
    try {
      const res = await documentApi.updateContent(
        selectedDoc.id,
        editedContent
      );
      const updated = res.data?.data ?? res.data;
      setIsTextEditing(false);
      setTextContent(editedContent);
      if (updated) setSelectedDoc(updated);
      loadData();
    } catch {
      showDialog(
        "Save Failed",
        "Failed to save content. Please try again.",
        "error"
      );
    }
    setSavingContent(false);
  };

  const handleCancelTextEdit = () => {
    setIsTextEditing(false);
    setEditedContent("");
  };

  const handleRequestSignature = async (
    doc: Document,
    provider: "INTERNAL" | "DOCUSIGN"
  ) => {
    setSignatureProvider(provider);
    setSignatureSignerId("");
    setSignerSearch("");
    setSignerDropdownOpen(false);
    setSignatureError(null);
    setShowSignatureModal(true);
    try {
      const res = await authApi.getUsers(0, 100);
      setSignerUsers(res.data?.data || []);
    } catch {
      setSignerUsers([]);
    }
  };

  const [signatureError, setSignatureError] = useState<string | null>(null);
  const handleSubmitSignatureRequest = async () => {
    if (!selectedDoc || !signatureSignerId.trim()) return;
    setSignatureError(null);
    try {
      await signatureApi.request(
        selectedDoc.id,
        signatureSignerId.trim(),
        signatureProvider
      );
      setShowSignatureModal(false);
      setSignatureSignerId("");
      loadData();
    } catch (e: any) {
      setSignatureError(
        e?.response?.data?.message || "Failed to request signature"
      );
    }
  };

  // Cleanup heartbeat on unmount or navigation
  useEffect(() => {
    return () => {
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  // Load preview blob when selectedDoc changes
  useEffect(() => {
    if (!selectedDoc || showNotes || showVersions) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setTextContent(null);
      setRedactedContent(null);
      setShowOriginal(false);
      setIsTextEditing(false);
      return;
    }

    // If PII detected, load redacted content instead of raw file
    if (selectedDoc.piiDetected && !showOriginal) {
      setPreviewUrl(null);
      setTextContent(null);
      documentApi
        .getRedactedContent(selectedDoc.id)
        .then((res) => {
          const data = res.data?.data ?? res.data;
          setRedactedContent(
            data?.content ?? "Redacted content not available."
          );
        })
        .catch(() => setRedactedContent("Failed to load redacted content."));
      return;
    }

    setRedactedContent(null);
    const mime = selectedDoc.mimeType || "";
    const isDocx =
      mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isText = mime.startsWith("text/") || mime === "application/json";
    const isBinary =
      mime.startsWith("image/") ||
      mime === "application/pdf" ||
      isDocx ||
      mime.startsWith("video/") ||
      mime.startsWith("audio/");

    if (isText) {
      // Fetch raw text content
      documentApi
        .getContent(selectedDoc.id)
        .then((res) => {
          const data = res.data?.data ?? res.data;
          setTextContent(data?.content ?? "");
          setPiiMasked(!!data?.piiMasked);
        })
        .catch(() => setTextContent(null));
      return;
    }
    if (!isBinary) return;
    let cancelled = false;
    documentApi
      .download(selectedDoc.id)
      .then((res) => {
        if (cancelled) return;
        const url = URL.createObjectURL(res.data);
        setPreviewUrl(url);
      })
      .catch((err) => {
        console.error("[Documents] preview download failed:", err);
      });
    return () => {
      cancelled = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoc?.id, showNotes, showVersions, showOriginal]);

  // Load email children (attachments) or parent when selectedDoc is an email document
  useEffect(() => {
    if (!selectedDoc) {
      setEmailChildren([]);
      setEmailParent(null);
      return;
    }
    const meta = selectedDoc.metadata as Record<string, unknown> | undefined;
    const isEmailDoc = meta?.source === "email";
    if (!isEmailDoc) {
      setEmailChildren([]);
      setEmailParent(null);
      return;
    }
    // If this is a parent email doc, load its children (attachments)
    if (!selectedDoc.parentDocumentId) {
      documentApi.getChildren(selectedDoc.id).then(res => {
        const data = res.data?.data ?? res.data ?? [];
        setEmailChildren(Array.isArray(data) ? data : []);
      }).catch(() => setEmailChildren([]));
      setEmailParent(null);
    } else {
      // This is a child attachment — load the parent email
      setEmailChildren([]);
      documentApi.get(selectedDoc.parentDocumentId).then(res => {
        const data = res.data?.data ?? res.data;
        setEmailParent(data ?? null);
      }).catch(() => setEmailParent(null));
    }
  }, [selectedDoc?.id]);

  // ── Presence: register heartbeat + poll viewers while detail panel open ──
  useEffect(() => {
    if (!selectedDoc?.id) {
      setViewers([]);
      if (presenceTickRef.current) {
        clearInterval(presenceTickRef.current);
        presenceTickRef.current = null;
      }
      return;
    }
    const docId = selectedDoc.id;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await presenceApi.heartbeat(
          docId,
          currentUser?.username,
          currentUser?.fullName || currentUser?.username,
        );
        if (!cancelled) {
          const data = res.data?.data ?? res.data;
          setViewers(data?.viewers || []);
        }
      } catch {
        /* ignore */
      }
    };
    tick();
    presenceTickRef.current = setInterval(tick, 20000);

    return () => {
      cancelled = true;
      if (presenceTickRef.current) {
        clearInterval(presenceTickRef.current);
        presenceTickRef.current = null;
      }
      presenceApi.leave(docId).catch(() => {});
    };
  }, [selectedDoc?.id, currentUser?.username, currentUser?.fullName]);

  // ── Document links: fetch when a doc is selected ──
  useEffect(() => {
    if (!selectedDoc?.id) {
      setDocLinks([]);
      return;
    }
    const docId = selectedDoc.id;
    documentApi
      .getLinks(docId)
      .then((res: any) => {
        const data = res.data?.data ?? res.data;
        setDocLinks(Array.isArray(data) ? data : []);
      })
      .catch(() => setDocLinks([]));
  }, [selectedDoc?.id]);

  const handleDeleteLink = async (linkId: string) => {
    if (!selectedDoc) return;
    if (!window.confirm("Remove this document link?")) return;
    try {
      await documentApi.deleteLink(selectedDoc.id, linkId);
      setDocLinks(prev => prev.filter(l => l.id !== linkId));
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to delete link");
    }
  };

  const handleSearchLinkCandidates = async (q: string) => {
    setLinkPickerQuery(q);
    if (q.length < 2) {
      setLinkPickerResults([]);
      return;
    }
    try {
      const res = await searchApi.quick(q, 0, 10);
      const data = res.data?.data ?? res.data;
      const hits = Array.isArray(data?.results) ? data.results : [];
      setLinkPickerResults(
        hits
          .filter((h: any) => h.documentId && h.documentId !== selectedDoc?.id)
          .map((h: any) => ({
            id: h.documentId,
            title: h.title,
            description: h.description,
            mimeType: h.mimeType,
            status: h.status,
          })) as any,
      );
    } catch {
      setLinkPickerResults([]);
    }
  };

  const handleCreateLink = async (targetId: string) => {
    if (!selectedDoc) return;
    try {
      const res = await documentApi.createLink(selectedDoc.id, {
        targetDocumentId: targetId,
        linkType: linkPickerType,
      });
      const created = res.data?.data ?? res.data;
      if (created) setDocLinks(prev => [...prev, created]);
      setShowLinkPicker(false);
      setLinkPickerQuery("");
      setLinkPickerResults([]);
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to create link");
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let docRes, folderRes;
      if (activeProject) {
        [docRes, folderRes] = await Promise.all([
          currentFolder
            ? documentApi.listByProject(
              activeProject.id,
              currentFolder,
              page,
              20
            )
            : documentApi.listByProject(activeProject.id, undefined, page, 20),
          documentApi.getFoldersByProject(activeProject.id, currentFolder)
        ]);
      } else {
        [docRes, folderRes] = await Promise.all([
          documentApi.list(currentFolder, page, 20),
          documentApi.getFolders(currentFolder)
        ]);
      }
      const docData = docRes.data?.data ?? docRes.data;
      setDocuments(docData?.content ?? []);
      setTotalPages(docData?.totalPages ?? 0);
      setFolders(folderRes.data?.data ?? folderRes.data ?? []);
    } catch (err) {
      console.error("[Documents] loadData failed:", err);
    }
    setLoading(false);
  }, [currentFolder, page, activeProject]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => {
      setContextMenu(null);
      setContextMenuPos(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  // Reset folder navigation when project changes
  useEffect(() => {
    setCurrentFolder(undefined);
    setCurrentFolderProjectId(undefined);
    setBreadcrumbs([{ name: "Root" }]);
    setPage(0);
    setSelectedDoc(null);
  }, [activeProject?.id]);

  // Auto-open document when navigated from search results (?doc=<id>)
  useEffect(() => {
    const docId = searchParams.get("doc");
    if (!docId) return;
    documentApi
      .get(docId)
      .then((res) => {
        const doc = res.data?.data ?? res.data;
        if (doc) setSelectedDoc(doc);
      })
      .catch(() => { });
  }, [searchParams]);

  const navigateToFolder = (
    folderId?: string,
    folderName?: string,
    folderProjectId?: string
  ) => {
    if (folderId) {
      setBreadcrumbs((prev) => [
        ...prev,
        { id: folderId, name: folderName || "Folder" }
      ]);
    } else {
      setBreadcrumbs([{ name: "Root" }]);
    }
    setCurrentFolder(folderId);
    setCurrentFolderProjectId(folderProjectId);
    setPage(0);
  };

  const navigateBreadcrumb = (index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    const folderId = breadcrumbs[index]?.id;
    setCurrentFolder(folderId);
    if (!folderId) setCurrentFolderProjectId(undefined);
    setPage(0);
  };

  const handleDownload = async (doc: Document) => {
    if (doc.piiDetected) {
      showDialog(
        "Download Contains Sensitive Data",
        `This document contains PII (${doc.piiTypes?.split(",").join(", ") || "sensitive data"}) with severity: ${doc.piiSeverity}. The downloaded file will contain unredacted sensitive information. Are you sure you want to proceed?`,
        "confirm",
        {
          confirmLabel: "Download Anyway",
          cancelLabel: "Cancel",
          destructive: true,
          onConfirm: async () => {
            setDialogOpen(false);
            try {
              const res = await documentApi.download(doc.id);
              const url = URL.createObjectURL(res.data);
              const a = document.createElement("a");
              a.href = url;
              a.download = doc.title;
              a.click();
              URL.revokeObjectURL(url);
            } catch (err) {
              console.error("[Documents] download failed:", err);
              showDialog(
                "Download Failed",
                "Failed to download the document.",
                "error"
              );
            }
          }
        }
      );
      return;
    }
    try {
      const res = await documentApi.download(doc.id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.title;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Documents] download failed:", err);
      showDialog(
        "Download Failed",
        "Failed to download the document. Check console for details.",
        "error"
      );
    }
  };

  const handleCheckout = async (doc: Document) => {
    try {
      const res = await documentApi.checkout(doc.id);
      const updated = res.data?.data ?? res.data;
      if (updated && selectedDoc?.id === doc.id) setSelectedDoc(updated);
      loadData();
      if (viewMode === "checkouts") loadMyCheckouts();
    } catch (err) {
      console.error("[Documents] checkout failed:", err);
    }
  };

  const handleCancelCheckout = async (doc: Document) => {
    try {
      const res = await documentApi.cancelCheckout(doc.id);
      const updated = res.data?.data ?? res.data;
      if (updated && selectedDoc?.id === doc.id) setSelectedDoc(updated);
      loadData();
      if (viewMode === "checkouts") loadMyCheckouts();
    } catch (err) {
      console.error("[Documents] cancel checkout failed:", err);
    }
  };

  const handleToggleLegalHold = async (doc: Document) => {
    try {
      if (doc.legalHold) {
        const confirmed = window.confirm(
          `Release legal hold on "${doc.title}"?\n\nThe document will become subject to normal retention rules again.`,
        );
        if (!confirmed) return;
        await documentApi.removeLegalHold(doc.id);
      } else {
        const reason = window.prompt(
          `Place "${doc.title}" under LEGAL HOLD?\n\nEnter reason (e.g. matter number, case reference):`,
          "",
        );
        if (reason === null) return;
        if (!reason.trim()) {
          alert("A reason is required to place a document under legal hold.");
          return;
        }
        await documentApi.setLegalHold(doc.id, reason.trim());
      }
      // Refresh selected doc + list
      const refreshed = await documentApi.get(doc.id);
      const updated = refreshed.data?.data ?? refreshed.data;
      if (updated && selectedDoc?.id === doc.id) setSelectedDoc(updated);
      loadData();
    } catch (err: any) {
      console.error("[Documents] legal-hold toggle failed:", err);
      alert(
        err?.response?.data?.message ||
          "Failed to toggle legal hold. You may not have permission.",
      );
    }
  };

  // ── Standalone Check In: upload a new version for a checked-out document (any file type) ──
  const handleCheckinForCheckout = async (doc: Document) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      // Run pre-check first
      setPreCheckLoading(true);
      try {
        const precheckForm = new FormData();
        precheckForm.append("file", file);
        const res = await documentApi.checkinPrecheck(doc.id, precheckForm);
        const result: VersionPreCheckResult = res.data?.data ?? res.data;

        if (result && result.warnings && result.warnings.length > 0) {
          setPreCheckResult(result);
          setPendingCheckinFile(file);
          // Store doc id for standalone checkin
          setStandaloneCheckinDocId(doc.id);
          setPreCheckLoading(false);
          return;
        }
      } catch (err) {
        console.warn("[PreCheck] failed, proceeding with check-in:", err);
      }
      setPreCheckLoading(false);

      // No warnings — proceed directly
      await performStandaloneCheckin(doc.id, file);
    };
    input.click();
  };

  const performStandaloneCheckin = async (docId: string, file: File) => {
    try {
      const form = new FormData();
      form.append("file", file);
      await documentApi.checkin(docId, form);
      setPreCheckResult(null);
      setPendingCheckinFile(null);
      setStandaloneCheckinDocId(null);
      loadData();
      if (viewMode === "checkouts") loadMyCheckouts();
      showDialog(
        "Check-In Successful",
        "The document has been checked in with a new version.",
        "success"
      );
    } catch (err) {
      console.error("[Checkin] failed:", err);
      showDialog(
        "Check-In Failed",
        "Failed to check in the document. Please check the console for details.",
        "error"
      );
    }
  };

  const handleDelete = async (doc: Document) => {
    showDialog(
      "Delete Document",
      `Are you sure you want to delete "${doc.title}"? This action cannot be undone.`,
      "confirm",
      {
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        destructive: true,
        onConfirm: async () => {
          setDialogOpen(false);
          try {
            await documentApi.delete(doc.id);
            if (selectedDoc?.id === doc.id) setSelectedDoc(null);
            loadData();
          } catch (err) {
            console.error("[Documents] delete failed:", err);
          }
        }
      }
    );
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await documentApi.createFolder({
        name: newFolderName.trim(),
        parentId: currentFolder,
        projectId: currentFolderProjectId || activeProject?.id
      });
      setShowNewFolder(false);
      setNewFolderName("");
      loadData();
    } catch (err) {
      console.error("[Documents] createFolder failed:", err);
      showDialog(
        "Folder Creation Failed",
        "Failed to create folder. Please try again.",
        "error"
      );
    }
  };

  const handleOpenInNewTab = async (doc: Document) => {
    try {
      const res = await documentApi.download(doc.id);
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank");
    } catch (err) {
      console.error("[Documents] open in new tab failed:", err);
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
                {i > 0 && (
                  <ChevronRight className="h-3 w-3 text-slate-400 mx-1" />
                )}
                <button
                  onClick={() => navigateBreadcrumb(i)}
                  className="text-primary-600 hover:underline"
                >
                  {i === 0 ? <Home className="h-4 w-4 inline" /> : bc.name}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewFolder(true)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2"
          >
            <FolderPlus className="h-4 w-4" /> New Folder
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 flex items-center gap-2"
          >
            <Upload className="h-4 w-4" /> Upload
          </button>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setViewMode("browse")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${viewMode === "browse" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <FileText className="h-4 w-4 inline mr-1.5" />
          Browse
        </button>
        <button
          onClick={() => {
            setViewMode("checkouts");
            loadMyCheckouts();
          }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${viewMode === "checkouts" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <Lock className="h-4 w-4 inline mr-1.5" />
          My Checkouts
        </button>
      </div>

      {/* New folder dialog */}
      {showNewFolder && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
          <FolderPlus className="h-5 w-5 text-amber-500" />
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            autoFocus
          />
          <button
            onClick={handleCreateFolder}
            className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
          >
            Create
          </button>
          <button
            onClick={() => {
              setShowNewFolder(false);
              setNewFolderName("");
            }}
            className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
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
              <p className="text-sm font-medium text-emerald-800">
                Editing document
              </p>
              <p className="text-xs text-emerald-600">
                Lock held &middot; {editElapsed} &middot;{" "}
                <Heart className="h-3 w-3 inline" /> {heartbeatCount} heartbeats
                sent
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wordUrl && (
              <button
                onClick={() => launchOfficeProtocol(wordUrl)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2 font-semibold"
              >
                📝 Open in Word
              </button>
            )}
            {editingDocId && (
              <button
                onClick={() => openInWps(editingDocId)}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700 flex items-center gap-2 font-semibold"
              >
                📄 Open in WPS
              </button>
            )}
            <button
              onClick={handleCheckinEdited}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2"
            >
              <UploadCloud className="h-4 w-4" /> Check In
            </button>
            <button
              onClick={handleDoneEditing}
              title="I finished editing in Word/WebDAV — my saves are already captured. Release the lock."
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2 font-semibold"
            >
              ✓ Done
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
            >
              Cancel Edit
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {viewMode === "checkouts" ? (
        /* ── My Checkouts View ── */
        <div className="bg-white rounded-xl border border-slate-200">
          {checkoutsLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : myCheckouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
              <Lock className="h-8 w-8" />
              <p className="text-sm">You have no checked-out documents</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="px-4 py-3 font-medium text-slate-500">
                      Name
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-500 hidden md:table-cell">
                      Size
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-500 hidden md:table-cell">
                      Checked Out
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {myCheckouts.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer"
                      onClick={() => {
                        setSelectedDoc(doc);
                        setViewMode("browse");
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">
                            {getFileIcon(doc.mimeType)}
                          </span>
                          <div>
                            <p className="font-medium text-slate-900">
                              {doc.title}
                            </p>
                            <p className="text-xs text-slate-400">
                              {doc.mimeType}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                        {formatBytes(doc.fileSizeBytes ?? doc.fileSize ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                        {doc.checkedOutAt ? formatDate(doc.checkedOutAt) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckinForCheckout(doc);
                            }}
                            className="px-3 py-1 text-xs border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 flex items-center gap-1"
                          >
                            <UploadCloud className="h-3 w-3" /> Check In
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelCheckout(doc);
                            }}
                            className="px-3 py-1 text-xs border border-green-300 text-green-700 rounded-lg hover:bg-green-50 flex items-center gap-1"
                          >
                            <Unlock className="h-3 w-3" /> Cancel Checkout
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(doc);
                            }}
                            className="px-3 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" /> Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
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
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                    Folders
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() =>
                          navigateToFolder(
                            folder.id,
                            folder.name,
                            folder.projectId
                          )
                        }
                        className="flex flex-col items-center p-3 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition text-center"
                      >
                        <FolderPlus className="h-8 w-8 text-amber-500 mb-1" />
                        <span className="text-xs font-medium text-slate-700 truncate w-full">
                          {folder.name}
                        </span>
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
                      <th className="px-4 py-3 font-medium text-slate-500">
                        Name
                      </th>
                      <th className="px-4 py-3 font-medium text-slate-500 hidden md:table-cell">
                        Size
                      </th>
                      <th className="px-4 py-3 font-medium text-slate-500 hidden lg:table-cell">
                        Status
                      </th>
                      <th className="px-4 py-3 font-medium text-slate-500 hidden lg:table-cell">
                        Version
                      </th>
                      <th className="px-4 py-3 font-medium text-slate-500 hidden md:table-cell">
                        Modified
                      </th>
                      <th className="px-4 py-3 font-medium text-slate-500 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-12 text-center text-slate-400"
                        >
                          No documents in this folder
                        </td>
                      </tr>
                    )}
                    {documents.map((doc) => (
                      <tr
                        key={doc.id}
                        className="border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer"
                        onClick={() => setSelectedDoc(doc)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">
                              {getFileIcon(doc.mimeType)}
                            </span>
                            <div>
                              <p className="font-medium text-slate-900 flex items-center gap-2">
                                {doc.title}
                                {(doc.isCheckedOut || doc.checkedOut) && (
                                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                                )}
                                {doc.legalHold && (
                                  <Shield className="h-3.5 w-3.5 text-red-500" />
                                )}
                                {(doc as any).aiGenerated && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px] font-semibold"
                                    title={`AI Confidence: ${((doc as any).aiConfidence * 100)?.toFixed(1) ?? "?"}%`}
                                  >
                                    <Bot className="h-3 w-3" /> AI
                                  </span>
                                )}
                                {doc.classificationLabel && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded text-[10px] font-semibold">
                                    {doc.classificationLabel}
                                  </span>
                                )}
                                {doc.m365Link && (
                                  <a
                                    href={doc.m365Link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold hover:bg-blue-200 transition-colors cursor-pointer"
                                    title={`Open in SharePoint: ${doc.m365Link}`}
                                  >
                                    M365
                                  </a>
                                )}
                                {doc.docusignEnvelopeId && (
                                  <a
                                    href={`https://app.docusign.com/documents/details/${doc.docusignEnvelopeId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-semibold hover:bg-yellow-200 transition-colors cursor-pointer"
                                    title={`View DocuSign Envelope: ${doc.docusignEnvelopeId}`}
                                  >
                                    DocuSign
                                  </a>
                                )}
                                {doc.sapDocumentNumber && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-semibold"
                                    title={`SAP Document: ${doc.sapDocumentNumber}`}
                                  >
                                    SAP {doc.sapDocumentNumber}
                                  </span>
                                )}
                                {doc.piiDetected && (
                                  <span
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${doc.piiSeverity === "CRITICAL" ||
                                        doc.piiSeverity === "HIGH"
                                        ? "bg-red-100 text-red-700"
                                        : doc.piiSeverity === "MEDIUM"
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-yellow-100 text-yellow-700"
                                      }`}
                                    title={`PII detected: ${doc.piiTypes || "Unknown"} (${doc.piiSeverity})`}
                                  >
                                    🔒 PII
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-400">
                                {doc.mimeType}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                          {formatBytes(doc.fileSizeBytes ?? doc.fileSize ?? 0)}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${doc.status === "ACTIVE"
                                ? "bg-green-100 text-green-700"
                                : doc.status === "DRAFT"
                                  ? "bg-slate-100 text-slate-600"
                                  : doc.status === "ARCHIVED"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">
                          v{doc.currentVersion ?? doc.version ?? 1}
                        </td>
                        <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                          {formatDate(doc.updatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (contextMenu === doc.id) {
                                  setContextMenu(null);
                                  setContextMenuPos(null);
                                } else {
                                  const rect = (
                                    e.currentTarget as HTMLElement
                                  ).getBoundingClientRect();
                                  setContextMenuPos({
                                    top: rect.bottom + 4,
                                    left: rect.right - 192
                                  });
                                  setContextMenu(doc.id);
                                }
                              }}
                              className="p-1 rounded hover:bg-slate-200"
                            >
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
              {contextMenu &&
                contextMenuPos &&
                (() => {
                  const doc = documents.find((d) => d.id === contextMenu);
                  if (!doc) return null;
                  return (
                    <div
                      className="fixed w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-[9999] py-1"
                      style={{
                        top: contextMenuPos.top,
                        left: Math.max(0, contextMenuPos.left)
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          handleDownload(doc);
                          setContextMenu(null);
                          setContextMenuPos(null);
                        }}
                        className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <Download className="h-4 w-4 mr-2" /> Download
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDoc(doc);
                          setShowNotes(true);
                          setContextMenu(null);
                          setContextMenuPos(null);
                        }}
                        className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <StickyNote className="h-4 w-4 mr-2" /> Notes
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDoc(doc);
                          setShowVersions(true);
                          setContextMenu(null);
                          setContextMenuPos(null);
                        }}
                        className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <Eye className="h-4 w-4 mr-2" /> Versions
                      </button>
                      {!(doc.isCheckedOut || doc.checkedOut) ? (
                        <button
                          onClick={() => {
                            handleCheckout(doc);
                            setContextMenu(null);
                            setContextMenuPos(null);
                          }}
                          className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          <Lock className="h-4 w-4 mr-2" /> Check Out
                        </button>
                      ) : doc.checkedOutBy === currentUser?.id ? (
                        <>
                          <button
                            onClick={() => {
                              handleCheckinForCheckout(doc);
                              setContextMenu(null);
                              setContextMenuPos(null);
                            }}
                            className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            <UploadCloud className="h-4 w-4 mr-2" /> Check In
                          </button>
                          <button
                            onClick={() => {
                              handleCancelCheckout(doc);
                              setContextMenu(null);
                              setContextMenuPos(null);
                            }}
                            className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            <Unlock className="h-4 w-4 mr-2" /> Cancel Checkout
                          </button>
                        </>
                      ) : (
                        <div className="px-3 py-2 text-xs text-amber-600 flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5" />
                          <span>
                            Checked out by{" "}
                            {doc.checkedOutByName || "another user"}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setSelectedDoc(doc);
                          setShowWorkflow(true);
                          setContextMenu(null);
                          setContextMenuPos(null);
                        }}
                        className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <GitBranch className="h-4 w-4 mr-2" /> Workflow
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDoc(doc);
                          setShowRetention(true);
                          setContextMenu(null);
                          setContextMenuPos(null);
                        }}
                        className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <Shield className="h-4 w-4 mr-2" /> Retention
                      </button>
                      {!doc.projectId && (
                        <button
                          onClick={async () => {
                            setSelectedDoc(doc);
                            setContextMenu(null);
                            setContextMenuPos(null);
                            try {
                              const res = await projectApi.getMine();
                              setAssignProjectList(
                                res.data?.data ?? res.data ?? []
                              );
                            } catch {
                              setAssignProjectList([]);
                            }
                            setAssignProjectId("");
                            setShowAssignProject(true);
                          }}
                          className="flex items-center w-full px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          <FolderInput className="h-4 w-4 mr-2" /> Assign to
                          Project
                        </button>
                      )}
                      <button
                        onClick={() => {
                          handleDelete(doc);
                          setContextMenu(null);
                          setContextMenuPos(null);
                        }}
                        className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </button>
                    </div>
                  );
                })()}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-slate-100">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-500">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modals / Panels */}
      {showUpload && (
        <UploadModal
          folderId={currentFolder}
          projectId={currentFolderProjectId || activeProject?.id}
          onClose={() => setShowUpload(false)}
          onComplete={() => {
            setShowUpload(false);
            loadData();
          }}
        />
      )}
      {showNotes && selectedDoc && (
        <NotesPanel
          document={selectedDoc}
          onClose={() => {
            setShowNotes(false);
            setSelectedDoc(null);
          }}
        />
      )}
      {showVersions && selectedDoc && (
        <VersionsPanel
          document={selectedDoc}
          onClose={() => {
            setShowVersions(false);
            setSelectedDoc(null);
          }}
        />
      )}

      {/* Document Workflow Panel */}
      {showWorkflow && selectedDoc && (
        <DocumentWorkflowPanel
          document={selectedDoc}
          projectId={activeProject?.id}
          userRoles={(currentUser?.roles ?? []).map((r: any) => typeof r === "string" ? r : r.name)}
          userId={currentUser?.id}
          onClose={() => {
            setShowWorkflow(false);
          }}
        />
      )}

      {/* Document AI Panel */}
      {showAiPanel && selectedDoc && (
        <DocumentAiPanel
          document={selectedDoc}
          onClose={() => setShowAiPanel(false)}
        />
      )}

      {/* Signature Request Modal */}
      {showSignatureModal &&
        selectedDoc &&
        (() => {
          const selectedUser = signerUsers.find(
            (u) => u.id === signatureSignerId
          );
          const filteredUsers = signerUsers.filter((u) => {
            if (!signerSearch) return true;
            const q = signerSearch.toLowerCase();
            return (
              u.username.toLowerCase().includes(q) ||
              u.email.toLowerCase().includes(q) ||
              `${u.firstName} ${u.lastName}`.toLowerCase().includes(q)
            );
          });
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-xl p-6 w-[420px]">
                <h3 className="text-lg font-semibold mb-4">
                  Request Signature
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  Document: {selectedDoc.title}
                </p>
                {signatureError && (
                  <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {signatureError}
                  </div>
                )}
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Signer
                </label>
                <div ref={signerRef} className="relative mb-3">
                  {/* Selected user or search input */}
                  {selectedUser && !signerDropdownOpen ? (
                    <button
                      onClick={() => setSignerDropdownOpen(true)}
                      className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    >
                      <span>
                        <span className="font-medium">
                          {selectedUser.firstName} {selectedUser.lastName}
                        </span>
                        <span className="text-gray-400 ml-1">
                          ({selectedUser.username})
                        </span>
                      </span>
                      <X
                        className="h-4 w-4 text-gray-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSignatureSignerId("");
                          setSignerSearch("");
                        }}
                      />
                    </button>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        value={signerSearch}
                        onChange={(e) => {
                          setSignerSearch(e.target.value);
                          setSignerDropdownOpen(true);
                        }}
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
                        <div className="px-3 py-2 text-sm text-gray-400">
                          No users found
                        </div>
                      ) : (
                        filteredUsers.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              setSignatureSignerId(u.id);
                              setSignerSearch("");
                              setSignerDropdownOpen(false);
                            }}
                            className="w-full flex items-start gap-2 px-3 py-2 hover:bg-violet-50 text-left text-sm transition"
                          >
                            <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700">
                              {u.firstName?.[0]}
                              {u.lastName?.[0]}
                            </div>
                            <div>
                              <div className="font-medium text-slate-800">
                                {u.firstName} {u.lastName}
                              </div>
                              <div className="text-xs text-gray-400">
                                {u.username} &middot; {u.email}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider
                </label>
                <select
                  value={signatureProvider}
                  onChange={(e) =>
                    setSignatureProvider(
                      e.target.value as "INTERNAL" | "DOCUSIGN"
                    )
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="INTERNAL">Internal</option>
                  <option value="DOCUSIGN">DocuSign</option>
                </select>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowSignatureModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitSignatureRequest}
                    disabled={!signatureSignerId}
                    className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50"
                  >
                    Send Request
                  </button>
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
          onClose={() => {
            setShowRetention(false);
          }}
        />
      )}

      {/* Pre-Check Warning Modal */}
      {preCheckResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handlePreCheckCancel}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Version Check Warning
                </h3>
                <p className="text-sm text-slate-500">
                  Review the following issues before check-in
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {preCheckResult.duplicateFound && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-red-500 text-lg">🔴</span>
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Duplicate Detected
                    </p>
                    <p className="text-xs text-red-600">
                      This file is identical to &quot;
                      {preCheckResult.duplicateDocumentTitle}&quot; (Version{" "}
                      {preCheckResult.duplicateVersionNumber})
                    </p>
                  </div>
                </div>
              )}
              {preCheckResult.formatMismatch && (
                <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <span className="text-orange-500 text-lg">🟠</span>
                  <div>
                    <p className="text-sm font-semibold text-orange-800">
                      Format Mismatch
                    </p>
                    <p className="text-xs text-orange-600">
                      Previous version: {preCheckResult.previousFormat}
                      <br />
                      New file: {preCheckResult.newFormat}
                    </p>
                    <p className="text-xs text-orange-500 mt-1 italic">
                      Are you sure this is the same document?
                    </p>
                  </div>
                </div>
              )}
              {preCheckResult.highRisk && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-red-500 text-lg">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      High-Risk Version
                    </p>
                    <p className="text-xs text-red-600">
                      Content similarity:{" "}
                      {preCheckResult.similarityScore != null
                        ? `${(preCheckResult.similarityScore * 100).toFixed(0)}%`
                        : "N/A"}
                    </p>
                    <p className="text-xs text-red-500 mt-1">
                      This appears to be a completely different document.
                    </p>
                  </div>
                </div>
              )}
              {preCheckResult.warnings &&
                preCheckResult.warnings.length > 0 && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      All Warnings:
                    </p>
                    <ul className="space-y-1">
                      {preCheckResult.warnings.map((w, i) => (
                        <li
                          key={i}
                          className="text-xs text-slate-600 flex items-start gap-2"
                        >
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
            <span className="text-sm text-slate-700">
              Analyzing document for anomalies...
            </span>
          </div>
        </div>
      )}

      {/* Assign to Project Modal */}
      {showAssignProject && selectedDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[420px]">
            <h3 className="text-lg font-semibold mb-4">Assign to Project</h3>
            <p className="text-sm text-gray-600 mb-4">
              Document: <span className="font-medium">{selectedDoc.title}</span>
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Project
            </label>
            <select
              value={assignProjectId}
              onChange={(e) => setAssignProjectId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="">— Choose a project —</option>
              {assignProjectList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAssignProject(false);
                  setSelectedDoc(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={!assignProjectId || assigningProject}
                onClick={async () => {
                  setAssigningProject(true);
                  try {
                    await documentApi.update(selectedDoc.id, {
                      projectId: assignProjectId
                    });
                    setShowAssignProject(false);
                    setSelectedDoc(null);
                    loadData();
                  } catch {
                    showDialog(
                      "Assignment Failed",
                      "Failed to assign project. Please try again.",
                      "error"
                    );
                  } finally {
                    setAssigningProject(false);
                  }
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {assigningProject && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Detail / Preview Panel */}
      {selectedDoc &&
        !showNotes &&
        !showVersions &&
        !showWorkflow &&
        !showRetention && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setSelectedDoc(null)}
            />
            <div className="relative w-3/4 bg-white shadow-xl flex flex-col h-full animate-in slide-in-from-right">
              <div className="flex items-center justify-between p-4 border-b border-slate-200 gap-3">
                <h2 className="font-semibold text-slate-900 truncate flex-1">
                  {selectedDoc.title}
                </h2>
                <NotarizationBadge documentId={selectedDoc.id} />
                {/* Presence avatars — always visible in header */}
                {viewers.length > 0 && (
                  <div className="flex items-center -space-x-2 shrink-0" title={`${viewers.length} viewing now`}>
                    {viewers.slice(0, 5).map((v) => {
                      const initials = (v.displayName || v.username || "?")
                        .split(/\s+/)
                        .map((p) => p[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")
                        .toUpperCase();
                      const hue = (v.userId || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
                      const isMe = v.userId === currentUser?.id;
                      return (
                        <div
                          key={v.userId}
                          title={`${v.displayName || v.username}${isMe ? " (you)" : ""}`}
                          className={`relative h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ${isMe ? "ring-emerald-500" : "ring-white"}`}
                          style={{ backgroundColor: `hsl(${hue},60%,45%)` }}
                        >
                          {initials}
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                        </div>
                      );
                    })}
                    {viewers.length > 5 && (
                      <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                        +{viewers.length - 5}
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-auto p-4 space-y-4 relative z-0">
                {/* ── PII Warning Banner ── */}
                {selectedDoc.piiDetected && (
                  <div
                    className={`rounded-lg p-3 flex items-start gap-3 ${selectedDoc.piiSeverity === "CRITICAL"
                        ? "bg-red-50 border border-red-300"
                        : selectedDoc.piiSeverity === "HIGH"
                          ? "bg-red-50 border border-red-200"
                          : selectedDoc.piiSeverity === "MEDIUM"
                            ? "bg-amber-50 border border-amber-200"
                            : "bg-yellow-50 border border-yellow-200"
                      }`}
                  >
                    <Shield
                      className={`h-5 w-5 flex-shrink-0 mt-0.5 ${selectedDoc.piiSeverity === "CRITICAL" ||
                          selectedDoc.piiSeverity === "HIGH"
                          ? "text-red-600"
                          : selectedDoc.piiSeverity === "MEDIUM"
                            ? "text-amber-600"
                            : "text-yellow-600"
                        }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold ${selectedDoc.piiSeverity === "CRITICAL" ||
                            selectedDoc.piiSeverity === "HIGH"
                            ? "text-red-800"
                            : selectedDoc.piiSeverity === "MEDIUM"
                              ? "text-amber-800"
                              : "text-yellow-800"
                          }`}
                      >
                        ⚠ Sensitive Information Detected
                        <span
                          className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${selectedDoc.piiSeverity === "CRITICAL"
                              ? "bg-red-200 text-red-800"
                              : selectedDoc.piiSeverity === "HIGH"
                                ? "bg-red-100 text-red-700"
                                : selectedDoc.piiSeverity === "MEDIUM"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-yellow-100 text-yellow-700"
                            }`}
                        >
                          {selectedDoc.piiSeverity}
                        </span>
                      </p>
                      <p
                        className={`text-xs mt-1 ${selectedDoc.piiSeverity === "CRITICAL" ||
                            selectedDoc.piiSeverity === "HIGH"
                            ? "text-red-600"
                            : selectedDoc.piiSeverity === "MEDIUM"
                              ? "text-amber-600"
                              : "text-yellow-600"
                          }`}
                      >
                        This document contains personally identifiable
                        information (PII):{" "}
                        {selectedDoc.piiTypes?.split(",").join(", ") ||
                          "Unknown types"}
                      </p>
                      {selectedDoc.piiScanDate && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          Scanned: {formatDate(selectedDoc.piiScanDate)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Preview area ── */}

                {/* Redacted content preview — shown when PII detected */}
                {selectedDoc.piiDetected &&
                  redactedContent &&
                  !showOriginal && (
                    <div className="space-y-3">
                      <div
                        className="bg-slate-900 rounded-lg p-6 overflow-auto"
                        style={{ maxHeight: 500 }}
                      >
                        <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                          {redactedContent}
                        </pre>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-slate-400 italic">
                          🔒 Preview shows redacted content — sensitive data has
                          been automatically masked
                        </p>
                        {currentUser?.roles?.includes("ADMIN") && (
                          <button
                            onClick={() => setShowOriginal(true)}
                            className="text-[11px] text-indigo-500 hover:text-indigo-400 hover:underline font-medium"
                          >
                            View Original (Admin)
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                {/* Admin viewing original — show back button */}
                {selectedDoc.piiDetected && showOriginal && (
                  <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                    <p className="text-xs text-amber-700">
                      ⚠ Viewing unredacted original — sensitive data is visible
                    </p>
                    <button
                      onClick={() => setShowOriginal(false)}
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >
                      ← Back to Redacted View
                    </button>
                  </div>
                )}

                {/* Image preview */}
                {selectedDoc.mimeType?.startsWith("image/") && previewUrl && (
                  <div className="bg-slate-100 rounded-lg p-2 flex items-center justify-center overflow-auto">
                    <img
                      src={previewUrl}
                      alt={selectedDoc.title}
                      className="max-h-[500px] rounded"
                    />
                  </div>
                )}

                {/* PDF preview */}
                {selectedDoc.mimeType === "application/pdf" && previewUrl && (
                  <div
                    className="bg-slate-100 rounded-lg overflow-hidden"
                    style={{ height: 500 }}
                  >
                    <object
                      data={previewUrl}
                      type="application/pdf"
                      className="w-full h-full"
                    >
                      <iframe
                        src={previewUrl}
                        className="w-full h-full border-0"
                        title="PDF Preview"
                      />
                    </object>
                  </div>
                )}

                {/* DOCX preview */}
                {selectedDoc.mimeType ===
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
                  previewUrl && <DocxViewer blobUrl={previewUrl} />}

                {/* Legacy .doc Word placeholder */}
                {selectedDoc.mimeType === "application/msword" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 flex flex-col items-center justify-center gap-3">
                    <div className="h-14 w-14 rounded-xl bg-blue-100 flex items-center justify-center">
                      <span className="text-2xl">📝</span>
                    </div>
                    <p className="text-sm font-medium text-blue-800">
                      Word Document (.doc)
                    </p>
                    <p className="text-xs text-blue-600">{selectedDoc.title}</p>
                    <button
                      onClick={() => handleDownload(selectedDoc)}
                      className="text-sm text-blue-700 hover:underline flex items-center gap-1 mt-1"
                    >
                      <Download className="h-3.5 w-3.5" /> Download to view
                    </button>
                  </div>
                )}

                {/* Excel / Spreadsheet placeholder */}
                {(selectedDoc.mimeType ===
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                  selectedDoc.mimeType === "application/vnd.ms-excel") && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 flex flex-col items-center justify-center gap-3">
                      <div className="h-14 w-14 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <span className="text-2xl">📊</span>
                      </div>
                      <p className="text-sm font-medium text-emerald-800">
                        Excel Spreadsheet
                      </p>
                      <p className="text-xs text-emerald-600">
                        {selectedDoc.title}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => handleDownload(selectedDoc)}
                          className="text-sm text-emerald-700 hover:underline flex items-center gap-1"
                        >
                          <Download className="h-3.5 w-3.5" /> Download to view
                        </button>
                      </div>
                    </div>
                  )}

                {/* PowerPoint / Presentation placeholder */}
                {(selectedDoc.mimeType ===
                  "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
                  selectedDoc.mimeType === "application/vnd.ms-powerpoint") && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-8 flex flex-col items-center justify-center gap-3">
                      <div className="h-14 w-14 rounded-xl bg-orange-100 flex items-center justify-center">
                        <span className="text-2xl">📽️</span>
                      </div>
                      <p className="text-sm font-medium text-orange-800">
                        PowerPoint Presentation
                      </p>
                      <p className="text-xs text-orange-600">
                        {selectedDoc.title}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => handleDownload(selectedDoc)}
                          className="text-sm text-orange-700 hover:underline flex items-center gap-1"
                        >
                          <Download className="h-3.5 w-3.5" /> Download to view
                        </button>
                      </div>
                    </div>
                  )}

                {/* Video preview */}
                {selectedDoc.mimeType?.startsWith("video/") && previewUrl && (
                  <div className="bg-black rounded-lg overflow-hidden">
                    <video
                      src={previewUrl}
                      controls
                      className="w-full max-h-[500px]"
                    />
                  </div>
                )}

                {/* Audio preview */}
                {selectedDoc.mimeType?.startsWith("audio/") && previewUrl && (
                  <div className="bg-slate-100 rounded-lg p-6 flex items-center justify-center">
                    <audio src={previewUrl} controls className="w-full" />
                  </div>
                )}

                {/* Text / JSON / code preview or inline editor */}
                {(selectedDoc.mimeType?.startsWith("text/") ||
                  selectedDoc.mimeType === "application/json") && (
                    <>
                      {isTextEditing ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500">
                              Editing — {selectedDoc.title}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveText}
                                disabled={savingContent}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {savingContent ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Save className="h-3 w-3" />
                                )}
                                {savingContent ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={handleCancelTextEdit}
                                className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-xs hover:bg-slate-50"
                              >
                                <X className="h-3 w-3" /> Cancel
                              </button>
                            </div>
                          </div>
                          <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="w-full h-[450px] p-3 bg-slate-50 border border-slate-300 rounded-lg font-mono text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            spellCheck={false}
                          />
                        </div>
                      ) : textContent !== null ? (
                        <div
                          className="bg-slate-50 border border-slate-200 rounded-lg overflow-auto"
                          style={{ maxHeight: 500 }}
                        >
                          {piiMasked && (
                            <div className="sticky top-0 z-10 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center gap-2">
                              🛡️ <span className="font-semibold">PII Shield active</span> — sensitive fields have been automatically masked based on your role. Request elevated access to view the unmasked document.
                            </div>
                          )}
                          <pre className="p-4 text-sm font-mono text-slate-800 whitespace-pre-wrap break-words">
                            {textContent}
                          </pre>
                        </div>
                      ) : (
                        <div className="bg-slate-100 rounded-lg p-8 flex items-center justify-center text-slate-400 text-sm">
                          Loading preview...
                        </div>
                      )}
                    </>
                  )}

                {/* Binary blob loading state */}
                {(selectedDoc.mimeType?.startsWith("image/") ||
                  selectedDoc.mimeType === "application/pdf" ||
                  selectedDoc.mimeType ===
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                  selectedDoc.mimeType?.startsWith("video/") ||
                  selectedDoc.mimeType?.startsWith("audio/")) &&
                  !previewUrl && (
                    <div className="bg-slate-100 rounded-lg p-8 flex items-center justify-center text-slate-400 text-sm">
                      Loading preview...
                    </div>
                  )}

                {/* Non-previewable file type fallback */}
                {(() => {
                  const m = selectedDoc.mimeType || "";
                  const previewable =
                    m.startsWith("image/") ||
                    m === "application/pdf" ||
                    m.startsWith("text/") ||
                    m === "application/json" ||
                    m.startsWith("video/") ||
                    m.startsWith("audio/") ||
                    m ===
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                    m ===
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                    m === "application/vnd.ms-excel" ||
                    m ===
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
                    m === "application/vnd.ms-powerpoint" ||
                    m === "application/msword";
                  if (previewable) return null;
                  return (
                    <div className="bg-slate-100 rounded-lg p-8 flex flex-col items-center justify-center gap-3">
                      <FileText className="h-12 w-12 text-slate-300" />
                      <p className="text-sm text-slate-400">
                        Preview not available for this file type
                      </p>
                      <p className="text-xs text-slate-400">
                        {m || "Unknown type"}
                      </p>
                      <button
                        onClick={() => handleOpenInNewTab(selectedDoc)}
                        className="text-sm text-primary-600 hover:underline flex items-center gap-1"
                      >
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
                    <p className="text-slate-700">
                      {formatBytes(
                        selectedDoc.fileSizeBytes ?? selectedDoc.fileSize ?? 0
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Version</p>
                    <p className="text-slate-700">
                      v{selectedDoc.currentVersion ?? selectedDoc.version ?? 1}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Status</p>
                    <p className="text-slate-700">{selectedDoc.status}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Created</p>
                    <p className="text-slate-700">
                      {formatDate(selectedDoc.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Modified</p>
                    <p className="text-slate-700">
                      {formatDate(selectedDoc.updatedAt)}
                    </p>
                  </div>
                  {selectedDoc.description && (
                    <div className="col-span-2">
                      <p className="text-slate-400 text-xs">Description</p>
                      <p className="text-slate-700">
                        {selectedDoc.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Plugin Integrations */}
                {(selectedDoc.m365Link ||
                  selectedDoc.docusignEnvelopeId ||
                  selectedDoc.sapDocumentNumber) && (
                    <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Integrations
                      </p>
                      {selectedDoc.m365Link && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">
                              M365
                            </span>
                            <span
                              className="text-xs text-slate-600 truncate max-w-[200px]"
                              title={selectedDoc.m365Link}
                            >
                              SharePoint Linked
                            </span>
                          </div>
                          <a
                            href={selectedDoc.m365Link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> Open in
                            SharePoint
                          </a>
                        </div>
                      )}
                      {selectedDoc.docusignEnvelopeId && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-semibold">
                              DocuSign
                            </span>
                            <span
                              className="text-xs text-slate-600 truncate max-w-[200px]"
                              title={selectedDoc.docusignEnvelopeId}
                            >
                              {selectedDoc.docusignEnvelopeId}
                            </span>
                          </div>
                          <a
                            href={`https://app.docusign.com/documents/details/${selectedDoc.docusignEnvelopeId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-yellow-700 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> View Envelope
                          </a>
                        </div>
                      )}
                      {selectedDoc.sapDocumentNumber && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-semibold">
                              SAP
                            </span>
                            <span className="text-xs text-slate-600">
                              {selectedDoc.sapDocumentNumber}
                            </span>
                          </div>
                          <span className="text-xs text-orange-600 flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Linked
                          </span>
                        </div>
                      )}
                    </div>
                  )}
              </div>

              {/* AI-Extracted Entities — Intelligent Intake */}
              {(selectedDoc as any).extractedEntities &&
                Object.keys((selectedDoc as any).extractedEntities).length > 0 && (
                  <div className="px-4 pb-3">
                    <div className="bg-gradient-to-br from-violet-50 to-sky-50 border border-violet-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Bot className="h-4 w-4 text-violet-600" />
                        <span className="text-xs font-semibold text-violet-800 uppercase tracking-wide">
                          Extracted Information
                        </span>
                      </div>
                      {(() => {
                        const e = (selectedDoc as any).extractedEntities as Record<string, any>;
                        const rows: JSX.Element[] = [];
                        if (e.primaryVendor) {
                          rows.push(
                            <div key="v" className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Vendor</span>
                              <span className="font-medium text-slate-800">{e.primaryVendor}</span>
                            </div>,
                          );
                        }
                        if (e.totalAmount != null) {
                          rows.push(
                            <div key="a" className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Amount</span>
                              <span className="font-mono font-semibold text-emerald-700">
                                {e.currency || "USD"} {Number(e.totalAmount).toLocaleString()}
                              </span>
                            </div>,
                          );
                        }
                        if (e.primaryInvoiceNumber) {
                          rows.push(
                            <div key="i" className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Invoice #</span>
                              <span className="font-mono text-slate-800">{e.primaryInvoiceNumber}</span>
                            </div>,
                          );
                        }
                        if (e.primaryDate) {
                          rows.push(
                            <div key="d" className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Date</span>
                              <span className="font-mono text-slate-800">{e.primaryDate}</span>
                            </div>,
                          );
                        }
                        if (Array.isArray(e.emails) && e.emails.length > 0) {
                          rows.push(
                            <div key="em" className="flex items-start justify-between text-xs gap-2">
                              <span className="text-slate-500">Emails</span>
                              <span className="font-mono text-slate-800 text-right break-all">
                                {e.emails.slice(0, 2).join(", ")}
                                {e.emails.length > 2 && ` +${e.emails.length - 2}`}
                              </span>
                            </div>,
                          );
                        }
                        return rows.length > 0 ? rows : (
                          <span className="text-[11px] text-slate-400 italic">
                            No structured entities found in content.
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                )}

              {/* Active viewers — Modern Workspace presence avatars */}
              {viewers.length > 0 && (
                <div className="px-4 pb-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                        Currently Viewing ({viewers.length})
                      </span>
                    </div>
                    <div className="flex items-center -space-x-2">
                      {viewers.slice(0, 6).map((v) => {
                        const initials = (v.displayName || v.username || "?")
                          .split(/\s+/)
                          .map((p) => p[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join("")
                          .toUpperCase();
                        // deterministic colour based on userId
                        const hue = (v.userId || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
                        const isMe = v.userId === currentUser?.id;
                        return (
                          <div
                            key={v.userId}
                            title={`${v.displayName || v.username}${isMe ? " (you)" : ""}`}
                            className={`relative h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ${isMe ? "ring-emerald-500" : "ring-white"}`}
                            style={{ backgroundColor: `hsl(${hue},60%,45%)` }}
                          >
                            {initials}
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                          </div>
                        );
                      })}
                      {viewers.length > 6 && (
                        <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                          +{viewers.length - 6}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Related Documents — cross-document relationships */}
              <div className="px-4 pb-3">
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-sky-600" />
                      <span className="text-xs font-semibold text-sky-800 uppercase tracking-wide">
                        Related Documents ({docLinks.length})
                      </span>
                    </div>
                    <button
                      onClick={() => setShowLinkPicker(v => !v)}
                      className="text-[11px] text-sky-700 hover:text-sky-900 font-semibold"
                    >
                      {showLinkPicker ? "Cancel" : "+ Link"}
                    </button>
                  </div>

                  {showLinkPicker && (
                    <div className="mb-2 bg-white border border-sky-200 rounded p-2 space-y-2">
                      <div className="flex gap-1">
                        <select
                          value={linkPickerType}
                          onChange={(e) => setLinkPickerType(e.target.value)}
                          className="text-[11px] border border-slate-200 rounded px-1 py-0.5"
                        >
                          <option value="RELATED">Related</option>
                          <option value="SUPERSEDES">Supersedes</option>
                          <option value="AMENDMENT">Amendment</option>
                          <option value="ATTACHMENT">Attachment</option>
                          <option value="REVISION_OF">Revision of</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Search documents…"
                          value={linkPickerQuery}
                          onChange={(e) => handleSearchLinkCandidates(e.target.value)}
                          className="flex-1 text-[11px] border border-slate-200 rounded px-2 py-0.5"
                        />
                      </div>
                      {linkPickerResults.length > 0 && (
                        <ul className="max-h-32 overflow-y-auto space-y-0.5">
                          {linkPickerResults.map((r) => (
                            <li key={r.id}>
                              <button
                                onClick={() => handleCreateLink(r.id)}
                                className="w-full text-left text-[11px] px-2 py-1 rounded hover:bg-sky-50 truncate"
                              >
                                {r.title}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {docLinks.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      No related documents linked.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {docLinks.map((l: any) => (
                        <li
                          key={l.id}
                          className="flex items-center justify-between bg-white border border-sky-100 rounded px-2 py-1 text-[11px]"
                        >
                          <button
                            onClick={() => {
                              const target = documents.find(d => d.id === l.relatedDocumentId);
                              if (target) setSelectedDoc(target);
                              else documentApi.get(l.relatedDocumentId).then(res => {
                                const d = res.data?.data ?? res.data;
                                if (d) setSelectedDoc(d);
                              }).catch(() => {});
                            }}
                            className="flex-1 text-left truncate hover:text-sky-700"
                          >
                            <span className="inline-block px-1 py-0.5 bg-sky-100 text-sky-700 rounded text-[9px] font-semibold mr-1">
                              {l.linkType}
                            </span>
                            <span
                              className={
                                l.direction === "INCOMING"
                                  ? "text-slate-500 italic"
                                  : "text-slate-800"
                              }
                            >
                              {l.direction === "INCOMING" ? "← " : "→ "}
                              {l.relatedDocumentTitle}
                            </span>
                          </button>
                          <button
                            onClick={() => handleDeleteLink(l.id)}
                            className="ml-1 text-slate-400 hover:text-red-600"
                            title="Remove link"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Email Info Section */}
              {selectedDoc.metadata && (selectedDoc.metadata as Record<string, unknown>)?.source === "email" && (
                <div className="px-4 pb-3">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                        Email Details
                      </span>
                      {selectedDoc.parentDocumentId && (
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-semibold">
                          Attachment
                        </span>
                      )}
                      {!selectedDoc.parentDocumentId && (
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-semibold">
                          Parent Email
                        </span>
                      )}
                    </div>

                    {/* Email metadata fields */}
                    {(() => {
                      const meta = selectedDoc.metadata as Record<string, unknown>;
                      return (
                        <div className="space-y-1.5 text-xs">
                          {meta.emailFrom && (
                            <div className="flex gap-2">
                              <span className="text-indigo-600 font-medium w-16 shrink-0">From:</span>
                              <span className="text-slate-700 truncate">{String(meta.emailFrom)}</span>
                            </div>
                          )}
                          {meta.emailTo && (
                            <div className="flex gap-2">
                              <span className="text-indigo-600 font-medium w-16 shrink-0">To:</span>
                              <span className="text-slate-700 truncate">{String(meta.emailTo)}</span>
                            </div>
                          )}
                          {meta.emailCc && (
                            <div className="flex gap-2">
                              <span className="text-indigo-600 font-medium w-16 shrink-0">CC:</span>
                              <span className="text-slate-700 truncate">{String(meta.emailCc)}</span>
                            </div>
                          )}
                          {meta.emailSubject && (
                            <div className="flex gap-2">
                              <span className="text-indigo-600 font-medium w-16 shrink-0">Subject:</span>
                              <span className="text-slate-700 truncate">{String(meta.emailSubject)}</span>
                            </div>
                          )}
                          {meta.emailDate && (
                            <div className="flex gap-2">
                              <span className="text-indigo-600 font-medium w-16 shrink-0">Date:</span>
                              <span className="text-slate-700">{formatDate(String(meta.emailDate))}</span>
                            </div>
                          )}
                          {meta.emailRule && (
                            <div className="flex gap-2">
                              <span className="text-indigo-600 font-medium w-16 shrink-0">Rule:</span>
                              <span className="text-slate-700">{String(meta.emailRule)}</span>
                            </div>
                          )}
                          {meta.emailConfig && (
                            <div className="flex gap-2">
                              <span className="text-indigo-600 font-medium w-16 shrink-0">Config:</span>
                              <span className="text-slate-700">{String(meta.emailConfig)}</span>
                            </div>
                          )}
                          {meta.ingestedAt && (
                            <div className="flex gap-2">
                              <span className="text-indigo-600 font-medium w-16 shrink-0">Ingested:</span>
                              <span className="text-slate-700">{formatDate(String(meta.ingestedAt))}</span>
                            </div>
                          )}
                          {typeof meta.emailAttachmentCount === "number" && meta.emailAttachmentCount > 0 && (
                            <div className="flex gap-2">
                              <span className="text-indigo-600 font-medium w-16 shrink-0">Files:</span>
                              <span className="text-slate-700">{String(meta.emailAttachmentCount)} attachment(s)</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Linked attachments (children of parent email) */}
                    {!selectedDoc.parentDocumentId && emailChildren.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-indigo-200">
                        <p className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide mb-1.5">
                          Attachments ({emailChildren.length})
                        </p>
                        <div className="space-y-1">
                          {emailChildren.map((child) => (
                            <button
                              key={child.id}
                              onClick={() => setSelectedDoc(child)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-white hover:bg-indigo-100 transition-colors text-left border border-indigo-100"
                            >
                              <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-slate-800 truncate font-medium">
                                  {child.title?.replace("[Attachment] ", "")}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {child.fileExtension?.toUpperCase()} &middot; {formatBytes(child.fileSizeBytes || 0)}
                                </p>
                              </div>
                              <Download className="h-3 w-3 text-indigo-400 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Link back to parent email (if this is an attachment) */}
                    {selectedDoc.parentDocumentId && emailParent && (
                      <div className="mt-3 pt-2 border-t border-indigo-200">
                        <p className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide mb-1.5">
                          Parent Email
                        </p>
                        <button
                          onClick={() => setSelectedDoc(emailParent)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-white hover:bg-indigo-100 transition-colors text-left border border-indigo-100"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-800 truncate font-medium">
                              {emailParent.title?.replace("[Email] ", "")}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              From: {(emailParent.metadata as Record<string, unknown>)?.emailFrom as string || "unknown"}
                            </p>
                          </div>
                          <ExternalLink className="h-3 w-3 text-indigo-400 shrink-0" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                        Editing in{" "}
                        {OFFICE_MIME_MAP[selectedDoc.mimeType || ""]?.label ||
                          "Word"}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-emerald-600">
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" /> {heartbeatCount}{" "}
                          heartbeats
                        </span>
                        <span>{editElapsed}</span>
                      </div>
                    </div>
                    {wordUrl ? (
                      <button
                        onClick={() => launchOfficeProtocol(wordUrl)}
                        className="block mt-2 w-full text-center px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                      >
                        📝 Open in{" "}
                        {OFFICE_MIME_MAP[selectedDoc.mimeType || ""]?.label ||
                          "Office"}
                      </button>
                    ) : (
                      <p className="text-xs text-emerald-600 mt-1">
                        Generating link...
                      </p>
                    )}
                    <button
                      onClick={() => openInWps(selectedDoc.id)}
                      className="block mt-1 w-full text-center px-4 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition-colors"
                    >
                      📄 Open in WPS Office
                    </button>
                    <p className="text-xs text-emerald-600 mt-1">
                      Lock held — edit locally, then Check In when done.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleCheckinEdited}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700"
                      >
                        <UploadCloud className="h-3.5 w-3.5" /> Check In Edited
                        File
                      </button>
                      <button
                        onClick={handleDoneEditing}
                        title="I finished editing in Word/WebDAV — my saves are already captured. Release the lock."
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 font-semibold"
                      >
                        ✓ Done
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs hover:bg-red-50"
                      >
                        Cancel Edit
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(selectedDoc)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                  >
                    <Download className="h-4 w-4" /> Download
                  </button>
                  {/* Smart Edit button: text → notepad, Office → respective app, others → hidden */}
                  {editingDocId !== selectedDoc.id &&
                    !isTextEditing &&
                    (() => {
                      const mime = selectedDoc.mimeType || "";
                      const isText =
                        mime.startsWith("text/") || mime === "application/json";
                      const officeMapping = OFFICE_MIME_MAP[mime];
                      const lockedByOther =
                        (selectedDoc.isCheckedOut || selectedDoc.checkedOut) &&
                        selectedDoc.checkedOutBy !== currentUser?.id;
                      if (isText)
                        return (
                          <button
                            onClick={handleEditText}
                            disabled={lockedByOther}
                            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-1 ${lockedByOther ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                            title={
                              lockedByOther
                                ? `Locked by ${selectedDoc.checkedOutByName || "another user"}`
                                : "Edit text content"
                            }
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        );
                      if (officeMapping)
                        return (
                          <button
                            onClick={() => handleEditInWord(selectedDoc)}
                            disabled={lockedByOther}
                            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-1 ${lockedByOther ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                            title={
                              lockedByOther
                                ? `Locked by ${selectedDoc.checkedOutByName || "another user"}`
                                : `Edit in ${officeMapping.label}`
                            }
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        );
                      return null;
                    })()}
                  <button
                    onClick={() => handleOpenInNewTab(selectedDoc)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                    title="Open in New Tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setShowVersions(true);
                    }}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                    title="Versions"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setShowNotes(true);
                    }}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                    title="Notes"
                  >
                    <StickyNote className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setShowWorkflow(true);
                    }}
                    className="px-4 py-2 border border-purple-300 text-purple-600 rounded-lg text-sm hover:bg-purple-50"
                    title="Start Workflow"
                  >
                    <GitBranch className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setShowAiPanel(true);
                    }}
                    className="px-4 py-2 border border-cyan-300 text-cyan-600 rounded-lg text-sm hover:bg-cyan-50"
                    title="AI Assistant"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setShowRetention(true);
                    }}
                    className="px-4 py-2 border border-emerald-300 text-emerald-600 rounded-lg text-sm hover:bg-emerald-50"
                    title="Retention & Compliance"
                  >
                    <Shield className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      handleRequestSignature(selectedDoc, "INTERNAL")
                    }
                    className="px-4 py-2 border border-violet-300 text-violet-600 rounded-lg text-sm hover:bg-violet-50"
                    title="Request Signature"
                  >
                    <PenTool className="h-4 w-4" />
                  </button>
                </div>
                {editingDocId !== selectedDoc.id && (
                  <>
                    {/* Checked-out-by-other info banner */}
                    {(selectedDoc.isCheckedOut || selectedDoc.checkedOut) &&
                      selectedDoc.checkedOutBy !== currentUser?.id && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                          <Lock className="h-4 w-4 flex-shrink-0" />
                          <span>
                            Checked out by{" "}
                            <strong>
                              {selectedDoc.checkedOutByName || "another user"}
                            </strong>
                            {selectedDoc.checkedOutAt && (
                              <>
                                {" "}
                                on{" "}
                                {new Date(
                                  selectedDoc.checkedOutAt
                                ).toLocaleString()}
                              </>
                            )}
                          </span>
                        </div>
                      )}
                    <div className="flex gap-2">
                      {!(selectedDoc.isCheckedOut || selectedDoc.checkedOut) ? (
                        <button
                          onClick={() => handleCheckout(selectedDoc)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm hover:bg-amber-50"
                        >
                          <Lock className="h-4 w-4" /> Check Out
                        </button>
                      ) : selectedDoc.checkedOutBy === currentUser?.id ? (
                        <>
                          <button
                            onClick={() => handleCheckinForCheckout(selectedDoc)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                          >
                            <UploadCloud className="h-4 w-4" /> Check In
                          </button>
                          <button
                            onClick={() => handleCancelCheckout(selectedDoc)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg text-sm hover:bg-green-50"
                          >
                            <Unlock className="h-4 w-4" /> Cancel Checkout
                          </button>
                        </>
                      ) : null}
                    </div>
                    {/* Legal Hold one-click toggle */}
                    <div className="mt-2">
                      <button
                        onClick={() => handleToggleLegalHold(selectedDoc)}
                        className={
                          selectedDoc.legalHold
                            ? "w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                            : "w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm hover:bg-red-50"
                        }
                        title={
                          selectedDoc.legalHold
                            ? `Under legal hold: ${selectedDoc.legalHoldReason || "(no reason recorded)"}`
                            : "Freeze this document from deletion / retention disposal"
                        }
                      >
                        <Shield className="h-4 w-4" />
                        {selectedDoc.legalHold
                          ? "Release Legal Hold"
                          : "Place on Legal Hold"}
                      </button>
                      {selectedDoc.legalHold && selectedDoc.legalHoldReason && (
                        <p className="mt-1 text-[11px] text-red-700 italic text-center">
                          Reason: {selectedDoc.legalHoldReason}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Styled Dialog (replaces all alert/confirm) */}
      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        {...dialogProps}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/* DOCUMENT WORKFLOW PANEL                             */
/* ═══════════════════════════════════════════════════ */
const statusColors: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  REVIEW: "bg-blue-100 text-blue-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CORRECTION: "bg-orange-100 text-orange-700",
  ARCHIVED: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-slate-200 text-slate-500",
  ESCALATED: "bg-pink-100 text-pink-700"
};

function DocumentWorkflowPanel({
  document: doc,
  projectId,
  userRoles,
  userId,
  onClose
}: {
  document: Document;
  projectId?: string;
  userRoles: string[];
  userId?: string;
  onClose: () => void;
}) {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [selectedDefId, setSelectedDefId] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startSuccess, setStartSuccess] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [transitionMsg, setTransitionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expandedInst, setExpandedInst] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, any[]>>({});
  const [projectDefaultWfId, setProjectDefaultWfId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<{ instanceId: string; action: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showPeerReview, setShowPeerReview] = useState<string | null>(null);
  const [peerReviewComment, setPeerReviewComment] = useState("");
  const [peerReviewLoading, setPeerReviewLoading] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState("");
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [changingWorkflow, setChangingWorkflow] = useState(false);

  const hasActiveWorkflow = instances.some((inst) =>
    !["ARCHIVED", "CANCELLED", "REJECTED"].includes(inst.currentState)
  );

  const reloadInstances = async () => {
    const res = await workflowApi.getByDocument(doc.id);
    setInstances(res.data?.data ?? res.data ?? []);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [defRes, instRes] = await Promise.all([
          workflowApi.getDefinitions(),
          workflowApi.getByDocument(doc.id)
        ]);
        const defs = defRes.data?.data ?? defRes.data ?? [];
        setDefinitions(defs);
        setInstances(instRes.data?.data ?? instRes.data ?? []);

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
    setStartSuccess(false);
    setStartError(null);
    try {
      await workflowApi.startInstance({
        documentId: doc.id,
        definitionId: selectedDefId,
        projectId: projectId,
        projectDefaultWorkflowId: projectDefaultWfId || undefined
      });
      await reloadInstances();
      setStartSuccess(true);
      setChangingWorkflow(false);
      setTimeout(() => setStartSuccess(false), 4000);
    } catch (err: any) {
      setStartError(err?.response?.data?.message || "Failed to start workflow");
    }
    setStarting(false);
  };

  /* Check if current user has the required role for a transition */
  const userCanPerform = (requiredRole?: string) => {
    if (!requiredRole) return true;
    // Map role names — backend stores AUTHOR, frontend may have ROLE_AUTHOR or just AUTHOR
    const normalizedUserRoles = userRoles.map((r) => r.replace(/^ROLE_/, "").toUpperCase());
    const normalized = requiredRole.replace(/^ROLE_/, "").toUpperCase();
    // SYSTEM_ADMIN can do everything
    if (normalizedUserRoles.includes("SYSTEM_ADMIN") || normalizedUserRoles.includes("ADMIN")) return true;
    return normalizedUserRoles.includes(normalized);
  };

  /* Get available transitions filtered by user role */
  const getAvailableTransitions = (inst: WorkflowInstance) => {
    const def = definitions.find((d) => d.id === inst.definitionId);
    if (!def?.transitions) return [];
    const state = inst.currentState || inst.currentStatus;
    return def.transitions.filter((t) => t.from === state);
  };

  /* Perform a workflow transition */
  const handleTransition = async (instanceId: string, action: string, comments?: string) => {
    setTransitioning(`${instanceId}-${action}`);
    setTransitionMsg(null);
    try {
      await workflowApi.transition(instanceId, action, comments);
      await reloadInstances();
      if (expandedInst === instanceId) {
        const hRes = await workflowApi.getHistory(instanceId);
        setHistories((prev) => ({ ...prev, [instanceId]: hRes.data?.data ?? hRes.data ?? [] }));
      }
      setTransitionMsg({ type: "success", text: `Action "${action.replace(/_/g, " ")}" completed` });
      setTimeout(() => setTransitionMsg(null), 4000);
    } catch (err: any) {
      setTransitionMsg({
        type: "error",
        text: err?.response?.data?.message || err?.response?.data?.error || `Failed to ${action}`
      });
    }
    setTransitioning(null);
  };

  /* Handle reject with reason */
  const handleReject = async () => {
    if (!showRejectModal || !rejectReason.trim()) return;
    await handleTransition(showRejectModal.instanceId, showRejectModal.action, rejectReason.trim());
    setShowRejectModal(null);
    setRejectReason("");
  };

  /* Load project members for reviewer picker */
  const loadProjectMembers = async () => {
    if (projectMembers.length > 0) return;
    setMembersLoading(true);
    try {
      const res = projectId
        ? await projectApi.getMembers(projectId)
        : null;
      const members = res?.data?.data ?? res?.data ?? [];
      // Filter out the current user
      setProjectMembers(members.filter((m: any) => m.userId !== userId));
    } catch { setProjectMembers([]); }
    setMembersLoading(false);
  };

  /* Handle peer review request — sends to the dedicated peer-review endpoint */
  const handleRequestPeerReview = async (instanceId: string) => {
    if (!selectedReviewer) {
      setTransitionMsg({ type: "error", text: "Please select a reviewer" });
      return;
    }
    setPeerReviewLoading(true);
    setTransitionMsg(null);
    try {
      await workflowApi.requestPeerReview(instanceId, selectedReviewer, peerReviewComment || undefined);
      await reloadInstances();
      setTransitionMsg({ type: "success", text: "Peer review requested" });
      setTimeout(() => setTransitionMsg(null), 4000);
    } catch (err: any) {
      setTransitionMsg({
        type: "error",
        text: err?.response?.data?.message || "Failed to request peer review"
      });
    }
    setPeerReviewLoading(false);
    setShowPeerReview(null);
    setPeerReviewComment("");
    setSelectedReviewer("");
  };

  /* Load history for an instance */
  const toggleHistory = async (instanceId: string) => {
    if (expandedInst === instanceId) {
      setExpandedInst(null);
      return;
    }
    setExpandedInst(instanceId);
    if (!histories[instanceId]) {
      try {
        const res = await workflowApi.getHistory(instanceId);
        setHistories((prev) => ({ ...prev, [instanceId]: res.data?.data ?? res.data ?? [] }));
      } catch { /* ignore */ }
    }
  };

  /* Action button styling */
  const actionStyle: Record<string, string> = {
    submit: "bg-blue-600 hover:bg-blue-700 text-white",
    approve: "bg-green-600 hover:bg-green-700 text-white",
    reject: "bg-red-600 hover:bg-red-700 text-white",
    archive: "bg-slate-600 hover:bg-slate-700 text-white",
    revise: "bg-amber-600 hover:bg-amber-700 text-white",
    resubmit: "bg-teal-600 hover:bg-teal-700 text-white",
    request_correction: "bg-orange-600 hover:bg-orange-700 text-white",
  };

  const actionIcon: Record<string, string> = {
    submit: "→",
    approve: "✓",
    reject: "✕",
    archive: "📦",
    resubmit: "↩",
    revise: "✏",
    request_correction: "⚠",
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
            {/* Start or Change Workflow */}
            {(!hasActiveWorkflow || changingWorkflow) ? (
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">
                    {hasActiveWorkflow ? "Change Workflow" : "Start Workflow"}
                  </h4>
                  {changingWorkflow && (
                    <button
                      onClick={() => setChangingWorkflow(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >Cancel</button>
                  )}
                </div>
                {projectDefaultWfId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <p className="text-xs text-blue-700">
                      Project default workflow is pre-selected.
                    </p>
                  </div>
                )}
                <select
                  value={selectedDefId}
                  onChange={(e) => setSelectedDefId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="">Select workflow type...</option>
                  {definitions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.id === projectDefaultWfId ? " (Project Default)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleStart}
                  disabled={starting || !selectedDefId}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {starting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {hasActiveWorkflow ? "Start New Workflow" : "Start Workflow"}
                </button>
                {startSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <p className="text-xs text-green-700 font-medium">Workflow started successfully!</p>
                  </div>
                )}
                {startError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                    <p className="text-xs text-red-700 font-medium">{startError}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600">Workflow Active</p>
                  <p className="text-[10px] text-slate-400">A workflow is running on this document</p>
                </div>
                <button
                  onClick={() => setChangingWorkflow(true)}
                  className="px-3 py-1.5 text-xs font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50"
                >
                  Change Workflow
                </button>
              </div>
            )}

            {/* Existing workflows */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">
                {hasActiveWorkflow ? "Workflow Progress" : "Workflows"} ({instances.length})
              </h4>
              {transitionMsg && (
                <div className={`rounded-lg p-2 flex items-center gap-2 mb-3 ${transitionMsg.type === "success"
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                  }`}>
                  {transitionMsg.type === "success"
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    : <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />}
                  <p className={`text-xs font-medium ${transitionMsg.type === "success" ? "text-green-700" : "text-red-700"
                    }`}>{transitionMsg.text}</p>
                </div>
              )}
              {instances.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No workflows for this document
                </p>
              ) : (
                <div className="space-y-3">
                  {instances.map((inst) => {
                    const allTransitions = getAvailableTransitions(inst);
                    const myTransitions = allTransitions.filter((t) => userCanPerform(t.requiredRole));
                    const blockedTransitions = allTransitions.filter((t) => !userCanPerform(t.requiredRole));
                    const isTerminal = ["ARCHIVED", "CANCELLED", "REJECTED"].includes(inst.currentState);
                    const isReviewState = ["REVIEW", "PENDING_APPROVAL"].includes(inst.currentState);
                    const historyItems = histories[inst.id] || [];
                    return (
                      <div
                        key={inst.id}
                        className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                      >
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColors[inst.currentState] || "bg-slate-100"}`}
                            >
                              {(inst.currentState ?? "UNKNOWN").replace(/_/g, " ")}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {inst.createdAt
                                ? new Date(inst.createdAt).toLocaleDateString()
                                : ""}
                            </span>
                          </div>
                          {inst.definitionName && (
                            <p className="text-xs text-slate-500 mb-3">
                              {inst.definitionName}
                            </p>
                          )}

                          {/* Action buttons for current user */}
                          {!isTerminal && myTransitions.length > 0 && (
                            <div className="space-y-2 mb-2">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Your Actions</p>
                              <div className="flex flex-wrap gap-1.5">
                                {myTransitions.map((t) => {
                                  const isReject = t.action.toLowerCase() === "reject";
                                  return (
                                    <button
                                      key={t.action}
                                      onClick={() => {
                                        if (isReject) {
                                          setShowRejectModal({ instanceId: inst.id, action: t.action });
                                          setRejectReason("");
                                        } else {
                                          handleTransition(inst.id, t.action);
                                        }
                                      }}
                                      disabled={transitioning !== null}
                                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 ${actionStyle[t.action.toLowerCase()] || "bg-primary-600 hover:bg-primary-700 text-white"
                                        }`}
                                    >
                                      {transitioning === `${inst.id}-${t.action}` ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <span className="text-[10px]">{actionIcon[t.action.toLowerCase()] || "▶"}</span>
                                      )}
                                      {t.action.replace(/_/g, " ")}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Peer Review button — shown in REVIEW or PENDING_APPROVAL states */}
                          {!isTerminal && isReviewState && (
                            <div className="mb-2">
                              {showPeerReview === inst.id ? (
                                <div className="bg-indigo-50 rounded-lg p-3 space-y-2 border border-indigo-200">
                                  <p className="text-xs font-semibold text-indigo-700">Request Peer Review</p>
                                  {/* Reviewer selector */}
                                  <div>
                                    <label className="block text-[10px] font-medium text-indigo-600 mb-1">Select Reviewer</label>
                                    {membersLoading ? (
                                      <div className="flex items-center gap-1.5 text-xs text-indigo-400 py-1">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Loading members...
                                      </div>
                                    ) : projectMembers.length === 0 ? (
                                      <p className="text-[10px] text-slate-400">No project members available. Ensure document belongs to a project.</p>
                                    ) : (
                                      <select
                                        value={selectedReviewer}
                                        onChange={(e) => setSelectedReviewer(e.target.value)}
                                        className="w-full px-2.5 py-1.5 border border-indigo-200 rounded-md text-xs focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
                                      >
                                        <option value="">-- Choose a reviewer --</option>
                                        {projectMembers.map((m: any) => (
                                          <option key={m.userId} value={m.userId}>
                                            {m.fullName || m.username} ({m.roleName?.replace(/_/g, " ")})
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                  <textarea
                                    value={peerReviewComment}
                                    onChange={(e) => setPeerReviewComment(e.target.value)}
                                    placeholder="Add review notes (optional)..."
                                    rows={2}
                                    className="w-full px-2.5 py-1.5 border border-indigo-200 rounded-md text-xs focus:ring-2 focus:ring-indigo-400 outline-none resize-none"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleRequestPeerReview(inst.id)}
                                      disabled={peerReviewLoading || !selectedReviewer}
                                      className="flex-1 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                      {peerReviewLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                                      Send Review Request
                                    </button>
                                    <button
                                      onClick={() => { setShowPeerReview(null); setPeerReviewComment(""); setSelectedReviewer(""); }}
                                      className="px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-md text-xs font-medium hover:bg-indigo-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setShowPeerReview(inst.id); loadProjectMembers(); }}
                                  className="w-full px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-md text-xs font-medium hover:bg-indigo-50 flex items-center justify-center gap-1.5"
                                >
                                  <Eye className="h-3 w-3" />
                                  Request Peer Review
                                </button>
                              )}
                            </div>
                          )}

                          {/* Show transitions user cannot perform (informational) */}
                          {!isTerminal && blockedTransitions.length > 0 && myTransitions.length === 0 && (
                            <div className="bg-slate-50 rounded-md p-2 mb-2">
                              <p className="text-[10px] text-slate-400 mb-1">
                                Waiting for another role to act:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {blockedTransitions.map((t) => (
                                  <span key={t.action} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500">
                                    {t.action.replace(/_/g, " ")}
                                    {t.requiredRole && (
                                      <span className="text-amber-500 font-medium">
                                        ({t.requiredRole.replace(/_/g, " ")})
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {isTerminal && (
                            <p className="text-xs text-slate-400 italic flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Workflow complete
                            </p>
                          )}
                        </div>

                        {/* History toggle */}
                        <button
                          onClick={() => toggleHistory(inst.id)}
                          className="w-full px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 hover:bg-slate-100 flex items-center justify-center gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          {expandedInst === inst.id ? "Hide" : "Show"} History
                          <ChevronRight className={`h-3 w-3 transition-transform ${expandedInst === inst.id ? "rotate-90" : ""}`} />
                        </button>

                        {/* History timeline */}
                        {expandedInst === inst.id && (
                          <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 max-h-48 overflow-y-auto">
                            {historyItems.length === 0 ? (
                              <p className="text-xs text-slate-400 text-center py-2">No history yet</p>
                            ) : (
                              <div className="space-y-2">
                                {historyItems.map((h: any, i: number) => (
                                  <div key={i} className="flex gap-2">
                                    <div className="flex flex-col items-center">
                                      <div className="h-2 w-2 rounded-full bg-purple-400 mt-1.5" />
                                      {i < historyItems.length - 1 && (
                                        <div className="w-px flex-1 bg-slate-200" />
                                      )}
                                    </div>
                                    <div className="flex-1 pb-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-semibold text-slate-600">
                                          {(h.fromState || "START").replace(/_/g, " ")}
                                        </span>
                                        <ChevronRight className="h-2.5 w-2.5 text-slate-400" />
                                        <span className="text-[10px] font-semibold text-slate-600">
                                          {(h.toState || "").replace(/_/g, " ")}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-400">
                                        {h.action?.replace(/_/g, " ")}
                                        {h.comments && ` — ${h.comments}`}
                                      </p>
                                      <p className="text-[9px] text-slate-300">
                                        {h.createdAt ? new Date(h.createdAt).toLocaleString() : ""}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Reject Document</h4>
                <p className="text-[10px] text-slate-400">The author will be asked to make corrections</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reason for rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain what needs to be corrected..."
                rows={4}
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || transitioning !== null}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {transitioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Reject
              </button>
              <button
                onClick={() => { setShowRejectModal(null); setRejectReason(""); }}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────── */
/* DOCUMENT AI PANEL                                   */
/* ─────────────────────────────────────────────────── */
function DocumentAiPanel({
  document: doc,
  onClose
}: {
  document: Document;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"ask" | "saved">("ask");
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "ai"; text: string; pairId?: string; q?: string; saved?: boolean }[]>([]);
  const [askLoading, setAskLoading] = useState(false);
  const [docContent, setDocContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedConvos, setSavedConvos] = useState<any[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadSaved = async () => {
    setSavedLoading(true);
    try {
      const r = await documentConversationApi.listForDocument(doc.id);
      setSavedConvos(r.data?.data ?? r.data ?? []);
    } catch { /* silent */ }
    setSavedLoading(false);
  };

  useEffect(() => { if (tab === "saved") loadSaved(); /* eslint-disable-next-line */ }, [tab, doc.id]);

  // Load document content on mount
  useEffect(() => {
    const fetchContent = async () => {
      setContentLoading(true);
      try {
        const res = await documentApi.getContent(doc.id);
        const raw = res.data?.data ?? res.data;
        // Backend returns {content: "text"} — extract the text
        if (typeof raw === "string" && raw.trim()) {
          setDocContent(raw);
        } else if (raw && typeof raw === "object" && typeof raw.content === "string" && raw.content.trim()) {
          setDocContent(raw.content);
        } else if (raw) {
          setDocContent(JSON.stringify(raw));
        } else {
          // Primary endpoint returned empty — try redacted content as fallback
          throw new Error("empty");
        }
      } catch (e: any) {
        // Fallback: try redacted content endpoint (uses Tika-extracted text)
        try {
          const res2 = await documentApi.getRedactedContent(doc.id);
          const raw2 = res2.data?.data ?? res2.data;
          const text = typeof raw2 === "string" ? raw2 : raw2?.content;
          if (text && typeof text === "string" && text.trim() && text !== "Redacted preview not available") {
            setDocContent(text);
          } else {
            setError("No text content available. The document may not have been processed yet.");
          }
        } catch {
          setError("Could not load document content. The document may not have been processed yet.");
        }
      }
      setContentLoading(false);
    };
    fetchContent();
  }, [doc.id]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSummarize = async () => {
    if (!docContent) return;
    setSummaryLoading(true);
    setError(null);
    try {
      const res = await aiApi.summarize(docContent, doc.title || doc.filename);
      const data = res.data?.data ?? res.data;
      setSummary(data?.summary || "No summary generated.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to generate summary. Is Ollama running?");
    }
    setSummaryLoading(false);
  };

  const handleAsk = async () => {
    if (!docContent || !question.trim()) return;
    const q = question.trim();
    const pairId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setQuestion("");
    setChatHistory((prev) => [...prev, { role: "user", text: q, pairId, q }]);
    setAskLoading(true);
    setError(null);
    try {
      const res = await aiApi.ask(docContent, doc.title || doc.filename, q);
      const data = res.data?.data ?? res.data;
      setChatHistory((prev) => [...prev, { role: "ai", text: data?.answer || "No answer.", pairId, q }]);
    } catch (err: any) {
      setChatHistory((prev) => [...prev, { role: "ai", text: "Error: " + (err?.response?.data?.message || "AI unavailable"), pairId, q }]);
    }
    setAskLoading(false);
  };

  const saveQA = async (pairId: string, q: string, answer: string) => {
    try {
      await documentConversationApi.save(doc.id, {
        versionId: null,
        title: q.length > 80 ? q.slice(0, 77) + "…" : q,
        question: q,
        answer,
      });
      setChatHistory((prev) => prev.map((m) => (m.pairId === pairId ? { ...m, saved: true } : m)));
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not save");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-500" />
            <h3 className="font-semibold text-slate-800">AI Document Assistant</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Document info */}
          <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-600 truncate">{doc.title || doc.filename}</span>
            {contentLoading && <Loader2 className="h-3 w-3 animate-spin text-slate-400 ml-auto" />}
            {docContent && <span className="text-[10px] text-green-500 ml-auto">Content loaded</span>}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 text-xs">
            <button
              onClick={() => setTab("ask")}
              className={`flex-1 px-3 py-1.5 rounded-md font-medium transition-colors ${
                tab === "ask" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Ask
            </button>
            <button
              onClick={() => setTab("saved")}
              className={`flex-1 px-3 py-1.5 rounded-md font-medium transition-colors ${
                tab === "saved" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Conversations {savedConvos.length > 0 && <span className="ml-1 text-slate-400">({savedConvos.length})</span>}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">
              {error}
            </div>
          )}

          {tab === "saved" ? (
            <div className="border border-slate-200 rounded-lg">
              <div className="px-3 py-2 bg-slate-50 rounded-t-lg flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Saved questions on this document</span>
                <button
                  onClick={() => setTab("ask")}
                  className="px-2 py-1 bg-indigo-600 text-white text-[11px] rounded-md hover:bg-indigo-700 inline-flex items-center gap-1"
                >
                  <MessageSquare className="h-3 w-3" /> Ask new
                </button>
              </div>
              {savedLoading ? (
                <div className="px-3 py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : savedConvos.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-slate-400">
                  No saved conversations yet. Ask a question and save the answer so others don&apos;t need to ask the same question again.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                  {savedConvos.map((c: any) => (
                    <div key={c.id} className="px-3 py-3 text-xs">
                      <div className="font-semibold text-slate-800">{c.title || c.question}</div>
                      <div className="text-slate-500 mt-1 italic">Q: {c.question}</div>
                      <div className="text-slate-700 mt-1 whitespace-pre-wrap">A: {c.answer}</div>
                      <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-2">
                        <span>{c.asked_by_name || "—"}</span>
                        <span>·</span>
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                        {c.version_number != null && (
                          <span className="ml-auto text-slate-500">v{c.version_number}</span>
                        )}
                        <button
                          onClick={async () => {
                            if (!confirm("Remove this saved Q&A?")) return;
                            await documentConversationApi.delete(c.id);
                            loadSaved();
                          }}
                          className="ml-auto text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
          <>
          {/* Summary section */}
          <div className="border border-cyan-200 rounded-lg">
            <div className="flex items-center justify-between px-3 py-2 bg-cyan-50 rounded-t-lg">
              <span className="text-xs font-semibold text-cyan-700">Document Summary</span>
              <button
                onClick={handleSummarize}
                disabled={summaryLoading || !docContent}
                className="px-3 py-1 bg-cyan-600 text-white text-xs rounded-md hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {summaryLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {summary ? "Regenerate" : "Generate Summary"}
              </button>
            </div>
            {summary && (
              <div className="px-3 py-2 text-sm text-slate-700 leading-relaxed">
                {summary}
              </div>
            )}
            {!summary && !summaryLoading && (
              <div className="px-3 py-3 text-xs text-slate-400 text-center">
                Click &quot;Generate Summary&quot; to get an AI-powered summary of this document.
              </div>
            )}
            {summaryLoading && (
              <div className="px-3 py-4 flex items-center justify-center gap-2 text-xs text-cyan-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing document...
              </div>
            )}
          </div>

          {/* Q&A section */}
          <div className="border border-indigo-200 rounded-lg flex flex-col">
            <div className="px-3 py-2 bg-indigo-50 rounded-t-lg">
              <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" /> Ask About This Document
              </span>
            </div>
            {/* Chat history */}
            <div className="max-h-60 overflow-y-auto px-3 py-2 space-y-2">
              {chatHistory.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">
                  Ask any question about this document and the AI will answer based on its content.
                </p>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700"
                    }`}>
                    {msg.text}
                    {msg.role === "ai" && msg.pairId && msg.q && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        {msg.saved ? (
                          <span className="text-[10px] text-green-600 inline-flex items-center gap-1">
                            <Check className="h-3 w-3" /> Saved to document
                          </span>
                        ) : (
                          <button
                            onClick={() => saveQA(msg.pairId!, msg.q!, msg.text)}
                            className="text-[10px] text-indigo-600 hover:underline inline-flex items-center gap-1"
                          >
                            <Bookmark className="h-3 w-3" /> Save Q&amp;A
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {askLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-lg px-3 py-2 text-xs text-slate-400 flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {/* Input */}
            <div className="flex gap-2 px-3 py-2 border-t border-indigo-100">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
                placeholder="Ask a question..."
                disabled={askLoading || !docContent}
                className="flex-1 px-3 py-1.5 border border-indigo-200 rounded-md text-xs focus:ring-2 focus:ring-indigo-400 outline-none disabled:opacity-50"
              />
              <button
                onClick={handleAsk}
                disabled={askLoading || !question.trim() || !docContent}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
              >
                {askLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Ask
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
