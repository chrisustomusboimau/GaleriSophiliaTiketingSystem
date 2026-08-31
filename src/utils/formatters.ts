/**
 * src/utils/formatters.ts
 * ----------------------------------------------------
 * Pengganti `priceCalculator.ts` lama. Tidak ada lagi tabel harga
 * hardcoded per lantai/kategori usia — harga selalu berasal dari
 * Master Data (TicketSubCategory.price) yang diambil dari backend.
 * File ini hanya berisi fungsi format & helper murni (tanpa state).
 */

import {
  FlatSubCategory,
  LocaleCode,
  LocalizedName,
  TransactionItemInput,
  TicketMaster,
} from "../types";

/* =====================================================
   NAMA MULTI-BAHASA
===================================================== */

/**
 * Urutan bahasa cadangan. Dibaca kiri ke kanan; entri pertama yang ada
 * isinya yang dipakai. Ini KEMBARAN dari FALLBACK_CHAIN di
 * `api/app/i18n.py` — kalau salah satu diubah, ubah keduanya, kalau tidak
 * nama yang sama bisa tampil berbeda antara katalog (dibaca dari
 * name_i18n) dan struk (dibaca dari snapshot yang dibentuk backend).
 */
const FALLBACK_CHAIN: Record<LocaleCode, LocaleCode[]> = {
  id: ["id", "en"],
  en: ["en", "id"],
  zh: ["zh", "en", "id"],
};

/**
 * Mengambil nama tiket untuk satu bahasa.
 *
 * Nama Mandarin bersifat opsional bagi admin, jadi pengunjung berbahasa
 * Mandarin otomatis melihat versi English — tidak pernah label kosong.
 * Argumen `names` sengaja boleh undefined supaya layar tetap hidup kalau
 * backend belum sempat dimigrasi.
 */
export function resolveName(
  names: LocalizedName | Partial<Record<LocaleCode, string>> | null | undefined,
  lang: LocaleCode,
  fallback = ""
): string {
  if (!names) return fallback;

  for (const locale of FALLBACK_CHAIN[lang] ?? FALLBACK_CHAIN.id) {
    const text = (names as Record<string, string | undefined>)[locale]?.trim();
    if (text) return text;
  }

  // Jaring pengaman terakhir: bahasa apa pun yang kebetulan terisi.
  for (const text of Object.values(names as Record<string, string | undefined>)) {
    const trimmed = text?.trim();
    if (trimmed) return trimmed;
  }

  return fallback;
}

/** Format angka menjadi Rupiah, contoh: 150000 -> "Rp150.000" */
export function formatCurrency(amount: number | null | undefined): string {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** dd/mm/yyyy */
export function formatDateID(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** HH:mm */
export function formatTimeID(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTimeID(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return `${formatDateID(dateStr)} ${formatTimeID(dateStr)}`;
}

/** "13:30:00" (backend) -> "13:30" (input[type=time]) */
export function toTimeInputValue(time: string | null | undefined): string {
  if (!time) return "";
  return time.slice(0, 5);
}

/** "13:30" (input[type=time]) -> "13:30:00" (backend) */
export function toApiTime(value: string): string {
  if (!value) return "";
  return value.length === 5 ? `${value}:00` : value;
}

/** Menghitung total harga dari daftar item yang dipilih terhadap master data. */
export function calculateItemsTotal(
  items: TransactionItemInput[],
  catalog: FlatSubCategory[]
): number {
  const priceMap = new Map(catalog.map((c) => [c.id, c.price]));
  return items.reduce((sum, item) => {
    const price = priceMap.get(item.ticket_sub_category_id) ?? 0;
    return sum + price * item.quantity;
  }, 0);
}

/**
 * `TicketSubCategoryRead` (per app/schema.py) TIDAK membawa nama master
 * induknya — hanya `ticket_master_id`. Jadi untuk menampilkan label
 * "Tiket Lantai 1 — Dewasa" di layar yang hanya punya sub-kategori lepas
 * (mis. dari `SessionTicketRead.sub_category`), bangun dulu peta
 * `sub_category_id -> master_name` dari `GET /ticket-masters` (endpoint
 * staf) memakai fungsi ini, lalu lookup per id.
 */
export function buildSubCategoryMasterMap(masters: TicketMaster[]): Record<string, string> {
  const map: Record<string, string> = {};
  masters.forEach((m) => {
    m.sub_categories.forEach((sc) => {
      map[sc.id] = m.name;
    });
  });
  return map;
}

/** Palet warna deterministik berdasarkan nama master tiket (bukan lagi daftar lantai tetap). */
const MASTER_COLOR_THEMES = [
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-purple-100 text-purple-800 border-purple-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
];

export function getMasterColorTheme(masterName: string): string {
  if (!masterName) return "bg-gray-100 text-gray-800 border-gray-200";
  let hash = 0;
  for (let i = 0; i < masterName.length; i++) {
    hash = (hash * 31 + masterName.charCodeAt(i)) >>> 0;
  }
  return MASTER_COLOR_THEMES[hash % MASTER_COLOR_THEMES.length];
}

/** Memisahkan "Tiket Lantai 1 - Dewasa" -> { group: "Tiket Lantai 1", variant: "Dewasa" } */
export function splitTicketSnapshot(snapshot: string): { group: string; variant: string } {
  const idx = snapshot.indexOf(" - ");
  if (idx === -1) return { group: snapshot, variant: "" };
  return { group: snapshot.slice(0, idx), variant: snapshot.slice(idx + 3) };
}

/**
 * Versi multi-bahasa dari `splitTicketSnapshot` untuk layar PENGUNJUNG
 * (struk / halaman antrean). Memilih snapshot sesuai bahasa aktif lalu
 * memakai parser yang sama persis di atas.
 *
 * Kalau item lama belum punya snapshot i18n (transaksi sebelum migrasi),
 * otomatis jatuh ke kolom cermin `ticket_name_snapshot` — layar tidak
 * pernah kosong.
 *
 * Layar STAF sengaja tetap memanggil `splitTicketSnapshot` langsung:
 * laporan, ringkasan, dan ekspor CSV memang selalu Bahasa Indonesia.
 */
export function resolveSnapshot(
  item: { ticket_name_snapshot: string; ticket_name_snapshot_i18n?: LocalizedName },
  lang: LocaleCode
): { group: string; variant: string; full: string } {
  const full = resolveName(item.ticket_name_snapshot_i18n, lang, item.ticket_name_snapshot);
  return { ...splitTicketSnapshot(full), full };
}

export const SESSION_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  opened: "Dibuka",
  closed: "Ditutup",
};

export const SESSION_STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-300",
  opened: "bg-green-100 text-green-700 border-green-300",
  closed: "bg-red-100 text-red-700 border-red-300",
};

/**
 * Label "sedang berjalan sekarang" — SENGAJA TERPISAH dari badge status di
 * atas. "Dibuka" (status) dan "Berlangsung" (jam dinding ada di dalam
 * rentang sesi) adalah dua hal berbeda: sesi bisa berstatus Dibuka tapi
 * jadwalnya baru mulai nanti sore. Hanya sesi berlabel inilah yang
 * melayani pembelian tiket pengunjung.
 */
export const SESSION_LIVE_LABEL = "Berlangsung";
export const SESSION_LIVE_BADGE =
  "bg-[#fb9418] text-black border-[#fb9418] font-black";

export const TRANSACTION_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Lunas",
  paid: "Lunas",
  cancelled: "Batal",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  qris: "QRIS",
  card: "Kartu Kredit/Debit",
  cash: "Tunai",
};

export const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  kasir: "Kasir",
  checker: "Checker",
};
