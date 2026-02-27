from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class PhoneEntryBase(BaseModel):
    department: str
    name: str
    phone: str
    extension: Optional[str] = None


class PhoneEntryCreate(PhoneEntryBase):
    pass


class PhoneEntryUpdate(BaseModel):
    department: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    extension: Optional[str] = None


class PhoneEntryResponse(PhoneEntryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
