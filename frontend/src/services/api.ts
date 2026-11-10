import {
  AuthResponse, Book, Member, DashboardStats, SystemHealth, VirtualShelfItem,
  CirculationTransaction, DueDateEnquiryResult, Fine, RfidTag, RfidTagHistory,
  StaffScanResult, SmartCardTapResult,
  InventorySession, InventorySessionDetail, BulkInventoryScanResult,
  GateEvent, GateStats, NotificationRecord, MigrationBatch, MigrationValidationReport,
  User, UserCreateRequest, UserUpdateRequest,
  DatabaseBackup, BackupValidationResult, OfflineVersionInfo, UpdateHistoryItem
} from '../types';

const BASE_URL = 'http://127.0.0.1:8000/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Error: ${response.status} ${response.statusText}`;
    let errJson: any = null;
    try {
      errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new ApiError(errorDetail, response.status, errJson);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  smartCardLogin: (smart_card_uid: string) =>
    request<AuthResponse>('/auth/smartcard-login', {
      method: 'POST',
      body: JSON.stringify({ smart_card_uid }),
    }),

  getCurrentUser: () => request<AuthResponse['user']>('/auth/me'),

  // Books
  getBooks: (params: { q?: string; category_id?: number; shelf_location?: string; status?: string; skip?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.q) query.append('q', params.q);
    if (params.category_id) query.append('category_id', params.category_id.toString());
    if (params.shelf_location) query.append('shelf_location', params.shelf_location);
    if (params.status) query.append('status', params.status);
    if (params.skip !== undefined) query.append('skip', params.skip.toString());
    if (params.limit !== undefined) query.append('limit', params.limit.toString());
    return request<{ items: Book[]; total: number; skip: number; limit: number }>(`/books?${query.toString()}`);
  },

  getBook: (id: number) => request<Book>(`/books/${id}`),

  createBook: (data: any) =>
    request<Book>('/books', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addBookCopy: (bookId: number, data: any) =>
    request<any>(`/books/${bookId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getVirtualBookshelf: (categoryCode?: string) => {
    const query = categoryCode ? `?category_code=${categoryCode}` : '';
    return request<VirtualShelfItem[]>(`/books/virtual-shelf${query}`);
  },

  getCategories: () => request<any[]>('/books/categories'),

  // Members
  getMembers: (params: { q?: string; status?: string; skip?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.q) query.append('q', params.q);
    if (params.status) query.append('status', params.status);
    if (params.skip !== undefined) query.append('skip', params.skip.toString());
    if (params.limit !== undefined) query.append('limit', params.limit.toString());
    return request<{ items: Member[]; total: number; skip: number; limit: number }>(`/members?${query.toString()}`);
  },

  getMember: (id: number) => request<Member>(`/members/${id}`),

  createMember: (data: any) =>
    request<Member>('/members', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  blockMember: (id: number, reason: string) =>
    request<Member>(`/members/${id}/block?reason=${encodeURIComponent(reason)}`, {
      method: 'POST',
    }),

  unblockMember: (id: number) =>
    request<Member>(`/members/${id}/unblock`, {
      method: 'POST',
    }),

  assignMemberCard: (id: number, smart_card_uid: string) =>
    request<Member>(`/members/${id}/assign-card`, {
      method: 'POST',
      body: JSON.stringify({ smart_card_uid }),
    }),

  // Reports & Analytics
  getDashboardStats: () => request<DashboardStats>('/reports/dashboard-stats'),

  // Admin & Health
  getSystemHealth: () => request<SystemHealth>('/admin/health'),
  getDiagnostics: () => request<any>('/admin/diagnostics'),

  // Circulation (Batch 2)
  checkout: (data: {
    membership_number?: string;
    member_id?: number;
    member_smart_card_uid?: string;
    accession_number?: string;
    barcode?: string;
    tag_uid?: string;
    due_days?: number;
    protocol?: string;
  }) =>
    request<CirculationTransaction>('/circulation/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  checkin: (data: {
    accession_number?: string;
    barcode?: string;
    tag_uid?: string;
    protocol?: string;
    notes?: string;
  }) =>
    request<CirculationTransaction>('/circulation/checkin', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  renew: (data: {
    transaction_id?: number;
    accession_number?: string;
    tag_uid?: string;
    additional_days?: number;
    protocol?: string;
  }) =>
    request<CirculationTransaction>('/circulation/renew', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  dueDateEnquiry: (params: { accession_number?: string; tag_uid?: string }) => {
    const query = new URLSearchParams();
    if (params.accession_number) query.append('accession_number', params.accession_number);
    if (params.tag_uid) query.append('tag_uid', params.tag_uid);
    return request<DueDateEnquiryResult>(`/circulation/due-date-enquiry?${query.toString()}`);
  },

  getCirculationHistory: (params: {
    skip?: number;
    limit?: number;
    q?: string;
    member_id?: number;
    book_item_id?: number;
    transaction_type?: string;
    status?: string;
    protocol?: string;
    active_only?: boolean;
  }) => {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.append('skip', params.skip.toString());
    if (params.limit !== undefined) query.append('limit', params.limit.toString());
    if (params.q) query.append('q', params.q);
    if (params.member_id) query.append('member_id', params.member_id.toString());
    if (params.book_item_id) query.append('book_item_id', params.book_item_id.toString());
    if (params.transaction_type) query.append('transaction_type', params.transaction_type);
    if (params.status) query.append('status', params.status);
    if (params.protocol) query.append('protocol', params.protocol);
    if (params.active_only) query.append('active_only', 'true');
    return request<{ items: CirculationTransaction[]; total: number; skip: number; limit: number }>(
      `/circulation/history?${query.toString()}`
    );
  },

  getFines: (params: { member_id?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params.member_id) query.append('member_id', params.member_id.toString());
    if (params.status) query.append('status', params.status);
    return request<Fine[]>(`/circulation/fines?${query.toString()}`);
  },

  payFine: (fineId: number, amount?: number) =>
    request<Fine>(`/circulation/fines/${fineId}/pay`, {
      method: 'POST',
      body: JSON.stringify(amount !== undefined ? { amount } : {}),
    }),

  // RFID Middleware & Hardware (Batch 2)
  getRfidTags: (params: { skip?: number; limit?: number; q?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.append('skip', params.skip.toString());
    if (params.limit !== undefined) query.append('limit', params.limit.toString());
    if (params.q) query.append('q', params.q);
    if (params.status) query.append('status', params.status);
    return request<{ items: RfidTag[]; total: number; skip: number; limit: number }>(`/rfid/tags?${query.toString()}`);
  },

  tagBookItem: (data: { book_item_id: number; tag_uid?: string; eas_bit?: boolean }) =>
    request<RfidTag>('/rfid/tag-item', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  retagBookItem: (data: { book_item_id: number; new_tag_uid?: string; reason?: string }) =>
    request<RfidTag>('/rfid/retag', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTagHistory: (params: { book_item_id?: number; tag_uid?: string }) => {
    const query = new URLSearchParams();
    if (params.book_item_id) query.append('book_item_id', params.book_item_id.toString());
    if (params.tag_uid) query.append('tag_uid', params.tag_uid);
    return request<RfidTagHistory[]>(`/rfid/history?${query.toString()}`);
  },

  simulateStaffScan: (data: { reader_id?: string; tag_uids: string[]; enforce_dedup?: boolean }) =>
    request<StaffScanResult>('/rfid/simulate/staff-scan', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  simulateSmartCardTap: (smart_card_uid: string) =>
    request<SmartCardTapResult>('/rfid/simulate/smart-card-tap', {
      method: 'POST',
      body: JSON.stringify({ smart_card_uid }),
    }),

  // Interoperability (Batch 2)
  processNcip: (payload: any) =>
    request<any>('/interop/ncip', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  processSip2: (raw_frame: string) =>
    request<{ raw_response: string; checksum: string; parsed: any }>('/interop/sip2', {
      method: 'POST',
      body: JSON.stringify({ raw_frame }),
    }),

  // Inventory & Stock Verification (Batch 3)
  createInventorySession: (data: { session_name: string; target_shelf: string }) =>
    request<InventorySession>('/inventory/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getInventorySessions: (params: { skip?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.append('skip', params.skip.toString());
    if (params.limit !== undefined) query.append('limit', params.limit.toString());
    return request<{ items: InventorySession[]; total: number; skip: number; limit: number }>(
      `/inventory/sessions?${query.toString()}`
    );
  },

  getInventorySession: (id: number) =>
    request<InventorySessionDetail>(`/inventory/sessions/${id}`),

  scanInventoryItems: (sessionId: number, data: { tag_uids: string[]; detected_shelf?: string }) =>
    request<BulkInventoryScanResult>(`/inventory/sessions/${sessionId}/scan`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  completeInventorySession: (sessionId: number) =>
    request<InventorySessionDetail>(`/inventory/sessions/${sessionId}/complete`, {
      method: 'POST',
    }),

  // RFID Security Gate & CCTV (Batch 3)
  simulateGatePassage: (data: { reader_id?: string; tag_uids: string[]; is_person_passing?: boolean }) =>
    request<GateEvent[]>('/gate/simulate-passage', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  recordFootfall: (count: number = 1) =>
    request<{ status: string; recorded: number; cumulative_footfall: number }>(
      `/gate/record-footfall?count=${count}`,
      { method: 'POST' }
    ),

  getGateEvents: (params: { alarm_only?: boolean; limit?: number; skip?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.alarm_only) query.append('alarm_only', 'true');
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.skip) query.append('skip', params.skip.toString());
    return request<{ items: GateEvent[]; total: number; skip: number; limit: number }>(
      `/gate/events?${query.toString()}`
    );
  },

  getGateStats: () => request<GateStats>('/gate/stats'),

  // Notifications Queue (Batch 3)
  getNotifications: (params: { status?: string; channel?: string; limit?: number; skip?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.channel) query.append('channel', params.channel);
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.skip) query.append('skip', params.skip.toString());
    return request<NotificationRecord[]>(`/notifications?${query.toString()}`);
  },

  sendTestNotification: (data: { channel?: string; recipient: string; subject: string; body: string }) =>
    request<NotificationRecord>('/notifications/send-test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Data Migration (20,000 Records & Scoped Rollback) (Batch 3)
  uploadMigrationCsv: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('access_token');
    return fetch('http://127.0.0.1:8000/api/migration/upload', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Upload error: ${res.status}`);
      }
      return res.json() as Promise<MigrationBatch>;
    });
  },

  generateSyntheticMigration: (recordCount: number = 20000, invalidCount: number = 100) =>
    request<MigrationBatch>('/migration/generate-synthetic', {
      method: 'POST',
      body: JSON.stringify({ record_count: recordCount, invalid_count: invalidCount }),
    }),

  getMigrationBatches: (params: { skip?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.append('skip', params.skip.toString());
    if (params.limit !== undefined) query.append('limit', params.limit.toString());
    return request<MigrationBatch[]>(`/migration/batches?${query.toString()}`);
  },

  getMigrationReport: (batchId: number) =>
    request<MigrationValidationReport>(`/migration/batches/${batchId}/report`),

  executeMigration: (batchId: number) =>
    request<MigrationBatch>(`/migration/batches/${batchId}/execute`, {
      method: 'POST',
    }),

  rollbackMigration: (batchId: number) =>
    request<{ batch_id: number; batch_number: string; status: string; deleted_books_count: number; message: string }>(
      `/migration/batches/${batchId}/rollback`,
      { method: 'POST' }
    ),

  // --- ACQUISITIONS & SERIALS (FR01) ---
  getSuppliers: () => request<any[]>('/acquisitions/suppliers'),
  createSupplier: (data: any) =>
    request<any>('/acquisitions/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPurchaseOrders: () => request<any[]>('/acquisitions/orders'),
  createPurchaseOrder: (data: any) =>
    request<any>('/acquisitions/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  receivePurchaseOrderItem: (orderId: number, data: any) =>
    request<any>(`/acquisitions/orders/${orderId}/receive`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSerialSubscriptions: () => request<any[]>('/acquisitions/serials'),
  createSerialSubscription: (data: any) =>
    request<any>('/acquisitions/serials', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  receiveSerialIssue: (subscriptionId: number, data: any) =>
    request<any>(`/acquisitions/serials/${subscriptionId}/issues`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // --- BARCODE & SPINE LABELS (FR01) ---
  getSpineLabel: (accessionNumber: string) =>
    request<any>(`/books/items/${encodeURIComponent(accessionNumber)}/spine-label`),

  // --- RFID READERS & TAG HEALTH (FR03, FR05) ---
  getReaderClients: () => request<any[]>('/rfid/readers'),
  sendReaderHeartbeat: (data: { reader_id: string; status?: string; ip_address?: string }) =>
    request<any>('/rfid/readers/heartbeat', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getTagHealthSummary: () => request<any>('/rfid/tags/health'),

  // --- SYSTEM SETTINGS CONFIGURATION (FR11) ---
  getSystemSettings: () => request<any[]>('/admin/settings'),
  updateSystemSettings: (data: Record<string, any>) =>
    request<{ message: string; updated: Record<string, any> }>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // --- NOTIFICATION RETRY & ADAPTERS (FR09) ---
  getNotificationAdapters: () => request<{ adapters: any[] }>('/notifications/adapters'),
  retryNotification: (id: number) =>
    request<any>(`/notifications/${id}/retry`, {
      method: 'POST',
    }),

  // --- FILTERABLE REPORTS & CSV EXPORT (FR08, AC08) ---
  getCirculationReport: (params: { transaction_type?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.transaction_type) q.append('transaction_type', params.transaction_type);
    if (params.limit) q.append('limit', params.limit.toString());
    return request<{ total: number; records: any[] }>(`/reports/circulation?${q.toString()}`);
  },
  getTaggedItemsReport: (params: { status?: string; shelf_location?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.append('status', params.status);
    if (params.shelf_location) q.append('shelf_location', params.shelf_location);
    if (params.limit) q.append('limit', params.limit.toString());
    return request<{ total: number; records: any[] }>(`/reports/tagged-items?${q.toString()}`);
  },
  getMembersReport: (params: { status?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.append('status', params.status);
    if (params.limit) q.append('limit', params.limit.toString());
    return request<{ total: number; records: any[] }>(`/reports/members?${q.toString()}`);
  },
  getFinesReport: (params: { status?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.append('status', params.status);
    if (params.limit) q.append('limit', params.limit.toString());
    return request<{ total: number; records: any[] }>(`/reports/fines?${q.toString()}`);
  },
  getGateEventsReport: (params: { alarm_only?: boolean; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.alarm_only !== undefined) q.append('alarm_only', params.alarm_only.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    return request<{ total: number; records: any[] }>(`/reports/gate-events?${q.toString()}`);
  },
  getOperatorActivityReport: (params: { action?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.action) q.append('action', params.action);
    if (params.limit) q.append('limit', params.limit.toString());
    return request<{ total: number; records: any[] }>(`/reports/operator-activity?${q.toString()}`);
  },

  // Admin User Management
  listAdminUsers: () => request<User[]>('/admin/users'),

  createAdminUser: (data: UserCreateRequest) =>
    request<User>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAdminUser: (id: number, data: UserUpdateRequest) =>
    request<User>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleAdminUserStatus: (id: number) =>
    request<{ id: number; is_active: boolean; message: string }>(`/admin/users/${id}/toggle-status`, {
      method: 'POST',
    }),

  getRoles: () => request<any[]>('/admin/roles'),

  getAuditLogs: (limit: number = 100) => request<any[]>(`/admin/audit-logs?limit=${limit}`),

  // Backup, Restore & Disaster Recovery (AC10, FR11)
  createBackup: (note?: string) =>
    request<DatabaseBackup>('/admin/backups', {
      method: 'POST',
      body: JSON.stringify(note ? { note } : {}),
    }),

  listBackups: () => request<DatabaseBackup[]>('/admin/backups'),

  validateBackup: (filename: string) =>
    request<BackupValidationResult>(`/admin/backups/${encodeURIComponent(filename)}/validate`),

  restoreBackup: (filename: string) =>
    request<{ message: string; restored_from: string; path: string }>(`/admin/backups/${encodeURIComponent(filename)}/restore`, {
      method: 'POST',
    }),

  // Offline Updates & Lifecycle (AC09, FR12)
  getApplicationVersion: () => request<OfflineVersionInfo>('/admin/updates/version'),

  getUpdateHistory: () => request<UpdateHistoryItem[]>('/admin/updates/history'),

  applyUpdatePackage: (packagePath: string) =>
    request<{ message: string; version: string; snapshot_id: string }>('/admin/updates/apply', {
      method: 'POST',
      body: JSON.stringify({ package_path: packagePath }),
    }),

  rollbackUpdatePackage: (snapshotId?: string) =>
    request<{ message: string; rolled_back_to: string }>('/admin/updates/rollback', {
      method: 'POST',
      body: JSON.stringify(snapshotId ? { snapshot_id: snapshotId } : {}),
    }),
};
