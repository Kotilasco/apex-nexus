'use client';

import { useEffect, useState, useCallback } from 'react';
import { authApi } from '@/lib/api';
import type { User, Role } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import {
  Users, UserPlus, Shield, RefreshCw, Search,
  CheckCircle, XCircle, Mail,
  Edit2, Save, X, ChevronDown, ChevronUp,
} from 'lucide-react';

function getUserDisplayName(user: User): string {
  if (user.fullName) return user.fullName;
  if (user.firstName || user.lastName) return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return user.username;
}

function getUserInitial(user: User): string {
  const name = getUserDisplayName(user);
  return name ? name.charAt(0).toUpperCase() : '?';
}

function isUserActive(user: User): boolean {
  return user.isActive ?? user.active ?? true;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingRoles, setEditingRoles] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', fullName: '' });
  const [registering, setRegistering] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authApi.getUsers(0, 100);
      const data = res.data?.data ?? res.data;
      const list = data?.content ?? (Array.isArray(data) ? data : []);
      setUsers(list);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const res = await authApi.getRoles();
      const data = res.data?.data ?? res.data;
      setRoles(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [loadUsers, loadRoles]);

  const filteredUsers = searchQuery
    ? users.filter((u) => {
        const q = searchQuery.toLowerCase();
        const name = getUserDisplayName(u).toLowerCase();
        return name.includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      })
    : users;

  const handleStartEditRoles = (user: User) => {
    setEditingRoles(user.id);
    const roleNames = (user.roles || []).map((r: any) => typeof r === 'string' ? r : r.name);
    setSelectedRoles(roleNames);
  };

  const handleSaveRoles = async (userId: string) => {
    setSavingRoles(true);
    try {
      await authApi.updateUserRoles(userId, selectedRoles);
      setEditingRoles(null);
      setStatusMessage({ type: 'success', text: 'Roles updated successfully' });
      await loadUsers();
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to update roles' });
    }
    setSavingRoles(false);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = !isUserActive(user);
    try {
      await authApi.updateUserStatus(user.id, newStatus);
      setStatusMessage({ type: 'success', text: `User ${newStatus ? 'activated' : 'deactivated'}` });
      await loadUsers();
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to update status' });
    }
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleRegister = async () => {
    if (!registerForm.username || !registerForm.email || !registerForm.password || !registerForm.fullName) return;
    setRegistering(true);
    try {
      await authApi.register(registerForm);
      setStatusMessage({ type: 'success', text: `User "${registerForm.username}" created successfully` });
      setShowRegister(false);
      setRegisterForm({ username: '', email: '', password: '', fullName: '' });
      await loadUsers();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to create user';
      setStatusMessage({ type: 'error', text: msg });
    }
    setRegistering(false);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const toggleRole = (roleName: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleName) ? prev.filter((r) => r !== roleName) : [...prev, roleName]
    );
  };

  const roleColors: Record<string, string> = {
    SYSTEM_ADMIN: 'bg-red-100 text-red-700',
    RECORDS_MANAGER: 'bg-purple-100 text-purple-700',
    DEPARTMENT_ADMIN: 'bg-orange-100 text-orange-700',
    APPROVER: 'bg-blue-100 text-blue-700',
    AUTHOR: 'bg-green-100 text-green-700',
    VIEWER: 'bg-slate-100 text-slate-700',
    AI_OPERATOR: 'bg-cyan-100 text-cyan-700',
  };

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
          statusMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {statusMessage.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage users, roles, and permissions &middot; {users.length} user{users.length !== 1 ? 's' : ''} &middot; {roles.length} role{roles.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowRegister(!showRegister)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700"
        >
          <UserPlus className="h-4 w-4" />
          Create User
        </button>
      </div>

      {showRegister && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary-600" /> Create New User
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                value={registerForm.fullName}
                onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input
                value={registerForm.username}
                onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                placeholder="e.g. johndoe"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                placeholder="e.g. john@company.com"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                placeholder="Min 8 characters"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowRegister(false)}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRegister}
              disabled={registering || !registerForm.username || !registerForm.email || !registerForm.password || !registerForm.fullName}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {registering ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users by name, username, or email..."
          className="w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No users found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Roles</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Created</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredUsers.map((user) => {
                const displayName = getUserDisplayName(user);
                const userRoleNames = (user.roles || []).map((r: any) => typeof r === 'string' ? r : r.name);
                const active = isUserActive(user);

                return (
                  <tr key={user.id} className="hover:bg-slate-50 group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-semibold text-sm">
                          {getUserInitial(user)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{displayName}</p>
                          <p className="text-xs text-slate-500">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {user.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingRoles === user.id ? (
                        <div className="flex flex-wrap gap-1 items-center">
                          {roles.map((role) => (
                            <button
                              key={role.id}
                              onClick={() => toggleRole(role.name)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${
                                selectedRoles.includes(role.name)
                                  ? (roleColors[role.name] || 'bg-indigo-100 text-indigo-700') + ' border-current'
                                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-400'
                              }`}
                            >
                              <Shield className="h-3 w-3" />
                              {role.name}
                            </button>
                          ))}
                          <button
                            onClick={() => handleSaveRoles(user.id)}
                            disabled={savingRoles}
                            className="ml-1 p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Save roles"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingRoles(null)}
                            className="p-1 text-slate-400 hover:bg-slate-50 rounded"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1 items-center">
                          {userRoleNames.map((roleName: string) => (
                            <span
                              key={roleName}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                roleColors[roleName] || 'bg-indigo-100 text-indigo-700'
                              }`}
                            >
                              <Shield className="h-3 w-3" />
                              {roleName}
                            </span>
                          ))}
                          <button
                            onClick={() => handleStartEditRoles(user)}
                            className="ml-1 p-1 text-slate-300 hover:text-primary-600 hover:bg-primary-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Edit roles"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggleStatus(user)} title={active ? 'Click to deactivate' : 'Click to activate'}>
                        {active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium hover:bg-green-200 transition-colors">
                            <CheckCircle className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium hover:bg-red-200 transition-colors">
                            <XCircle className="h-3 w-3" /> Inactive
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                      >
                        {expandedUser === user.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
