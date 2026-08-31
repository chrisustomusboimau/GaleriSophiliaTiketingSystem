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

/** Kode bahasa yang dikenal aplikasi — selaras dengan `Language` di
 *  contexts/LanguageContext.tsx dan SUPPORTED_LOCALES di api/app/i18n.py. */
export type LocaleCode = "id" | "en" | "zh";

/**
 * Nama multi-bahasa untuk Master Tiket & Sub-Kategori.
 * `id` & `en` WAJIB (ditegakkan backend lewat Pydantic + CHECK constraint),
 * `zh` opsional — kalau kosong, pembaca jatuh ke `en` lewat `resolveName()`.
 *
 * HARGA TIDAK ADA DI SINI: harga tetap satu nilai universal di
 * `TicketSubCategory.price`, apapun bahasa yang sedang aktif.
 */
export interface LocalizedName {
  id: string;
  en: string;
  zh?: string;
}

/** Bentuk longgar untuk payload form admin yang masih diketik separuh. */
export type LocalizedNameInput = Partial<Record<LocaleCode, string>>;

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
  /**
   * Cermin Bahasa Indonesia dari `name_i18n.id`, ditulis ulang backend
   * setiap kali varian disimpan. Dipakai layar & laporan STAF (yang memang
   * berbahasa Indonesia) dan sebagai kunci pengelompokan yang stabil —
   * JANGAN dipakai untuk layar pengunjung, pakai `name_i18n`.
   */
  name: string;
  /** Nama per bahasa yang dilihat pengunjung. */
  name_i18n: LocalizedName;
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
  /**
   * Versi multi-bahasa dari `ticket_master_name`. Inilah yang dipakai
   * halaman pemilihan tiket pengunjung untuk menampilkan nama lantai
   * sesuai bahasa aktif.
   */
  ticket_master_name_i18n?: LocalizedName | null;
}

export interface TicketMaster {
  id: string;
  /** Cermin Bahasa Indonesia — lihat catatan di TicketSubCategory.name. */
  name: string;
  name_i18n: LocalizedName;
  description: string | null;
  /** Soft delete — false berarti sudah "dihapus" (dinonaktifkan) admin. */
  is_active: boolean;
  sub_categories: TicketSubCategory[];
}

export interface TicketSubCategoryPayload {
  /** ID & EN wajib; backend membalas 422 kalau salah satunya kosong. */
  name_i18n: LocalizedNameInput;
  min_age: number;
  max_age?: number | null;
  price: number;
  /** Kirim true untuk mengaktifkan kembali sub-kategori yang dinonaktifkan. */
  is_active?: boolean;
}

export interface TicketMasterPayload {
  /** ID & EN wajib; backend membalas 422 kalau salah satunya kosong. */
  name_i18n: LocalizedNameInput;
  description?: string | null;
  /** Kirim true untuk mengaktifkan kembali master yang dinonaktifkan. */
  is_active?: boolean;
}

// Helper: sub-category yang "diratakan" & tahu master induknya.
// Dipakai di UI (dropdown, checklist sesi, editor transaksi) supaya
// tidak perlu terus-menerus melakukan nested lookup.
export interface FlatSubCategory extends TicketSubCategory {
  /** Nama master versi Bahasa Indonesia (layar staf). */
  master_name: string;
  /** Nama master per bahasa (kalau perlu ditampilkan ke pengunjung). */
  master_name_i18n: LocalizedName;
}

export function flattenTicketMasters(masters: TicketMaster[]): FlatSubCategory[] {
  return masters.flatMap((m) =>
    m.sub_categories.map((sc) => ({ ...sc, master_name: m.name, master_name_i18n: m.name_i18n }))
  );
}

// ==========================================
// OPERATIONAL SESSION & AUDIT
// ==========================================

export interface ActiveSessionStatus {
  has_active: boolean;
  server_time: string;
  session: OperationalSession | null;
}

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
  /**
   * True HANYA untuk sesi yang sudah dibuka admin DAN jam dinding sekarang
   * ada di dalam rentangnya (half-open: `start <= now < end`). Dihitung
   * backend, bukan di browser, supaya tidak bergantung pada jam perangkat
   * pengunjung yang bisa salah. Ini yang memberi label "Berlangsung".
   */
  is_live: boolean;
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
  /** Cermin Bahasa Indonesia — dipakai laporan & ekspor CSV staf. */
  ticket_name_snapshot: string;
  /** Snapshot per bahasa, dibekukan saat transaksi dibuat (layar pengunjung). */
  ticket_name_snapshot_i18n?: LocalizedName;
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
