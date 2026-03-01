"""
동아리 홍보 API
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.club import Club, ClubApplication

router = APIRouter(prefix="/clubs", tags=["동아리"])


# Schemas
class ClubCreate(BaseModel):
    name: str
    description: str
    qna_questions: Optional[List[str]] = None


class ClubUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    qna_questions: Optional[List[str]] = None


class ClubApplicationCreate(BaseModel):
    name: str
    student_id: str
    qna_answers: Optional[dict] = None


class ClubResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: str
    qna_questions: Optional[List[str]]
    created_at: str
    author_name: Optional[str] = None
    application_count: int = 0
    is_mine: bool = False

    class Config:
        from_attributes = True


class ClubApplicationResponse(BaseModel):
    id: int
    club_id: int
    user_id: int
    name: str
    student_id: str
    qna_answers: Optional[dict]
    created_at: str

    class Config:
        from_attributes = True


@router.get("")
async def get_clubs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """동아리 목록 조회"""
    clubs = db.query(Club).order_by(Club.created_at.desc()).all()

    result = []
    for club in clubs:
        result.append({
            "id": club.id,
            "user_id": club.user_id,
            "name": club.name,
            "description": club.description,
            "qna_questions": club.qna_questions,
            "created_at": club.created_at.isoformat() if club.created_at else "",
            "author_name": club.user.name if club.user else "",
            "application_count": len(club.applications),
            "is_mine": club.user_id == current_user.id
        })

    return result


@router.get("/{club_id}")
async def get_club(
    club_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """동아리 상세 조회"""
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=404, detail="동아리를 찾을 수 없습니다.")

    # 내가 이미 신청했는지 확인
    my_application = db.query(ClubApplication).filter(
        ClubApplication.club_id == club_id,
        ClubApplication.user_id == current_user.id
    ).first()

    return {
        "id": club.id,
        "user_id": club.user_id,
        "name": club.name,
        "description": club.description,
        "qna_questions": club.qna_questions,
        "created_at": club.created_at.isoformat() if club.created_at else "",
        "author_name": club.user.name if club.user else "",
        "application_count": len(club.applications),
        "is_mine": club.user_id == current_user.id,
        "has_applied": my_application is not None
    }


@router.post("")
async def create_club(
    data: ClubCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """동아리 등록"""
    club = Club(
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        qna_questions=data.qna_questions
    )
    db.add(club)
    db.commit()
    db.refresh(club)

    return {"id": club.id, "message": "동아리가 등록되었습니다."}


@router.put("/{club_id}")
async def update_club(
    club_id: int,
    data: ClubUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """동아리 수정"""
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=404, detail="동아리를 찾을 수 없습니다.")
    if club.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")

    if data.name is not None:
        club.name = data.name
    if data.description is not None:
        club.description = data.description
    if data.qna_questions is not None:
        club.qna_questions = data.qna_questions

    db.commit()
    return {"message": "동아리가 수정되었습니다."}


@router.delete("/{club_id}")
async def delete_club(
    club_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """동아리 삭제"""
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=404, detail="동아리를 찾을 수 없습니다.")
    if club.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")

    db.delete(club)
    db.commit()
    return {"message": "동아리가 삭제되었습니다."}


# 신청 관련 API
@router.post("/{club_id}/apply")
async def apply_club(
    club_id: int,
    data: ClubApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """동아리 신청"""
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=404, detail="동아리를 찾을 수 없습니다.")

    if club.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="자신의 동아리에는 신청할 수 없습니다.")

    # 이미 신청했는지 확인
    existing = db.query(ClubApplication).filter(
        ClubApplication.club_id == club_id,
        ClubApplication.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 신청하셨습니다.")

    application = ClubApplication(
        club_id=club_id,
        user_id=current_user.id,
        name=data.name,
        student_id=data.student_id,
        qna_answers=data.qna_answers
    )
    db.add(application)
    db.commit()

    return {"message": "신청이 완료되었습니다."}


@router.get("/{club_id}/applications")
async def get_club_applications(
    club_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """동아리 신청 목록 조회 (작성자만)"""
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=404, detail="동아리를 찾을 수 없습니다.")
    if club.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="조회 권한이 없습니다.")

    applications = db.query(ClubApplication).filter(
        ClubApplication.club_id == club_id
    ).order_by(ClubApplication.created_at.desc()).all()

    return [
        {
            "id": app.id,
            "club_id": app.club_id,
            "user_id": app.user_id,
            "name": app.name,
            "student_id": app.student_id,
            "qna_answers": app.qna_answers,
            "created_at": app.created_at.isoformat() if app.created_at else ""
        }
        for app in applications
    ]


@router.delete("/{club_id}/applications/{application_id}")
async def delete_application(
    club_id: int,
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """신청 삭제 (신청자 본인 또는 동아리 작성자)"""
    application = db.query(ClubApplication).filter(
        ClubApplication.id == application_id,
        ClubApplication.club_id == club_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="신청을 찾을 수 없습니다.")

    club = db.query(Club).filter(Club.id == club_id).first()
    if application.user_id != current_user.id and club.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")

    db.delete(application)
    db.commit()
    return {"message": "신청이 삭제되었습니다."}
