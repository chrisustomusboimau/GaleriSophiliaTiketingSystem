# app/db.py
# ==========================================================
# DATABASE SETUP
# Skema baru: Master Tiket, Sesi Operasional, Tiket per Sesi,
# Audit Tiket Fisik Kasir, Nama Pemesan, dan Multi-item Transaction.
# Semua konfigurasi dibaca dari app.config.settings.
#
# UPDATE (perbaikan bug FK saat hapus Master Tiket / Sub-Kategori):
# Ditambahkan kolom `is_active` pada `TicketMaster` & `TicketSubCategory`
# untuk mendukung SOFT DELETE. Sebelumnya, menghapus `TicketSubCategory`
# yang masih direferensikan oleh `TransactionItem` (FK `ondelete="RESTRICT"`
# di bawah) akan gagal dengan `ForeignKeyViolationError`. Sekarang endpoint
# "hapus" di main.py hanya mengubah `is_active = False`, tidak pernah lagi
# menjalankan `DELETE FROM` pada baris yang mungkin punya riwayat transaksi
# — riwayat lama & laporan keuangan/audit tetap konsisten selamanya.
#
# ⚠️ MIGRASI MANUAL DIBUTUHKAN: `create_db_and_tables()` di bawah cuma
# menjalankan `Base.metadata.create_all()`, yang HANYA membuat tabel yang
# belum ada — TIDAK menambahkan kolom baru ke tabel yang sudah eksis.
# Kalau database Anda sudah pernah dijalankan sebelumnya, jalankan SQL ini
# SEKALI secara manual (lihat juga `backend/MIGRATE.sql` di paket ini):
#
#   ALTER TABLE ticket_masters       ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
#   ALTER TABLE ticket_sub_categories ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
#
# Untuk instalasi BARU (database kosong), `create_all()` akan membuat kedua
# tabel ini lengkap dengan kolom `is_active` dari awal — tidak perlu migrasi.
# ==========================================================

from collections.abc import AsyncGenerator
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey,
    Uuid, Date, Time, UniqueConstraint, CheckConstraint, Boolean
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship

from fastapi_users.db import SQLAlchemyUserDatabase, SQLAlchemyBaseUserTableUUID
from fastapi import Depends

# Satu-satunya sumber konfigurasi — tidak ada lagi os.getenv() di sini
from app.config import settings
from app.i18n import resolve_name


# ==========================================
# BASE & USER MODEL
# ==========================================

class Base(DeclarativeBase):
    pass


class User(SQLAlchemyBaseUserTableUUID, Base):
    """
    Model user untuk staff internal (admin, kasir, checker).
    Pengunjung publik tidak memiliki akun — transaksi tidak butuh user_id.
    """
    role = Column(String, nullable=False, default="kasir")


# ==========================================
# MASTER DATA (DIKELOLA ADMIN)
# ==========================================

