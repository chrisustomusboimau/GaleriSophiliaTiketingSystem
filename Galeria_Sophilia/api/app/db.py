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
#
# UPDATE v2 (terminal pembayaran, sesi kasir, approval checker, master
# varian usia): model baru `PaymentTerminal`, `AgeCategory`,
# `CashierSession`, `CashierSessionTerminal`; kolom baru di
# `TicketSubCategory` (age_category_id) dan `TransactionEntry` (detail
# terminal + status verifikasi). Peringatan migrasi yang sama berlaku —
# jalankan `api/MIGRATE_v2.sql` SEKALI pada database yang sudah ada.
# ==========================================================

from collections.abc import AsyncGenerator
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey,
    Uuid, Date, Time, UniqueConstraint, CheckConstraint, Boolean,
    Index, text
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

class AgeCategory(Base):
    """
    BARU (v2) — MASTER VARIAN KATEGORI USIA.

    Sumber tunggal daftar varian usia untuk SELURUH master tiket. Sebelum
    ini, admin mengetik ulang "Dewasa 22+", "Anak 0–12", dst. secara manual
    di setiap master tiket — sehingga "Dewasa" di Lantai 1 dan "Dewasa" di
    Lantai 2 adalah dua baris lepas yang gampang menyimpang (beda ejaan,
    beda rentang usia). Sekarang varian dibuat sekali di sini, lalu setiap
    master tiket hanya mengisi HARGA-nya.

    Nama dipisah cermin/i18n dengan pola yang sama seperti TicketMaster —
    lihat penjelasan panjang di TicketMaster.name & TicketMaster.name_i18n.
    """
    __tablename__ = "age_categories"

    id        = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name      = Column(String, nullable=False)          # cermin Bahasa Indonesia
    name_i18n = Column(JSONB, nullable=False, server_default="{}")
    min_age   = Column(Integer, nullable=False, default=0)
    max_age   = Column(Integer, nullable=True)          # NULL = tanpa batas atas
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        CheckConstraint("max_age IS NULL OR max_age >= min_age", name="ck_age_category_range_valid"),
        CheckConstraint(
            "btrim(coalesce(name_i18n->>'id','')) <> '' AND btrim(coalesce(name_i18n->>'en','')) <> ''",
            name="ck_age_category_name_i18n_required",
        ),
    )


class PaymentTerminal(Base):
    """
    BARU (v2) — Terminal pembayaran fisik yang ada di lokasi.
    Contoh: "EDC 1", "EDC 2", "QRIS Meja 1", "QRIS Meja 2".

    `category` sengaja memakai nilai yang SUDAH dipakai kolom
    `TransactionEntry.payment_method` ('qris' / 'card' / 'cash'), dengan
    'card' BERARTI kategori EDC — frontend memang sudah melabelinya "EDC"
    di filter riwayat. Konsekuensinya: tidak ada satu pun baris transaksi
    lama yang perlu ditulis ulang saat fitur ini masuk.

    Soft delete lewat `is_active`, alasannya sama persis dengan
    TicketSubCategory.is_active: terminal yang sudah pernah dipakai
    transaksi TIDAK BOLEH dihapus dari database, kalau tidak riwayat
    pembayaran kehilangan jejak alat yang dipakai.
    """
    __tablename__ = "payment_terminals"

    id        = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name      = Column(String, nullable=False, unique=True)
    category  = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        CheckConstraint("category IN ('qris','card','cash')", name="ck_payment_terminal_category_valid"),
    )


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

    # BARU (v2) — tautan ke MASTER varian usia. Sejak sekarang baris di
    # tabel ini TIDAK LAGI dibuat dengan nama & rentang usia ketikan bebas:
    # admin memilih varian dari `age_categories`, lalu hanya mengisi harga.
    #
    # Kolom name / name_i18n / min_age / max_age di bawah TETAP ADA dan
    # tetap diisi backend — perannya berubah jadi SNAPSHOT (pola yang sama
    # dengan TransactionItem.ticket_name_snapshot): mengganti nama atau
    # rentang usia di master varian besok TIDAK BOLEH diam-diam mengubah
    # sesi yang sedang berjalan maupun laporan yang sudah dicetak.
    #
    # Nullable karena baris legacy hasil migrasi bisa saja tidak menemukan
    # padanan master varian; baris baru selalu mengisinya.
    age_category_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("age_categories.id", ondelete="RESTRICT"),
        nullable=True
    )

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
        # Satu harga per varian usia per master tiket. Postgres mengizinkan
        # NULL berulang kali pada UNIQUE, jadi baris legacy yang belum
        # tertaut master varian tidak diblokir constraint ini.
        UniqueConstraint("ticket_master_id", "age_category_id", name="uq_age_category_per_master"),
    )

    # lazy="selectin" agar snapshot nama tiket ("Tiket Lantai 11 - Dewasa") bisa
    # dibentuk tanpa lazy-load tersembunyi di dalam async session
    ticket_master = relationship("TicketMaster", back_populates="sub_categories", lazy="selectin")
    # lazy="selectin" supaya halaman pengunjung bisa mengelompokkan varian
    # lintas-lantai berdasarkan master varian usia tanpa query tambahan.
    age_category  = relationship("AgeCategory", lazy="selectin")

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
# SESI KASIR (BARU v2)
# ==========================================

