import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9600/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch { return true; }
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('apex_token');
    if (token) {
      if (isTokenExpired(token)) {
        localStorage.removeItem('apex_token');
        localStorage.removeItem('apex_user');
        window.location.href = '/login';
        return Promise.reject(new Error('Token expired'));
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  // Let browser set Content-Type (with boundary) for FormData
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    if (typeof window !== 'undefined') {
      if (status === 401) {
        localStorage.removeItem('apex_token');
        localStorage.removeItem('apex_user');
        window.location.href = '/login';
      } else if (status === 403) {
        // Check if token is missing or expired — services return 403 for unauthenticated requests
        const token = localStorage.getItem('apex_token');
        if (!token || isTokenExpired(token)) {
          localStorage.removeItem('apex_token');
          localStorage.removeItem('apex_user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

/* ── Auth ── */
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  register: (data: { username: string; email: string; password: string; fullName: string }) => {
    const [firstName, ...rest] = data.fullName.trim().split(' ');
    const lastName = rest.join(' ') || firstName;
    return api.post('/auth/register', {
      username: data.username,
      email: data.email,
      password: data.password,
      firstName,
      lastName,
    });
  },
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  getUsers: (page = 0, size = 20) =>
    api.get('/auth/users', { params: { page, size } }),
  getUser: (id: string) => api.get(`/auth/users/${id}`),
  updateUser: (id: string, data: { firstName?: string; lastName?: string; email?: string; department?: string }) =>
    api.put(`/auth/users/${id}`, data),
  updateUserRoles: (id: string, roles: string[]) =>
    api.put(`/auth/users/${id}/roles`, { roles }),
  updateUserStatus: (id: string, active: boolean) =>
    api.put(`/auth/users/${id}/status`, { active }),
  getRoles: () => api.get('/auth/roles'),
};

/* ── Documents ── */
export const documentApi = {
  list: (folderId?: string, page = 0, size = 20) =>
    folderId
      ? api.get(`/documents/folder/${folderId}`, { params: { page, size } })
      : api.get('/documents/my', { params: { page, size } }),
  listByProject: (projectId: string, folderId?: string, page = 0, size = 20) =>
    api.get(`/documents/project/${projectId}`, { params: { folderId, page, size } }),
  get: (id: string) => api.get(`/documents/${id}`),
  upload: (data: FormData) =>
    api.post('/documents', data, { timeout: 300000 }),
  download: (id: string) =>
    api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  getContent: (id: string) => api.get(`/documents/${id}/content`),
  getRedactedContent: (id: string) => api.get(`/documents/${id}/content/redacted`),
  updateContent: (id: string, content: string) =>
    api.put(`/documents/${id}/content`, { content }),
  delete: (id: string) => api.delete(`/documents/${id}`),
  update: (id: string, data: { title?: string; description?: string; status?: string; folderId?: string; projectId?: string; tags?: string[]; metadata?: Record<string, unknown> }) =>
    api.put(`/documents/${id}`, data),
  copyVersionToProject: (docId: string, versionNumber: number, data: { targetProjectId: string; targetFolderId?: string; title?: string }) =>
    api.post(`/documents/${docId}/versions/${versionNumber}/copy-to-project`, data),
  checkout: (id: string) => api.post(`/documents/${id}/checkout`),
  checkin: (id: string, data: FormData) =>
    api.post(`/documents/${id}/checkin`, data),
  checkinPrecheck: (id: string, data: FormData) =>
    api.post(`/documents/${id}/checkin-precheck`, data),
  compareVersions: (id: string, v1: number, v2: number) =>
    api.get(`/documents/${id}/versions/${v1}/compare/${v2}`),
  cancelCheckout: (id: string) => api.post(`/documents/${id}/cancel-checkout`),
  myCheckouts: () => api.get('/documents/my-checkouts'),
  getVersions: (id: string) => api.get(`/documents/${id}/versions`),
  downloadVersion: (id: string, version: number) =>
    api.get(`/documents/${id}/versions/${version}/download`, { responseType: 'blob' }),
  getNotes: (id: string) => api.get(`/documents/${id}/notes`),
  addNote: (id: string, data: { content: string; color?: string; parentNoteId?: string }) =>
    api.post(`/documents/${id}/notes`, data),
  deleteNote: (id: string, noteId: string) =>
    api.delete(`/documents/${id}/notes/${noteId}`),
  setLegalHold: (id: string, reason: string) =>
    api.post(`/documents/${id}/legal-hold`, null, { params: { reason } }),
  removeLegalHold: (id: string) => api.delete(`/documents/${id}/legal-hold`),
  /* Folders */
  getFolders: (parentId?: string) =>
    parentId ? api.get(`/folders/${parentId}/children`) : api.get('/folders/root'),
  getFoldersByProject: (projectId: string, parentId?: string) =>
    parentId
      ? api.get(`/folders/project/${projectId}`, { params: { parentId } })
      : api.get(`/folders/project/${projectId}`),
  createFolder: (data: { name: string; parentId?: string; projectId?: string }) =>
    api.post('/folders', data),
};

/* ── WOPI (Office Integration) ── */
export const wopiApi = {
  generateToken: (docId: string, permissions = 'EDIT') =>
    api.post(`/wopi/token/${docId}`, null, { params: { permissions } }),
};

/* ── Lock / Editing ── */
export const lockApi = {
  acquire: (docId: string) => api.post(`/locks/${docId}/acquire`),
  heartbeat: (docId: string) => api.post(`/locks/${docId}/heartbeat`),
  release: (docId: string) => api.post(`/locks/${docId}/release`),
  status: (docId: string) => api.get(`/locks/${docId}/status`),
  saveDraft: (docId: string, file: File | Blob) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/locks/${docId}/draft`, form);
  },
  getDraft: (docId: string) =>
    api.get(`/locks/${docId}/draft`, { responseType: 'blob' }),
  forceRelease: (docId: string, discardDraft = false) =>
    api.post(`/locks/${docId}/force-release`, null, { params: { discardDraft } }),
  takeover: (docId: string, saveDraftAsRecovery = true) =>
    api.post(`/locks/${docId}/takeover`, null, { params: { saveDraftAsRecovery } }),
};

/* ── Workflow ── */
export const workflowApi = {
  getDefinitions: () => api.get('/workflow/definitions'),
  getDefinition: (id: string) => api.get(`/workflow/definitions/${id}`),
  createDefinition: (data: {
    name: string; description?: string; states: string[];
    transitions: { from: string; to: string; action: string; requiredRole?: string }[];
    initialState?: string; requiredRoles?: string[];
    humanReviewRequired?: boolean; escalationRules?: { state: string; slaHours: number; maxLevel?: number; notifyRole?: string }[];
  }) => api.post('/workflow/definitions', data),
  updateDefinition: (id: string, data: {
    name: string; description?: string; states: string[];
    transitions: { from: string; to: string; action: string; requiredRole?: string }[];
    initialState?: string; requiredRoles?: string[];
    humanReviewRequired?: boolean; escalationRules?: { state: string; slaHours: number; maxLevel?: number; notifyRole?: string }[];
  }) => api.put(`/workflow/definitions/${id}`, data),
  deleteDefinition: (id: string) => api.delete(`/workflow/definitions/${id}`),
  startInstance: (data: { documentId: string; definitionId: string; notes?: string; projectId?: string; projectDefaultWorkflowId?: string }) =>
    api.post('/workflow/instances', data),
  getInstance: (id: string) => api.get(`/workflow/instances/${id}`),
  getMyInstances: (page = 0, size = 20) =>
    api.get('/workflow/instances/my', { params: { page, size } }),
  getPendingApprovals: (page = 0, size = 20) =>
    api.get('/workflow/instances/pending-approvals', { params: { page, size } }),
  getPendingCount: () => api.get('/workflow/instances/pending-approvals/count'),
  transition: (id: string, action: string, notes?: string, documentHash?: string) =>
    api.post(`/workflow/instances/${id}/transition`, { action, comments: notes, documentHash }),
  approve: (id: string, decision: string, notes?: string) =>
    api.post(`/workflow/instances/${id}/approve`, { decision, comments: notes }),
  cancel: (id: string, reason?: string) =>
    api.post(`/workflow/instances/${id}/cancel`, null, { params: { comments: reason } }),
  getHistory: (id: string) => api.get(`/workflow/instances/${id}/history`),
  getByStatus: (status: string, page = 0, size = 20) =>
    api.get(`/workflow/instances/by-status/${status}`, { params: { page, size } }),
  getByDocument: (documentId: string) =>
    api.get(`/workflow/instances/by-document/${documentId}`),
  getOverdue: () => api.get('/workflow/instances/overdue'),
};

/* ── Search ── */
export const searchApi = {
  quick: (q: string, page = 0, size = 20) =>
    api.get('/search', { params: { q, page, size } }),
  advanced: (data: {
    query: string;
    tags?: string[];
    mimeType?: string;
    status?: string;
    folderPath?: string;
    authorId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    size?: number;
  }) => api.post('/search', data),
  semantic: (q: string, size = 10) =>
    api.get('/search/semantic', { params: { q, size } }),
  extractContent: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/search/extract', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  classify: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/search/classify', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  gdprScan: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/search/gdpr-scan', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

/* ── Retention ── */
export const retentionApi = {
  getPolicies: () => api.get('/retention/policies'),
  getPolicy: (id: string) => api.get(`/retention/policies/${id}`),
  createPolicy: (data: { name: string; retentionYears: number; autoDispose: boolean; requiresApproval: boolean }) =>
    api.post('/retention/policies', data),
  updatePolicy: (id: string, data: { name: string; retentionYears: number; autoDispose: boolean; requiresApproval: boolean }) =>
    api.put(`/retention/policies/${id}`, data),
  deletePolicy: (id: string) => api.delete(`/retention/policies/${id}`),
  getDispositions: (status?: string, page = 0, size = 20) =>
    api.get('/retention/dispositions/pending', { params: { page, size } }),
  approveDisposition: (id: string) => api.post(`/retention/dispositions/${id}/approve`),
  rejectDisposition: (id: string, reason: string) =>
    api.post(`/retention/dispositions/${id}/reject`, null, { params: { reason } }),
  holdDisposition: (id: string, reason: string) =>
    api.post(`/retention/dispositions/${id}/hold`, null, { params: { reason } }),
  getStats: () => api.get('/retention/stats'),
  triggerScan: () => api.post('/retention/scan'),
};

/* ── Audit ── */
export const auditApi = {
  getByUser: (userId: string, page = 0, size = 20) =>
    api.get(`/audit/logs/by-user/${userId}`, { params: { page, size } }),
  getByAction: (action: string, page = 0, size = 20) =>
    api.get(`/audit/logs/by-action/${action}`, { params: { page, size } }),
  getByResource: (type: string, id: string, page = 0, size = 20) =>
    api.get(`/audit/logs/by-resource/${type}/${id}`, { params: { page, size } }),
  getByResourceType: (type: string, page = 0, size = 20) =>
    api.get(`/audit/logs/by-resource-type/${type}`, { params: { page, size } }),
  getByDate: (from: string, to: string, page = 0, size = 20) =>
    api.get('/audit/logs/by-date', { params: { from, to, page, size } }),
  getRecent: (page = 0, size = 20) =>
    api.get('/audit/recent', { params: { page, size } }),
  getStats: () => api.get('/audit/stats'),
};

/* ── Notifications ── */
export const notificationApi = {
  send: (data: { userId: string; type: string; title: string; message: string }) =>
    api.post('/notification/send', data),
  getMy: (page = 0, size = 20) =>
    api.get('/notification/my', { params: { page, size } }),
  getUnread: () => api.get('/notification/my/unread'),
  getUnreadCount: () => api.get('/notification/my/unread/count'),
  markRead: (id: string) => api.post(`/notification/${id}/read`),
  markAllRead: () => api.post('/notification/my/read-all'),
};

/* ── Projects ── */
export const projectApi = {
  list: () => api.get('/projects'),
  getMine: () => api.get('/projects/mine'),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: { name: string; description?: string; aiEnabled?: boolean; parentProjectId?: string; defaultWorkflowDefinitionId?: string;
    defaultRetentionPeriodYears?: number; retentionDocumentTypes?: string[]; jurisdictionCode?: string;
    privacyRedactionEnabled?: boolean; complianceCategory?: string }) =>
    api.post('/projects', data),
  update: (id: string, data: { name: string; description?: string; aiEnabled?: boolean; defaultWorkflowDefinitionId?: string | null;
    defaultRetentionPeriodYears?: number; retentionDocumentTypes?: string[]; jurisdictionCode?: string;
    privacyRedactionEnabled?: boolean; complianceCategory?: string }) =>
    api.put(`/projects/${id}`, data),
  getMembers: (id: string) => api.get(`/projects/${id}/members`),
  addMember: (id: string, data: { userId: string; roleId: string; permissions: string[] }) =>
    api.post(`/projects/${id}/members`, data),
  removeMember: (id: string, userId: string) =>
    api.delete(`/projects/${id}/members/${userId}`),
  updateMember: (id: string, userId: string, permissions: string[]) =>
    api.put(`/projects/${id}/members/${userId}`, { permissions }),
  getPlugins: (id: string) => api.get(`/projects/${id}/plugins`),
  activatePlugin: (id: string, pluginId: string) =>
    api.post(`/projects/${id}/plugins/${pluginId}/activate`),
  deactivatePlugin: (id: string, pluginId: string) =>
    api.post(`/projects/${id}/plugins/${pluginId}/deactivate`),
  toggleAi: (id: string) =>
    api.post(`/projects/${id}/ai/toggle`),
  getSubProjects: (id: string) =>
    api.get(`/projects/${id}/sub-projects`),
};

/* ── AI Governance ── */
export const governanceApi = {
  getEffective: (projectId?: string, userId?: string) =>
    api.get('/governance/effective', { params: { projectId, userId } }),
  getEffectiveByType: (policyType: string, projectId?: string, userId?: string) =>
    api.get(`/governance/effective/${policyType}`, { params: { projectId, userId } }),
  checkFeature: (policyType: string, projectId?: string, userId?: string) =>
    api.get(`/governance/check/${policyType}`, { params: { projectId, userId } }),
  getPolicies: () => api.get('/governance/policies'),
  getGlobalPolicies: () => api.get('/governance/policies/global'),
  getProjectPolicies: (projectId: string) =>
    api.get(`/governance/policies/project/${projectId}`),
  createPolicy: (data: {
    scope: string; scopeId?: string; policyType: string;
    isEnabled: boolean; settings: Record<string, unknown>;
  }) => api.post('/governance/policies', data),
  updatePolicy: (id: string, data: {
    isEnabled?: boolean; settings?: Record<string, unknown>; reason?: string;
  }) => api.put(`/governance/policies/${id}`, data),
  getPolicyAudit: (id: string) => api.get(`/governance/policies/${id}/audit`),
};

/* ── Share Links ── */
export const shareLinkApi = {
  create: (data: {
    documentId: string;
    expiresInHours?: number;
    password?: string;
    maxDownloads?: number;
    allowPreview?: boolean;
    allowDownload?: boolean;
    ipWhitelist?: string[];
  }) => api.post('/auth/share-links', data),
  listByDocument: (documentId: string) =>
    api.get(`/auth/share-links/document/${documentId}`),
  revoke: (linkId: string) => api.delete(`/auth/share-links/${linkId}`),
  validate: (token: string, password?: string, ipAddress?: string) =>
    api.post('/auth/share-links/validate', { token, password, ipAddress }),
  recordDownload: (token: string) =>
    api.post(`/auth/share-links/download/${token}`),
};

/* ── Document Signatures ── */
export const signatureApi = {
  request: (documentId: string, signerId: string, provider?: string) =>
    api.post('/documents/signatures/request', { documentId, signerId, provider }),
  sign: (signatureId: string) =>
    api.post(`/documents/signatures/${signatureId}/sign`),
  decline: (signatureId: string) =>
    api.post(`/documents/signatures/${signatureId}/decline`),
  verify: (signatureId: string) =>
    api.get(`/documents/signatures/${signatureId}/verify`),
  getByDocument: (documentId: string) =>
    api.get(`/documents/signatures/document/${documentId}`),
  getPending: () => api.get('/documents/signatures/pending'),
};

/* ── Workflow Forwards ── */
export const forwardApi = {
  forward: (data: {
    documentId: string;
    forwardedTo: string;
    message?: string;
    actionRequired?: string;
    workflowInstanceId?: string;
  }) => api.post('/workflows/forwards', data),
  getPending: (page = 0, size = 20) =>
    api.get('/workflows/forwards/pending', { params: { page, size } }),
  getPendingCount: () => api.get('/workflows/forwards/pending/count'),
  getByDocument: (documentId: string) =>
    api.get(`/workflows/forwards/document/${documentId}`),
  complete: (forwardId: string, response: string) =>
    api.post(`/workflows/forwards/${forwardId}/complete`, null, { params: { response } }),
};

/* ── Document Presence ── */
export const presenceApi = {
  getViewers: (documentId: string) =>
    api.get(`/notifications/presence/${documentId}`),
};

/* ── Document Preview ── */
export const previewApi = {
  getPreviewUrl: (documentId: string) =>
    `${api.defaults.baseURL}/documents/${documentId}/preview`,
};

/* ── Jurisdictions & Legal Compliance ── */
export const jurisdictionApi = {
  getJurisdictions: () => api.get('/retention/jurisdictions'),
  getJurisdiction: (code: string) => api.get(`/retention/jurisdictions/${code}`),
  getFrameworks: (jurisdictionId: string) =>
    api.get(`/retention/jurisdictions/${jurisdictionId}/frameworks`),
  getAllFrameworks: () => api.get('/retention/jurisdictions/frameworks'),
  getRulesByJurisdiction: (jurisdictionId: string) =>
    api.get(`/retention/jurisdictions/${jurisdictionId}/rules`),
  getAllRules: () => api.get('/retention/jurisdictions/rules'),
  getRulesByCategory: (category: string) =>
    api.get(`/retention/jurisdictions/rules/by-category/${category}`),
  checkCompliance: (jurisdictionId: string, category: string) =>
    api.get(`/retention/jurisdictions/${jurisdictionId}/rules/check/${category}`),
};

/* ── Plugin Marketplace ── */
export const pluginApi = {
  getAll: () => api.get('/auth/plugins'),
  getActive: () => api.get('/auth/plugins/active'),
  getById: (id: string) => api.get(`/auth/plugins/${id}`),
  getByName: (name: string) => api.get(`/auth/plugins/by-name/${name}`),
  getByType: (type: string) => api.get(`/auth/plugins/by-type/${type}`),
  getByCategory: (category: string) => api.get(`/auth/plugins/by-category/${category}`),
  activate: (id: string) => api.post(`/auth/plugins/${id}/activate`),
  deactivate: (id: string) => api.post(`/auth/plugins/${id}/deactivate`),
  getHooksForEvent: (eventName: string) => api.get(`/auth/plugins/hooks/${eventName}`),
};

/* ── Industry Templates ── */
export const industryTemplateApi = {
  getAll: () => api.get('/auth/industry-templates'),
  getById: (id: string) => api.get(`/auth/industry-templates/${id}`),
  getByName: (name: string) => api.get(`/auth/industry-templates/by-name/${name}`),
  getByIndustry: (industry: string) => api.get(`/auth/industry-templates/by-industry/${industry}`),
};

/* ── Workflow Templates ── */
export const workflowTemplateApi = {
  getAll: () => api.get('/workflows/templates'),
  getById: (id: string) => api.get(`/workflows/templates/${id}`),
  getByName: (name: string) => api.get(`/workflows/templates/by-name/${name}`),
  getByCategory: (category: string) => api.get(`/workflows/templates/by-category/${category}`),
  getByIndustry: (industry: string) => api.get(`/workflows/templates/by-industry/${industry}`),
};

/* ── AI Service ── */
export const aiApi = {
  generateWorkflow: (prompt: string) =>
    api.post('/ai/generate-workflow', { prompt }),
  getStatus: () => api.get('/ai/status'),
};

/* ── Email Ingestion ── */
export const emailIngestionApi = {
  getConfigs: () => api.get('/email-ingestion/configs'),
  getConfig: (id: string) => api.get(`/email-ingestion/configs/${id}`),
  createConfig: (data: any) => api.post('/email-ingestion/configs', data),
  updateConfig: (id: string, data: any) => api.put(`/email-ingestion/configs/${id}`, data),
  toggleConfig: (id: string) => api.patch(`/email-ingestion/configs/${id}/toggle`),
  deleteConfig: (id: string) => api.delete(`/email-ingestion/configs/${id}`),
  addRule: (configId: string, data: any) => api.post(`/email-ingestion/configs/${configId}/rules`, data),
  toggleRule: (ruleId: string) => api.patch(`/email-ingestion/rules/${ruleId}/toggle`),
  deleteRule: (ruleId: string) => api.delete(`/email-ingestion/rules/${ruleId}`),
  pollNow: (configId: string) => api.post(`/email-ingestion/configs/${configId}/poll`),
};