class TicketMaster(Base):
    """
    Master lokasi/area tiket (contoh: "Tiket Lantai 11", "Tiket Lantai 12").
    """
    __tablename__ = "ticket_masters"

    id          = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # KOLOM CERMIN (Bahasa Indonesia). Selalu ditulis ulang dari
    # name_i18n["id"] setiap kali master dibuat/diubah — JANGAN pernah diisi
    # sendiri tanpa memperbarui name_i18n. Sengaja dipertahankan supaya:
    #   1) UNIQUE constraint di bawah tetap menjaga duplikasi nama,
    #   2) seluruh layar & laporan staf (Ringkasan, Riwayat, ekspor CSV)
    #      yang berbahasa Indonesia tidak perlu diubah sama sekali.
    name        = Column(String, nullable=False, unique=True)   # e.g., "Tiket Lantai 11"

    # BARU — nama multi-bahasa yang dilihat pengunjung.
    # {"id": "Tiket Lantai 11", "en": "Floor 11 Ticket", "zh": "11层门票"}
    # `id` & `en` wajib (divalidasi app/i18n.py + CheckConstraint di bawah),
    # `zh` opsional. HARGA tidak ada di sini — harga tetap satu nilai
    # universal di TicketSubCategory.price.
    name_i18n   = Column(JSONB, nullable=False, server_default="{}")

    description = Column(String, nullable=True)

    # BARU — soft delete. "Menghapus" master tiket dari UI tidak lagi
    # menjalankan DELETE FROM; cukup menonaktifkannya di sini. Master yang
    # is_active=False otomatis hilang dari daftar pilihan tiket baru
    # (GET /ticket-masters default), tapi tetap ada di database sehingga
    # sesi & transaksi lama yang mereferensikannya tidak rusak.
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        # Menegakkan "ID & EN wajib" di level database, bukan cuma di
        # Pydantic — memakai ->> (bukan operator ?) supaya tidak bentrok
        # dengan paramstyle SQLAlchemy.
        CheckConstraint(
            "btrim(coalesce(name_i18n->>'id','')) <> '' AND btrim(coalesce(name_i18n->>'en','')) <> ''",
            name="ck_ticket_master_name_i18n_required",
        ),
    )

    sub_categories = relationship(
        "TicketSubCategory",
        back_populates="ticket_master",
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class TicketSubCategory(Base):
    """
    Sub-kategori tiket berdasarkan rentang usia & harga.
    Contoh: Remaja (17-21 thn) -> Rp50.000, Dewasa (22+ thn) -> Rp75.000
    """
    __tablename__ = "ticket_sub_categories"

    id               = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_master_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("ticket_masters.id", ondelete="CASCADE"),
        nullable=False
    )
    # KOLOM CERMIN (Bahasa Indonesia) — lihat penjelasan di TicketMaster.name.
    name    = Column(String, nullable=False)     # e.g., "Remaja", "Dewasa"

    # BARU — nama varian multi-bahasa: {"id": "Dewasa", "en": "Adult", ...}
    name_i18n = Column(JSONB, nullable=False, server_default="{}")

    min_age = Column(Integer, nullable=False, default=0)
    max_age = Column(Integer, nullable=True)     # NULL = tanpa batas atas (misal 22+)
    price   = Column(Integer, nullable=False)    # Harga dasar tiket

    # BARU — soft delete. Lihat penjelasan di TicketMaster.is_active di atas.
    # Ini yang menyelesaikan bug ForeignKeyViolationError: baris di tabel ini
    # TIDAK PERNAH dihapus lagi lewat endpoint "hapus sub-kategori", jadi FK
    # `transaction_items_ticket_sub_category_id_fkey` (ondelete="RESTRICT")
    # tidak akan pernah dilanggar oleh alur normal aplikasi lagi.
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        CheckConstraint("max_age IS NULL OR max_age >= min_age", name="ck_age_range_valid"),
        CheckConstraint(
            "btrim(coalesce(name_i18n->>'id','')) <> '' AND btrim(coalesce(name_i18n->>'en','')) <> ''",
            name="ck_sub_category_name_i18n_required",
        ),
    )

    # lazy="selectin" agar snapshot nama tiket ("Tiket Lantai 11 - Dewasa") bisa
    # dibentuk tanpa lazy-load tersembunyi di dalam async session
    ticket_master = relationship("TicketMaster", back_populates="sub_categories", lazy="selectin")

    @property
    def ticket_master_name(self) -> str | None:
        """
        BARU — properti komputasi (BUKAN kolom database, tidak perlu migrasi).

        `TicketSubCategoryRead` yang dikirim ke klien PUBLIK (mis. lewat
        `GET /sessions/active`, dipakai halaman pemilihan tiket pengunjung)
        sebelumnya tidak pernah membawa nama master induknya ("Tiket Lantai
        1") — cuma `ticket_master_id` (UUID). Endpoint publik itu TIDAK
        boleh memanggil `GET /ticket-masters` (khusus staf), jadi frontend
        publik tidak pernah bisa menampilkan nama lantai yang benar.

        Karena relasi `ticket_master` di atas sudah `lazy="selectin"` (selalu
        ikut termuat saat sub-kategori ini dimuat, transitif lewat rantai
        selectin dari SessionTicket/OperationalSession), properti ini bisa
        diakses tanpa I/O tambahan. Pydantic (`from_attributes=True`) otomatis
        memetakan properti Python biasa sama seperti kolom lewat `getattr`.
        """
        return self.ticket_master.name if self.ticket_master else None

    @property
    def ticket_master_name_i18n(self) -> dict | None:
        """
        Versi multi-bahasa dari `ticket_master_name` di atas — inilah yang
        dipakai halaman pemilihan tiket pengunjung untuk menampilkan nama
        lantai sesuai bahasa aktif. Sama seperti properti di atas, gratis
        secara I/O karena relasi `ticket_master` sudah lazy="selectin".
        """
        return self.ticket_master.name_i18n if self.ticket_master else None

    session_tickets = relationship(
        "SessionTicket",
        back_populates="sub_category",
        cascade="all, delete-orphan"
    )


