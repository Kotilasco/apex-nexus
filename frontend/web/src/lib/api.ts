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
  getChildren: (id: string) => api.get(`/documents/${id}/children`),
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
  updateRetention: (id: string, data: { retentionPeriodYears?: number; retentionPeriodMinutes?: number }) =>
    api.put(`/documents/${id}/retention`, data),
  /* Document Links (cross-document relationships) */
  getLinks: (id: string) => api.get(`/documents/${id}/links`),
  createLink: (id: string, data: { targetDocumentId: string; linkType?: string; note?: string }) =>
    api.post(`/documents/${id}/links`, data),
  deleteLink: (id: string, linkId: string) =>
    api.delete(`/documents/${id}/links/${linkId}`),
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
  requestPeerReview: (id: string, reviewerId: string, comments?: string) =>
    api.post(`/workflow/instances/${id}/peer-review`, { reviewerId, comments }),
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
    api.get('/retention/dispositions', { params: { status: status || 'PENDING', page, size } }),
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
  create: (data: {
    name: string; description?: string; aiEnabled?: boolean; parentProjectId?: string; defaultWorkflowDefinitionId?: string;
    defaultRetentionPeriodYears?: number; retentionDocumentTypes?: string[]; jurisdictionCode?: string;
    privacyRedactionEnabled?: boolean; complianceCategory?: string
  }) =>
    api.post('/projects', data),
  update: (id: string, data: {
    name: string; description?: string; aiEnabled?: boolean; defaultWorkflowDefinitionId?: string | null;
    defaultRetentionPeriodYears?: number; retentionDocumentTypes?: string[]; jurisdictionCode?: string;
    privacyRedactionEnabled?: boolean; complianceCategory?: string
  }) =>
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
  summarize: (content: string, title: string) =>
    api.post('/ai/summarize', { content, title }),
  ask: (content: string, title: string, question: string) =>
    api.post('/ai/ask', { content, title, question }),
};

