# schema.py
# ---------------------------------
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from fastapi_users import schemas
from enum import Enum # <-- TAMBAHAN: Import Enum

# --- ENUMS ---
# TAMBAHAN: Definisi metode pembayaran yang diizinkan
class PaymentMethodEnum(str, Enum):
    qris = "qris"
    card = "card"

# --- ORIGIN SCHEMA ---
class OriginBase(BaseModel):
    country_code: str
    count: int

# --- ITEM SCHEMAS ---
class TicketItemBase(BaseModel):
    floor: str 
    age_category: str 
    quantity: int = Field(..., ge=0) 

class TicketItemResponse(TicketItemBase):
    unit_price: int

# --- TRANSACTION SCHEMAS ---
class TransactionCreate(BaseModel):
    items: List[TicketItemBase]
    origins: List[OriginBase] = []
    # TAMBAHAN: Field payment method dengan nilai default 'qris'
    payment_method: PaymentMethodEnum = PaymentMethodEnum.qris

class TransactionResponse(BaseModel):
    id: uuid.UUID
    queue_number: int
    total_price: int
    status: str
    created_at: datetime
    # Tambahkan confirmed_at agar selalu diekspos oleh API
    confirmed_at: Optional[datetime] = None
    
    # TAMBAHAN: Field payment method untuk response
    payment_method: PaymentMethodEnum
    
    items: List[TicketItemResponse]
    origins: List[OriginBase]

    class Config:
        from_attributes = True

# ==========================================
# EDIT SCHEMAS
# ==========================================
class TransactionItemSchema(BaseModel):
    floor: str
    age_category: str
    quantity: int
    unit_price: int

class TransactionUpdateData(BaseModel):
    """
    Schema used by the Admin Dashboard to edit an existing ticket.
    Allows updating the items array, origins array, and/or the payment status.
    """
    items: Optional[List[TransactionItemSchema]] = None
    origins: Optional[List[OriginBase]] = None  # <--- INI SANGAT PENTING AGAR API EDIT BEKERJA
    status: Optional[str] = None
    
    # TAMBAHAN: Mengizinkan admin mengubah metode pembayaran
    payment_method: Optional[PaymentMethodEnum] = None

class TransactionStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|paid|confirmed|cancelled)$")

# ==========================================
# USER SCHEMAS (Admin Auth)
# ==========================================
class UserRead(schemas.BaseUser[uuid.UUID]):
    pass

class UserCreate(schemas.BaseUserCreate):
    pass

class UserUpdate(schemas.BaseUserUpdate):
    pass