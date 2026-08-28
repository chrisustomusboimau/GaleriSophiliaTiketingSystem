/**
 * src/types/index.ts
 * ----------------------------------------------------
 * Definisi TypeScript tunggal untuk seluruh entitas backend.
 * Menggantikan interface-interface lama yang tersebar & memakai
 * struktur "floor / age_category" hardcoded. Semua tipe di sini
 * mengikuti skema FastAPI (app/schema.py) apa adanya.
 */

// ==========================================
// SHARED / PRIMITIVES
// ==========================================

export type UserRole = "admin" | "kasir" | "checker";

export type SessionStatus = "draft" | "opened" | "closed";

export type TransactionStatus = "pending" | "confirmed" | "cancelled" | "paid";

export type PaymentMethod = "qris" | "card" | "cash";

// ==========================================
// AUTH / USER (fastapi-users + role kustom)
// ==========================================

export interface UserStaff {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_verified?: boolean;
  is_superuser?: boolean;
}

export interface UserUpdatePayload {
  email?: string;
  role?: UserRole;
  is_active?: boolean;
  password?: string;
}

export interface UserRegisterPayload {
  email: string;
  password: string;
  role: UserRole;
  is_active?: boolean;
  is_superuser?: boolean;
  is_verified?: boolean;
}

// ==========================================
// TICKET MASTER & SUB CATEGORY (Master Data)
// ==========================================

export interface TicketSubCategory {
  id: string;
  ticket_master_id: string;
  name: string;
  min_age: number;
  max_age: number | null;
  price: number;
  /** Soft delete — false berarti sudah "dihapus" (dinonaktifkan) admin. */
  is_active: boolean;
  /**
   * Nama master induk (mis. "Tiket Lantai 1"), BARU disertakan backend lewat
   * properti komputasi `TicketSubCategory.ticket_master_name` — utamanya
   * dipakai endpoint publik (`GET /sessions/active`) supaya halaman
   * pemilihan tiket pengunjung bisa menampilkan nama lantai tanpa memanggil
   * `GET /ticket-masters` (khusus staf). Selalu ada di respons staf juga,
   * tapi biasanya sudah redundan di sana karena sudah dikelompokkan per
   * master oleh `flattenTicketMasters()`.
   */
  ticket_master_name?: string | null;
}

export interface TicketMaster {
  id: string;
  name: string;
  description: string | null;
  /** Soft delete — false berarti sudah "dihapus" (dinonaktifkan) admin. */
  is_active: boolean;
  sub_categories: TicketSubCategory[];
}

export interface TicketSubCategoryPayload {
  name: string;
  min_age: number;
  max_age?: number | null;
  price: number;
  /** Kirim true untuk mengaktifkan kembali sub-kategori yang dinonaktifkan. */
  is_active?: boolean;
}

export interface TicketMasterPayload {
  name: string;
  description?: string | null;
  /** Kirim true untuk mengaktifkan kembali master yang dinonaktifkan. */
  is_active?: boolean;
}

// Helper: sub-category yang "diratakan" & tahu master induknya.
// Dipakai di UI (dropdown, checklist sesi, editor transaksi) supaya
// tidak perlu terus-menerus melakukan nested lookup.
export interface FlatSubCategory extends TicketSubCategory {
  master_name: string;
}

export function flattenTicketMasters(masters: TicketMaster[]): FlatSubCategory[] {
  return masters.flatMap((m) =>
    m.sub_categories.map((sc) => ({ ...sc, master_name: m.name }))
  );
}

// ==========================================
// OPERATIONAL SESSION & AUDIT
// ==========================================

export interface SessionTicketAudit {
  id: string;
  session_ticket_id: string;
  start_ticket_number: number | null;
  end_ticket_number: number | null;
}

export interface SessionTicket {
  id: string;
  session_id: string;
  ticket_sub_category_id: string;
  /**
   * Nama field ini dikonfirmasi dari app/schema.py: `SessionTicketRead.sub_category`
   * (BUKAN `ticket_sub_category` seperti pada paket sebelumnya). Selalu ada
   * (tidak Optional di backend), tapi tetap ditandai opsional di sini sebagai
   * jaring pengaman UI.
   */
  sub_category?: TicketSubCategory;
  audit: SessionTicketAudit | null;
}

export interface OperationalSession {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  status: SessionStatus;
  active_tickets: SessionTicket[];
}

export interface OperationalSessionPayload {
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  ticket_sub_category_ids: string[];
}

/** Satu baris perubahan dalam permintaan bulk-save nomor tiket fisik. */
export interface SessionTicketAuditBulkItem {
  session_ticket_id: string;
  /** Kirim hanya field yang benar-benar diubah user; field lain biarkan undefined. */
  start_ticket_number?: number;
  end_ticket_number?: number;
}

export interface SessionTicketAuditBulkPayload {
  items: SessionTicketAuditBulkItem[];
}

// ==========================================
// TRANSACTIONS
// ==========================================

export interface TransactionItem {
  id?: string;
  ticket_sub_category_id: string;
  ticket_name_snapshot: string;
  quantity: number;
  unit_price: number;
}

export interface TransactionOrigin {
  id?: string;
  country_code: string;
  count: number;
}

export interface TransactionEntry {
  id: string;
  /** Wajib ada per TransactionResponse.session_id: uuid.UUID (non-nullable). */
  session_id: string;
  queue_number: number;
  ticket_code: string;
  /** Wajib diisi per TransactionCreate.customer_name: str = Field(..., min_length=1). */
  customer_name: string;
  date_only: string;
  total_price: number;
  status: TransactionStatus;
  payment_method: PaymentMethod;
  confirmed_at: string | null;
  created_at: string;
  items: TransactionItem[];
  origins: TransactionOrigin[];
}

export interface TransactionItemInput {
  ticket_sub_category_id: string;
  quantity: number;
}

export interface TransactionOriginInput {
  country_code: string;
  count: number;
}

export interface TransactionCreatePayload {
  /** Wajib per TransactionCreate.customer_name: str = Field(..., min_length=1) di backend. */
  customer_name: string;
  payment_method: PaymentMethod;
  items: TransactionItemInput[];
  origins: TransactionOriginInput[];
}

export interface TransactionUpdatePayload {
  customer_name?: string | null;
  items?: TransactionItemInput[];
  origins?: TransactionOriginInput[];
  status?: TransactionStatus;
  payment_method?: PaymentMethod;
}

export interface TransactionStatusPayload {
  status: TransactionStatus;
}

// Alias lama dipertahankan sebentar untuk kompatibilitas nama import,
// tapi menunjuk ke bentuk data baru. Komponen baru sebaiknya memakai
// `TransactionEntry` secara langsung.
export type Visitor = TransactionEntry;
export type Transaction = TransactionEntry;
