# main.py
# ==========================================================
# Perubahan dari versi sebelumnya:
#   - Menambahkan custom endpoint GET /api/v1/users untuk
#     mengambil daftar semua staf (hanya untuk Admin).
# ==========================================================

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager
from sqlalchemy import select, func, delete
import uuid
from typing import List, Optional
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta

from app.config import settings

from app.schema import (
    UserCreate, UserRead, UserUpdate,
    TransactionCreate, TransactionResponse, TransactionStatusUpdate,
    TransactionUpdateData
)
from app.db import (
    create_db_and_tables, get_async_session, User,
    TransactionEntry, TransactionOriginEntry, TransactionItem
)

from app.users import auth_backend, fastapi_users, require_role

# ----------------------------------------------------------
# INISIALISASI PENJAGA PINTU (ROLE-BASED ACCESS)
# ----------------------------------------------------------
current_admin   = require_role(["admin"])
current_kasir   = require_role(["admin", "kasir"])
current_checker = require_role(["admin", "kasir", "checker"])


PREFIX = settings.api_prefix   # "/api/v1"
WIB    = settings.timezone     # ZoneInfo("Asia/Jakarta")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
    yield

app = FastAPI(lifespan=lifespan)

# ==========================================
# CORS MIDDLEWARE
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# AUTHENTICATION ROUTERS
# ==========================================
# 1. PUBLIC: Login & Reset Password bisa diakses siapa saja
app.include_router(fastapi_users.get_auth_router(auth_backend), prefix=f"{PREFIX}/auth/jwt", tags=["auth"])
app.include_router(fastapi_users.get_reset_password_router(),   prefix=f"{PREFIX}/auth",     tags=["auth"])
app.include_router(fastapi_users.get_verify_router(UserRead),   prefix=f"{PREFIX}/auth",     tags=["auth"])

# 2. RESTRICTED: Pendaftaran hanya untuk Admin
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix=f"{PREFIX}/auth",
    tags=["auth-admin"],
    dependencies=[Depends(current_admin)]  
)

# Rute standar users dari fastapi-users (hanya bisa /me atau /id)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix=f"{PREFIX}/users",
    tags=["users-admin"],
    dependencies=[Depends(current_admin)]  
)

# ==========================================
# CUSTOM USER ROUTER: GET ALL USERS (HANYA ADMIN)
# ==========================================
@app.get(f"{PREFIX}/users", response_model=List[UserRead], tags=["users-admin"])
async def list_all_users(
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_admin) # <-- HANYA ADMIN
):
    """ADMIN: Mengambil daftar seluruh staf (admin, kasir, checker)."""
    try:
        result = await session.execute(select(User))
        users = result.scalars().all()
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {e}")


# ==========================================
# TRANSACTION / QUEUE ROUTERS
# ==========================================

@app.post(f"{PREFIX}/transactions", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    payload: TransactionCreate,
    session: AsyncSession = Depends(get_async_session)
):
    """PUBLIC: Pengunjung bisa membuat antrian transaksi baru."""
    for attempt in range(settings.max_queue_retry):
        try:
            total_price = 0
            transaction_items = []

            for item in payload.items:
                floor_prices = settings.prices_map.get(item.floor)
                if not floor_prices:
                    raise HTTPException(status_code=400, detail=f"Invalid floor: {item.floor}")

                price = floor_prices.get(item.age_category)
                if price is None:
                    raise HTTPException(status_code=400, detail=f"Invalid age category: {item.age_category}")

                item_total = price * item.quantity
                total_price += item_total

                transaction_items.append(TransactionItem(
                    floor=item.floor,
                    age_category=item.age_category,
                    quantity=item.quantity,
                    unit_price=price
                ))

            now_wib = datetime.now(WIB)
            start_of_today_wib    = datetime(now_wib.year, now_wib.month, now_wib.day, tzinfo=WIB)
            start_of_tomorrow_wib = start_of_today_wib + timedelta(days=1)

            result = await session.execute(
                select(func.max(TransactionEntry.queue_number))
                .where(
                    TransactionEntry.created_at >= start_of_today_wib,
                    TransactionEntry.created_at < start_of_tomorrow_wib
                )
            )
            max_queue = result.scalar() or 0

            new_transaction = TransactionEntry(
                queue_number=max_queue + 1,
                date_only=now_wib.date(),
                total_price=total_price,
                status="pending",
                payment_method=payload.payment_method.value,
                items=transaction_items,
                origins=[TransactionOriginEntry(**o.dict()) for o in payload.origins]
            )

            session.add(new_transaction)
            await session.commit()
            await session.refresh(new_transaction)
            return new_transaction

        except IntegrityError:
            await session.rollback()
            continue

    raise HTTPException(status_code=409, detail="Queue conflict, please retry")