# ==========================================
# SESI OPERASIONAL & AUDIT KASIR
# ==========================================

class OperationalSession(Base):
    """
    Jadwal sesi operasional yang dibuat Admin (contoh: Sesi Siang 12.00–16.00).
    """
    __tablename__ = "operational_sessions"

    id         = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name       = Column(String, nullable=False)          # e.g., "Sesi Siang"
    date       = Column(Date, nullable=False, index=True) # Tanggal sesi berlaku
    start_time = Column(Time, nullable=False)             # e.g., 12:00:00
    end_time   = Column(Time, nullable=False)             # e.g., 16:00:00
    status     = Column(String, nullable=False, default="draft")  # draft, opened, closed

    __table_args__ = (
        CheckConstraint("status IN ('draft','opened','closed')", name="ck_session_status_valid"),
    )

    @property
    def is_live(self) -> bool:
        """
        BARU — properti komputasi (BUKAN kolom database, tidak perlu migrasi).

        True HANYA untuk sesi yang benar-benar sedang berjalan saat ini:
        sudah dibuka admin, tanggalnya hari ini, dan jam dinding sekarang
        ada di dalam rentangnya. Inilah satu-satunya sesi yang boleh
        melayani pembelian tiket, dan yang diberi label "Berlangsung" di
        panel admin.

        Rentang bersifat HALF-OPEN [start, end): pada detik tepat di
        `end_time`, sesi ini sudah TIDAK live lagi. Itu yang membuat dua
        sesi bersebelahan (12:00–16:00 dan 16:00–20:00) tidak pernah
        dua-duanya live di pukul 16:00.

        Karena Pydantic `from_attributes=True` memetakan properti Python
        seperti kolom biasa, SEMUA endpoint yang mengembalikan sesi
        otomatis ikut membawa flag ini tanpa perubahan apa pun di sana.
        """
        now = datetime.now(settings.timezone)
        return (
            self.status == "opened"
            and self.date == now.date()
            and self.start_time <= now.time() < self.end_time
        )

    # Tiket yang diaktifkan pada sesi ini
    active_tickets = relationship(
        "SessionTicket",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    # Transaksi yang masuk di sesi ini
    transactions = relationship("TransactionEntry", back_populates="session")


class SessionTicket(Base):
    """
    Tabel junction yang menentukan tiket mana saja yang dijual/aktif pada suatu sesi.
    """
    __tablename__ = "session_tickets"

    id         = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("operational_sessions.id", ondelete="CASCADE"),
        nullable=False
    )
    ticket_sub_category_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("ticket_sub_categories.id", ondelete="CASCADE"),
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint("session_id", "ticket_sub_category_id", name="uq_ticket_per_session"),
    )

    session      = relationship("OperationalSession", back_populates="active_tickets")
    sub_category = relationship("TicketSubCategory", back_populates="session_tickets", lazy="selectin")
    audit        = relationship(
        "SessionTicketAudit",
        back_populates="session_ticket",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class SessionTicketAudit(Base):
    """
    Pencatatan kontrol & audit nomor tiket fisik oleh Kasir (Awal & Akhir Sesi).
    """
    __tablename__ = "session_ticket_audits"

    id                = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_ticket_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("session_tickets.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )

    # Input Kasir/Admin — boleh diisi & diedit kapan saja selama sesi induk
    # berstatus 'draft' atau 'opened' (divalidasi di main.py, bukan di sini).
    start_ticket_number = Column(Integer, nullable=True)
    # Input Kasir/Admin — boleh diisi & diedit kapan saja selama sesi induk
    # berstatus 'opened' (divalidasi di main.py).
    end_ticket_number   = Column(Integer, nullable=True)

    session_ticket = relationship("SessionTicket", back_populates="audit")


# ==========================================
# TRANSAKSI & DETAIL PEMESANAN
# ==========================================

class TransactionEntry(Base):
    """
    Header Transaksi. Terikat ke OperationalSession dan memiliki nama pemesan.
    """
    __tablename__ = "transactions"

    id         = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("operational_sessions.id", ondelete="RESTRICT"),
        nullable=False
    )

    queue_number = Column(Integer, nullable=False, index=True)
    ticket_code  = Column(String, nullable=False, unique=True, index=True)

    # MANDATORI: Nama Pemesan / Pengunjung
    customer_name = Column(String, nullable=False)

    total_price    = Column(Integer, nullable=False)
    status         = Column(String, nullable=False, default="pending")   # pending, confirmed, paid, cancelled
    payment_method = Column(String, nullable=False, default="qris")

    # Immutable — diisi otomatis saat pertama kali dibuat
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(settings.timezone)
    )
    # Nullable — diisi oleh API saat status berubah ke "confirmed" / "paid"
    confirmed_at = Column(DateTime(timezone=True), nullable=True, default=None)

    # Kolom tanggal untuk composite unique constraint (reset harian antrean)
    date_only = Column(Date, nullable=False)

    __table_args__ = (
        UniqueConstraint("queue_number", "date_only", name="uq_queue_per_day"),
    )

    session = relationship("OperationalSession", back_populates="transactions")
    items   = relationship(
        "TransactionItem",
        back_populates="transaction",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    origins = relationship(
        "TransactionOriginEntry",
        back_populates="transaction",
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class TransactionItem(Base):
    """
    Menyimpan setiap jenis tiket yang dipilih dalam satu transaksi.
    Terikat ke TicketSubCategory dengan snapshot nama & harga agar riwayat
    tidak berubah jika master tiket diubah admin di kemudian hari.

    CATATAN: FK ke ticket_sub_categories sengaja `ondelete="RESTRICT"` —
    inilah yang memicu ForeignKeyViolationError kalau ticket_sub_categories
    di-hard-delete selagi masih direferensikan baris di sini. Sejak
    penerapan soft delete (lihat TicketSubCategory.is_active), baris di
    tabel ini tidak akan pernah lagi memblokir proses "hapus" dari sisi
    admin, karena sisi TicketSubCategory tidak pernah benar-benar dihapus.
    """
    __tablename__ = "transaction_items"

    id             = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False
    )
    ticket_sub_category_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("ticket_sub_categories.id", ondelete="RESTRICT"),
        nullable=False
    )

    # KOLOM CERMIN (Bahasa Indonesia) — dipakai seluruh laporan & ekspor
    # CSV staf apa adanya, jadi sengaja tidak diubah formatnya.
    ticket_name_snapshot = Column(String, nullable=False)   # e.g., "Tiket Lantai 11 - Dewasa"

    # BARU — snapshot nama multi-bahasa, dibekukan saat transaksi dibuat:
    # {"id": "Tiket Lantai 11 - Dewasa", "en": "Floor 11 Ticket - Adult"}
    # Dipakai layar antrean/struk pengunjung supaya bahasanya konsisten
    # dengan katalog yang barusan mereka lihat.
    ticket_name_snapshot_i18n = Column(JSONB, nullable=False, server_default="{}")

    quantity   = Column(Integer, nullable=False, default=1)
    unit_price = Column(Integer, nullable=False)             # Harga saat pembelian (price snapshot)

    transaction  = relationship("TransactionEntry", back_populates="items")
    sub_category = relationship("TicketSubCategory", lazy="selectin")


