from datetime import date, datetime, timezone, timedelta
from typing import List
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.friend import Friend
from app.models.dotori import DepartmentRankingCache, DotoriGift
from app.schemas.dotori import (
    DotoriInfo,
    AttendanceResponse,
    PurchaseRequest,
    PurchaseResponse,
    DepartmentRanking,
    RankingResponse,
    GiftRequest,
    GiftResponse,
    ReceivedGift,
    UnreadGiftsResponse,
)

router = APIRouter(prefix="/dotori", tags=["도토리"])

# 가격 설정
PRICE_NICKNAME_COLOR = 200
PRICE_TITLE = 300

# KST 타임존
KST = timezone(timedelta(hours=9))


def get_today_kst() -> date:
    """KST 기준 오늘 날짜 반환"""
    return datetime.now(KST).date()


@router.get("/info", response_model=DotoriInfo)
def get_dotori_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """도토리 정보 조회"""
    today = get_today_kst()
    can_attend = current_user.last_attendance_date != today

    return DotoriInfo(
        point=current_user.dotori_point or 0,
        nickname_color=current_user.nickname_color,
        title=current_user.title,
        can_attend_today=can_attend
    )


@router.post("/attendance", response_model=AttendanceResponse)
def check_attendance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """출석 체크 - 하루 1회, KST 자정 기준"""
    today = get_today_kst()

    # 이미 출석했는지 확인
    if current_user.last_attendance_date == today:
        return AttendanceResponse(
            success=False,
            message="오늘은 이미 출석했습니다",
            dotori_earned=0,
            total_point=current_user.dotori_point or 0
        )

    # 출석 처리
    current_user.dotori_point = (current_user.dotori_point or 0) + 1
    current_user.last_attendance_date = today
    db.commit()

    return AttendanceResponse(
        success=True,
        message="출석 완료! 도토리 1개를 획득했습니다",
        dotori_earned=1,
        total_point=current_user.dotori_point
    )


@router.post("/shop/purchase", response_model=PurchaseResponse)
def purchase_item(
    request: PurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """상점 아이템 구매"""
    current_point = current_user.dotori_point or 0

    if request.item_type == "nickname_color":
        # 닉네임 색상 구매
        price = PRICE_NICKNAME_COLOR

        # HEX 색상 검증
        if not re.match(r'^#[0-9A-Fa-f]{6}$', request.value):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="올바른 색상 코드가 아닙니다 (예: #FF5733)"
            )

        if current_point < price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"도토리가 부족합니다 (필요: {price}, 보유: {current_point})"
            )

        # 구매 처리
        current_user.dotori_point = current_point - price
        current_user.nickname_color = request.value.upper()
        db.commit()

        return PurchaseResponse(
            success=True,
            message="닉네임 색상이 변경되었습니다!",
            remaining_point=current_user.dotori_point,
            item_type="nickname_color",
            item_value=current_user.nickname_color
        )

    elif request.item_type == "title":
        # 칭호 구매
        price = PRICE_TITLE

        # 칭호 길이 검증 (3글자 이하)
        if len(request.value) > 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="칭호는 3글자 이하여야 합니다"
            )

        # 빈 문자열 검증
        if len(request.value) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="칭호를 입력해주세요"
            )

        if current_point < price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"도토리가 부족합니다 (필요: {price}, 보유: {current_point})"
            )

        # 구매 처리
        current_user.dotori_point = current_point - price
        current_user.title = request.value
        db.commit()

        return PurchaseResponse(
            success=True,
            message=f"칭호 [{request.value}]가 설정되었습니다!",
            remaining_point=current_user.dotori_point,
            item_type="title",
            item_value=current_user.title
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="알 수 없는 아이템 타입입니다"
        )


def refresh_ranking_cache(db: Session):
    """랭킹 캐시 갱신 (하루 1회)"""
    today = get_today_kst()

    # 오늘 캐시가 이미 있는지 확인
    existing = db.query(DepartmentRankingCache).filter(
        DepartmentRankingCache.cache_date == today
    ).first()

    if existing:
        return  # 이미 캐시됨

    # 이전 캐시 삭제
    db.query(DepartmentRankingCache).delete()

    # 학과별 도토리 합계 조회
    rankings = db.query(
        User.department,
        func.sum(User.dotori_point).label('total_dotori'),
        func.count(User.id).label('user_count')
    ).group_by(
        User.department
    ).order_by(
        desc('total_dotori')
    ).all()

    # 캐시 테이블에 저장
    for idx, (dept, total, count) in enumerate(rankings, 1):
        cache_entry = DepartmentRankingCache(
            cache_date=today,
            rank=idx,
            department=dept,
            total_dotori=total or 0,
            user_count=count
        )
        db.add(cache_entry)

    db.commit()