class CashierSession(Base):
    """
    BARU (v2) — Sesi kerja SATU kasir di dalam satu sesi operasional.

    Bedanya dengan `OperationalSession`: sesi operasional itu jadwal milik
    galeri (dibuka & ditutup admin), sedangkan ini adalah "shift" personal
    kasir — siapa yang berjaga, dan TERMINAL PEMBAYARAN MANA yang ada di
    mejanya selama shift itu. Dari sinilah daftar pilihan metode pembayaran
    spesifik (EDC 1 / QRIS Meja 2 / ...) pada pop-up konfirmasi berasal;
    kasir tidak bisa memilih terminal yang bukan miliknya.

    Sengaja dicatat di database (bukan sekadar state browser) supaya
    transaksi bisa ditelusuri sampai "EDC 2, kasir X, sesi Y" — termasuk
    setelah kasir ganti perangkat atau browsernya dibersihkan.
    """
    __tablename__ = "cashier_sessions"

    id         = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("operational_sessions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    user_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("user.id", ondelete="RESTRICT"),
        nullable=False
    )
    opened_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(settings.timezone)
    )
    # NULL = masih berjalan. Lihat catatan indeks parsial di bawah.
    closed_at = Column(DateTime(timezone=True), nullable=True, default=None)

    __table_args__ = (
        # Satu kasir hanya boleh punya SATU sesi kasir terbuka pada satu
        # waktu. Indeks PARSIAL (bukan UniqueConstraint biasa) supaya sesi
        # yang sudah ditutup tidak ikut memblokir sesi berikutnya —
        # UniqueConstraint("user_id") polos akan melarang kasir bekerja
        # untuk kedua kalinya, selamanya.
        Index(
            "uq_one_open_cashier_session",
            "user_id",
            unique=True,
            postgresql_where=text("closed_at IS NULL"),
        ),
    )

    @property
    def is_open(self) -> bool:
        """Properti komputasi (BUKAN kolom) — dipetakan Pydantic seperti kolom biasa."""
        return self.closed_at is None

    session   = relationship("OperationalSession", lazy="selectin")
    user      = relationship("User", lazy="selectin")
    terminals = relationship(
        "CashierSessionTerminal",
        back_populates="cashier_session",
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class CashierSessionTerminal(Base):
    """
    Tabel junction: terminal pembayaran mana saja yang dipakai pada satu
    sesi kasir. Pola & alasannya sama dengan `SessionTicket` di atas.
    """
    __tablename__ = "cashier_session_terminals"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cashier_session_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("cashier_sessions.id", ondelete="CASCADE"),
        nullable=False
    )
    payment_terminal_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("payment_terminals.id", ondelete="RESTRICT"),
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "cashier_session_id", "payment_terminal_id",
            name="uq_terminal_per_cashier_session"
        ),
    )

    cashier_session = relationship("CashierSession", back_populates="terminals")
    terminal        = relationship("PaymentTerminal", lazy="selectin")


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

    # KATEGORI metode pembayaran: 'qris' | 'card' (= EDC) | 'cash'.
    # Nilai 'card' sengaja dipertahankan apa adanya untuk kategori EDC —
    # mengganti nilainya jadi 'edc' berarti menulis ulang setiap baris
    # transaksi yang pernah ada, tanpa manfaat nyata. Yang berubah cuma
    # labelnya di layar (lihat PAYMENT_METHOD_LABEL di frontend).
    payment_method = Column(String, nullable=False, default="qris")

    # --- BARU (v2): DETAIL metode pembayaran ---
    # Terminal fisik yang benar-benar dipakai (mis. "EDC 1", "QRIS Meja 2").
    # NULL untuk transaksi yang dibuat pengunjung sendiri lewat halaman
    # publik: di sana belum ada kasir, jadi belum ada terminal. Detailnya
    # baru terisi saat kasir menekan Konfirmasi dan memilih terminal.
    payment_terminal_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("payment_terminals.id", ondelete="RESTRICT"),
        nullable=True
    )
    # SNAPSHOT nama terminal, dibekukan saat transaksi ditulis — alasannya
    # sama dengan TransactionItem.ticket_name_snapshot: admin mengganti
    # nama "EDC 1" jadi "EDC Lantai 1" besok TIDAK BOLEH mengubah riwayat
    # & laporan rekonsiliasi yang sudah dicetak hari ini.
    payment_method_detail = Column(String, nullable=True)
    # Jejak sesi kasir yang melayani — untuk audit "siapa, pakai alat apa".
    cashier_session_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("cashier_sessions.id", ondelete="RESTRICT"),
        nullable=True
    )

    # --- BARU (v2): VERIFIKASI CHECKER ---
    # 'pending' | 'approved'. Begitu 'approved', transaksi TERKUNCI untuk
    # kasir (tidak bisa diedit/dihapus) dan hanya bisa di-override oleh
    # checker atau admin. Penegakannya di app.py (_assert_can_mutate),
    # bukan di sini.
    verification_status = Column(
        String, nullable=False, default="pending", server_default="pending", index=True
    )
    verified_by_id = Column(
        Uuid(as_uuid=True),
        # SET NULL, bukan RESTRICT: menghapus akun checker yang sudah
        # resign tidak boleh terhalang oleh riwayat verifikasinya, dan
        # tidak boleh ikut menghapus transaksinya.
        ForeignKey("user.id", ondelete="SET NULL"),
        nullable=True
    )
    verified_at = Column(DateTime(timezone=True), nullable=True, default=None)

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
        CheckConstraint(
            "verification_status IN ('pending','approved')",
            name="ck_transaction_verification_status_valid",
        ),
    )

    session          = relationship("OperationalSession", back_populates="transactions")
    payment_terminal = relationship("PaymentTerminal", lazy="selectin")
    cashier_session  = relationship("CashierSession", lazy="selectin")
    verified_by      = relationship("User", foreign_keys=[verified_by_id], lazy="selectin")
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
