# app/db.py
# ==========================================================
# DATABASE SETUP
# Semua konfigurasi kini dibaca dari app.config.settings.
# ==========================================================

from collections.abc import AsyncGenerator
import uuid

from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey,
    Uuid, Date, UniqueConstraint
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship

from fastapi_users.db import SQLAlchemyUserDatabase, SQLAlchemyBaseUserTableUUID
from fastapi import Depends

# Satu-satunya sumber konfigurasi — tidak ada lagi os.getenv() di sini
from app.config import settings


# ==========================================
# ORM MODELS
# ==========================================

class Base(DeclarativeBase):
    pass


class User(SQLAlchemyBaseUserTableUUID, Base):
    """
    Model user untuk staff internal.
    Public visitors do not have accounts,
    so transactions do not require a user_id.
    """
    # TAMBAHAN: Kolom role untuk membedakan admin, kasir, dan checker
    role = Column(String, nullable=False, default="kasir")


class TransactionEntry(Base):
    __tablename__ = "transactions"

    id            = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    queue_number  = Column(Integer, nullable=False, index=True)
    
    # --- TAMBAHAN BARU: Kolom untuk menyimpan format tiket (cth: 20260709-001) ---
    ticket_code   = Column(String, nullable=False, unique=True, index=True)
    
    total_price   = Column(Integer, nullable=False)
    status        = Column(String,  nullable=False, default="pending")
    payment_method = Column(String, nullable=False, default="qris")

    # Immutable — diisi otomatis saat pertama kali dibuat
    # Menggunakan settings.timezone agar konsisten dengan konfigurasi terpusat
    created_at  = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: __import__("datetime").datetime.now(settings.timezone)
    )

    # Nullable — diisi oleh API saat status berubah ke "confirmed" / "paid"
    confirmed_at = Column(DateTime(timezone=True), nullable=True, default=None)

    # Kolom tanggal untuk composite unique constraint (reset harian antrean)
    date_only = Column(Date, nullable=False)

    __table_args__ = (
        UniqueConstraint("queue_number", "date_only", name="uq_queue_per_day"),
    )

    # Relationships — lazy="selectin" agar data termuat otomatis tanpa query N+1
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
    Contoh: 2 Adult untuk Floor 6, 1 Child untuk Floor 1.
    """
    __tablename__ = "transaction_items"

    id             = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False
    )
    floor          = Column(String,  nullable=False)        # e.g., "Floor 1", "Floor 5", "Floor 6/7"
    age_category   = Column(String,  nullable=False)        # e.g., "adult", "student", "child"
    quantity       = Column(Integer, nullable=False, default=1)
    unit_price     = Column(Integer, nullable=False)        # Harga saat pembelian (price snapshot)

    transaction = relationship("TransactionEntry", back_populates="items")


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
    count        = Column(Integer,   nullable=False, default=1)

    transaction = relationship("TransactionEntry", back_populates="origins")


# ==========================================
# DATABASE ENGINE & SESSION
# ==========================================

# URL sudah dinormalisasi ke format asyncpg oleh settings.database_url_async
# Semua parameter engine juga berasal dari settings — tidak ada hardcode di sini
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