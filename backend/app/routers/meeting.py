"""
과팅 API
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.meeting import Meeting, MeetingApplication
from app.models.chat import ChatRoom, ChatRoomMember

router = APIRouter(prefix="/meetings", tags=["과팅"])


# Schemas
class MeetingCreate(BaseModel):
    department: str
    member_count: int
    description: Optional[str] = None


class MeetingUpdate(BaseModel):
    member_count: Optional[int] = None
    description: Optional[str] = None


class MeetingApplicationCreate(BaseModel):
    department: str
    member_count: int
    message: Optional[str] = None


@router.get("")
async def get_meetings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """과팅 목록 조회"""
    meetings = db.query(Meeting).filter(
        Meeting.status != "matched"
    ).order_by(Meeting.created_at.desc()).all()

    result = []
    for meeting in meetings:
        result.append({
            "id": meeting.id,
            "user_id": meeting.user_id,
            "department": meeting.department,
            "member_count": meeting.member_count,
            "description": meeting.description,
            "status": meeting.status,
            "created_at": meeting.created_at.isoformat() if meeting.created_at else "",
            "application_count": len(meeting.applications),
            "is_mine": meeting.user_id == current_user.id
        })

    return result


@router.get("/my")
async def get_my_meetings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """내가 작성한 과팅 목록 + 내가 신청해서 매칭된 과팅"""
    # 내가 작성한 과팅
    my_meetings = db.query(Meeting).filter(
        Meeting.user_id == current_user.id
    ).order_by(Meeting.created_at.desc()).all()

    result = []
    for meeting in my_meetings:
        result.append({
            "id": meeting.id,
            "user_id": meeting.user_id,
            "department": meeting.department,
            "member_count": meeting.member_count,
            "description": meeting.description,
            "status": meeting.status,
            "chat_room_id": meeting.chat_room_id,
            "created_at": meeting.created_at.isoformat() if meeting.created_at else "",
            "application_count": len(meeting.applications),
            "is_mine": True,
            "is_applicant": False
        })

    # 내가 신청해서 매칭된 과팅
    matched_applications = db.query(MeetingApplication).filter(
        MeetingApplication.user_id == current_user.id,
        MeetingApplication.is_matched == 1
    ).all()

    for app in matched_applications:
        meeting = app.meeting
        if meeting:
            result.append({
                "id": meeting.id,
                "user_id": meeting.user_id,
                "department": meeting.department,
                "member_count": meeting.member_count,
                "description": meeting.description,
                "status": meeting.status,
                "chat_room_id": meeting.chat_room_id,
                "created_at": meeting.created_at.isoformat() if meeting.created_at else "",
                "application_count": len(meeting.applications),
                "is_mine": False,
                "is_applicant": True
            })

    return result


@router.get("/{meeting_id}")
async def get_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """과팅 상세 조회"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="과팅을 찾을 수 없습니다.")

    # 내가 이미 신청했는지 확인
    my_application = db.query(MeetingApplication).filter(
        MeetingApplication.meeting_id == meeting_id,
        MeetingApplication.user_id == current_user.id
    ).first()

    return {
        "id": meeting.id,
        "user_id": meeting.user_id,
        "department": meeting.department,
        "member_count": meeting.member_count,
        "description": meeting.description,
        "status": meeting.status,
        "chat_room_id": meeting.chat_room_id,
        "created_at": meeting.created_at.isoformat() if meeting.created_at else "",
        "application_count": len(meeting.applications),
        "is_mine": meeting.user_id == current_user.id,
        "has_applied": my_application is not None,
        "my_application_id": my_application.id if my_application else None
    }


