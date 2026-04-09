import { create } from 'zustand';
import { authApi } from './api';
import type { User } from './types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  hydrated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; fullName: string }) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: false,
  hydrated: false,

  login: async (username, password) => {
    set({ loading: true });
    try {
      const res = await authApi.login(username, password);
      const data = res.data.data ?? res.data;
      const token = data.accessToken;
      const user: User = {
        id: data.userId,
        username: data.username,
        email: data.email ?? '',
        fullName: data.fullName,
        roles: (data.roles ?? []).map((r: string) => ({ id: '', name: r, permissions: [] })),
        active: true,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem('apex_token', token);
      localStorage.setItem('apex_user', JSON.stringify(user));
      set({ user, token, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  register: async (data) => {
    set({ loading: true });
    try {
      await authApi.register(data);
      set({ loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem('apex_token');
    localStorage.removeItem('apex_user');
    set({ user: null, token: null });
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('apex_token');
    const userStr = localStorage.getItem('apex_user');
    if (token && userStr) {
      try {
        set({ user: JSON.parse(userStr), token, hydrated: true });
      } catch {
        set({ hydrated: true });
      }
    } else {
      set({ hydrated: true });
    }
  },

  hasPermission: (permission: string) => {
    const user = get().user;
    if (!user) return false;
    return user.roles?.some(r => r.permissions?.some(p => p.name === permission)) ?? false;
  },

  hasRole: (role: string) => {
    const user = get().user;
    if (!user) return false;
    return user.roles?.some(r => r.name === role) ?? false;
  },
}));
