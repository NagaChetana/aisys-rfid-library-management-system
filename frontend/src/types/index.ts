export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role_id: number;
  role_name?: string;
  smart_card_uid?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface BookItem {
  id: number;
  book_id: number;
  accession_number: string;
  barcode: string;
  copy_number: number;
  shelf_location: string;
  status: string;
  is_reference_only: boolean;
  price: number;
  migration_batch_id?: number;
  rfid_tag_uid?: string;
  rfid_eas_bit?: boolean;
  created_at: string;
}

export interface Book {
  id: number;
  isbn: string;
  title: string;
  subtitle?: string;
  publisher?: string;
  publish_year?: number;
  edition?: string;
  pages?: number;
  description?: string;
  is_serial: boolean;
  call_number?: string;
  author_id: number;
  author_name?: string;
  category_id: number;
  category_name?: string;
  category_code?: string;
  copies_count: number;
  available_copies_count: number;
  migration_batch_id?: number;
  items: BookItem[];
  created_at: string;
  updated_at: string;
}

export interface VirtualShelfItem {
  id: number;
  isbn: string;
  title: string;
  author: string;
  call_number?: string;
  category_code: string;
  shelf_location: string;
  available_copies: number;
  total_copies: number;
}

export interface Member {
  id: number;
  membership_number: string;
  full_name: string;
  email?: string;
  phone?: string;
  smart_card_uid?: string;
  status: 'active' | 'suspended' | 'blocked';
  fine_balance: number;
  max_allowed_loans: number;
  membership_type: string;
  expiry_date?: string;
  active_loans_count: number;
  migration_batch_id?: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_titles: number;
  total_copies: number;
  available_copies: number;
  checked_out_copies: number;
  tagged_copies: number;
  tag_coverage_percent: number;
  total_members: number;
  active_members: number;
  blocked_members: number;
  active_loans: number;
  total_overdue: number;
  total_unpaid_fines: number;
  gate_alarms_count: number;
  recent_transactions: {
    id: number;
    type: string;
    book_title: string;
    accession_number: string;
    member_name: string;
    date?: string;
    status: string;
  }[];
  category_distribution: { name: string; count: number }[];
  shelf_distribution: { shelf: string; count: number }[];
}

export interface SystemHealth {
  status: string;
  service: string;
  version: string;
  sop_compliance: string;
  database: {
    status: string;
    engine: string;
    journal_mode: string;
    file_size_kb: number;
    wal_size_kb: number;
  };
  disk: {
    total_gb: number;
    free_gb: number;
  };
  offline_ready: boolean;
}