@router.post("")
async def create_meeting(
    data: MeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """과팅 등록"""
    meeting = Meeting(
        user_id=current_user.id,
        department=data.department,
        member_count=data.member_count,
        description=data.description,
        status="open"
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    return {"id": meeting.id, "message": "과팅이 등록되었습니다."}


@router.put("/{meeting_id}")
async def update_meeting(
    meeting_id: int,
    data: MeetingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """과팅 수정"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="과팅을 찾을 수 없습니다.")
    if meeting.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")
    if meeting.status == "matched":
        raise HTTPException(status_code=400, detail="매칭된 과팅은 수정할 수 없습니다.")

    if data.member_count is not None:
        meeting.member_count = data.member_count
    if data.description is not None:
        meeting.description = data.description

    db.commit()
    return {"message": "과팅이 수정되었습니다."}


@router.delete("/{meeting_id}")
async def delete_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """과팅 삭제"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="과팅을 찾을 수 없습니다.")
    if meeting.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")

    db.delete(meeting)
    db.commit()
    return {"message": "과팅이 삭제되었습니다."}


@router.put("/{meeting_id}/close")
async def close_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """과팅 마감"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="과팅을 찾을 수 없습니다.")
    if meeting.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    meeting.status = "closed"
    db.commit()
    return {"message": "과팅이 마감되었습니다."}


# 신청 관련 API
@router.post("/{meeting_id}/apply")
async def apply_meeting(
    meeting_id: int,
    data: MeetingApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """과팅 신청"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="과팅을 찾을 수 없습니다.")

    if meeting.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="자신의 과팅에는 신청할 수 없습니다.")

    if meeting.status != "open":
        raise HTTPException(status_code=400, detail="모집이 마감된 과팅입니다.")

    # 이미 신청했는지 확인
    existing = db.query(MeetingApplication).filter(
        MeetingApplication.meeting_id == meeting_id,
        MeetingApplication.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 신청하셨습니다.")

    application = MeetingApplication(
        meeting_id=meeting_id,
        user_id=current_user.id,
        department=data.department,
        member_count=data.member_count,
        message=data.message
    )
    db.add(application)
    db.commit()

    return {"message": "신청이 완료되었습니다."}


@router.get("/{meeting_id}/applications")
async def get_meeting_applications(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """과팅 신청 목록 조회 (작성자만)"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="과팅을 찾을 수 없습니다.")
    if meeting.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="조회 권한이 없습니다.")

    applications = db.query(MeetingApplication).filter(
        MeetingApplication.meeting_id == meeting_id
    ).order_by(MeetingApplication.created_at.desc()).all()

    return [
        {
            "id": app.id,
            "meeting_id": app.meeting_id,
            "user_id": app.user_id,
            "department": app.department,
            "member_count": app.member_count,
            "message": app.message,
            "is_matched": app.is_matched,
            "created_at": app.created_at.isoformat() if app.created_at else ""
        }
        for app in applications
    ]


@router.post("/{meeting_id}/match/{application_id}")
async def match_meeting(
    meeting_id: int,
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """과팅 매칭 (작성자가 신청자 선택)"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="과팅을 찾을 수 없습니다.")
    if meeting.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="매칭 권한이 없습니다.")
    if meeting.status == "matched":
        raise HTTPException(status_code=400, detail="이미 매칭된 과팅입니다.")

    application = db.query(MeetingApplication).filter(
        MeetingApplication.id == application_id,
        MeetingApplication.meeting_id == meeting_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="신청을 찾을 수 없습니다.")

    # 채팅방 생성
    chat_room = ChatRoom(
        name=f"과팅: {meeting.department} & {application.department}",
        description=f"{meeting.department}({meeting.member_count}명) & {application.department}({application.member_count}명)",
        room_type="meeting"
    )
    db.add(chat_room)
    db.commit()
    db.refresh(chat_room)

    # 채팅방 멤버 추가
    db.add(ChatRoomMember(room_id=chat_room.id, user_id=meeting.user_id))
    db.add(ChatRoomMember(room_id=chat_room.id, user_id=application.user_id))

    # 매칭 상태 업데이트
    meeting.status = "matched"
    meeting.matched_application_id = application_id
    meeting.chat_room_id = chat_room.id
    application.is_matched = 1

    db.commit()

    return {
        "message": "매칭이 완료되었습니다.",
        "chat_room_id": chat_room.id
    }


@router.delete("/{meeting_id}/applications/{application_id}")
async def delete_meeting_application(
    meeting_id: int,
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """신청 삭제 (신청자 본인 또는 과팅 작성자)"""
    application = db.query(MeetingApplication).filter(
        MeetingApplication.id == application_id,
        MeetingApplication.meeting_id == meeting_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="신청을 찾을 수 없습니다.")

    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if application.user_id != current_user.id and meeting.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")

    if application.is_matched:
        raise HTTPException(status_code=400, detail="매칭된 신청은 삭제할 수 없습니다.")

    db.delete(application)
    db.commit()
    return {"message": "신청이 삭제되었습니다."}
