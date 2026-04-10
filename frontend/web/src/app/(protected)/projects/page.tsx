'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { projectApi, authApi, documentApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useProjectStore } from '@/lib/project-store';
import type { Project, ProjectMember, User, Document } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import {
  FolderKanban, Plus, Users, FileText, Settings, Trash2, X,
  ChevronDown, ChevronUp, UserPlus, UserMinus, Shield, ExternalLink,
} from 'lucide-react';

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const { loadProjects: reloadStoreProjects } = useProjectStore();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', aiEnabled: true });
  const [createLoading, setCreateLoading] = useState(false);

  // Expanded project detail
  const [expanded, setExpanded] = useState<string | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Add member
  const [showAddMember, setShowAddMember] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [addMemberForm, setAddMemberForm] = useState({ userId: '', roleId: 'member', permissions: ['READ', 'WRITE'] });
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  // Documents assignment
  const [documents, setDocuments] = useState<Document[]>([]);

  const isAdmin = user?.roles?.some(r => r.name?.toUpperCase() === 'ADMIN' || r.name?.toUpperCase() === 'ROLE_ADMIN') ?? false;

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = isAdmin ? await projectApi.list() : await projectApi.getMine();
      const data = res.data?.data ?? res.data;
      setProjects(Array.isArray(data) ? data : data?.content ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    setCreateLoading(true);
    try {
      await projectApi.create(createForm);
      setShowCreate(false);
      setCreateForm({ name: '', description: '', aiEnabled: true });
      loadProjects();
      reloadStoreProjects();
    } catch { alert('Failed to create project'); }
    setCreateLoading(false);
  };

  const toggleExpand = async (projectId: string) => {
    if (expanded === projectId) { setExpanded(null); return; }
    setExpanded(projectId);
    setMembersLoading(true);
    try {
      const res = await projectApi.getMembers(projectId);
      setMembers(res.data?.data ?? res.data ?? []);
    } catch { setMembers([]); }
    setMembersLoading(false);
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
    if (!expanded || !addMemberForm.userId) return;
    setAddMemberLoading(true);
    try {
      await projectApi.addMember(expanded, addMemberForm);
      setShowAddMember(false);
      setAddMemberForm({ userId: '', roleId: 'member', permissions: ['READ', 'WRITE'] });
      // Reload members
      const res = await projectApi.getMembers(expanded);
      setMembers(res.data?.data ?? res.data ?? []);
    } catch { alert('Failed to add member'); }
    setAddMemberLoading(false);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!expanded || !confirm('Remove this member from the project?')) return;
    try {
      await projectApi.removeMember(expanded, userId);
      const res = await projectApi.getMembers(expanded);
      setMembers(res.data?.data ?? res.data ?? []);
    } catch { alert('Failed to remove member'); }
  };

  const permissionOptions = ['READ', 'WRITE', 'DELETE', 'MANAGE', 'APPROVE', 'AI_INVOKE', 'EXPORT', 'ADMIN'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 mt-1">Create and manage projects, assign team members and documents</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" /> New Project
        </button>
      </div>

      {/* Project List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <FolderKanban className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">No projects yet</p>
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Create Your First Project
            </button>
          </div>
        ) : (
          projects.map(project => (
            <div key={project.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => toggleExpand(project.id)}>
                    <div className="flex items-center gap-3 mb-1">
                      <FolderKanban className="h-5 w-5 text-primary-600" />
                      <h3 className="text-lg font-semibold text-slate-900 hover:text-primary-600 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); router.push(`/projects/${project.id}`); }}>
                        {project.name}
                      </h3>
                      {project.aiEnabled && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">AI Enabled</span>
                      )}
                      {(project.subProjectCount ?? 0) > 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">{project.subProjectCount} sub-project{project.subProjectCount !== 1 ? 's' : ''}</span>
                      )}
                      {project.parentProjectName && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">↳ {project.parentProjectName}</span>
                      )}
                      {!project.isActive && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">Inactive</span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-sm text-slate-500 mt-1 ml-8">{project.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-2 ml-8">Created {formatDateTime(project.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => router.push(`/projects/${project.id}`)}
                      className="p-2 rounded-lg hover:bg-primary-50 text-primary-600" title="Open project">
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button onClick={() => toggleExpand(project.id)}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                      {expanded === project.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded: Members & Documents */}
              {expanded === project.id && (
                <div className="border-t border-slate-100 bg-slate-50 p-5 space-y-4">
                  {/* Members Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Users className="h-4 w-4" /> Team Members
                      </h4>
                      <button onClick={openAddMember}
                        className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 flex items-center gap-1">
                        <UserPlus className="h-3.5 w-3.5" /> Add Member
                      </button>
                    </div>
                    {membersLoading ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
                      </div>
                    ) : members.length === 0 ? (
                      <p className="text-sm text-slate-400 py-2">No members assigned yet</p>
                    ) : (
                      <div className="space-y-2">
                        {members.map(m => {
                          const displayName = m.fullName?.trim() || m.username || m.userId;
                          const initials = (m.username || m.fullName || m.userId || '??').slice(0, 2).toUpperCase();
                          return (
                            <div key={m.userId} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                                  {initials}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-700">{displayName}</p>
                                  {m.email && <p className="text-xs text-slate-400">{m.email}</p>}
                                  <div className="flex gap-1 mt-0.5">
                                    {(m.effectivePermissions ?? m.permissions ?? []).map(p => (
                                      <span key={p} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-medium">{p}</span>
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

                  {/* Project Info */}
                  <div className="pt-2 border-t border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                      <Settings className="h-4 w-4" /> Project Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Project ID:</span>
                        <p className="font-mono text-xs text-slate-600 mt-0.5">{project.id}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Owner:</span>
                        <p className="text-sm text-slate-600 mt-0.5">{project.ownerName || project.ownerId}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">AI Enabled:</span>
                        <p className="text-slate-600 mt-0.5">{project.aiEnabled ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Status:</span>
                        <p className="text-slate-600 mt-0.5">{project.isActive ? 'Active' : 'Inactive'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Create New Project</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
                <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., HR Documents 2026" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the purpose of this project..." rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="aiEnabled" checked={createForm.aiEnabled}
                  onChange={e => setCreateForm(f => ({ ...f, aiEnabled: e.target.checked }))}
                  className="h-4 w-4 text-primary-600 rounded border-slate-300" />
                <label htmlFor="aiEnabled" className="text-sm text-slate-700">Enable AI features (classification, anomaly detection)</label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleCreate} disabled={createLoading || !createForm.name.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                {createLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Plus className="h-4 w-4" />}
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
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
