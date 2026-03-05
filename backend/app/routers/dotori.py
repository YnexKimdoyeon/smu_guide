from datetime import date, datetime, timezone, timedelta
from typing import List
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.dotori import (
    DotoriInfo,
    AttendanceResponse,
    PurchaseRequest,
    PurchaseResponse,
    DepartmentRanking,
    RankingResponse,
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


@router.get("/ranking", response_model=RankingResponse)
def get_ranking(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """학과별 도토리 랭킹 조회"""
    # 학과별 도토리 합계 조회
    rankings = db.query(
        User.department,
        func.sum(User.dotori_point).label('total_dotori'),
        func.count(User.id).label('user_count')
    ).group_by(
        User.department
    ).order_by(
        desc('total_dotori')
    ).limit(10).all()

    result_rankings = []
    my_department_info = None

    for idx, (dept, total, count) in enumerate(rankings, 1):
        ranking_item = DepartmentRanking(
            rank=idx,
            department=dept,
            total_dotori=total or 0,
            user_count=count
        )
        result_rankings.append(ranking_item)

        # 내 학과인지 확인
        if dept == current_user.department:
            my_department_info = ranking_item

    # 내 학과가 상위 10위에 없으면 별도 조회
    if my_department_info is None and current_user.department:
        my_dept_result = db.query(
            User.department,
            func.sum(User.dotori_point).label('total_dotori'),
            func.count(User.id).label('user_count')
        ).filter(
            User.department == current_user.department
        ).group_by(
            User.department
        ).first()

        if my_dept_result:
            # 순위 계산
            higher_count = db.query(User.department).group_by(
                User.department
            ).having(
                func.sum(User.dotori_point) > (my_dept_result.total_dotori or 0)
            ).count()

            my_department_info = DepartmentRanking(
                rank=higher_count + 1,
                department=current_user.department,
                total_dotori=my_dept_result.total_dotori or 0,
                user_count=my_dept_result.user_count
            )

    return RankingResponse(
        rankings=result_rankings,
        my_department=my_department_info
    )
