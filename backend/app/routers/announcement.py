from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.core.cache import smart_cache_get, smart_cache_set, cache_delete_pattern
from app.models.user import User
from app.models.announcement import Announcement
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate, AnnouncementResponse

router = APIRouter(prefix="/announcements", tags=["공지사항"])

CACHE_KEY_LIST = "announcements:list"
CACHE_KEY_DETAIL = "announcements:detail"
CACHE_EXPIRE = 600  # 10분


@router.get("", response_model=List[AnnouncementResponse])
def get_announcements(
    category: Optional[str] = Query(None, description="카테고리 필터"),
    db: Session = Depends(get_db)
):
    """공지사항 목록 조회"""
    query = db.query(Announcement)

    if category:
        query = query.filter(Announcement.category == category)

    announcements = query.order_by(desc(Announcement.notice_date)).all()
    return announcements


@router.get("/{announcement_id}", response_model=AnnouncementResponse)
def get_announcement(
    announcement_id: int,
    db: Session = Depends(get_db)
):
    """공지사항 상세 조회"""
    announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id
    ).first()

    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="공지사항을 찾을 수 없습니다"
        )

    return announcement


@router.post("", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
def create_announcement(
    announcement_data: AnnouncementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """공지사항 생성 (관리자용)"""
    new_announcement = Announcement(**announcement_data.model_dump())

    db.add(new_announcement)
    db.commit()
    db.refresh(new_announcement)

    return new_announcement


@router.put("/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(
    announcement_id: int,
    announcement_data: AnnouncementUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """공지사항 수정 (관리자용)"""
    announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id
    ).first()

    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="공지사항을 찾을 수 없습니다"
        )

    update_data = announcement_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(announcement, key, value)

    db.commit()
    db.refresh(announcement)

    return announcement


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    announcement_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """공지사항 삭제 (관리자용)"""
    announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id
    ).first()

    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="공지사항을 찾을 수 없습니다"
        )

    db.delete(announcement)
    db.commit()
