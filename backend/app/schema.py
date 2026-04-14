from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime
from fastapi_users import schemas


class OriginBase(BaseModel):
    country_code: str
    count: int

class TransactionCreate(BaseModel):
    under_8_count: int = 0
    under_22_count: int = 0
    adult_count: int = 0
    origins: List[OriginBase] = []

class TransactionResponse(TransactionCreate):
    id: uuid.UUID
    queue_number: int
    total_price: int
    status: str
    created_at: datetime
    
    class Config:
        orm_mode = True # or model_config = ConfigDict(from_attributes=True) for Pydantic V2

class TransactionStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|paid|cancelled)$")

class UserRead(schemas.BaseUser[uuid.UUID]):
    pass

class UserCreate(schemas.BaseUserCreate):
    pass

class UserUpdate(schemas.BaseUserUpdate):
    pass