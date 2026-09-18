# app/schema.py
# ==========================================================
# PYDANTIC SCHEMAS (Penyelarasan Skema Lama & Skema Baru)
#
# UPDATE pada putaran ini:
# - TicketMasterRead / TicketSubCategoryRead: tambah field `is_active`
#   (soft delete — lihat app/db.py & app/main.py).
# - TicketMasterUpdate / TicketSubCategoryUpdate: tambah field opsional
#   `is_active` supaya admin bisa "mengaktifkan kembali" via endpoint PATCH
#   yang sama (tidak perlu endpoint baru).
# - BARU: SessionTicketAuditBulkItem / SessionTicketAuditBulkUpdate untuk
#   mekanisme "satu tombol Simpan" di halaman Detail Audit.
#
# UPDATE v2:
# - PaymentTerminal*  : master terminal pembayaran (EDC 1, QRIS Meja 2, ...).
# - AgeCategory*      : master varian kategori usia yang terpusat.
# - CashierSession*   : shift kasir + terminal yang dipakainya.
# - TicketSubCategoryCreate/Update TIDAK LAGI menerima nama & rentang usia —
#   keduanya diturunkan dari AgeCategory; admin hanya mengisi harga.
# - Transaksi membawa metode pembayaran DETAIL (terminal) di samping
#   KATEGORI yang sudah ada, plus status verifikasi Checker.
# ==========================================================

import uuid
from datetime import date, datetime, time
from enum import Enum
from typing import Annotated, Dict, List, Optional

from fastapi_users import schemas
from pydantic import AfterValidator, BaseModel, Field

from app.i18n import normalize_name_i18n

# ==========================================
# 0. TIPE NAMA MULTI-BAHASA
# ==========================================
#
# Dipakai di SEMUA skema tulis (create/update) yang menerima nama tiket.
# `normalize_name_i18n` membersihkan spasi, membuang locale kosong, dan
# melempar ValueError kalau `id` atau `en` tidak diisi — Pydantic
# mengubahnya jadi respons 422 dari FastAPI secara otomatis. Jadi aturan
# "ID & EN wajib" ditegakkan di batas API, bukan cuma di form browser.
LocalizedName = Annotated[Dict[str, str], AfterValidator(normalize_name_i18n)]

# Skema BACA memakai Dict polos (tanpa validator): data yang sudah ada di
# database tidak boleh bikin response gagal, misalnya baris lama yang
# belum sempat dilengkapi terjemahannya.
LocalizedNameRead = Dict[str, str]


# ==========================================
# 1. ENUMS
# ==========================================

class RoleEnum(str, Enum):
    admin = "admin"
    kasir = "kasir"
    checker = "checker"


class PaymentMethodEnum(str, Enum):
    """
    KATEGORI metode pembayaran. `card` ADALAH kategori EDC — nilainya
    sengaja tidak diganti jadi "edc" supaya tidak ada satu pun baris
    transaksi lama yang perlu ditulis ulang; yang berubah hanya labelnya
    di layar (PAYMENT_METHOD_LABEL di frontend).

    Dipakai juga sebagai kategori `PaymentTerminal` — daftar nilainya
    memang harus identik, karena kategori transaksi diturunkan langsung
    dari kategori terminal yang dipilih kasir.
    """
    qris = "qris"
    cash = "cash"
    card = "card"


class VerificationStatusEnum(str, Enum):
    """Status verifikasi Checker. `approved` mengunci transaksi dari kasir."""
    pending  = "pending"
    approved = "approved"


class TransactionStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    paid = "paid"
    cancelled = "cancelled"


class SessionStatus(str, Enum):
    draft = "draft"
    opened = "opened"
    closed = "closed"


# Alias untuk kompatibilitas impor nama pendek/lama
PaymentMethod = PaymentMethodEnum


# ==========================================
# 2. USER SCHEMAS (Auth & Roles)
# ==========================================

class UserRead(schemas.BaseUser[uuid.UUID]):
    role: RoleEnum


class UserCreate(schemas.BaseUserCreate):
    role: RoleEnum = RoleEnum.kasir


class UserUpdate(schemas.BaseUserUpdate):
    role: Optional[RoleEnum] = None


# ==========================================
# 2b. MASTER VARIAN KATEGORI USIA (ADMIN) — BARU v2
# ==========================================

