from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.cache import smart_cache_get, smart_cache_set, cache_delete_pattern
from app.models.user import User
from app.models.phonebook import PhoneEntry
from app.schemas.phonebook import PhoneEntryCreate, PhoneEntryUpdate, PhoneEntryResponse

router = APIRouter(prefix="/phonebook", tags=["전화번호부"])

CACHE_KEY = "phonebook"
CACHE_EXPIRE = 3600  # 1시간


@router.get("", response_model=List[PhoneEntryResponse])
def get_phone_entries(
    search: Optional[str] = Query(None, description="검색어"),
    department: Optional[str] = Query(None, description="부서 필터"),
    db: Session = Depends(get_db)
):
    """전화번호부 조회"""
    query = db.query(PhoneEntry)

    if department:
        query = query.filter(PhoneEntry.department == department)

    if search:
        query = query.filter(
            (PhoneEntry.department.contains(search)) |
            (PhoneEntry.name.contains(search)) |
            (PhoneEntry.phone.contains(search))
        )

    entries = query.order_by(PhoneEntry.department, PhoneEntry.name).all()
    return entries


@router.get("/departments", response_model=List[str])
def get_departments(db: Session = Depends(get_db)):
    """부서 목록 조회 (캐싱 적용)"""
    cache_key = f"{CACHE_KEY}:departments"

    cached = smart_cache_get(cache_key)
    if cached:
        return cached

    departments = db.query(PhoneEntry.department).distinct().all()
    result = [d[0] for d in departments if d[0]]

    smart_cache_set(cache_key, result, CACHE_EXPIRE)

    return result


@router.get("/{entry_id}", response_model=PhoneEntryResponse)
def get_phone_entry(
    entry_id: int,
    db: Session = Depends(get_db)
):
    """전화번호부 상세 조회"""
    entry = db.query(PhoneEntry).filter(PhoneEntry.id == entry_id).first()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="연락처를 찾을 수 없습니다"
        )

    return entry


@router.post("", response_model=PhoneEntryResponse, status_code=status.HTTP_201_CREATED)
def create_phone_entry(
    entry_data: PhoneEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """전화번호부 추가 (관리자용)"""
    new_entry = PhoneEntry(**entry_data.model_dump())

    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    return new_entry


@router.put("/{entry_id}", response_model=PhoneEntryResponse)
def update_phone_entry(
    entry_id: int,
    entry_data: PhoneEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """전화번호부 수정 (관리자용)"""
    entry = db.query(PhoneEntry).filter(PhoneEntry.id == entry_id).first()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="연락처를 찾을 수 없습니다"
        )

    update_data = entry_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(entry, key, value)

    db.commit()
    db.refresh(entry)

    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_phone_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """전화번호부 삭제 (관리자용)"""
    entry = db.query(PhoneEntry).filter(PhoneEntry.id == entry_id).first()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="연락처를 찾을 수 없습니다"
        )

    db.delete(entry)
    db.commit()
