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

export interface CirculationTransaction {
  id: number;
  transaction_type: 'checkout' | 'checkin' | 'renew';
  book_item_id: number;
  accession_number: string;
  book_title: string;
  member_id: number;
  member_name: string;
  membership_number: string;
  operator_user_id?: number;
  protocol: string;
  checkout_date: string;
  due_date?: string;
  return_date?: string;
  renewal_count: number;
  fine_amount: number;
  notes?: string;
  eas_bit?: boolean;
  created_at: string;
}

export interface DueDateEnquiryResult {
  accession_number: string;
  book_title: string;
  member_name: string;
  membership_number: string;
  checkout_date: string;
  due_date: string;
  renewal_count: number;
  is_overdue: boolean;
  days_overdue: number;
  estimated_fine: number;
}

export interface Fine {
  id: number;
  member_id: number;
  member_name: string;
  membership_number: string;
  circulation_transaction_id?: number;
  amount: number;
  paid_amount: number;
  status: 'unpaid' | 'paid' | 'waived';
  reason: string;
  assessed_date: string;
  settled_date?: string;
}

export interface RfidTag {
  id: number;
  tag_uid: string;
  item_type: string;
  book_item_id?: number;
  accession_number?: string;
  book_title?: string;
  shelf_location?: string;
  member_id?: number;
  member_name?: string;
  eas_bit: boolean;
  status: 'active' | 'decommissioned' | 'lost';
  last_scanned_at?: string;
  created_at: string;
}

export interface RfidTagHistory {
  id: number;
  tag_uid: string;
  item_type: string;
  book_item_id?: number;
  member_id?: number;
  assigned_at: string;
  deassigned_at?: string;
  deassignment_reason?: string;
  actor_user_id?: number;
}

export interface StaffScanItem {
  tag_uid: string;
  item_type: string;
  accession_number: string;
  barcode: string;
  book_title: string;
  author: string;
  status: string;
  eas_bit: boolean;
  is_reference_only: boolean;
}

export interface StaffScanResult {
  reader_id: string;
  timestamp: string;
  total_detected: number;
  items: StaffScanItem[];
  unknown_tags: string[];
  suppressed_duplicates: number;
}

export interface SmartCardTapResult {
  entity_type: 'staff' | 'member' | 'unknown';
  id?: number;
  username?: string;
  full_name?: string;
  role?: string;
  membership_number?: string;
  status?: string;
  fine_balance?: number;
  smart_card_uid: string;
  detail?: string;
}

