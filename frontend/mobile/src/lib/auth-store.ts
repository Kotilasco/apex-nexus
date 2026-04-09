import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi } from './api';

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roles: { name: string }[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,

  login: async (username, password) => {
    const res = await authApi.login(username, password);
    const data = res.data?.data ?? res.data;
    const token = data.token ?? data.accessToken;
    await SecureStore.setItemAsync('apex_token', token);
    await SecureStore.setItemAsync('apex_user', JSON.stringify(data.user));
    set({ user: data.user, token, loading: false });
  },

  logout: async () => {
    try { await authApi.logout(); } catch { /* silent */ }
    await SecureStore.deleteItemAsync('apex_token');
    await SecureStore.deleteItemAsync('apex_user');
    set({ user: null, token: null, loading: false });
  },

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('apex_token');
      const userStr = await SecureStore.getItemAsync('apex_user');
      if (token && userStr) {
        set({ token, user: JSON.parse(userStr), loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },
}));