@app.get(f"{PREFIX}/transactions", response_model=List[TransactionResponse], tags=["transactions"])
async def list_today_transactions(
    status: Optional[str] = Query(None, description="Filter by payment status (e.g., 'pending')"),
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_checker) # <-- PENJAGA PINTU: ADMIN, KASIR, CHECKER
):
    """STAFF: Lists transactions FOR TODAY ONLY."""
    try:
        now_wib = datetime.now(WIB)
        start_of_today_wib    = datetime(now_wib.year, now_wib.month, now_wib.day, tzinfo=WIB)
        start_of_tomorrow_wib = start_of_today_wib + timedelta(days=1)

        query = select(TransactionEntry).order_by(TransactionEntry.created_at.asc())
        query = query.where(
            TransactionEntry.created_at >= start_of_today_wib,
            TransactionEntry.created_at < start_of_tomorrow_wib
        )
        if status:
            query = query.where(TransactionEntry.status == status)

        result = await session.execute(query)
        entries = result.scalars().unique().all()
        return entries
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch today's transactions: {e}")


@app.get(f"{PREFIX}/transactions/all", response_model=List[TransactionResponse], tags=["transactions"])
async def list_all_transactions(
    status: Optional[str] = Query(None, description="Filter by payment status (e.g., 'pending')"),
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_checker) # <-- PENJAGA PINTU: ADMIN, KASIR, CHECKER
):
    """STAFF: Lists ALL historical transactions."""
    try:
        query = select(TransactionEntry).order_by(TransactionEntry.created_at.asc())
        if status:
            query = query.where(TransactionEntry.status == status)

        result = await session.execute(query)
        entries = result.scalars().unique().all()
        return entries
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch all transactions: {e}")


@app.get(f"{PREFIX}/transactions/{{transaction_id}}", response_model=TransactionResponse, tags=["transactions"])
async def get_transaction_details(
    transaction_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """PUBLIC: Fetches a specific transaction ticket using its UUID."""
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


@app.patch(f"{PREFIX}/transactions/{{transaction_id}}/status", tags=["transactions"])
async def update_transaction_status(
    transaction_id: uuid.UUID,
    payload: TransactionStatusUpdate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_kasir) # <-- PENJAGA PINTU: HANYA ADMIN & KASIR (Checker Ditolak)
):
    """STAFF: Updates the payment status of a ticket."""
    try:
        result = await session.execute(
            select(TransactionEntry).where(TransactionEntry.id == transaction_id)
        )
        entry = result.scalars().first()
        if not entry:
            raise HTTPException(status_code=404, detail="Ticket not found")

        entry.status = payload.status
        if payload.status in ["confirmed", "paid"]:
            entry.confirmed_at = datetime.now(WIB)

        await session.commit()
        return {"success": True, "message": f"Status updated to {payload.status}"}
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update status {e}")


@app.patch(f"{PREFIX}/transactions/{{transaction_id}}/edit", response_model=TransactionResponse, tags=["transactions"])
async def edit_transaction_data(
    transaction_id: uuid.UUID,
    payload: TransactionUpdateData,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_kasir) # <-- PENJAGA PINTU: HANYA ADMIN & KASIR (Checker Ditolak)
):
    """STAFF: Updates items and origins by deleting old records and inserting new ones."""
    result = await session.execute(select(TransactionEntry).where(TransactionEntry.id == transaction_id))
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if payload.items is not None:
        await session.execute(delete(TransactionItem).where(TransactionItem.transaction_id == transaction_id))

        total_price = 0
        new_items = []
        for item in payload.items:
            price = settings.prices_map[item.floor][item.age_category]
            total_price += price * item.quantity
            new_items.append(TransactionItem(
                transaction_id=transaction_id,
                floor=item.floor,
                age_category=item.age_category,
                quantity=item.quantity,
                unit_price=price
            ))

        session.add_all(new_items)
        entry.total_price = total_price

    if getattr(payload, "origins", None) is not None:
        await session.execute(delete(TransactionOriginEntry).where(TransactionOriginEntry.transaction_id == transaction_id))

        new_origins = [
            TransactionOriginEntry(
                transaction_id=transaction_id,
                country_code=origin.country_code,
                count=origin.count
            )
            for origin in payload.origins
        ]
        session.add_all(new_origins)

    if payload.status is not None:
        entry.status = payload.status
        if payload.status in ["confirmed", "paid"]:
            entry.confirmed_at = datetime.now(WIB)

    if payload.payment_method is not None:
        entry.payment_method = payload.payment_method.value

    try:
        await session.commit()
        await session.refresh(entry)
        return entry
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to edit transaction: {e}")


@app.delete(f"{PREFIX}/transactions/{{transaction_id}}", tags=["transactions"])
async def delete_transaction_entry(
    transaction_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_admin) # <-- PENJAGA PINTU: HANYA ADMIN BISA MENGHAPUS
):
    """ADMIN: Deletes a specific transaction from the queue."""
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