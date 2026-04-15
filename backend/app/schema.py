from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from fastapi_users import schemas

class OriginBase(BaseModel):
    country_code: str
    count: int

class TicketItemBase(BaseModel):
    floor: str # e.g., "Floor 1"
    age_category: str # "adult", "student", "child"
    quantity: int = Field(..., ge=0) # Changed to ge=0 so admins can reduce quantities to 0 if needed

class TicketItemResponse(TicketItemBase):
    unit_price: int

class TransactionCreate(BaseModel):
    items: List[TicketItemBase]
    origins: List[OriginBase] = []

class TransactionResponse(BaseModel):
    id: uuid.UUID
    queue_number: int
    total_price: int
    status: str
    created_at: datetime
    items: List[TicketItemResponse]
    origins: List[OriginBase]

    class Config:
        from_attributes = True

# ==========================================
# NEW EDIT SCHEMAS
# ==========================================
class TransactionItemSchema(BaseModel):
    floor: str
    age_category: str
    quantity: int
    unit_price: int

class TransactionUpdateData(BaseModel):
    """
    Schema used by the Admin Dashboard to edit an existing ticket.
    Allows updating the items array and/or the payment status.
    """
    items: Optional[List[TransactionItemSchema]] = None
    status: Optional[str] = None

class TransactionStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|paid|cancelled)$")

# ==========================================
# USER SCHEMAS (Admin Auth)
# ==========================================
class UserRead(schemas.BaseUser[uuid.UUID]):
    pass

class UserCreate(schemas.BaseUserCreate):
    pass

class UserUpdate(schemas.BaseUserUpdate):
    pass