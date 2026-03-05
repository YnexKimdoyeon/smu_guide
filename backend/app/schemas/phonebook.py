from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class PhoneEntryBase(BaseModel):
    category: str = "dept"  # dept=학과, admin=행정
    department: str
    name: str
    phone: str
    location: Optional[str] = None
    fax: Optional[str] = None


class PhoneEntryCreate(PhoneEntryBase):
    pass


class PhoneEntryUpdate(BaseModel):
    category: Optional[str] = None
    department: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    fax: Optional[str] = None


class PhoneEntryResponse(PhoneEntryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