class AgeCategoryCreate(BaseModel):
    # Nama per bahasa: {"id": "Dewasa", "en": "Adult", "zh": "成人"} — `zh`
    # opsional, aturan & validatornya sama persis dengan varian tiket lama.
    name_i18n: LocalizedName
    min_age: int = Field(default=0, ge=0)
    max_age: Optional[int] = Field(default=None, ge=0)


class AgeCategoryUpdate(BaseModel):
    name_i18n: Optional[LocalizedName] = None
    min_age: Optional[int] = Field(default=None, ge=0)
    max_age: Optional[int] = Field(default=None, ge=0)
    # Kirim `is_active: true` untuk mengaktifkan kembali varian yang
    # sebelumnya dinonaktifkan — pola yang sama dengan master tiket.
    is_active: Optional[bool] = None


class AgeCategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    name_i18n: LocalizedNameRead = {}
    min_age: int
    max_age: Optional[int] = None
    is_active: bool = True

    class Config:
        from_attributes = True


# ==========================================
# 2c. TERMINAL PEMBAYARAN (ADMIN) — BARU v2
# ==========================================

class PaymentTerminalCreate(BaseModel):
    # Nama TIDAK multi-bahasa: ini label alat fisik di meja kasir, dibaca
    # staf, bukan pengunjung — "EDC 1" tetap "EDC 1" dalam bahasa apa pun.
    name: str = Field(..., min_length=1)
    category: PaymentMethodEnum


class PaymentTerminalUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    category: Optional[PaymentMethodEnum] = None
    is_active: Optional[bool] = None


class PaymentTerminalRead(BaseModel):
    id: uuid.UUID
    name: str
    category: PaymentMethodEnum
    is_active: bool = True

    class Config:
        from_attributes = True


# ==========================================
# 3. TICKET MASTER & SUB CATEGORY (ADMIN)
# ==========================================

class TicketSubCategoryCreate(BaseModel):
    """
    UBAH v2: varian tiket tidak lagi diketik bebas per master.

    Dulu payload ini membawa `name_i18n` / `min_age` / `max_age` sendiri —
    artinya "Dewasa" di Lantai 1 dan "Dewasa" di Lantai 2 adalah dua
    definisi lepas yang gampang menyimpang. Sekarang admin memilih varian
    dari MASTER varian usia (`age_categories`) dan HANYA mengisi harga;
    backend yang menyalin nama & rentang usia ke kolom snapshot.
    """
    age_category_id: uuid.UUID
    price: int = Field(..., ge=0)


class TicketSubCategoryUpdate(BaseModel):
    """
    Yang bisa diubah per master tiket tinggal HARGA (dan status aktif).
    Nama & rentang usia diubah di master varian usia, satu tempat untuk
    semua master tiket — itulah inti sentralisasinya.
    """
    price: Optional[int] = Field(default=None, ge=0)
    # Kirim `is_active: true` untuk mengaktifkan kembali sub-kategori
    # yang sebelumnya dinonaktifkan (soft-deleted).
    is_active: Optional[bool] = None


class TicketSubCategoryRead(BaseModel):
    id: uuid.UUID
    ticket_master_id: uuid.UUID
    # BARU v2 — tautan ke master varian usia. Inilah kunci yang dipakai
    # halaman pengunjung untuk menggabungkan varian yang sama lintas
    # lantai jadi SATU baris input (lihat alur pemilihan tiket).
    # Optional karena baris legacy hasil migrasi bisa belum tertaut.
    age_category_id: Optional[uuid.UUID] = None
    # `name` = cermin Bahasa Indonesia (dipakai layar & laporan staf).
    name: str
    # `name_i18n` = sumber sebenarnya, dipakai layar pengunjung.
    name_i18n: LocalizedNameRead = {}
    min_age: int
    max_age: Optional[int] = None
    price: int
    is_active: bool = True
    # BARU: nama master induk (mis. "Tiket Lantai 1"), diambil dari properti
    # komputasi `TicketSubCategory.ticket_master_name` di db.py — supaya
    # endpoint publik (GET /sessions/active) bisa menampilkan label lantai
    # tanpa perlu memanggil GET /ticket-masters (khusus staf).
    ticket_master_name: Optional[str] = None
    # BARU: versi multi-bahasa dari label master di atas, supaya halaman
    # pemilihan tiket pengunjung bisa menampilkan nama lantai sesuai bahasa
    # aktif tanpa memanggil GET /ticket-masters (endpoint khusus staf).
    ticket_master_name_i18n: Optional[LocalizedNameRead] = None

    class Config:
        from_attributes = True