export const documentConversationApi = {
  listForDocument: (documentId: string) =>
    api.get(`/documents/${documentId}/conversations`),
  listForVersion: (versionId: string) =>
    api.get(`/documents/versions/${versionId}/conversations`),
  save: (documentId: string, body: { versionId?: string | null; title?: string; question: string; answer: string }) =>
    api.post(`/documents/${documentId}/conversations`, body),
  delete: (id: string) =>
    api.delete(`/documents/conversations/${id}`),
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

export const presenceApi = {
  get: (documentId: string) =>
    api.get(`/notifications/presence/${documentId}`),
  heartbeat: (documentId: string, username?: string, displayName?: string) =>
    api.post(`/notifications/presence/${documentId}/heartbeat`, null, {
      params: { username, displayName },
    }),
  leave: (documentId: string) =>
    api.delete(`/notifications/presence/${documentId}`),
};

/* ── POTRAZ / Zimbabwe DPA Compliance ── */
export const complianceApi = {
  // dashboard
  dashboard: () => api.get('/compliance/potraz/dashboard'),

  // consents
  listConsents: (params?: { dataSubjectId?: string; status?: string }) =>
    api.get('/compliance/consents', { params }),
  createConsent: (data: any) => api.post('/compliance/consents', data),
  withdrawConsent: (id: string) => api.post(`/compliance/consents/${id}/withdraw`),

  // DSR
  listDsrs: (status?: string) =>
    api.get('/compliance/dsr', { params: status ? { status } : {} }),
  getDsr: (id: string) => api.get(`/compliance/dsr/${id}`),
  createDsr: (data: any) => api.post('/compliance/dsr', data),
  updateDsrStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/compliance/dsr/${id}/status`, { status, notes }),
  executeDsr: (id: string) => api.post(`/compliance/dsr/${id}/execute`),

  // breaches
  listBreaches: (status?: string) =>
    api.get('/compliance/breaches', { params: status ? { status } : {} }),
  getBreach: (id: string) => api.get(`/compliance/breaches/${id}`),
  createBreach: (data: any) => api.post('/compliance/breaches', data),
  notifyPotraz: (id: string, reference?: string) =>
    api.post(`/compliance/breaches/${id}/notify-potraz`, { reference }),

  // transfers
  listTransfers: () => api.get('/compliance/transfers'),
  createTransfer: (data: any) => api.post('/compliance/transfers', data),

  // DST
  listDst: (year?: number, month?: number) =>
    api.get('/compliance/dst', { params: { year, month } }),
  createDst: (data: any) => api.post('/compliance/dst', data),
  dstSummary: (year?: number) =>
    api.get('/compliance/dst/summary', { params: year ? { year } : {} }),

  // PII
  piiInventory: () => api.get('/compliance/pii/inventory'),
  piiAccessLog: (documentId?: string, limit = 100) =>
    api.get('/compliance/pii/access-log', { params: { documentId, limit } }),

  // snapshots
  listSnapshots: () => api.get('/compliance/snapshots'),
  getSnapshot: (id: string) => api.get(`/compliance/snapshots/${id}`),
  createSnapshot: (reportType: string = 'POTRAZ_AUDIT') =>
    api.post('/compliance/snapshots', { reportType }),
};


/* ── Agentic AI + Federated search ── */
const LONG_TIMEOUT = 180000; // LLM calls can take 30-90s
// LLM-style Q&A and intent hints (kept for search page)
export const askApi = {
  ask: (question: string, topK: number = 5) =>
    api.post('/search/ask', { question, topK }, { timeout: LONG_TIMEOUT }),
  federated: (q: string, sources?: string[], size: number = 10) =>
    api.get('/search/federated', { params: { q, size, sources: sources?.join(',') } }),
  synthesize: (topic: string, topK: number = 8) =>
    api.post('/search/synthesize', { topic, topK }, { timeout: LONG_TIMEOUT }),
  intent: (prompt: string) =>
    api.post('/search/intent', { prompt }, { timeout: LONG_TIMEOUT }),
};

// Proactive Intent Detection — reasons over every ingested document and proposes actions.
export const agenticApi = {
  suggestions: () => api.get('/agentic/suggestions'),
  history: () => api.get('/agentic/suggestions/history'),
  accept: (id: string) => api.post(`/agentic/suggestions/${id}/accept`),
  dismiss: (id: string) => api.post(`/agentic/suggestions/${id}/dismiss`),
  detect: (documentId: string) => api.post(`/agentic/detect/${documentId}`),
  summary: () => api.get('/agentic/summary'),
  team: () => api.get('/agentic/team'),
  runAuditor: () => api.post('/agentic/team/auditor/run'),
  runArchivist: () => api.post('/agentic/team/archivist/run'),
  runBridge: () => api.post('/agentic/team/bridge/run'),
};

// Adaptive Case Management — non-linear, evidence-rich case folders.
export const casesApi = {
  list: (status?: string, category?: string) =>
    api.get('/cases', { params: { status, category } }),
  summary: () => api.get('/cases/summary'),
  get: (id: string) => api.get(`/cases/${id}`),
  create: (body: { title: string; description?: string; category: string; priority?: string; projectId?: string }) =>
    api.post('/cases', body),
  close: (id: string, outcome: string) =>
    api.post(`/cases/${id}/close`, { outcome }),
  setStatus: (id: string, status: string) =>
    api.post(`/cases/${id}/status`, { status }),
  addTask: (id: string, body: { title: string; description?: string; assigneeId?: string; dueAt?: string }) =>
    api.post(`/cases/${id}/tasks`, body),
  completeTask: (taskId: string) =>
    api.post(`/cases/tasks/${taskId}/complete`),
  attach: (id: string, documentId: string, note?: string) =>
    api.post(`/cases/${id}/documents/${documentId}`, { note }),
  invite: (id: string, body: { userId?: string; externalEmail?: string; role?: string }) =>
    api.post(`/cases/${id}/participants`, body),
};

// Green IT / Sustainability — composite Green Index, kWh, CO2.
export const sustainabilityApi = {
  snapshot: () => api.get('/sustainability/snapshot'),
  refresh: () => api.post('/sustainability/snapshot/refresh'),
  trend: (days: number = 30) => api.get('/sustainability/trend', { params: { days } }),
};

// Federated Search — unified layer across Outlook / SharePoint / network shares / legacy ECM.
export const federatedApi = {
  sources: () => api.get('/federated/sources'),
  search: (q: string, types?: string[]) =>
    api.get('/federated/search', { params: { q, types: types?.join(',') } }),
  toggleSource: (id: string, enabled: boolean) =>
    api.post(`/federated/sources/${id}/toggle`, null, { params: { enabled } }),
  createSource: (body: { name: string; sourceType: string; endpointUrl: string; authConfig?: string; docCountEstimate?: number; }) =>
    api.post('/federated/sources', body),
  updateSource: (id: string, patch: Record<string, any>) =>
    api.patch(`/federated/sources/${id}`, patch),
  deleteSource: (id: string) => api.delete(`/federated/sources/${id}`),
  testSource: (id: string) => api.post(`/federated/sources/${id}/test`),
  emailMailboxes: () => api.get('/federated/email-mailboxes'),
  importFromEmail: () => api.post('/federated/import-from-email'),
};

// Vendor Portals — secured data rooms for external participants.
export const vendorPortalApi = {
  list: () => api.get('/vendor-portals'),
  summary: () => api.get('/vendor-portals/summary'),
  get: (id: string) => api.get(`/vendor-portals/${id}`),
  create: (body: {
    vendorCode: string; vendorName: string; contactEmail?: string;
    projectId?: string; requiredDocs?: string[]; expiryDays?: number;
  }) => api.post('/vendor-portals', body),
  revoke: (id: string) => api.post(`/vendor-portals/${id}/revoke`),
  approve: (uploadId: string, notes?: string) =>
    api.post(`/vendor-portals/uploads/${uploadId}/approve`, { notes }),
  reject: (uploadId: string, notes?: string) =>
    api.post(`/vendor-portals/uploads/${uploadId}/reject`, { notes }),
  addComplianceDoc: (portalId: string, body: { docType: string; label?: string; expiresOn: string; validFrom?: string; uploadId?: string; }) =>
    api.post(`/vendor-portals/${portalId}/compliance-docs`, body),
  removeComplianceDoc: (cdId: string) =>
    api.delete(`/vendor-portals/compliance-docs/${cdId}`),
};

// Process Intelligence — predictive bottlenecks + reassignment suggestions.
export const predictionApi = {
  list: () => api.get('/workflows/predictions'),
  summary: () => api.get('/workflows/predictions/summary'),
  refresh: () => api.post('/workflows/predictions/refresh'),
  reassign: (instanceId: string, userId: string) =>
    api.post(`/workflows/predictions/${instanceId}/reassign`, { userId }),
};

// Advanced 2026 features
export const notarizationApi = {
  notarize: (documentId: string) => api.post(`/documents/${documentId}/notarize`),
  verify: (documentId: string) => api.get(`/documents/${documentId}/verify`),
};

export const knowledgeGraphApi = {
  graph: (params: { scope?: string; scopeId?: string; maxNodes?: number } = {}) =>
    api.get('/documents/knowledge-graph', { params }),
};

export const workflowHealthApi = {
  overview: (days: number = 30) =>
    api.get('/workflows/health/overview', { params: { days } }),
};

export const intakeApi = {
  upload: (files: File[], autoRoute = true, projectId?: string) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const q = new URLSearchParams();
    q.set('autoRoute', String(autoRoute));
    if (projectId) q.set('projectId', projectId);
    return api.post(`/intake/upload?${q.toString()}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    });
  },
  classifyText: (fileName: string, mimeType: string, text: string) =>
    api.post('/search/classify-text', { fileName, mimeType, text }, { timeout: 120000 }),
  batch: (batchId: string) => api.get(`/intake/batches/${batchId}`),
  recentBatches: () => api.get('/intake/batches'),
  route: (intakeId: string, projectId?: string, startWorkflow = true) =>
    api.post(`/intake/${intakeId}/route`, { projectId, startWorkflow }),
};

export const sapApi = {
  summary: () => api.get('/sap/summary'),
  purchaseOrders: () => api.get('/sap-mock/purchase-orders'),
  purchaseOrder: (po: string) => api.get(`/sap-mock/purchase-orders/${po}`),
  invoices: () => api.get('/sap-mock/invoices'),
  assets: () => api.get('/sap-mock/assets'),
  asset: (equipmentId: string) => api.get(`/sap-mock/assets/${equipmentId}`),
  processInvoice: (documentId: string) =>
    api.post(`/sap/invoices/process/${documentId}`, {}, { timeout: 120000 }),
  linkAsset: (equipmentId: string, documentId: string, linkType = 'ATTACHMENT') =>
    api.post(`/sap/assets/${equipmentId}/link/${documentId}?linkType=${linkType}`),
  transactionDocuments: (arObject: string, objectKey: string) =>
    api.get(`/sap/transactions/${arObject}/${objectKey}/documents`),
};
