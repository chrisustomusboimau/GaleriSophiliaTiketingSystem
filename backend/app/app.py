from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager
from sqlalchemy import select, func
import uuid
from typing import List, Optional
from pydantic import BaseModel 
from sqlalchemy.exc import IntegrityError

# Assuming you update your schemas and DB models to match the new architecture.
from app.schema import (
    UserCreate, UserRead, UserUpdate, 
    TransactionCreate, TransactionResponse, TransactionStatusUpdate
)
from app.db import (
    create_db_and_tables, get_async_session, User,
    TransactionEntry, TransactionOriginEntry
)
from app.users import auth_backend, current_active_user, fastapi_users

# --- SERVER-SIDE PRICE CONFIGURATION ---
PRICES = {
    "under_8": 50000,
    "under_22": 75000,
    "adult": 100000
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
    yield

app = FastAPI(lifespan=lifespan)

# ==========================================
# CORS MIDDLEWARE CONFIGURATION
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], # Your Vite frontend URLs
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

# ==========================================
# AUTHENTICATION ROUTERS
# ==========================================
app.include_router(fastapi_users.get_auth_router(auth_backend), prefix="/auth/jwt", tags=["auth"])
app.include_router(fastapi_users.get_register_router(UserRead, UserCreate), prefix="/auth", tags=["auth"])
app.include_router(fastapi_users.get_reset_password_router(), prefix="/auth", tags=["auth"])
app.include_router(fastapi_users.get_verify_router(UserRead), prefix="/auth", tags=["auth"])
app.include_router(fastapi_users.get_users_router(UserRead, UserUpdate), prefix="/users", tags=["users"])


# ==========================================
# TRANSACTION / QUEUE ROUTERS
# ==========================================
MAX_RETRY = 5

@app.post("/api/v1/transactions", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    payload: TransactionCreate,
    session: AsyncSession = Depends(get_async_session)
):
    for attempt in range(MAX_RETRY):
        try:
            # 1. hitung total harga
            calculated_total = (
                (payload.under_8_count * PRICES["under_8"]) +
                (payload.under_22_count * PRICES["under_22"]) +
                (payload.adult_count * PRICES["adult"])
            )

            # 2. ambil queue terakhir
            result = await session.execute(
                select(func.max(TransactionEntry.queue_number))
            )
            max_queue = result.scalar() or 0

            # 3. buat transaksi
            new_transaction = TransactionEntry(
                queue_number=max_queue + 1,
                under_8_count=payload.under_8_count,
                under_22_count=payload.under_22_count,
                adult_count=payload.adult_count,
                total_price=calculated_total,
                status="pending"
            )

            session.add(new_transaction)
            await session.commit()
            await session.refresh(new_transaction)

            return new_transaction

        except IntegrityError:
            # terjadi race condition
            await session.rollback()

    # jika semua retry gagal
    raise HTTPException(
        status_code=409,
        detail="Queue conflict, please retry"
    )


@app.get("/api/v1/transactions/{transaction_id}", response_model=TransactionResponse, tags=["transactions"])
async def get_transaction_details(
    transaction_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """
    PUBLIC: Fetches a specific transaction ticket using its UUID.
    Used by the visitor to see their QR code and queue details.
    """
    try:
        result = await session.execute(
            select(TransactionEntry).where(TransactionEntry.id == transaction_id)
        )
        entry = result.scalars().first()

        if not entry:
            raise HTTPException(status_code=404, detail="Ticket not found")

        return entry

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error {e}")


@app.get("/api/v1/transactions", response_model=List[TransactionResponse], tags=["transactions"])
async def list_transactions(
    status: Optional[str] = Query(None, description="Filter by payment status (e.g., 'pending')"),
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user) # ADMIN ONLY
):
    """
    ADMIN: Lists all transactions. Used by the cashier dashboard.
    Can be filtered by status.
    """
    try:
        query = select(TransactionEntry).order_by(TransactionEntry.created_at.asc())
        
        if status:
            query = query.where(TransactionEntry.status == status)

        result = await session.execute(query)
        entries = result.scalars().unique().all()
        return entries
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch transactions {e}")


@app.patch("/api/v1/transactions/{transaction_id}/status", tags=["transactions"])
async def update_transaction_status(
    transaction_id: uuid.UUID,
    payload: TransactionStatusUpdate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user) # ADMIN ONLY
):
    """
    ADMIN: Updates the payment status of a ticket (e.g., to 'paid').
    """
    try:
        result = await session.execute(
            select(TransactionEntry).where(TransactionEntry.id == transaction_id)
        )
        entry = result.scalars().first()

        if not entry:
            raise HTTPException(status_code=404, detail="Ticket not found")

        entry.status = payload.status
        await session.commit()

        return {"success": True, "message": f"Status updated to {payload.status}"}
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update status {e}")


# ==========================================
# BAGIAN BARU: EDIT TRANSAKSI (DITAMBAHKAN)
# ==========================================

# Idealnya ini ditaruh di app/schema.py, tapi saya taruh di sini agar file ini langsung jalan.
class TransactionUpdateData(BaseModel):
    under_8_count: Optional[int] = None
    under_22_count: Optional[int] = None
    adult_count: Optional[int] = None

@app.patch("/api/v1/transactions/{transaction_id}/edit", response_model=TransactionResponse, tags=["transactions"])
async def edit_transaction_data(
    transaction_id: uuid.UUID,
    payload: TransactionUpdateData,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user) # ADMIN ONLY
):
    """
    ADMIN: Mengedit detail transaksi (jumlah tiket) dan menghitung ulang total harga.
    """
    try:
        result = await session.execute(
            select(TransactionEntry).where(TransactionEntry.id == transaction_id)
        )
        entry = result.scalars().first()

        if not entry:
            raise HTTPException(status_code=404, detail="Ticket not found")

        # Update data jika field diberikan dalam request
        if payload.under_8_count is not None:
            entry.under_8_count = payload.under_8_count
        if payload.under_22_count is not None:
            entry.under_22_count = payload.under_22_count
        if payload.adult_count is not None:
            entry.adult_count = payload.adult_count

        # KALKULASI ULANG HARGA DI SERVER (Sangat penting untuk keamanan)
        entry.total_price = (
            (entry.under_8_count * PRICES["under_8"]) +
            (entry.under_22_count * PRICES["under_22"]) +
            (entry.adult_count * PRICES["adult"])
        )

        await session.commit()
        await session.refresh(entry)
        
        return entry

    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to edit transaction: {e}")


@app.delete("/api/v1/transactions/{transaction_id}", tags=["transactions"])
async def delete_transaction_entry(
    transaction_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user) # ADMIN ONLY
):
    """
    ADMIN: Deletes a specific transaction from the queue.
    """
    try:
        result = await session.execute(
            select(TransactionEntry).where(TransactionEntry.id == transaction_id)
        )
        entry = result.scalars().first()

        if not entry:
            raise HTTPException(status_code=404, detail="Queue entry not found")

        await session.delete(entry)
        await session.commit()

        return {"success": True, "message": "Queue entry deleted successfully"}

    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete entry {e}")