class TicketMasterCreate(BaseModel):
    name_i18n: LocalizedName
    description: Optional[str] = None
    sub_categories: List[TicketSubCategoryCreate] = Field(default_factory=list)


class TicketMasterUpdate(BaseModel):
    name_i18n: Optional[LocalizedName] = None
    description: Optional[str] = None
    # BARU: kirim `is_active: true` untuk mengaktifkan kembali master tiket
    # yang sebelumnya dinonaktifkan (soft-deleted).
    is_active: Optional[bool] = None


class TicketMasterRead(BaseModel):
    id: uuid.UUID
    # `name` = cermin Bahasa Indonesia; `name_i18n` = sumber sebenarnya.
    name: str
    name_i18n: LocalizedNameRead = {}
    description: Optional[str] = None
    is_active: bool = True
    sub_categories: List[TicketSubCategoryRead] = []

    class Config:
        from_attributes = True


# ==========================================
# 4. OPERATIONAL SESSION & AUDIT KASIR
# ==========================================

class OperationalSessionCreate(BaseModel):
    name: str
    date: date
    start_time: time
    end_time: time
    ticket_sub_category_ids: List[uuid.UUID] = Field(
        default_factory=list,
        description="Daftar ID sub-kategori tiket yang diaktifkan untuk sesi ini"
    )


class OperationalSessionUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None


class SessionTicketAuditRead(BaseModel):
    id: uuid.UUID
    session_ticket_id: uuid.UUID
    start_ticket_number: Optional[int] = None
    end_ticket_number: Optional[int] = None

    class Config:
        from_attributes = True


class SessionTicketAuditStartUpdate(BaseModel):
    start_ticket_number: int = Field(..., ge=0)


class SessionTicketAuditEndUpdate(BaseModel):
    end_ticket_number: int = Field(..., ge=0)


# --- BARU: Bulk save (satu tombol "Simpan" untuk semua tiket sekaligus) ---

class SessionTicketAuditBulkItem(BaseModel):
    session_ticket_id: uuid.UUID
    # Keduanya opsional per-item: kirim hanya field yang benar-benar diubah
    # user untuk tiket tsb. Field yang tidak dikirim (None) tidak disentuh.
    start_ticket_number: Optional[int] = Field(default=None, ge=0)
    end_ticket_number: Optional[int] = Field(default=None, ge=0)


class SessionTicketAuditBulkUpdate(BaseModel):
    items: List[SessionTicketAuditBulkItem] = Field(..., min_length=1)


class SessionTicketRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    ticket_sub_category_id: uuid.UUID
    sub_category: TicketSubCategoryRead
    audit: Optional[SessionTicketAuditRead] = None

    class Config:
        from_attributes = True


class OperationalSessionRead(BaseModel):
    id: uuid.UUID
    name: str
    date: date
    start_time: time
    end_time: time
    status: SessionStatus
    # BARU — dipetakan dari properti `OperationalSession.is_live` (db.py).
    # True hanya untuk sesi yang sudah dibuka DAN jam dinding sekarang ada
    # di dalam rentangnya. Dipakai label "Berlangsung" di panel admin dan
    # gerbang akses halaman pembelian pengunjung.
    is_live: bool = False
    active_tickets: List[SessionTicketRead] = []

    class Config:
        from_attributes = True


class ActiveSessionStatusRead(BaseModel):
    """
    Respons `GET /sessions/active/status` (PUBLIK).

    Selalu balas 200 — "galeri sedang tutup" adalah keadaan normal, bukan
    error, jadi tidak pantas disampaikan lewat 403 seperti
    `GET /sessions/active`. Ini yang dipakai penjaga rute frontend untuk
    memutuskan: lanjut ke halaman pembelian, atau alihkan ke halaman
    "belum bisa membeli tiket".
    """
    has_active: bool
    server_time: datetime
    session: Optional[OperationalSessionRead] = None