@router.get("/ranking", response_model=RankingResponse)
def get_ranking(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """학과별 도토리 랭킹 조회 (캐시 사용)"""
    today = get_today_kst()

    # 오늘 캐시가 없으면 갱신
    cache_exists = db.query(DepartmentRankingCache).filter(
        DepartmentRankingCache.cache_date == today
    ).first()

    if not cache_exists:
        refresh_ranking_cache(db)

    # 캐시에서 상위 10개 조회
    cached_rankings = db.query(DepartmentRankingCache).filter(
        DepartmentRankingCache.cache_date == today
    ).order_by(
        DepartmentRankingCache.rank
    ).limit(10).all()

    result_rankings = []
    my_department_info = None

    for cached in cached_rankings:
        ranking_item = DepartmentRanking(
            rank=cached.rank,
            department=cached.department,
            total_dotori=cached.total_dotori,
            user_count=cached.user_count
        )
        result_rankings.append(ranking_item)

        # 내 학과인지 확인
        if cached.department == current_user.department:
            my_department_info = ranking_item

    # 내 학과가 상위 10위에 없으면 캐시에서 조회
    if my_department_info is None and current_user.department:
        my_cached = db.query(DepartmentRankingCache).filter(
            DepartmentRankingCache.cache_date == today,
            DepartmentRankingCache.department == current_user.department
        ).first()

        if my_cached:
            my_department_info = DepartmentRanking(
                rank=my_cached.rank,
                department=my_cached.department,
                total_dotori=my_cached.total_dotori,
                user_count=my_cached.user_count
            )

    return RankingResponse(
        rankings=result_rankings,
        my_department=my_department_info
    )


# === 도토리 선물 기능 ===

@router.post("/gift", response_model=GiftResponse)
def send_gift(
    request: GiftRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """친구에게 도토리 선물"""
    # 자신에게 선물 불가
    if request.receiver_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자신에게 선물할 수 없습니다"
        )

    # 친구 관계 확인
    friendship = db.query(Friend).filter(
        Friend.status == "accepted",
        (
            ((Friend.user_id == current_user.id) & (Friend.friend_id == request.receiver_id)) |
            ((Friend.user_id == request.receiver_id) & (Friend.friend_id == current_user.id))
        )
    ).first()

    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="친구에게만 선물할 수 있습니다"
        )

    # 받는 사람 확인
    receiver = db.query(User).filter(User.id == request.receiver_id).first()
    if not receiver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="받는 사람을 찾을 수 없습니다"
        )

    # 도토리 잔액 확인
    current_point = current_user.dotori_point or 0
    if current_point < request.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"도토리가 부족합니다 (보유: {current_point})"
        )

    # 선물 전송
    current_user.dotori_point = current_point - request.amount
    receiver.dotori_point = (receiver.dotori_point or 0) + request.amount

    # 선물 기록 저장
    gift = DotoriGift(
        sender_id=current_user.id,
        receiver_id=receiver.id,
        amount=request.amount
    )
    db.add(gift)
    db.commit()

    return GiftResponse(
        success=True,
        message=f"{receiver.name}님에게 도토리 {request.amount}개를 선물했습니다!",
        remaining_point=current_user.dotori_point
    )


@router.get("/gifts/unread", response_model=UnreadGiftsResponse)
def get_unread_gifts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """읽지 않은 선물 목록 조회"""
    unread_gifts = db.query(DotoriGift).filter(
        DotoriGift.receiver_id == current_user.id,
        DotoriGift.is_read == False
    ).order_by(DotoriGift.created_at.desc()).all()

    # 보낸 사람 정보 조회
    sender_ids = [g.sender_id for g in unread_gifts]
    senders = db.query(User).filter(User.id.in_(sender_ids)).all() if sender_ids else []
    sender_map = {s.id: s for s in senders}

    result = []
    for gift in unread_gifts:
        sender = sender_map.get(gift.sender_id)
        result.append(ReceivedGift(
            id=gift.id,
            sender_id=gift.sender_id,
            sender_name=sender.name if sender else "알 수 없음",
            amount=gift.amount,
            created_at=gift.created_at
        ))

    return UnreadGiftsResponse(gifts=result)


@router.post("/gifts/{gift_id}/read")
def mark_gift_as_read(
    gift_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """선물 읽음 처리"""
    gift = db.query(DotoriGift).filter(
        DotoriGift.id == gift_id,
        DotoriGift.receiver_id == current_user.id
    ).first()

    if not gift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="선물을 찾을 수 없습니다"
        )

    gift.is_read = True
    db.commit()

    return {"success": True}
