import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'http://10.0.2.2:8080'; // Android emulator → localhost

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync('apex_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('apex_token');
      await SecureStore.deleteItemAsync('apex_user');
    }
    return Promise.reject(error);
  }
);

export default api;

/* ── Auth ── */
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  register: (data: { username: string; email: string; password: string; fullName: string }) =>
    api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

/* ── Documents ── */
export const documentApi = {
  list: (folderId?: string, page = 0, size = 20) =>
    api.get('/documents', { params: { folderId, page, size } }),
  get: (id: string) => api.get(`/documents/${id}`),
  download: (id: string) =>
    api.get(`/documents/${id}/download`, { responseType: 'arraybuffer' }),
  getNotes: (id: string) => api.get(`/documents/${id}/notes`),
  addNote: (id: string, data: { content: string; color?: string }) =>
    api.post(`/documents/${id}/notes`, data),
  getVersions: (id: string) => api.get(`/documents/${id}/versions`),
  getFolders: (parentId?: string) =>
    api.get('/documents/folders', { params: { parentId } }),
};

/* ── Workflow ── */
export const workflowApi = {
  getMyInstances: (page = 0, size = 20) =>
    api.get('/workflow/instances/my', { params: { page, size } }),
  getPendingApprovals: (page = 0, size = 20) =>
    api.get('/workflow/instances/pending-approvals', { params: { page, size } }),
  approve: (id: string, decision: string, notes?: string) =>
    api.post(`/workflow/instances/${id}/approve`, null, { params: { decision, notes } }),
  getHistory: (id: string) => api.get(`/workflow/instances/${id}/history`),
};

/* ── Search ── */
export const searchApi = {
  quick: (q: string, page = 0, size = 20) =>
    api.get('/search', { params: { q, page, size } }),
};

/* ── Notifications ── */
export const notificationApi = {
  getMy: (page = 0, size = 20) =>
    api.get('/notification/my', { params: { page, size } }),
  getUnread: () => api.get('/notification/my/unread'),
  getUnreadCount: () => api.get('/notification/my/unread/count'),
  markRead: (id: string) => api.post(`/notification/${id}/read`),
  markAllRead: () => api.post('/notification/my/read-all'),
};
