'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { projectApi, authApi, documentApi, workflowApi, jurisdictionApi, pluginApi } from '@/lib/api';
import { useProjectStore } from '@/lib/project-store';
import { useAuthStore } from '@/lib/auth-store';
import type { Project, ProjectMember, User, Document, Folder, WorkflowDefinition, Jurisdiction, JurisdictionRetentionRule, ProjectPluginStatus, Role } from '@/lib/types';
import { formatDateTime, formatBytes, getFileIcon } from '@/lib/utils';
import {
  FolderKanban, Plus, Users, FileText, Settings, ArrowLeft, X,
  ChevronRight, Home, Upload, FolderPlus, Download, UserPlus, UserMinus,
  Eye, Trash2, GitBranch, Save, Loader2, CheckCircle2, Info, Shield,
  Clock, Lock, AlertTriangle, BookOpen, Plug, Power, PowerOff, Brain, Layers, Pencil, Check,
} from 'lucide-react';
import UploadModal from '@/components/documents/UploadModal';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { setActiveProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentFolder, setCurrentFolder] = useState<string | undefined>();
  const [breadcrumbs, setBreadcrumbs] = useState<{ id?: string; name: string }[]>([{ name: 'Root' }]);

  // Modals
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [addMemberForm, setAddMemberForm] = useState({ userId: '', roleId: '', permissions: ['READ', 'WRITE'] });
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'documents' | 'members' | 'sub-projects' | 'plugins' | 'workflow' | 'retention' | 'settings'>('documents');

  // Sub-projects
  const [subProjects, setSubProjects] = useState<Project[]>([]);
  const [subProjectsLoading, setSubProjectsLoading] = useState(false);
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [subForm, setSubForm] = useState({ name: '', description: '', aiEnabled: true });
  const [subCreateLoading, setSubCreateLoading] = useState(false);

  // AI toggle
  const [togglingAi, setTogglingAi] = useState(false);

  // Plugin management
  const [projectPlugins, setProjectPlugins] = useState<ProjectPluginStatus[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [togglingPlugin, setTogglingPlugin] = useState<string | null>(null);

  // Workflow settings
  const [workflowDefs, setWorkflowDefs] = useState<WorkflowDefinition[]>([]);
  const [selectedWfId, setSelectedWfId] = useState<string>('');
  const [savingWf, setSavingWf] = useState(false);
  const [wfSaved, setWfSaved] = useState(false);
  const [wfLoading, setWfLoading] = useState(false);

  // Retention & Compliance
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [retentionRules, setRetentionRules] = useState<JurisdictionRetentionRule[]>([]);
  const [retentionForm, setRetentionForm] = useState({
    defaultRetentionPeriodYears: 0,
    retentionDocumentTypes: [] as string[],
    jurisdictionCode: '',
    privacyRedactionEnabled: false,
    complianceCategory: '',
  });
  const [savingRetention, setSavingRetention] = useState(false);
  const [retentionSaved, setRetentionSaved] = useState(false);
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [newDocType, setNewDocType] = useState('');
  const documentCategories = ['CONTRACT', 'TAX', 'HR', 'PERSONAL_DATA', 'FINANCIAL', 'MEDICAL', 'LEGAL', 'INVOICE', 'REPORT', 'POLICY'];

  const permissionOptions = ['READ', 'WRITE', 'DELETE', 'MANAGE', 'APPROVE', 'AI_INVOKE', 'EXPORT', 'ADMIN'];

  const currentUser = useAuthStore(s => s.user);
  const currentMember = members.find(m => m.userId === currentUser?.id);
  const currentPerms = currentMember?.effectivePermissions ?? currentMember?.permissions ?? [];
  const isProjectAdmin = project?.ownerId === currentUser?.id || currentPerms.includes('ADMIN') || currentPerms.includes('MANAGE');
  const canWrite = isProjectAdmin || currentPerms.includes('WRITE');

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, membRes] = await Promise.all([
        projectApi.get(projectId),
        projectApi.getMembers(projectId),
      ]);
      setProject(projRes.data?.data ?? projRes.data);
      setMembers(membRes.data?.data ?? membRes.data ?? []);
    } catch { router.push('/projects'); }
    setLoading(false);
  }, [projectId, router]);

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const [docRes, folderRes] = await Promise.all([
        currentFolder
          ? documentApi.listByProject(projectId, currentFolder, page, 20)
          : documentApi.listByProject(projectId, undefined, page, 20),
        documentApi.getFoldersByProject(projectId, currentFolder),
      ]);
      const docData = docRes.data?.data ?? docRes.data;
      setDocuments(docData?.content ?? []);
      setTotalPages(docData?.totalPages ?? 0);
      setFolders(folderRes.data?.data ?? folderRes.data ?? []);
    } catch (err) { console.error('[ProjectDetail] loadDocuments failed:', err); }
    setDocsLoading(false);
  }, [projectId, currentFolder, page]);

  useEffect(() => { loadProject(); }, [loadProject]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // Load plugins when plugins tab is active
  useEffect(() => {
    if (activeTab !== 'plugins') return;
    setPluginsLoading(true);
    projectApi.getPlugins(projectId).then(res => {
      setProjectPlugins(res.data?.data ?? res.data ?? []);
    }).catch(() => {}).finally(() => setPluginsLoading(false));
  }, [activeTab, projectId]);

  // Load sub-projects when sub-projects tab is active
  useEffect(() => {
    if (activeTab !== 'sub-projects') return;
    setSubProjectsLoading(true);
    projectApi.getSubProjects(projectId).then(res => {
      setSubProjects(res.data?.data ?? res.data ?? []);
    }).catch(() => {}).finally(() => setSubProjectsLoading(false));
  }, [activeTab, projectId]);

  // Load workflow definitions when workflow tab is active
  useEffect(() => {
    if (activeTab !== 'workflow') return;
    setWfLoading(true);
    workflowApi.getDefinitions().then(res => {
      const defs: WorkflowDefinition[] = res.data?.data ?? res.data ?? [];
      setWorkflowDefs(defs.filter((d: WorkflowDefinition) => d.isActive !== false));
    }).catch(() => {}).finally(() => setWfLoading(false));
  }, [activeTab]);

  // Sync selected workflow from project data
  useEffect(() => {
    if (project?.defaultWorkflowDefinitionId) {
      setSelectedWfId(project.defaultWorkflowDefinitionId);
    }
  }, [project?.defaultWorkflowDefinitionId]);

  // Load jurisdictions & rules when retention tab is active
  useEffect(() => {
    if (activeTab !== 'retention') return;
    setRetentionLoading(true);
    Promise.all([
      jurisdictionApi.getJurisdictions(),
      jurisdictionApi.getAllRules(),
    ]).then(([jRes, rRes]) => {
      setJurisdictions(jRes.data?.data ?? jRes.data ?? []);
      setRetentionRules(rRes.data?.data ?? rRes.data ?? []);
    }).catch(() => {}).finally(() => setRetentionLoading(false));
  }, [activeTab]);

  // Sync retention form from project data
  useEffect(() => {
    if (project) {
      setRetentionForm({
        defaultRetentionPeriodYears: project.defaultRetentionPeriodYears ?? 0,
        retentionDocumentTypes: project.retentionDocumentTypes ?? [],
        jurisdictionCode: project.jurisdictionCode ?? '',
        privacyRedactionEnabled: project.privacyRedactionEnabled ?? false,
        complianceCategory: project.complianceCategory ?? '',
      });
    }
  }, [project]);

  const handleSaveDefaultWorkflow = async () => {
    if (!project) return;
    setSavingWf(true);
    setWfSaved(false);
    try {
      await projectApi.update(projectId, { name: project.name, defaultWorkflowDefinitionId: selectedWfId || null });
      const res = await projectApi.get(projectId);
      setProject(res.data?.data ?? res.data);
      setWfSaved(true);
      setTimeout(() => setWfSaved(false), 3000);
    } catch { alert('Failed to save workflow setting'); }
    setSavingWf(false);
  };

  const handleSaveRetention = async () => {
    if (!project) return;
    setSavingRetention(true);
    setRetentionSaved(false);
    try {
      await projectApi.update(projectId, {
        name: project.name,
        defaultRetentionPeriodYears: retentionForm.defaultRetentionPeriodYears || undefined,
        retentionDocumentTypes: retentionForm.retentionDocumentTypes.length > 0 ? retentionForm.retentionDocumentTypes : undefined,
        jurisdictionCode: retentionForm.jurisdictionCode || undefined,
        privacyRedactionEnabled: retentionForm.privacyRedactionEnabled,
        complianceCategory: retentionForm.complianceCategory || undefined,
      });
      const res = await projectApi.get(projectId);
      setProject(res.data?.data ?? res.data);
      setRetentionSaved(true);
      setTimeout(() => setRetentionSaved(false), 3000);
    } catch { alert('Failed to save retention settings'); }
    setSavingRetention(false);
  };

  const navigateToFolder = (folderId: string, folderName: string) => {
    setCurrentFolder(folderId);
    setBreadcrumbs(prev => [...prev, { id: folderId, name: folderName }]);
    setPage(0);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === 0) {
      setCurrentFolder(undefined);
      setBreadcrumbs([{ name: 'Root' }]);
    } else {
      const crumb = breadcrumbs[index];
      setCurrentFolder(crumb.id);
      setBreadcrumbs(prev => prev.slice(0, index + 1));
    }
    setPage(0);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await documentApi.createFolder({ name: newFolderName.trim(), parentId: currentFolder, projectId });
      setShowNewFolder(false);
      setNewFolderName('');
      loadDocuments();
    } catch { alert('Failed to create folder'); }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const res = await documentApi.download(doc.id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title}.${doc.fileExtension || 'bin'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed'); }
  };

  const openAddMember = async () => {
    setShowAddMember(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([authApi.getUsers(0, 100), authApi.getRoles()]);
      const uData = usersRes.data?.data ?? usersRes.data;
      setUsers(uData?.content ?? uData ?? []);
      const rData = rolesRes.data?.data ?? rolesRes.data;
      const rolesList = Array.isArray(rData) ? rData : rData?.content ?? [];
      setRoles(rolesList);
      if (rolesList.length > 0 && !addMemberForm.roleId) {
        const viewerRole = rolesList.find((r: Role) => r.name === 'VIEWER');
        setAddMemberForm(f => ({ ...f, roleId: (viewerRole ?? rolesList[0]).id }));
      }
    } catch { /* ignore */ }
  };

  const handleAddMember = async () => {
    if (!addMemberForm.userId) return;
    setAddMemberLoading(true);
    try {
      await projectApi.addMember(projectId, addMemberForm);
      setShowAddMember(false);
      setAddMemberForm({ userId: '', roleId: '', permissions: ['READ', 'WRITE'] });
      const res = await projectApi.getMembers(projectId);
      setMembers(res.data?.data ?? res.data ?? []);
    } catch { alert('Failed to add member'); }
    setAddMemberLoading(false);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member from the project?')) return;
    try {
      await projectApi.removeMember(projectId, userId);
      const res = await projectApi.getMembers(projectId);
      setMembers(res.data?.data ?? res.data ?? []);
    } catch { alert('Failed to remove member'); }
  };

  const startEditPerms = (m: ProjectMember) => {
    setEditingMemberId(m.userId);
    setEditPerms([...(m.effectivePermissions ?? m.permissions ?? [])]);
  };

  const handleSavePerms = async (userId: string) => {
    try {
      await projectApi.updateMember(projectId, userId, editPerms);
      const res = await projectApi.getMembers(projectId);
      setMembers(res.data?.data ?? res.data ?? []);
      setEditingMemberId(null);
    } catch { alert('Failed to update permissions'); }
  };

  const openInDocuments = () => {
    if (project) {
      setActiveProject(project);
      router.push('/documents');
    }
  };

  const toggleProjectPlugin = async (plugin: ProjectPluginStatus) => {
    setTogglingPlugin(plugin.pluginId);
    try {
      if (plugin.activeInProject) {
        await projectApi.deactivatePlugin(projectId, plugin.pluginId);
      } else {
        await projectApi.activatePlugin(projectId, plugin.pluginId);
      }
      const res = await projectApi.getPlugins(projectId);
      setProjectPlugins(res.data?.data ?? res.data ?? []);
    } catch { alert('Failed to toggle plugin'); }
    setTogglingPlugin(null);
  };

  const handleToggleAi = async () => {
    setTogglingAi(true);
    try {
      const res = await projectApi.toggleAi(projectId);
      setProject(res.data?.data ?? res.data);
    } catch { alert('Only the project owner or a system admin can toggle AI'); }
    setTogglingAi(false);
  };

  const handleCreateSubProject = async () => {
    if (!subForm.name.trim()) return;
    setSubCreateLoading(true);
    try {
      await projectApi.create({ ...subForm, parentProjectId: projectId });
      setShowCreateSub(false);
      setSubForm({ name: '', description: '', aiEnabled: true });
      const res = await projectApi.getSubProjects(projectId);
      setSubProjects(res.data?.data ?? res.data ?? []);
    } catch { alert('Failed to create sub-project'); }
    setSubCreateLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push(project.parentProjectId ? `/projects/${project.parentProjectId}` : '/projects')}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            {project.parentProjectName && (
              <button onClick={() => router.push(`/projects/${project.parentProjectId}`)}
                className="text-xs text-primary-600 hover:underline flex items-center gap-1 mb-0.5">
                <Layers className="h-3 w-3" /> {project.parentProjectName}
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <FolderKanban className="h-6 w-6 text-primary-600" />
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
              {project.aiEnabled && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">AI</span>
              )}
              {(project.subProjectCount ?? 0) > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  {project.subProjectCount} sub-project{project.subProjectCount !== 1 ? 's' : ''}
                </span>
              )}
              {/* Permission role badge */}
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                isProjectAdmin ? 'bg-green-100 text-green-700' : canWrite ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {isProjectAdmin ? 'Admin' : canWrite ? 'Editor' : 'Read-only'}
              </span>
            </div>
            {project.description && (
              <p className="text-sm text-slate-500 mt-1 ml-10">{project.description}</p>
            )}
          </div>
        </div>
        <button onClick={openInDocuments}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4" /> Open in Documents
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[
          { key: 'documents' as const, label: 'Documents', icon: FileText },
          { key: 'members' as const, label: `Members (${members.length})`, icon: Users },
          { key: 'sub-projects' as const, label: `Sub-Projects${(project.subProjectCount ?? 0) > 0 ? ` (${project.subProjectCount})` : ''}`, icon: Layers },
          { key: 'plugins' as const, label: 'Plugins', icon: Plug },
          { key: 'workflow' as const, label: 'Workflow', icon: GitBranch },
          { key: 'retention' as const, label: 'Retention & Compliance', icon: Shield },
          { key: 'settings' as const, label: 'Settings', icon: Settings },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
              activeTab === t.key ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-xl border border-slate-200">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center gap-2 text-sm">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
                  <button onClick={() => navigateToBreadcrumb(i)}
                    className={`hover:text-primary-600 ${i === breadcrumbs.length - 1 ? 'font-medium text-slate-900' : 'text-slate-500'}`}>
                    {i === 0 ? <Home className="h-4 w-4" /> : crumb.name}
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {canWrite && (
                showNewFolder ? (
                  <div className="flex items-center gap-2">
                    <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                      placeholder="Folder name..." className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm w-40 focus:ring-2 focus:ring-primary-500 outline-none"
                      onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} autoFocus />
                    <button onClick={handleCreateFolder} className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">Create</button>
                    <button onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => setShowNewFolder(true)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5">
                      <FolderPlus className="h-4 w-4" /> New Folder
                    </button>
                    <button onClick={() => setShowUpload(true)} className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-1.5">
                      <Upload className="h-4 w-4" /> Upload
                    </button>
                  </>
                )
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {docsLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
              </div>
            ) : (
              <>
                {/* Folders */}
                {folders.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
                    {folders.map(folder => (
                      <button key={folder.id} onClick={() => navigateToFolder(folder.id, folder.name)}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:bg-primary-50 hover:border-primary-200 transition">
                        <FolderKanban className="h-10 w-10 text-amber-500" />
                        <span className="text-sm font-medium text-slate-700 text-center truncate w-full">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Documents */}
                {documents.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-left">
                          <th className="pb-2 font-medium">Name</th>
                          <th className="pb-2 font-medium">Type</th>
                          <th className="pb-2 font-medium">Size</th>
                          <th className="pb-2 font-medium">Status</th>
                          <th className="pb-2 font-medium">Updated</th>
                          <th className="pb-2 font-medium w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map(doc => (
                          <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                            onClick={() => router.push(`/documents?doc=${doc.id}`)}>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-slate-400" />
                                <span className="font-medium text-slate-900">{doc.title}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-slate-500">{doc.fileExtension?.toUpperCase() || '—'}</td>
                            <td className="py-3 pr-4 text-slate-500">{formatBytes(doc.fileSizeBytes)}</td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                doc.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                doc.status === 'DRAFT' ? 'bg-slate-100 text-slate-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>{doc.status}</span>
                            </td>
                            <td className="py-3 pr-4 text-slate-500">{formatDateTime(doc.updatedAt)}</td>
                            <td className="py-3">
                              <button onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Download">
                                <Download className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : folders.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-4">No documents in this project yet</p>
                    {canWrite && (
                      <button onClick={() => setShowUpload(true)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium inline-flex items-center gap-2">
                        <Upload className="h-4 w-4" /> Upload First Document
                      </button>
                    )}
                  </div>
                ) : null}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-100">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50">Previous</button>
                    <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50">Next</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Team Members</h3>
            {isProjectAdmin && (
              <button onClick={openAddMember}
                className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 flex items-center gap-1">
                <UserPlus className="h-3.5 w-3.5" /> Add Member
              </button>
            )}
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No members assigned yet</p>
          ) : (
            <div className="space-y-2">
              {members.map(m => {
                const displayName = m.fullName?.trim() || m.username || m.userId;
                const initials = (m.username || m.fullName || m.userId || '??').slice(0, 2).toUpperCase();
                return (
                  <div key={m.userId} className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                          {initials}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{displayName}</p>
                          {m.email && <p className="text-xs text-slate-400">{m.email}</p>}
                          {m.roleName && <span className="text-[10px] text-primary-600 font-medium">{m.roleName}</span>}
                        </div>
                      </div>
                      {isProjectAdmin && (
                        <div className="flex items-center gap-1">
                          {editingMemberId === m.userId ? (
                            <>
                              <button onClick={() => handleSavePerms(m.userId)}
                                className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 hover:text-green-700" title="Save permissions">
                                <Check className="h-4 w-4" />
                              </button>
                              <button onClick={() => setEditingMemberId(null)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Cancel">
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => startEditPerms(m)}
                              className="p-1.5 rounded-lg hover:bg-primary-50 text-slate-400 hover:text-primary-600" title="Edit permissions">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => handleRemoveMember(m.userId)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600" title="Remove member">
                            <UserMinus className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {editingMemberId === m.userId ? (
                      <div className="mt-2 flex gap-1.5 flex-wrap">
                        {permissionOptions.map(p => (
                          <button key={p} type="button"
                            onClick={() => setEditPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                            className={`px-2 py-0.5 text-[10px] rounded font-medium border transition-colors ${
                              editPerms.includes(p)
                                ? 'bg-primary-100 text-primary-700 border-primary-300'
                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                            }`}>
                            {p}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1.5 ml-12 flex gap-1 flex-wrap">
                        {(m.effectivePermissions ?? m.permissions ?? []).map(p => (
                          <span key={p} className="px-1.5 py-0.5 bg-white text-slate-500 text-[10px] rounded font-medium border border-slate-200">{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Plugins Tab */}
      {activeTab === 'plugins' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Project Plugins</h3>
              <p className="text-xs text-slate-400 mt-1">Activate or deactivate plugins for this project. Only globally active plugins are shown.</p>
            </div>
            <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
              {projectPlugins.filter(p => p.activeInProject).length} active
            </span>
          </div>

          {pluginsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : projectPlugins.length === 0 ? (
            <div className="text-center py-8">
              <Plug className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No plugins available. Activate plugins from the Marketplace first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projectPlugins.map(plugin => (
                <div key={plugin.pluginId}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 border transition ${
                    plugin.activeInProject ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
                  }`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-lg ${
                      plugin.activeInProject ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      <Plug className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800 truncate">{plugin.displayName}</p>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-medium">{plugin.pluginType}</span>
                        {plugin.isPremium && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded font-medium">Premium</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{plugin.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{plugin.vendor} &middot; v{plugin.version}</p>
                    </div>
                  </div>
                  {isProjectAdmin ? (
                    <button
                      onClick={() => toggleProjectPlugin(plugin)}
                      disabled={togglingPlugin === plugin.pluginId}
                      className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition ${
                        plugin.activeInProject
                          ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                      } disabled:opacity-50`}>
                      {togglingPlugin === plugin.pluginId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : plugin.activeInProject ? (
                        <><PowerOff className="h-3.5 w-3.5" /> Deactivate</>
                      ) : (
                        <><Power className="h-3.5 w-3.5" /> Activate</>
                      )}
                    </button>
                  ) : (
                    <span className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg ${plugin.activeInProject ? 'text-green-600' : 'text-slate-400'}`}>
                      {plugin.activeInProject ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-Projects Tab */}
      {activeTab === 'sub-projects' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Sub-Projects</h3>
              <p className="text-xs text-slate-400 mt-1">Create and manage smaller projects nested under this project for better organisation.</p>
            </div>
            {isProjectAdmin && (
              <button onClick={() => setShowCreateSub(true)}
                className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New Sub-Project
              </button>
            )}
          </div>

          {subProjectsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : subProjects.length === 0 ? (
            <div className="text-center py-8">
              <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-3">No sub-projects yet</p>
              {isProjectAdmin && (
                <button onClick={() => setShowCreateSub(true)}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Create Sub-Project
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {subProjects.map(sub => (
                <div key={sub.id}
                  className="flex items-center justify-between rounded-lg px-4 py-3 border border-slate-200 hover:border-primary-300 transition cursor-pointer"
                  onClick={() => router.push(`/projects/${sub.id}`)}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{sub.name}</p>
                        {sub.aiEnabled && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded font-medium">AI</span>
                        )}
                        {(sub.subProjectCount ?? 0) > 0 && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-medium">{sub.subProjectCount} sub</span>
                        )}
                      </div>
                      {sub.description && <p className="text-xs text-slate-400 truncate">{sub.description}</p>}
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {sub.memberCount ?? 0} members &middot; Created {formatDateTime(sub.createdAt)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Sub-Project Modal */}
      {showCreateSub && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Create Sub-Project</h3>
              <button onClick={() => setShowCreateSub(false)} className="p-1 rounded-lg hover:bg-slate-100" title="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sub-Project Name *</label>
                <input value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Enter sub-project name..." autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={subForm.description} onChange={e => setSubForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  rows={3} placeholder="Optional description..." />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={subForm.aiEnabled} onChange={e => setSubForm(f => ({ ...f, aiEnabled: e.target.checked }))}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                <span className="text-sm text-slate-700">Enable AI for this sub-project</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
              <button onClick={() => setShowCreateSub(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleCreateSubProject} disabled={subCreateLoading || !subForm.name.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                {subCreateLoading && <Loader2 className="h-4 w-4 animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Tab */}
      {activeTab === 'workflow' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Default Workflow</h3>
              <p className="text-xs text-slate-400 mt-1">Set the default approval workflow for new documents in this project.</p>
            </div>
            {wfSaved && (
              <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
          </div>

          {wfLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Workflow Definition</label>
                <select value={selectedWfId} onChange={e => setSelectedWfId(e.target.value)} disabled={!isProjectAdmin}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white disabled:opacity-60 disabled:cursor-not-allowed">
                  <option value="">None (no default workflow)</option>
                  {workflowDefs.map(wf => (
                    <option key={wf.id} value={wf.id}>{wf.name} — {wf.steps?.length ?? 0} steps</option>
                  ))}
                </select>
              </div>

              {selectedWfId && workflowDefs.find(w => w.id === selectedWfId) && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1"><Info className="h-3.5 w-3.5" /> Workflow Steps</h4>
                  <div className="space-y-2">
                    {workflowDefs.find(w => w.id === selectedWfId)!.steps?.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="h-5 w-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                        <span className="text-slate-700 font-medium">{step.name}</span>
                        <span className="text-slate-400">— {step.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isProjectAdmin && (
                <button onClick={handleSaveDefaultWorkflow} disabled={savingWf}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                  {savingWf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Workflow Setting
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Retention & Compliance Tab */}
      {activeTab === 'retention' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Retention & Compliance</h3>
              <p className="text-xs text-slate-400 mt-1">Configure document retention policies, jurisdiction rules, and privacy settings.</p>
            </div>
            {retentionSaved && (
              <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
          </div>

          {retentionLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Jurisdiction & Retention Period */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> Jurisdiction</label>
                  <select value={retentionForm.jurisdictionCode} onChange={e => setRetentionForm(f => ({ ...f, jurisdictionCode: e.target.value }))} disabled={!isProjectAdmin}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white disabled:opacity-60 disabled:cursor-not-allowed">
                    <option value="">None selected</option>
                    {jurisdictions.map(j => (
                      <option key={j.code} value={j.code}>{j.name} ({j.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Default Retention (years)</label>
                  <input type="number" min={0} max={100} value={retentionForm.defaultRetentionPeriodYears}
                    onChange={e => setRetentionForm(f => ({ ...f, defaultRetentionPeriodYears: parseInt(e.target.value) || 0 }))} disabled={!isProjectAdmin}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed" />
                </div>
              </div>

              {/* Compliance Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Compliance Category</label>
                <select value={retentionForm.complianceCategory} onChange={e => setRetentionForm(f => ({ ...f, complianceCategory: e.target.value }))} disabled={!isProjectAdmin}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white disabled:opacity-60 disabled:cursor-not-allowed">
                  <option value="">None</option>
                  <option value="GDPR">GDPR</option>
                  <option value="HIPAA">HIPAA</option>
                  <option value="SOX">SOX</option>
                  <option value="ISO27001">ISO 27001</option>
                  <option value="PCI_DSS">PCI DSS</option>
                  <option value="SOC2">SOC 2</option>
                </select>
              </div>

              {/* Privacy Redaction */}
              <label className={`flex items-center gap-2 ${isProjectAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                <input type="checkbox" checked={retentionForm.privacyRedactionEnabled}
                  onChange={e => setRetentionForm(f => ({ ...f, privacyRedactionEnabled: e.target.checked }))} disabled={!isProjectAdmin}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                <span className="text-sm text-slate-700 flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Enable privacy redaction for sensitive fields</span>
              </label>

              {/* Document Types */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Retention Document Types</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {retentionForm.retentionDocumentTypes.map(dt => (
                    <span key={dt} className="px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full flex items-center gap-1">
                      {dt}
                      {isProjectAdmin && (
                        <button onClick={() => setRetentionForm(f => ({ ...f, retentionDocumentTypes: f.retentionDocumentTypes.filter(t => t !== dt) }))}
                          className="hover:text-red-600"><X className="h-3 w-3" /></button>
                      )}
                    </span>
                  ))}
                </div>
                {isProjectAdmin && (
                  <div className="flex items-center gap-2">
                    <select value={newDocType} onChange={e => setNewDocType(e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                      <option value="">Add category...</option>
                      {documentCategories.filter(c => !retentionForm.retentionDocumentTypes.includes(c)).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button onClick={() => { if (newDocType) { setRetentionForm(f => ({ ...f, retentionDocumentTypes: [...f.retentionDocumentTypes, newDocType] })); setNewDocType(''); } }}
                      disabled={!newDocType}
                      className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 disabled:opacity-50">
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Jurisdiction Rules Table */}
              {retentionRules.length > 0 && retentionForm.jurisdictionCode && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Jurisdiction Retention Rules ({retentionForm.jurisdictionCode})
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-left">
                          <th className="px-3 py-2 font-medium">Document Type</th>
                          <th className="px-3 py-2 font-medium">Min Retention</th>
                          <th className="px-3 py-2 font-medium">Legal Basis</th>
                          <th className="px-3 py-2 font-medium">Mandatory</th>
                        </tr>
                      </thead>
                      <tbody>
                        {retentionRules.filter(r => r.jurisdictionCode === retentionForm.jurisdictionCode).map(rule => (
                          <tr key={rule.id} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-700 font-medium">{rule.documentType}</td>
                            <td className="px-3 py-2 text-slate-500">{rule.minimumRetentionYears} years</td>
                            <td className="px-3 py-2 text-slate-500">{rule.legalBasis || '—'}</td>
                            <td className="px-3 py-2">{rule.mandatory ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <span className="text-slate-300">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {isProjectAdmin && (
                <button onClick={handleSaveRetention} disabled={savingRetention}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                  {savingRetention ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Compliance Settings
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          {/* AI Toggle */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${project.aiEnabled ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'}`}>
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">AI Features</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Enable AI-powered document analysis, classification, and anomaly detection for this project.</p>
                </div>
              </div>
              <button onClick={handleToggleAi} disabled={togglingAi || !isProjectAdmin}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  project.aiEnabled ? 'bg-purple-600' : 'bg-slate-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}>
                {togglingAi ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white absolute left-1/2 -translate-x-1/2" />
                ) : (
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${project.aiEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                )}
              </button>
            </div>
          </div>

          {/* Project Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Project Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-400">ID</span><p className="text-slate-700 font-mono text-xs mt-0.5">{project.id}</p></div>
              <div><span className="text-slate-400">Status</span><p className="text-slate-700 mt-0.5">{project.status}</p></div>
              <div><span className="text-slate-400">Created</span><p className="text-slate-700 mt-0.5">{formatDateTime(project.createdAt)}</p></div>
              <div><span className="text-slate-400">Updated</span><p className="text-slate-700 mt-0.5">{formatDateTime(project.updatedAt)}</p></div>
              <div><span className="text-slate-400">Organization</span><p className="text-slate-700 mt-0.5">{project.organizationId}</p></div>
              <div><span className="text-slate-400">Members</span><p className="text-slate-700 mt-0.5">{project.memberCount ?? members.length}</p></div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal projectId={projectId} folderId={currentFolder} onClose={() => setShowUpload(false)}
          onComplete={() => { setShowUpload(false); loadDocuments(); }} />
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Add Team Member</h3>
              <button onClick={() => setShowAddMember(false)} className="p-1 rounded-lg hover:bg-slate-100" title="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select User</label>
                <select value={addMemberForm.userId} onChange={e => setAddMemberForm(f => ({ ...f, userId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                  <option value="">Choose a user...</option>
                  {users.filter(u => !members.some(m => m.userId === u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.fullName || u.username} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select value={addMemberForm.roleId} onChange={e => setAddMemberForm(f => ({ ...f, roleId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Permissions</label>
                <div className="flex flex-wrap gap-2">
                  {permissionOptions.map(perm => (
                    <label key={perm} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={addMemberForm.permissions.includes(perm)}
                        onChange={e => {
                          setAddMemberForm(f => ({ ...f, permissions: e.target.checked ? [...f.permissions, perm] : f.permissions.filter(p => p !== perm) }));
                        }}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                      <span className="text-slate-600">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
              <button onClick={() => setShowAddMember(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleAddMember} disabled={addMemberLoading || !addMemberForm.userId || !addMemberForm.roleId}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                {addMemberLoading && <Loader2 className="h-4 w-4 animate-spin" />} Add Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
