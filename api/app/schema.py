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
    qris = "qris"
    cash = "cash"
    card = "card"


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
# 3. TICKET MASTER & SUB CATEGORY (ADMIN)
# ==========================================

class TicketSubCategoryCreate(BaseModel):
    # Nama varian per bahasa: {"id": "Dewasa", "en": "Adult", "zh": "成人"}.
    # `zh` opsional. Harga TIDAK ikut per-bahasa — satu `price` universal.
    name_i18n: LocalizedName
    min_age: int = Field(default=0, ge=0)
    max_age: Optional[int] = Field(default=None, ge=0)
    price: int = Field(..., ge=0)


class TicketSubCategoryUpdate(BaseModel):
    # Dikirim utuh (semua bahasa sekaligus) saat admin menyimpan form edit.
    name_i18n: Optional[LocalizedName] = None
    min_age: Optional[int] = Field(default=None, ge=0)
    max_age: Optional[int] = Field(default=None, ge=0)
    price: Optional[int] = Field(default=None, ge=0)
    # BARU: kirim `is_active: true` untuk mengaktifkan kembali sub-kategori
    # yang sebelumnya dinonaktifkan (soft-deleted).
    is_active: Optional[bool] = None


class TicketSubCategoryRead(BaseModel):
    id: uuid.UUID
    ticket_master_id: uuid.UUID
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
    payment_method: PaymentMethodEnum = PaymentMethodEnum.qris


class TransactionResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    queue_number: int
    ticket_code: str
    customer_name: str
    total_price: int
    status: TransactionStatus
    payment_method: PaymentMethodEnum
    created_at: datetime
    confirmed_at: Optional[datetime] = None
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


class TransactionUpdateData(BaseModel):
    """
    Schema yang digunakan Admin Dashboard untuk mengedit transaksi yang ada.
    """
    customer_name: Optional[str] = None
    items: Optional[List[TransactionItemCreate]] = None
    origins: Optional[List[OriginBase]] = None
    status: Optional[TransactionStatus] = None
    payment_method: Optional[PaymentMethodEnum] = None
