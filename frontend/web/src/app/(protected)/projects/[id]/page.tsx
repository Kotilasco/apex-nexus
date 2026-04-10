'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { projectApi, authApi, documentApi, workflowApi, jurisdictionApi, pluginApi } from '@/lib/api';
import { useProjectStore } from '@/lib/project-store';
import type { Project, ProjectMember, User, Document, Folder, WorkflowDefinition, Jurisdiction, JurisdictionRetentionRule, ProjectPluginStatus } from '@/lib/types';
import { formatDateTime, formatBytes, getFileIcon } from '@/lib/utils';
import {
  FolderKanban, Plus, Users, FileText, Settings, ArrowLeft, X,
  ChevronRight, Home, Upload, FolderPlus, Download, UserPlus, UserMinus,
  Eye, Trash2, GitBranch, Save, Loader2, CheckCircle2, Info, Shield,
  Clock, Lock, AlertTriangle, BookOpen, Plug, Power, PowerOff, Brain, Layers,
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
  const [addMemberForm, setAddMemberForm] = useState({ userId: '', roleId: 'member', permissions: ['READ', 'WRITE'] });
  const [addMemberLoading, setAddMemberLoading] = useState(false);
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
      const res = await authApi.getUsers(0, 100);
      const data = res.data?.data ?? res.data;
      setUsers(data?.content ?? data ?? []);
    } catch { /* ignore */ }
  };

  const handleAddMember = async () => {
    if (!addMemberForm.userId) return;
    setAddMemberLoading(true);
    try {
      await projectApi.addMember(projectId, addMemberForm);
      setShowAddMember(false);
      setAddMemberForm({ userId: '', roleId: 'member', permissions: ['READ', 'WRITE'] });
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
              {showNewFolder ? (
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
                    <button onClick={() => setShowUpload(true)}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium inline-flex items-center gap-2">
                      <Upload className="h-4 w-4" /> Upload First Document
                    </button>
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
            <button onClick={openAddMember}
              className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 flex items-center gap-1">
              <UserPlus className="h-3.5 w-3.5" /> Add Member
            </button>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No members assigned yet</p>
          ) : (
            <div className="space-y-2">
              {members.map(m => {
                const displayName = m.fullName?.trim() || m.username || m.userId;
                const initials = (m.username || m.fullName || m.userId || '??').slice(0, 2).toUpperCase();
                return (
                  <div key={m.userId} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{displayName}</p>
                        {m.email && <p className="text-xs text-slate-400">{m.email}</p>}
                        {m.roleName && <span className="text-[10px] text-primary-600 font-medium">{m.roleName}</span>}
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {(m.effectivePermissions ?? m.permissions ?? []).map(p => (
                            <span key={p} className="px-1.5 py-0.5 bg-white text-slate-500 text-[10px] rounded font-medium border border-slate-200">{p}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveMember(m.userId)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600" title="Remove member">
                      <UserMinus className="h-4 w-4" />
                    </button>
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
            <button onClick={() => setShowCreateSub(true)}
              className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Sub-Project
            </button>
          </div>

          {subProjectsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : subProjects.length === 0 ? (
            <div className="text-center py-8">
              <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-3">No sub-projects yet</p>
              <button onClick={() => setShowCreateSub(true)}
                className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 inline-flex items-center gap-2">
                <Plus className="h-4 w-4" /> Create Sub-Project
              </button>
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
                  placeholder="e.g., Phase 1 Documents" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={subForm.description} onChange={e => setSubForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe this sub-project..." rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="subAiEnabled" checked={subForm.aiEnabled}
                  onChange={e => setSubForm(f => ({ ...f, aiEnabled: e.target.checked }))}
                  className="h-4 w-4 text-primary-600 rounded border-slate-300" />
                <label htmlFor="subAiEnabled" className="text-sm text-slate-700">Enable AI features</label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button onClick={() => setShowCreateSub(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleCreateSubProject} disabled={subCreateLoading || !subForm.name.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                {subCreateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
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
              <p className="text-xs text-slate-400 mt-1">Set a default workflow for all documents in this project. Documents inherit this workflow but can use a more restrictive one.</p>
            </div>
          </div>

          {wfLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Workflow Selector */}
              <div className="max-w-md">
                <label className="block text-sm font-medium text-slate-700 mb-2">Workflow Type</label>
                <select value={selectedWfId} onChange={e => { setSelectedWfId(e.target.value); setWfSaved(false); }}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                  <option value="">No default workflow</option>
                  {workflowDefs.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-3">
                <button onClick={handleSaveDefaultWorkflow} disabled={savingWf}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                  {savingWf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
                {wfSaved && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Saved
                  </span>
                )}
              </div>

              {/* Selected Workflow Details */}
              {selectedWfId && (() => {
                const def = workflowDefs.find(d => d.id === selectedWfId);
                if (!def) return null;
                return (
                  <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{def.name}</h4>
                      {def.description && <p className="text-xs text-slate-500 mt-1">{def.description}</p>}
                    </div>

                    {/* States */}
                    {Array.isArray(def.states) && def.states.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">Allowed States</p>
                        <div className="flex flex-wrap gap-1.5">
                          {def.states.map((s: string) => (
                            <span key={s} className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 text-xs rounded-lg font-medium">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transitions */}
                    {Array.isArray(def.transitions) && def.transitions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">Transitions</p>
                        <div className="space-y-1.5">
                          {def.transitions.map((t: { from: string; to: string; action: string; requiredRole?: string }, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-medium text-slate-700">{t.from}</span>
                              <span className="text-slate-400">→</span>
                              <span className="text-primary-600 font-medium">{t.action}</span>
                              <span className="text-slate-400">→</span>
                              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-medium text-slate-700">{t.to}</span>
                              {t.requiredRole && <span className="text-slate-400 ml-1">(role: {t.requiredRole})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Info Banner */}
                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-700">Documents in this project will default to this workflow. When starting a workflow on a document, only workflows with equal or more restrictive states/transitions than this default will be allowed.</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Retention & Compliance Tab */}
      {activeTab === 'retention' && (
        <div className="space-y-6">
          {retentionLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <>
              {/* Retention Settings */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-6">
                  <Clock className="h-5 w-5 text-primary-600" />
                  <h3 className="text-sm font-semibold text-slate-700">Default Retention Policy</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Default Retention Period */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Default Retention Period (Years)</label>
                    <input type="number" min={0} max={999}
                      value={retentionForm.defaultRetentionPeriodYears || ''}
                      onChange={e => setRetentionForm(f => ({ ...f, defaultRetentionPeriodYears: parseInt(e.target.value) || 0 }))}
                      placeholder="e.g. 7"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                    <p className="text-xs text-slate-400 mt-1">Documents must have retention ≥ this value</p>
                  </div>

                  {/* Compliance Category */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Compliance Category</label>
                    <select value={retentionForm.complianceCategory}
                      onChange={e => setRetentionForm(f => ({ ...f, complianceCategory: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                      <option value="">None</option>
                      {documentCategories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Allowed Document Types */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Allowed Document Types</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(retentionForm.retentionDocumentTypes || []).map(t => (
                      <span key={t} className="px-3 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full flex items-center gap-1.5 border border-primary-200">
                        {t}
                        <button onClick={() => setRetentionForm(f => ({ ...f, retentionDocumentTypes: f.retentionDocumentTypes.filter(x => x !== t) }))}
                          className="hover:text-red-600"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                    {(retentionForm.retentionDocumentTypes || []).length === 0 && (
                      <span className="text-xs text-slate-400">All document types allowed</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={newDocType} onChange={e => setNewDocType(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                      <option value="">Add type...</option>
                      {documentCategories.filter(c => !(retentionForm.retentionDocumentTypes || []).includes(c)).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button onClick={() => {
                      if (newDocType) {
                        setRetentionForm(f => ({ ...f, retentionDocumentTypes: [...f.retentionDocumentTypes, newDocType] }));
                        setNewDocType('');
                      }
                    }} disabled={!newDocType}
                      className="px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50">
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Jurisdiction & Compliance */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-6">
                  <BookOpen className="h-5 w-5 text-primary-600" />
                  <h3 className="text-sm font-semibold text-slate-700">Jurisdiction & Compliance</h3>
                </div>

                <div className="max-w-md">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Jurisdiction</label>
                  <select value={retentionForm.jurisdictionCode}
                    onChange={e => setRetentionForm(f => ({ ...f, jurisdictionCode: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                    <option value="">No jurisdiction selected</option>
                    {jurisdictions.map(j => (
                      <option key={j.code} value={j.code}>{j.name} ({j.code}) — {j.region}</option>
                    ))}
                  </select>
                </div>

                {/* Show rules for selected jurisdiction */}
                {retentionForm.jurisdictionCode && (() => {
                  const selectedJ = jurisdictions.find(j => j.code === retentionForm.jurisdictionCode);
                  const rules = retentionRules.filter(r => r.jurisdictionCode === retentionForm.jurisdictionCode);
                  return (
                    <div className="mt-6 space-y-4">
                      {selectedJ && (
                        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-blue-700">
                            Compliance jurisdiction: <strong>{selectedJ.name}</strong> ({selectedJ.region}).
                            Documents in this project will be governed by the retention rules below.
                          </p>
                        </div>
                      )}

                      {rules.length > 0 ? (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="text-left py-2.5 px-3 font-medium text-slate-600 text-xs">Category</th>
                                <th className="text-left py-2.5 px-3 font-medium text-slate-600 text-xs">Min. Retention</th>
                                <th className="text-left py-2.5 px-3 font-medium text-slate-600 text-xs">Legal Framework</th>
                                <th className="text-left py-2.5 px-3 font-medium text-slate-600 text-xs">Citation</th>
                                <th className="text-left py-2.5 px-3 font-medium text-slate-600 text-xs">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rules.map(r => (
                                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                                  <td className="py-2.5 px-3">
                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded border border-amber-200">{r.documentCategory}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-700 font-medium">{r.minRetentionYears} yrs</td>
                                  <td className="py-2.5 px-3 text-slate-500 text-xs">{r.legalFrameworkName || r.legalFrameworkCode}</td>
                                  <td className="py-2.5 px-3 text-slate-500 text-xs max-w-[200px] truncate">{r.legalCitation}</td>
                                  <td className="py-2.5 px-3">
                                    {r.isMandatory ? (
                                      <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-medium rounded border border-red-200">Required</span>
                                    ) : (
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded">Optional</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">No retention rules found for this jurisdiction</p>
                      )}

                      {/* Penalty Info */}
                      {rules.filter(r => r.penaltyInfo).length > 0 && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-amber-700 space-y-1">
                            <p className="font-medium">Non-Compliance Penalties:</p>
                            {rules.filter(r => r.penaltyInfo).map(r => (
                              <p key={r.id}>• <strong>{r.documentCategory}:</strong> {r.penaltyInfo}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Privacy Redaction */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="h-5 w-5 text-primary-600" />
                  <h3 className="text-sm font-semibold text-slate-700">Privacy Redaction</h3>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" checked={retentionForm.privacyRedactionEnabled}
                      onChange={e => setRetentionForm(f => ({ ...f, privacyRedactionEnabled: e.target.checked }))}
                      className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-700">Enable Privacy Redaction</span>
                    <p className="text-xs text-slate-400 mt-0.5">When enabled, documents in this project can have personal data automatically identified and redacted. This serves as the project default — individual documents can override.</p>
                  </div>
                </label>
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-3">
                <button onClick={handleSaveRetention} disabled={savingRetention}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                  {savingRetention ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Retention & Compliance Settings
                </button>
                {retentionSaved && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Settings saved
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Project Settings</h3>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <span className="text-slate-400">Project ID</span>
              <p className="font-mono text-xs text-slate-600 mt-1">{project.id}</p>
            </div>
            <div>
              <span className="text-slate-400">Owner</span>
              <p className="text-sm text-slate-600 mt-1">{project.ownerName || project.ownerId}</p>
            </div>
            <div>
              <span className="text-slate-400">AI Enabled</span>
              <p className="text-slate-600 mt-1">{project.aiEnabled ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className="text-slate-400">Status</span>
              <p className="text-slate-600 mt-1">{project.isActive ? 'Active' : 'Inactive'}</p>
            </div>
            <div>
              <span className="text-slate-400">Created</span>
              <p className="text-slate-600 mt-1">{formatDateTime(project.createdAt)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          folderId={currentFolder}
          projectId={projectId}Features</span>
              <div className="flex items-center gap-3 mt-1">
                <button onClick={handleToggleAi} disabled={togglingAi}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    project.aiEnabled ? 'bg-purple-600' : 'bg-slate-300'
                  } ${togglingAi ? 'opacity-50' : ''}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    project.aiEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <span className={`text-sm font-medium ${project.aiEnabled ? 'text-purple-700' : 'text-slate-500'}`}>
                  {togglingAi ? 'Saving...' : project.aiEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Only the project owner or system admin can toggle this</p>
            </div>
            <div>
              <span className="text-slate-400">Status</span>
              <p className="text-slate-600 mt-1">{project.isActive ? 'Active' : 'Inactive'}</p>
            </div>
            {project.parentProjectName && (
              <div>
                <span className="text-slate-400">Parent Project</span>
                <button onClick={() => router.push(`/projects/${project.parentProjectId}`)}
                  className="block text-sm text-primary-600 hover:underline mt-1">{project.parentProjectName}</button>
              </div>
            )}er Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Add Team Member</h3>
              <button onClick={() => setShowAddMember(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">User</label>
                <select value={addMemberForm.userId} onChange={e => setAddMemberForm(f => ({ ...f, userId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                  <option value="">Select a user...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.fullName || u.username} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select value={addMemberForm.roleId} onChange={e => setAddMemberForm(f => ({ ...f, roleId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Permissions</label>
                <div className="flex flex-wrap gap-2">
                  {permissionOptions.map(perm => (
                    <label key={perm} className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={addMemberForm.permissions.includes(perm)}
                        onChange={e => {
                          setAddMemberForm(f => ({
                            ...f,
                            permissions: e.target.checked
                              ? [...f.permissions, perm]
                              : f.permissions.filter(p => p !== perm),
                          }));
                        }}
                        className="h-3.5 w-3.5 text-primary-600 rounded border-slate-300" />
                      <span className="text-slate-600">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button onClick={() => setShowAddMember(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleAddMember} disabled={addMemberLoading || !addMemberForm.userId}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                {addMemberLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <UserPlus className="h-4 w-4" />}
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