class TransactionOriginEntry(Base):
    """
    Mencatat negara asal pengunjung dalam satu transaksi.
    Dinormalisasi untuk mendukung kelompok pengunjung dari beberapa negara berbeda.
    """
    __tablename__ = "transaction_origins"

    id             = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False
    )
    country_code = Column(String(2), nullable=False)  # e.g., 'id', 'us', 'jp'
    count        = Column(Integer, nullable=False, default=1)

    transaction = relationship("TransactionEntry", back_populates="origins")


# ==========================================
# DATABASE ENGINE & SESSION
# ==========================================

engine = create_async_engine(
    settings.database_url_async,
    pool_pre_ping=settings.db_pool_pre_ping,
    connect_args={
        "statement_cache_size":          settings.db_statement_cache_size,
        "prepared_statement_cache_size": settings.db_prepared_statement_cache_size,
    }
)

async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


# ==========================================
# HELPERS / DEPENDENCIES
# ==========================================

async def create_db_and_tables():
    """
    Membuat semua tabel jika belum ada.
    Untuk production, pertimbangkan menggunakan Alembic untuk migrasi.

    ⚠️ Ini TIDAK menambahkan kolom baru ke tabel yang sudah eksis (lihat
    catatan migrasi manual di bagian atas file ini) — hanya membuat tabel
    yang belum ada sama sekali.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency: yield satu sesi database per request."""
    async with async_session_maker() as session:
        yield session


async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    """Dependency yang digunakan fastapi-users untuk mengakses tabel User."""
    yield SQLAlchemyUserDatabase(session, User)
