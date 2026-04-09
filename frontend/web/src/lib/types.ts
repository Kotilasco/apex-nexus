export interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  roles: string[];
  isActive?: boolean;
  active?: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: (Permission | string)[];
}

export interface Permission {
  id: string;
  name: string;
  description: string;
}

export interface Document {
  id: string;
  objectGuid?: string;
  title: string;
  description: string;
  mimeType: string;
  fileSize?: number;
  fileSizeBytes?: number;
  fileExtension?: string;
  status: DocumentStatus;
  folderId: string;
  folderPath?: string;
  projectId?: string;
  version?: number;
  currentVersion?: number;
  checkedOut?: boolean;
  isCheckedOut?: boolean;
  checkedOutBy: string | null;
  checkedOutByName?: string | null;
  checkedOutAt?: string | null;
  legalHold: boolean;
  legalHoldReason: string | null;
  retentionStartDate?: string;
  retentionPeriodYears?: number;
  retentionExpiry?: string | null;
  privacyRedactionEnabled?: boolean;
  classificationLabel?: string;
  m365Link?: string;
  docusignEnvelopeId?: string;
  sapDocumentNumber?: string;
  aiGenerated?: boolean;
  aiConfidence?: number;
  tags: string[];
  metadata?: Record<string, unknown>;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'DESTROYED';

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  versionType: string;
  versionLabel: string;
  fileName: string;
  sha256Hash: string;
  fileSizeBytes: number;
  authorId: string;
  authorName: string;
  changeSummary: string;
  createdAt: string;
  anomalyFlagged: boolean;
  anomalyScore: number;
  similarityScore: number;
  anomalyReasons: string[];
}

export interface VersionPreCheckResult {
  duplicateFound: boolean;
  duplicateDocumentId: string | null;
  duplicateDocumentTitle: string | null;
  duplicateVersionNumber: number | null;
  formatMismatch: boolean;
  previousFormat: string | null;
  newFormat: string | null;
  similarityScore: number | null;
  highRisk: boolean;
  warnings: string[];
}

export interface DocumentNote {
  id: string;
  documentId: string;
  content: string;
  color: string;
  pinned: boolean;
  parentNoteId: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  createdAt: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  states: string[];
  transitions: { from: string; to: string; action: string; requiredRole?: string }[];
  initialState?: string;
  requiredRoles?: string[];
  humanReviewRequired?: boolean;
  escalationRules?: { state: string; slaHours: number; maxLevel?: number; notifyRole?: string }[];
  isActive?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowInstance {
  id: string;
  definitionId: string;
  definitionName?: string;
  documentId: string;
  initiatedBy: string;
  currentState: WorkflowStatus;
  currentStatus?: WorkflowStatus;
  notes: string;
  correctionCount: number;
  rejectedDocumentHash?: string;
  rejectionComments?: string;
  assignedTo?: string | null;
  priority?: number;
  dueDate?: string | null;
  completedAt?: string | null;
  escalationLevel?: number;
  escalatedAt?: string | null;
  slaDeadline?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowStatus = 'DRAFT' | 'REVIEW' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CORRECTION' | 'ARCHIVED' | 'CANCELLED' | 'ESCALATED';

/* ── Projects ── */
export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  aiEnabled: boolean;
  isActive: boolean;
  defaultWorkflowDefinitionId?: string;
  defaultRetentionPeriodYears?: number;
  retentionDocumentTypes?: string[];
  jurisdictionCode?: string;
  privacyRedactionEnabled?: boolean;
  complianceCategory?: string;
  createdAt: string;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  roleId: string;
  permissions: string[];
}

/* ── AI Governance ── */
export type PolicyScope = 'GLOBAL' | 'PROJECT' | 'USER';

export interface GovernancePolicy {
  id: string;
  scope: PolicyScope;
  scopeId: string | null;
  policyType: string;
  isEnabled: boolean;
  settings: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyAuditEntry {
  id: string;
  policyId: string;
  changedBy: string;
  changeType: string;
  oldSettings: Record<string, unknown> | null;
  newSettings: Record<string, unknown> | null;
  reason: string;
  createdAt: string;
}

export interface WorkflowTransition {
  id: string;
  instanceId?: string;
  fromState: string;
  toState: string;
  fromStatus?: string;
  toStatus?: string;
  action: string;
  performedBy: string;
  notes: string;
  comments?: string;
  createdAt: string;
}

export interface SearchResult {
  id?: string;
  documentId?: string;
  title: string;
  description: string | null;
  mimeType: string;
  status: string;
  folderPath: string | null;
  authorName: string | null;
  authorId?: string;
  tags: string[];
  createdAt: string | null;
  updatedAt?: string | null;
  highlights?: string[];
  highlight?: Record<string, string[]>;
  metadata?: Record<string, unknown>;
  score: number;
}

export interface SearchFacetBucket {
  key: string;
  count: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total?: number;
  totalHits?: number;
  page: number;
  size: number;
  totalPages?: number;
  facets: Record<string, SearchFacetBucket[] | Record<string, number>>;
}

export interface RetentionPolicy {
  id: string;
  name: string;
  retentionYears: number;
  autoDispose: boolean;
  requiresApproval: boolean;
  createdAt: string;
}

export interface DispositionItem {
  id: string;
  documentId: string;
  documentTitle: string;
  policyName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'ON_HOLD';
  scheduledDate: string;
  graceEndDate: string;
  approvedBy: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  userId: string;
  username?: string;
  actorType?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  projectId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string;
  timestamp?: string;
  createdAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  resourceType: string | null;
  resourceId: string | null;
  read: boolean;
  emailSent: boolean;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  timestamp: string;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

/* ── Jurisdictions & Legal Frameworks ── */
export interface Jurisdiction {
  id: string;
  code: string;
  name: string;
  region: string;
  isActive: boolean;
  frameworks?: LegalFramework[];
}

export interface LegalFramework {
  id: string;
  code: string;
  name: string;
  description: string;
  authority: string;
  effectiveDate: string;
  url: string;
  jurisdictionCode: string;
}

export interface JurisdictionRetentionRule {
  id: string;
  jurisdictionCode: string;
  jurisdictionName: string;
  legalFrameworkCode: string;
  legalFrameworkName: string;
  documentCategory: string;
  minRetentionYears: number;
  maxRetentionYears: number | null;
  description: string;
  legalCitation: string;
  penaltyInfo: string | null;
  isMandatory: boolean;
}

/* ── Plugin / Extension Marketplace ── */
export interface Plugin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  vendor: string;
  pluginType: string;
  category: string;
  status: string;
  configSchema: string;
  capabilities: string;
  iconUrl: string;
  documentationUrl: string;
  isPremium: boolean;
  installedCount: number;
  createdAt: string;
  hooks?: PluginHook[];
}

export interface PluginHook {
  id: string;
  hookType: string;
  eventName: string;
  handlerConfig: string;
  executionOrder: number;
  isActive: boolean;
}

/* ── Industry Templates ── */
export interface IndustryTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string;
  industry: string;
  includedPlugins: string;
  defaultWorkflows: string;
  retentionRules: string;
  complianceFrameworks: string;
  iconUrl: string;
  isActive: boolean;
  createdAt: string;
}

/* ── Workflow Templates ── */
export interface WorkflowTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  industry: string;
  states: string;
  transitions: string;
  initialState: string;
  canvasLayout: string;
  icon: string;
  color: string;
  estimatedDurationHours: number;
  isActive: boolean;
  createdAt: string;
}
