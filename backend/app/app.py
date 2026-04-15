from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager
from sqlalchemy import select, func
import uuid
from typing import List, Optional
from pydantic import BaseModel 
from sqlalchemy.exc import IntegrityError

# --- CORRECTED IMPORTS ---
# Removed TransactionItem from schema, added to db
from app.schema import (
    UserCreate, UserRead, UserUpdate, 
    TransactionCreate, TransactionResponse, TransactionStatusUpdate,
    TransactionUpdateData
)
from app.db import (
    create_db_and_tables, get_async_session, User,
    TransactionEntry, TransactionOriginEntry, TransactionItem 
)
from app.users import auth_backend, current_active_user, fastapi_users

# --- SERVER-SIDE PRICE CONFIGURATION ---
PRICES_MAP = {
    "Floor 6/7": {"adult": 100000, "student": 50000, "child": 25000},
    "Floor 5":   {"adult": 40000,  "student": 20000, "child": 10000},
    "Floor 1":   {"adult": 60000,  "student": 40000, "child": 20000},
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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], 
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
            total_price = 0
            transaction_items = []

            # 1. Logic: Calculate dynamic price and prepare items
            for item in payload.items:
                floor_prices = PRICES_MAP.get(item.floor)
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

            # 2. Handle Queue Number
            result = await session.execute(select(func.max(TransactionEntry.queue_number)))
            max_queue = result.scalar() or 0

            # 3. Create main transaction
            new_transaction = TransactionEntry(
                queue_number=max_queue + 1,
                total_price=total_price,
                status="pending",
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
# EDIT TRANSAKSI
# ==========================================

@app.patch("/api/v1/transactions/{transaction_id}/edit", response_model=TransactionResponse, tags=["transactions"])
async def edit_transaction_data(
    transaction_id: uuid.UUID,
    payload: TransactionUpdateData, # Use the new update schema
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user)
):
    """
    ADMIN: Completely updates items and recalculates price, and optionally updates status.
    """
    result = await session.execute(select(TransactionEntry).where(TransactionEntry.id == transaction_id))
    entry = result.scalars().first()

    if not entry:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # 1. Update Items & Recalculate Price (If items were provided)
    if payload.items is not None:
        entry.items = [] # Clear old items
        
        total_price = 0
        for item in payload.items:
            # Enforce server-side pricing for security
            price = PRICES_MAP[item.floor][item.age_category]
            total_price += price * item.quantity
            entry.items.append(TransactionItem(
                floor=item.floor, age_category=item.age_category, 
                quantity=item.quantity, unit_price=price
            ))

        entry.total_price = total_price

    # 2. Update Status (If status was provided)
    if payload.status is not None:
        entry.status = payload.status

    try:
        await session.commit()
        await session.refresh(entry)
        return entry
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