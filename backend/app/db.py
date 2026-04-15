from collections.abc import AsyncGenerator
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo


# Updated to use standard Uuid (cross-compatible with SQLite and PostgreSQL)
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Uuid
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship

from fastapi_users.db import SQLAlchemyUserDatabase, SQLAlchemyBaseUserTableUUID
from fastapi import Depends

DATABASE_URL = "sqlite+aiosqlite:///./test.db"
WIB = ZoneInfo("Asia/Jakarta")

class Base(DeclarativeBase):
    pass


class User(SQLAlchemyBaseUserTableUUID, Base):
    """
    Admin user model. 
    Public visitors do not have accounts, so transactions do not require a user_id.
    """
    pass


class TransactionEntry(Base):
    __tablename__ = "transactions"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    queue_number = Column(Integer, nullable=False, unique=True, index=True)
    total_price = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(WIB))

    # Relationships
    items = relationship("TransactionItem", back_populates="transaction", cascade="all, delete-orphan", lazy="selectin")
    origins = relationship("TransactionOriginEntry", back_populates="transaction", cascade="all, delete-orphan", lazy="selectin")

class TransactionItem(Base):
    """
    Stores each specific ticket type selected in a transaction.
    Example: 2 Adults for Floor 6, 1 Child for Floor 1.
    """
    __tablename__ = "transaction_items"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(Uuid(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    
    floor = Column(String, nullable=False)        # e.g., "Floor 1", "Floor 5", "Floor 6/7"
    age_category = Column(String, nullable=False) # e.g., "adult", "student", "child"
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Integer, nullable=False)  # Price at time of purchase

    transaction = relationship("TransactionEntry", back_populates="items")
    
class TransactionOriginEntry(Base):
    """
    Tracks the origin countries for a specific transaction.
    Normalized to support groups of visitors coming from multiple different countries.
    """
    __tablename__ = "transaction_origins"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign Key linking back to the main transaction
    transaction_id = Column(Uuid(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    
    # Origin Details
    country_code = Column(String(2), nullable=False) # e.g., 'id', 'us', 'jp'
    count = Column(Integer, nullable=False, default=1) # Number of people from this country

    # Relationships
    transaction = relationship("TransactionEntry", back_populates="origins")


# ==========================================
# DATABASE SETUP & HELPERS
# ==========================================

engine = create_async_engine(DATABASE_URL)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def create_db_and_tables():
    """Creates all tables. For production, consider using Alembic for migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to yield a database session per request."""
    async with async_session_maker() as session:
        yield session


async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    """Dependency used by fastapi-users to access the User table."""
    yield SQLAlchemyUserDatabase(session, User)