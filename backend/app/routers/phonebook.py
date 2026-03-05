from typing import List, Optional
import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.cache import smart_cache_get, smart_cache_set, cache_delete_pattern
from app.models.user import User
from app.models.phonebook import PhoneEntry
from app.schemas.phonebook import PhoneEntryCreate, PhoneEntryUpdate, PhoneEntryResponse

router = APIRouter(prefix="/phonebook", tags=["전화번호부"])


def sanitize_search_query(query: str) -> str:
    """
    검색어 정규화 및 위험 문자 필터링
    - 이모지 제거
    - 유니코드 방향 제어 문자 제거
    - 일반 텍스트만 허용 (한글, 영문, 숫자, 공백, 하이픈)
    """
    if not query:
        return ""

    # 유니코드 정규화 (NFC)
    query = unicodedata.normalize("NFC", query)

    # 제어 문자 제거 (유니코드 카테고리 C*)
    query = "".join(
        char for char in query
        if not unicodedata.category(char).startswith("C")
    )

    # 이모지 및 특수 심볼 제거 (유니코드 카테고리 So, Sk)
    query = "".join(
        char for char in query
        if unicodedata.category(char) not in ("So", "Sk")
    )

    # 유니코드 방향 제어 문자 제거 (RTL, LTR 등)
    bidi_chars = re.compile(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069]")
    query = bidi_chars.sub("", query)

    # 허용 문자만 유지: 한글, 영문, 숫자, 공백, 하이픈, 점
    allowed_pattern = re.compile(r"[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318Fa-zA-Z0-9\s\-\.]")
    query = allowed_pattern.sub("", query)

    # 연속 공백 제거 및 앞뒤 공백 제거
    query = re.sub(r"\s+", " ", query).strip()

    # 최대 길이 제한 (100자)
    return query[:100]

CACHE_KEY = "phonebook"
CACHE_EXPIRE = 3600  # 1시간


@router.get("", response_model=List[PhoneEntryResponse])
def get_phone_entries(
    search: Optional[str] = Query(None, description="검색어"),
    category: Optional[str] = Query(None, description="카테고리: dept/admin"),
    department: Optional[str] = Query(None, description="부서 필터"),
    db: Session = Depends(get_db)
):
    """전화번호부 조회"""
    query = db.query(PhoneEntry)

    if category:
        query = query.filter(PhoneEntry.category == category)

    if department:
        query = query.filter(PhoneEntry.department == department)

    if search:
        # 검색어 정규화 (이모지/특수 유니코드 필터링)
        sanitized_search = sanitize_search_query(search)
        if sanitized_search:
            query = query.filter(
                (PhoneEntry.department.contains(sanitized_search)) |
                (PhoneEntry.name.contains(sanitized_search)) |
                (PhoneEntry.phone.contains(sanitized_search))
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