# ==========================================
# 4b. SESI KASIR (BARU v2)
# ==========================================

class CashierSessionCreate(BaseModel):
    session_id: uuid.UUID
    terminal_ids: List[uuid.UUID] = Field(
        default_factory=list,
        description="Terminal pembayaran yang dipakai kasir selama shift ini "
                    "(mis. EDC 1 & QRIS Meja 2). Boleh kosong kalau kasir "
                    "hanya melayani tunai."
    )


class CashierSessionRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    user_id: uuid.UUID
    opened_at: datetime
    closed_at: Optional[datetime] = None
    # Dipetakan dari properti komputasi `CashierSession.is_open` (db.py).
    is_open: bool = True
    # Terminal yang boleh dipilih kasir ini pada pop-up konfirmasi
    # pembayaran — sengaja dikirim utuh (bukan cuma id-nya) supaya
    # frontend tidak perlu memanggil GET /payment-terminals lagi.
    terminals: List[PaymentTerminalRead] = []

    class Config:
        from_attributes = True


class CashierSessionStatusRead(BaseModel):
    """
    Respons `GET /cashier-sessions/me/active`.

    SELALU 200 — "kasir belum membuka sesinya" adalah keadaan normal
    (justru itulah yang memicu gerbang "Buka Sesi Kasir" di frontend),
    bukan error. Pola yang sama dengan `ActiveSessionStatusRead`.
    """
    has_active: bool
    cashier_session: Optional[CashierSessionRead] = None


# ==========================================
# 5. ORIGIN SCHEMAS
# ==========================================

class OriginBase(BaseModel):
    country_code: str = Field(..., min_length=2, max_length=2)
    count: int = Field(..., gt=0)


class TransactionOriginResponse(OriginBase):
    id: uuid.UUID

    class Config:
        from_attributes = True


# Alias untuk kompatibilitas pemanggilan nama kelas baru
TransactionOriginCreate = OriginBase


# ==========================================
# 6. TRANSACTION ITEM SCHEMAS
# ==========================================

class TransactionItemCreate(BaseModel):
    ticket_sub_category_id: uuid.UUID
    quantity: int = Field(..., gt=0)


class TransactionItemResponse(BaseModel):
    id: uuid.UUID
    ticket_sub_category_id: uuid.UUID
    ticket_name_snapshot: str  # e.g., "Tiket Lantai 11 - Dewasa" (cermin ID)
    # BARU: snapshot nama per bahasa, dibekukan saat transaksi dibuat.
    ticket_name_snapshot_i18n: LocalizedNameRead = {}
    quantity: int
    unit_price: int

    class Config:
        from_attributes = True


# ==========================================
# 7. TRANSACTION SCHEMAS
# ==========================================

class TransactionCreate(BaseModel):
    customer_name: str = Field(..., min_length=1)  # Wajib diisi sesuai spesifikasi baru
    items: List[TransactionItemCreate] = Field(..., min_length=1)
    origins: List[OriginBase] = Field(default_factory=list)
    # KATEGORI pembayaran. Diabaikan kalau `payment_terminal_id` diisi —
    # terminal yang menentukan kategorinya, bukan sebaliknya. Kalau tidak,
    # dua field ini bisa saling bertentangan ("QRIS" + terminal "EDC 1").
    payment_method: PaymentMethodEnum = PaymentMethodEnum.qris
    # BARU v2 — terminal fisik yang dipakai. Hanya diisi kalau transaksi
    # dibuat kasir (Tambah Manual); pengunjung yang memesan sendiri dari
    # halaman publik membiarkannya kosong, dan detailnya baru terisi saat
    # kasir menekan Konfirmasi.
    payment_terminal_id: Optional[uuid.UUID] = None


class TransactionResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    queue_number: int
    ticket_code: str
    customer_name: str
    total_price: int
    status: TransactionStatus

    # --- Metode pembayaran: KATEGORI + DETAIL ---
    # `payment_method`        : kategori umum (EDC / QRIS / Tunai)
    # `payment_method_detail` : terminal spesifik ("EDC 1", "QRIS Meja 2"),
    #                           NULL selama belum dikonfirmasi kasir.
    payment_method: PaymentMethodEnum
    payment_terminal_id: Optional[uuid.UUID] = None
    payment_method_detail: Optional[str] = None
    cashier_session_id: Optional[uuid.UUID] = None

    # --- Verifikasi Checker (LEGACY — dipertahankan di skema untuk data
    # lama; UI tidak lagi menampilkan atau bisa mengubah field ini sejak
    # role Checker menjadi read-only. Penguncian edit sekarang ditentukan
    # dari `status`, lihat `confirmed_by_*` di bawah). ---
    verification_status: VerificationStatusEnum = VerificationStatusEnum.pending
    verified_by_id: Optional[uuid.UUID] = None
    verified_at: Optional[datetime] = None

    created_at: datetime
    confirmed_at: Optional[datetime] = None
    # BARU: staf yang menekan Konfirmasi (mengunci antrean ke
    # "confirmed"/"paid"). `confirmed_by_email` dipakai frontend untuk
    # menurunkan nama tampilan (bagian sebelum "@") di kolom "Dikonfirmasi
    # Oleh" pada tabel Riwayat Transaksi.
    confirmed_by_id: Optional[uuid.UUID] = None
    confirmed_by_email: Optional[str] = None
    date_only: date
    items: List[TransactionItemResponse] = []
    origins: List[TransactionOriginResponse] = []

    class Config:
        from_attributes = True


# ==========================================
# 8. EDIT / UPDATE SCHEMAS (ADMIN DASHBOARD)
# ==========================================

class TransactionStatusUpdate(BaseModel):
    status: TransactionStatus
    # BARU v2 — inilah jalur "pop-up konfirmasi pembayaran": saat kasir
    # mengonfirmasi transaksi yang dibuat pengunjung, terminal yang
    # dipilihnya mengisi KATEGORI + DETAIL metode pembayaran sekaligus.
    payment_terminal_id: Optional[uuid.UUID] = None
    # Untuk pembayaran TUNAI, yang memang tidak punya terminal: kasir
    # cukup mengirim kategorinya. Kalau `payment_terminal_id` juga diisi,
    # terminal yang menang — kategori selalu diturunkan dari alat yang
    # benar-benar dipakai menagih.
    payment_method: Optional[PaymentMethodEnum] = None


class TransactionVerificationUpdate(BaseModel):
    """
    Body `PATCH /transactions/{id}/verification` — HANYA untuk role
    Checker & Admin. Begitu `approved`, transaksi terkunci dari kasir.
    """
    verification_status: VerificationStatusEnum


class TransactionUpdateData(BaseModel):
    """
    Schema yang digunakan Admin Dashboard untuk mengedit transaksi yang ada.
    """
    customer_name: Optional[str] = None
    items: Optional[List[TransactionItemCreate]] = None
    origins: Optional[List[OriginBase]] = None
    status: Optional[TransactionStatus] = None
    payment_method: Optional[PaymentMethodEnum] = None
    # Diabaikan kalau None; kalau diisi, kategori ikut diturunkan dari
    # terminal (aturan yang sama dengan TransactionCreate di atas).
    payment_terminal_id: Optional[uuid.UUID] = None


# ==========================================
# 9. LAPORAN (EKSPOR EXCEL) — BARU
# ==========================================

class SessionReportRead(BaseModel):
    """
    Respons `GET /reports/sessions/{session_id}` (per sesi, ADMIN) dan
    `GET /reports/combined` (multi-sesi per tanggal, ADMIN & KASIR).

    Backend sengaja hanya mengirim DATA MENTAH (sesi + transaksinya). Angka
    ringkasan & workbook Excel tetap dibangun di frontend dari data ini
    (`src/utils/report.ts` & `reportWorkbook.ts`) — satu-satunya
    implementasi, jadi angka di layar dan di berkas unduhan tidak mungkin
    menyimpang. Yang dijamin endpoint ini: HAK AKSES ekspor per role, dan
    validasi bahwa sesi yang digabung memang berasal dari tanggal yang sama.
    """
    date: date
    sessions: List[OperationalSessionRead]
    # Seluruh transaksi milik sesi-sesi di atas, SEMUA status, urut waktu dibuat.
    transactions: List[TransactionResponse]
    # Nama berkas saran: "Tiketing-YYYY-MM-DD-NamaSesi.xlsx" (per sesi) atau
    # "Tiketing-YYYY-MM-DD.xlsx" (multi-sesi).
    file_name: str
