"""
관리자 페이지 API
"""
import hashlib
import secrets
import os
from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta

from ..core.database import get_db
from ..models.user import User
from ..models.schedule import Schedule
from ..models.chat import ChatRoom, ChatMessage, ChatRoomMember
from ..models.chat import RandomChatRoom, RandomChatMessage
from ..models.friend import Friend
from ..models.commute import CommuteSchedule, CommuteGroup, CommuteGroupMember, CommuteChat
from ..models.club import Club, ClubApplication
from ..models.meeting import Meeting, MeetingApplication
from ..models.block import UserReport, UserBlock
from ..models.notification import AppLastViewed
from ..models.dotori import DotoriGift
from ..services.push import send_push_notification

router = APIRouter(prefix="/admin", tags=["관리자"])

# 환경변수에서 비밀번호 가져오기 (없으면 기본값 사용)
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "bang0622@")

# 활성 세션 저장 (메모리 기반 - 서버 재시작시 초기화)
# 실제 운영에서는 Redis 등 사용 권장
active_sessions: dict[str, datetime] = {}
SESSION_EXPIRY_HOURS = 24


def generate_session_token() -> str:
    """안전한 세션 토큰 생성"""
    return secrets.token_urlsafe(32)


def verify_admin_token(x_admin_token: Optional[str] = Header(None)) -> bool:
    """관리자 토큰 검증"""
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="관리자 인증이 필요합니다.")

    if x_admin_token not in active_sessions:
        raise HTTPException(status_code=401, detail="유효하지 않은 세션입니다. 다시 로그인해주세요.")

    # 세션 만료 체크
    session_time = active_sessions[x_admin_token]
    if datetime.now() - session_time > timedelta(hours=SESSION_EXPIRY_HOURS):
        del active_sessions[x_admin_token]
        raise HTTPException(status_code=401, detail="세션이 만료되었습니다. 다시 로그인해주세요.")

    # 세션 갱신
    active_sessions[x_admin_token] = datetime.now()
    return True


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None


@router.post("/login")
async def admin_login(request: LoginRequest):
    """관리자 로그인"""
    if request.password == ADMIN_PASSWORD:
        # 안전한 세션 토큰 생성
        token = generate_session_token()
        active_sessions[token] = datetime.now()

        # 오래된 세션 정리 (최대 10개 유지)
        if len(active_sessions) > 10:
            oldest = sorted(active_sessions.items(), key=lambda x: x[1])[:len(active_sessions)-10]
            for old_token, _ in oldest:
                del active_sessions[old_token]

        return {"success": True, "token": token}
    raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")


