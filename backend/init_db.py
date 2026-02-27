"""
데이터베이스 초기화 및 샘플 데이터 생성 스크립트
실행: python init_db.py
"""
import sys
sys.path.append(".")

from app.core.database import engine, SessionLocal, Base
from app.core.security import get_password_hash
from app.models.user import User
from app.models.schedule import Schedule
from app.models.chat import ChatRoom, ChatRoomMember
from app.models.announcement import Announcement
from app.models.phonebook import PhoneEntry

def init_database():
    # 테이블 생성
    Base.metadata.create_all(bind=engine)
    print("테이블 생성 완료!")

def create_sample_data():
    db = SessionLocal()

    try:
        # 샘플 사용자 생성
        existing_user = db.query(User).filter(User.student_id == "20230001").first()
        if not existing_user:
            sample_user = User(
                student_id="20230001",
                password=get_password_hash("1234"),
                name="김선문",
                department="컴퓨터공학과"
            )
            db.add(sample_user)
            db.commit()
            db.refresh(sample_user)
            print(f"샘플 사용자 생성: {sample_user.name} ({sample_user.student_id})")

            # 샘플 시간표 생성
            schedules = [
                {"day": "월", "start_time": "09:00", "end_time": "10:30", "subject": "자료구조", "professor": "이교수", "room": "IT관 301", "color": "#3B82F6"},
                {"day": "월", "start_time": "13:00", "end_time": "14:30", "subject": "알고리즘", "professor": "김교수", "room": "IT관 405", "color": "#0EA5E9"},
                {"day": "화", "start_time": "10:30", "end_time": "12:00", "subject": "데이터베이스", "professor": "박교수", "room": "IT관 201", "color": "#06B6D4"},
                {"day": "화", "start_time": "14:00", "end_time": "15:30", "subject": "운영체제", "professor": "최교수", "room": "IT관 302", "color": "#8B5CF6"},
                {"day": "수", "start_time": "09:00", "end_time": "10:30", "subject": "컴퓨터네트워크", "professor": "정교수", "room": "IT관 101", "color": "#F59E0B"},
                {"day": "수", "start_time": "13:00", "end_time": "14:30", "subject": "소프트웨어공학", "professor": "한교수", "room": "IT관 202", "color": "#10B981"},
                {"day": "목", "start_time": "10:30", "end_time": "12:00", "subject": "자료구조", "professor": "이교수", "room": "IT관 301", "color": "#3B82F6"},
                {"day": "목", "start_time": "15:00", "end_time": "16:30", "subject": "인공지능", "professor": "윤교수", "room": "IT관 501", "color": "#EF4444"},
                {"day": "금", "start_time": "09:00", "end_time": "10:30", "subject": "웹프로그래밍", "professor": "서교수", "room": "IT관 401", "color": "#EC4899"},
                {"day": "금", "start_time": "13:00", "end_time": "14:30", "subject": "알고리즘", "professor": "김교수", "room": "IT관 405", "color": "#0EA5E9"},
            ]

            for sched in schedules:
                db.add(Schedule(user_id=sample_user.id, **sched))
            db.commit()
            print("샘플 시간표 생성 완료!")

        # 전체 채팅방 생성 (없을 경우에만)
        global_room = db.query(ChatRoom).filter(ChatRoom.room_type == "global").first()
        if not global_room:
            global_room = ChatRoom(
                name="전체 채팅",
                description="선문대학교 전체 익명 채팅방",
                room_type="global",
                subject_key=None,
                created_by=None
            )
            db.add(global_room)
            db.commit()
            print("전체 채팅방 생성 완료!")

        # 샘플 공지사항 생성
        if db.query(Announcement).count() == 0:
            announcements = [
                {"title": "2026학년도 1학기 수강신청 안내", "category": "학사", "is_new": 1, "content": "2026학년도 1학기 수강신청 일정을 안내드립니다."},
                {"title": "중앙도서관 운영시간 변경 안내", "category": "일반", "is_new": 1, "content": "중앙도서관 운영시간이 변경됩니다."},
                {"title": "장학금 신청 안내 (3월)", "category": "장학", "is_new": 0, "content": "3월 장학금 신청 안내입니다."},
                {"title": "2026학년도 졸업요건 안내", "category": "학사", "is_new": 0, "content": "졸업요건을 확인해주세요."},
                {"title": "캠퍼스 셔틀버스 노선 변경", "category": "일반", "is_new": 0, "content": "셔틀버스 노선이 변경됩니다."},
                {"title": "동아리 박람회 개최 안내", "category": "행사", "is_new": 0, "content": "동아리 박람회가 개최됩니다."},
            ]
            for ann in announcements:
                db.add(Announcement(**ann))
            db.commit()
            print("샘플 공지사항 생성 완료!")

        # 샘플 전화번호부 생성
        if db.query(PhoneEntry).count() == 0:
            phone_entries = [
                {"department": "학사지원팀", "name": "학사문의", "phone": "041-530-2114", "extension": "2114"},
                {"department": "학사지원팀", "name": "성적문의", "phone": "041-530-2115", "extension": "2115"},
                {"department": "학생지원팀", "name": "장학문의", "phone": "041-530-2210", "extension": "2210"},
                {"department": "학생지원팀", "name": "생활관문의", "phone": "041-530-2220", "extension": "2220"},
                {"department": "취업지원팀", "name": "취업상담", "phone": "041-530-2310", "extension": "2310"},
                {"department": "국제교류팀", "name": "교환학생", "phone": "041-530-2410", "extension": "2410"},
                {"department": "도서관", "name": "대출/반납", "phone": "041-530-2510", "extension": "2510"},
                {"department": "도서관", "name": "열람실", "phone": "041-530-2520", "extension": "2520"},
                {"department": "IT지원팀", "name": "전산문의", "phone": "041-530-2610", "extension": "2610"},
                {"department": "보건실", "name": "건강상담", "phone": "041-530-2710", "extension": "2710"},
            ]
            for entry in phone_entries:
                db.add(PhoneEntry(**entry))
            db.commit()
            print("샘플 전화번호부 생성 완료!")

        print("\n초기화 완료!")
        print("테스트 계정: 학번 20230001 / 비밀번호 1234")

    except Exception as e:
        print(f"오류 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("데이터베이스 초기화 시작...")
    init_database()
    create_sample_data()
