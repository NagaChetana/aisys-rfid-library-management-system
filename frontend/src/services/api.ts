import { AuthResponse, Book, Member, DashboardStats, SystemHealth, VirtualShelfItem } from '../types';

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
};