@router.get("/stats")
async def get_stats(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """전체 통계"""
    total_users = db.query(func.count(User.id)).scalar()
    total_schedules = db.query(func.count(Schedule.id)).scalar()
    total_chat_messages = db.query(func.count(ChatMessage.id)).scalar()
    total_random_messages = db.query(func.count(RandomChatMessage.id)).scalar()
    total_friends = db.query(func.count(Friend.id)).filter(Friend.status == "accepted").scalar()
    total_clubs = db.query(func.count(Club.id)).scalar()
    total_meetings = db.query(func.count(Meeting.id)).scalar()
    total_reports = db.query(func.count(UserReport.id)).scalar()

    return {
        "total_users": total_users,
        "total_schedules": total_schedules,
        "total_chat_messages": total_chat_messages,
        "total_random_messages": total_random_messages,
        "total_friends": total_friends,
        "total_clubs": total_clubs,
        "total_meetings": total_meetings,
        "total_reports": total_reports,
    }


@router.get("/users")
async def get_all_users(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """전체 유저 목록"""
    users = db.query(User).order_by(User.created_at.desc()).all()

    result = []
    for user in users:
        # 각 유저의 기본 통계
        schedule_count = db.query(func.count(Schedule.id)).filter(Schedule.user_id == user.id).scalar()
        chat_count = db.query(func.count(ChatMessage.id)).filter(ChatMessage.user_id == user.id).scalar()
        friend_count = db.query(func.count(Friend.id)).filter(
            ((Friend.user_id == user.id) | (Friend.friend_id == user.id)) &
            (Friend.status == "accepted")
        ).scalar()

        result.append({
            "id": user.id,
            "student_id": user.student_id,
            "name": user.name,
            "department": user.department,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "schedule_count": schedule_count,
            "chat_count": chat_count,
            "friend_count": friend_count,
        })

    return result


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """유저 상세 정보"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")

    # 시간표
    schedules = db.query(Schedule).filter(Schedule.user_id == user_id).all()
    schedule_data = [{
        "id": s.id,
        "day": s.day,
        "start_time": s.start_time,
        "end_time": s.end_time,
        "subject": s.subject,
        "professor": s.professor,
        "room": s.room,
    } for s in schedules]

    # 채팅 메시지 (최근 100개)
    chat_messages = db.query(ChatMessage).filter(
        ChatMessage.user_id == user_id
    ).order_by(ChatMessage.created_at.desc()).limit(100).all()

    chat_data = []
    for msg in chat_messages:
        room = db.query(ChatRoom).filter(ChatRoom.id == msg.room_id).first()
        chat_data.append({
            "id": msg.id,
            "room_name": room.name if room else "Unknown",
            "message": msg.message,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        })

    # 랜덤 채팅 메시지 (최근 100개)
    random_messages = db.query(RandomChatMessage).filter(
        RandomChatMessage.user_id == user_id
    ).order_by(RandomChatMessage.created_at.desc()).limit(100).all()

    random_chat_data = [{
        "id": msg.id,
        "room_id": msg.room_id,
        "message": msg.message,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    } for msg in random_messages]

    # 친구 목록
    friends_sent = db.query(Friend).filter(Friend.user_id == user_id).all()
    friends_received = db.query(Friend).filter(Friend.friend_id == user_id).all()

    friend_data = []
    for f in friends_sent:
        friend_user = db.query(User).filter(User.id == f.friend_id).first()
        friend_data.append({
            "id": f.id,
            "direction": "sent",
            "friend_name": friend_user.name if friend_user else "Unknown",
            "friend_student_id": friend_user.student_id if friend_user else "Unknown",
            "status": f.status,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })
    for f in friends_received:
        friend_user = db.query(User).filter(User.id == f.user_id).first()
        friend_data.append({
            "id": f.id,
            "direction": "received",
            "friend_name": friend_user.name if friend_user else "Unknown",
            "friend_student_id": friend_user.student_id if friend_user else "Unknown",
            "status": f.status,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })

    # 등하교 스케줄
    commute_schedules = db.query(CommuteSchedule).filter(CommuteSchedule.user_id == user_id).all()
    commute_data = [{
        "id": c.id,
        "day": c.day,
        "commute_type": c.commute_type,
        "time": c.time,
        "location": c.location,
        "is_active": c.is_active,
    } for c in commute_schedules]

    # 등하교 채팅 메시지
    commute_chats = db.query(CommuteChat).filter(
        CommuteChat.user_id == user_id
    ).order_by(CommuteChat.created_at.desc()).limit(50).all()

    commute_chat_data = [{
        "id": c.id,
        "group_id": c.group_id,
        "message": c.message,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    } for c in commute_chats]

    # 동아리 (생성한 것)
    clubs_created = db.query(Club).filter(Club.user_id == user_id).all()
    clubs_data = [{
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    } for c in clubs_created]

    # 동아리 신청
    club_applications = db.query(ClubApplication).filter(ClubApplication.user_id == user_id).all()
    club_app_data = []
    for app in club_applications:
        club = db.query(Club).filter(Club.id == app.club_id).first()
        club_app_data.append({
            "id": app.id,
            "club_name": club.name if club else "Unknown",
            "created_at": app.created_at.isoformat() if app.created_at else None,
        })

    # 과팅 (생성한 것)
    meetings_created = db.query(Meeting).filter(Meeting.user_id == user_id).all()
    meetings_data = [{
        "id": m.id,
        "department": m.department,
        "member_count": m.member_count,
        "description": m.description,
        "status": m.status,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    } for m in meetings_created]

    # 과팅 신청
    meeting_applications = db.query(MeetingApplication).filter(MeetingApplication.user_id == user_id).all()
    meeting_app_data = []
    for app in meeting_applications:
        meeting = db.query(Meeting).filter(Meeting.id == app.meeting_id).first()
        meeting_app_data.append({
            "id": app.id,
            "meeting_department": meeting.department if meeting else "Unknown",
            "message": app.message,
            "is_matched": app.is_matched,
            "created_at": app.created_at.isoformat() if app.created_at else None,
        })

    # 신고 (한 것)
    reports_sent = db.query(UserReport).filter(UserReport.reporter_id == user_id).all()
    reports_sent_data = []
    for r in reports_sent:
        reported_user = db.query(User).filter(User.id == r.reported_user_id).first()
        reports_sent_data.append({
            "id": r.id,
            "reported_user": reported_user.name if reported_user else "Unknown",
            "reason": r.reason,
            "detail": r.detail,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    # 신고 (받은 것)
    reports_received = db.query(UserReport).filter(UserReport.reported_user_id == user_id).all()
    reports_received_data = []
    for r in reports_received:
        reporter_user = db.query(User).filter(User.id == r.reporter_id).first()
        reports_received_data.append({
            "id": r.id,
            "reporter": reporter_user.name if reporter_user else "Unknown",
            "reason": r.reason,
            "detail": r.detail,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    # 차단 목록
    blocks = db.query(UserBlock).filter(UserBlock.user_id == user_id).all()
    blocks_data = []
    for b in blocks:
        blocked_user = db.query(User).filter(User.id == b.blocked_user_id).first()
        blocks_data.append({
            "id": b.id,
            "blocked_user": blocked_user.name if blocked_user else "Unknown",
            "blocked_student_id": blocked_user.student_id if blocked_user else "Unknown",
            "created_at": b.created_at.isoformat() if b.created_at else None,
        })

    return {
        "user": {
            "id": user.id,
            "student_id": user.student_id,
            "name": user.name,
            "department": user.department,
            "profile_image": user.profile_image,
            "dotori_point": user.dotori_point or 0,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        },
        "schedules": schedule_data,
        "chat_messages": chat_data,
        "random_chat_messages": random_chat_data,
        "friends": friend_data,
        "commute_schedules": commute_data,
        "commute_chats": commute_chat_data,
        "clubs_created": clubs_data,
        "club_applications": club_app_data,
        "meetings_created": meetings_data,
        "meeting_applications": meeting_app_data,
        "reports_sent": reports_sent_data,
        "reports_received": reports_received_data,
        "blocks": blocks_data,
    }


class PushRequest(BaseModel):
    user_ids: List[int]  # 유저 ID 리스트 (DB ID)
    title: str
    content: str


class PushAllRequest(BaseModel):
    title: str
    content: str


@router.post("/push")
async def send_push_to_users(
    request: PushRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """특정 유저들에게 푸시 알림 전송"""
    # 유저 ID로 학번 조회
    users = db.query(User).filter(User.id.in_(request.user_ids)).all()

    if not users:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")

    # 학번 리스트 추출
    student_ids = [user.student_id for user in users]

    # 푸시 알림 전송
    import asyncio
    result = await send_push_notification(
        user_ids=student_ids,
        title=request.title,
        content=request.content
    )

    return {
        "success": result.get("success", False),
        "sent_to": [{"id": u.id, "name": u.name, "student_id": u.student_id} for u in users],
        "response": result.get("response", {})
    }


@router.post("/push/all")
async def send_push_to_all_users(
    request: PushAllRequest,
    _: bool = Depends(verify_admin_token)
):
    """전체 유저에게 푸시 알림 전송"""
    from ..services.push import send_push_to_all

    result = await send_push_to_all(
        title=request.title,
        content=request.content
    )

    return {
        "success": result.get("success", False),
        "response": result.get("response", {})
    }


def delete_user_and_data(db: Session, user_id: int):
    """유저와 관련된 모든 데이터 삭제"""
    # 시간표
    db.query(Schedule).filter(Schedule.user_id == user_id).delete()
    # 채팅 메시지 & 방 멤버
    db.query(ChatMessage).filter(ChatMessage.user_id == user_id).delete()
    db.query(ChatRoomMember).filter(ChatRoomMember.user_id == user_id).delete()
    # 랜덤 채팅
    db.query(RandomChatMessage).filter(RandomChatMessage.user_id == user_id).delete()
    rooms_as_1 = db.query(RandomChatRoom).filter(RandomChatRoom.user1_id == user_id).all()
    rooms_as_2 = db.query(RandomChatRoom).filter(RandomChatRoom.user2_id == user_id).all()
    for room in rooms_as_1 + rooms_as_2:
        db.query(RandomChatMessage).filter(RandomChatMessage.room_id == room.id).delete()
        db.delete(room)
    # 친구
    db.query(Friend).filter((Friend.user_id == user_id) | (Friend.friend_id == user_id)).delete()
    # 등하교
    db.query(CommuteChat).filter(CommuteChat.user_id == user_id).delete()
    db.query(CommuteGroupMember).filter(CommuteGroupMember.user_id == user_id).delete()
    db.query(CommuteSchedule).filter(CommuteSchedule.user_id == user_id).delete()
    # 동아리
    clubs = db.query(Club).filter(Club.user_id == user_id).all()
    for club in clubs:
        db.query(ClubApplication).filter(ClubApplication.club_id == club.id).delete()
        db.delete(club)
    db.query(ClubApplication).filter(ClubApplication.user_id == user_id).delete()
    # 과팅
    meetings = db.query(Meeting).filter(Meeting.user_id == user_id).all()
    for meeting in meetings:
        db.query(MeetingApplication).filter(MeetingApplication.meeting_id == meeting.id).delete()
        db.delete(meeting)
    db.query(MeetingApplication).filter(MeetingApplication.user_id == user_id).delete()
    # 신고 & 차단
    db.query(UserReport).filter((UserReport.reporter_id == user_id) | (UserReport.reported_user_id == user_id)).delete()
    db.query(UserBlock).filter((UserBlock.user_id == user_id) | (UserBlock.blocked_user_id == user_id)).delete()
    # 알림 추적
    db.query(AppLastViewed).filter(AppLastViewed.user_id == user_id).delete()
    # 도토리 선물
    db.query(DotoriGift).filter((DotoriGift.sender_id == user_id) | (DotoriGift.receiver_id == user_id)).delete()
    # 유저 삭제
    db.query(User).filter(User.id == user_id).delete()


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """유저 삭제 (관련 데이터 전체 삭제)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")

    name = user.name
    try:
        delete_user_and_data(db, user_id)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"삭제 실패: {str(e)}")

    return {"success": True, "message": f"{name}님의 계정과 모든 데이터가 삭제되었습니다."}


class BulkDeleteRequest(BaseModel):
    user_ids: List[int]


@router.post("/users/bulk-delete")
async def bulk_delete_users(
    request: BulkDeleteRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """유저 일괄 삭제 (관련 데이터 전체 삭제)"""
    if not request.user_ids:
        raise HTTPException(status_code=400, detail="삭제할 유저를 선택하세요.")

    deleted_count = 0
    errors = []

    for user_id in request.user_ids:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            errors.append(f"ID {user_id}: 유저를 찾을 수 없음")
            continue
        try:
            delete_user_and_data(db, user_id)
            deleted_count += 1
        except Exception as e:
            errors.append(f"ID {user_id}: {str(e)}")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"삭제 커밋 실패: {str(e)}")

    return {
        "success": True,
        "deleted_count": deleted_count,
        "errors": errors if errors else None,
        "message": f"{deleted_count}명의 회원이 삭제되었습니다."
    }


class DotoriGrantRequest(BaseModel):
    user_id: int
    amount: int
    reason: Optional[str] = None


@router.post("/dotori/grant")
async def grant_dotori(
    request: DotoriGrantRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """관리자가 유저에게 도토리 지급 (추가)"""
    if request.amount < 1:
        raise HTTPException(status_code=400, detail="1개 이상 지급해야 합니다.")

    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")

    user.dotori_point = (user.dotori_point or 0) + request.amount
    db.commit()

    return {
        "success": True,
        "message": f"{user.name}님에게 도토리 {request.amount}개를 지급했습니다.",
        "new_total": user.dotori_point,
        "reason": request.reason
    }


class DotoriSetRequest(BaseModel):
    user_id: int
    amount: int


@router.post("/dotori/set")
async def set_dotori(
    request: DotoriSetRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """관리자가 유저의 도토리를 임의 값으로 설정"""
    if request.amount < 0:
        raise HTTPException(status_code=400, detail="0 이상의 값을 입력하세요.")

    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")

    old_amount = user.dotori_point or 0
    user.dotori_point = request.amount
    db.commit()

    return {
        "success": True,
        "message": f"{user.name}님의 도토리를 {old_amount} → {request.amount}개로 변경했습니다.",
        "old_total": old_amount,
        "new_total": request.amount
    }
