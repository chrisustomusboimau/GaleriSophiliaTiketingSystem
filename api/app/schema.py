# schema.py
# ---------------------------------
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from fastapi_users import schemas
from enum import Enum 

# --- ENUMS ---
class PaymentMethodEnum(str, Enum):
    qris = "qris"
    card = "card"

# TAMBAHAN: Definisi Role User
class RoleEnum(str, Enum):
    admin = "admin"
    kasir = "kasir"
    checker = "checker"

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
    payment_method: PaymentMethodEnum = PaymentMethodEnum.qris

class TransactionResponse(BaseModel):
    id: uuid.UUID
    queue_number: int
    
    # --- TAMBAHAN BARU: Field untuk format kode tiket ---
    ticket_code: str
    
    total_price: int
    status: str
    created_at: datetime
    confirmed_at: Optional[datetime] = None
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
    origins: Optional[List[OriginBase]] = None  
    status: Optional[str] = None
    payment_method: Optional[PaymentMethodEnum] = None

class TransactionStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|paid|confirmed|cancelled)$")

# ==========================================
# USER SCHEMAS (Auth & Roles)
# ==========================================
class UserRead(schemas.BaseUser[uuid.UUID]):
    role: RoleEnum # Menampilkan role saat membaca data user

class UserCreate(schemas.BaseUserCreate):
    role: RoleEnum = RoleEnum.kasir # Default saat buat user baru adalah kasir

class UserUpdate(schemas.BaseUserUpdate):
    role: Optional[RoleEnum] = None # Mengizinkan perubahan role