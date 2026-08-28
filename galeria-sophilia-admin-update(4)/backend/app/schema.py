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
from typing import List, Optional

from fastapi_users import schemas
from pydantic import BaseModel, Field


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
    name: str
    min_age: int = Field(default=0, ge=0)
    max_age: Optional[int] = Field(default=None, ge=0)
    price: int = Field(..., ge=0)


class TicketSubCategoryUpdate(BaseModel):
    name: Optional[str] = None
    min_age: Optional[int] = Field(default=None, ge=0)
    max_age: Optional[int] = Field(default=None, ge=0)
    price: Optional[int] = Field(default=None, ge=0)
    # BARU: kirim `is_active: true` untuk mengaktifkan kembali sub-kategori
    # yang sebelumnya dinonaktifkan (soft-deleted).
    is_active: Optional[bool] = None


class TicketSubCategoryRead(BaseModel):
    id: uuid.UUID
    ticket_master_id: uuid.UUID
    name: str
    min_age: int
    max_age: Optional[int] = None
    price: int
    is_active: bool = True
    # BARU: nama master induk (mis. "Tiket Lantai 1"), diambil dari properti
    # komputasi `TicketSubCategory.ticket_master_name` di db.py — supaya
    # endpoint publik (GET /sessions/active) bisa menampilkan label lantai
    # tanpa perlu memanggil GET /ticket-masters (khusus staf).
    ticket_master_name: Optional[str] = None

    class Config:
        from_attributes = True


class TicketMasterCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sub_categories: List[TicketSubCategoryCreate] = Field(default_factory=list)


class TicketMasterUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    # BARU: kirim `is_active: true` untuk mengaktifkan kembali master tiket
    # yang sebelumnya dinonaktifkan (soft-deleted).
    is_active: Optional[bool] = None


class TicketMasterRead(BaseModel):
    id: uuid.UUID
    name: str
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
    active_tickets: List[SessionTicketRead] = []

    class Config:
        from_attributes = True


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
    ticket_name_snapshot: str  # e.g., "Tiket Lantai 11 - Dewasa"
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
