import {
  AuthResponse, Book, Member, DashboardStats, SystemHealth, VirtualShelfItem,
  CirculationTransaction, DueDateEnquiryResult, Fine, RfidTag, RfidTagHistory,
  StaffScanResult, SmartCardTapResult
} from '../types';

const BASE_URL = 'http://127.0.0.1:8000/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
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
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
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
    member_id?: number;
    book_item_id?: number;
    transaction_type?: string;
    active_only?: boolean;
  }) => {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.append('skip', params.skip.toString());
    if (params.limit !== undefined) query.append('limit', params.limit.toString());
    if (params.member_id) query.append('member_id', params.member_id.toString());
    if (params.book_item_id) query.append('book_item_id', params.book_item_id.toString());
    if (params.transaction_type) query.append('transaction_type', params.transaction_type);
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
};
