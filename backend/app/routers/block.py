from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.block import UserBlock, UserReport

router = APIRouter(prefix="/block", tags=["차단/신고"])


class BlockRequest(BaseModel):
    blocked_user_id: int


class ReportRequest(BaseModel):
    reported_user_id: int
    reason: str
    detail: Optional[str] = None
    message_id: Optional[int] = None
    room_type: Optional[str] = None


class BlockedUserResponse(BaseModel):
    id: int
    blocked_user_id: int
    anon_name: str
    created_at: str

    class Config:
        from_attributes = True


@router.post("/block", status_code=status.HTTP_201_CREATED)
def block_user(
    data: BlockRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자 차단"""
    if data.blocked_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신을 차단할 수 없습니다"
        )

    # 이미 차단했는지 확인
    existing = db.query(UserBlock).filter(
        UserBlock.user_id == current_user.id,
        UserBlock.blocked_user_id == data.blocked_user_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 차단한 사용자입니다"
        )

    block = UserBlock(
        user_id=current_user.id,
        blocked_user_id=data.blocked_user_id
    )
    db.add(block)
    db.commit()

    return {"message": "사용자를 차단했습니다"}


@router.delete("/block/{blocked_user_id}", status_code=status.HTTP_200_OK)
def unblock_user(
    blocked_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """차단 해제"""
    block = db.query(UserBlock).filter(
        UserBlock.user_id == current_user.id,
        UserBlock.blocked_user_id == blocked_user_id
    ).first()

    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="차단 정보를 찾을 수 없습니다"
        )

    db.delete(block)
    db.commit()

    return {"message": "차단을 해제했습니다"}


@router.get("/blocks", response_model=List[BlockedUserResponse])
def get_blocked_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """차단 목록 조회"""
    blocks = db.query(UserBlock).filter(
        UserBlock.user_id == current_user.id
    ).all()

    result = []
    for block in blocks:
        anon_num = (block.blocked_user_id * 7) % 1000
        result.append({
            "id": block.id,
            "blocked_user_id": block.blocked_user_id,
            "anon_name": f"익명{anon_num}",
            "created_at": block.created_at.isoformat()
        })

    return result


@router.get("/blocked-ids")
def get_blocked_user_ids(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """차단한 사용자 ID 목록 조회"""
    blocks = db.query(UserBlock.blocked_user_id).filter(
        UserBlock.user_id == current_user.id
    ).all()

    return {"blocked_ids": [b[0] for b in blocks]}


@router.post("/report", status_code=status.HTTP_201_CREATED)
def report_user(
    data: ReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자 신고"""
    if data.reported_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신을 신고할 수 없습니다"
        )

    report = UserReport(
        reporter_id=current_user.id,
        reported_user_id=data.reported_user_id,
        reason=data.reason,
        detail=data.detail,
        message_id=data.message_id,
        room_type=data.room_type
    )
    db.add(report)
    db.commit()

    return {"message": "신고가 접수되었습니다"}
