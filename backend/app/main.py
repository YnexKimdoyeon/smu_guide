from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from contextlib import asynccontextmanager
from datetime import datetime, date, timedelta
from collections import defaultdict
import time
import random

from app.core.database import engine, Base, SessionLocal
from app.core.config import settings
from app.routers import auth, schedule, chat, commute, announcement, phonebook, friend, sunmoon, random_chat, ws_chat, block, gpt, canvas, cafeteria, club, meeting, scholarship, notification, shuttle, admin, banner, dotori, quick_room
from app.models.commute import CommuteSchedule, CommuteGroup, CommuteGroupMember
from app.models.user import User
from app.services.crawler import sync_run_crawler
from app.services.push import send_push_sync

# 모든 모델 임포트 (테이블 생성을 위해)
from app.models import user, schedule as schedule_model, chat as chat_model
from app.models import commute as commute_model, announcement as announcement_model
from app.models import phonebook as phonebook_model, friend as friend_model
from app.models import block as block_model, club as club_model, meeting as meeting_model
from app.models import notification as notification_model, dotori as dotori_model
from app.models import quick_room as quick_room_model

# 데이터베이스 테이블 생성
Base.metadata.create_all(bind=engine)

# 채팅 테이블 컬럼 업데이트 및 전체 채팅방 생성
def init_chat_system():
    db = SessionLocal()
    try:
        # room_type 컬럼 추가
        try:
            db.execute(text("""
                ALTER TABLE SMU_CHAT_ROOMS
                ADD COLUMN room_type VARCHAR(20) DEFAULT 'global'
            """))
            db.commit()
        except Exception:
            db.rollback()

        # subject_key 컬럼 추가
        try:
            db.execute(text("""
                ALTER TABLE SMU_CHAT_ROOMS
                ADD COLUMN subject_key VARCHAR(200) NULL
            """))
            db.commit()
        except Exception:
            db.rollback()

        # 기존 샘플 채팅방 삭제 (room_type이 NULL이거나 이름이 '전체 채팅'이 아닌 global 타입이 아닌 것들)
        try:
            db.execute(text("""
                DELETE FROM SMU_CHAT_MESSAGES WHERE room_id IN (
                    SELECT id FROM SMU_CHAT_ROOMS WHERE room_type IS NULL OR room_type = ''
                )
            """))
            db.execute(text("""
                DELETE FROM SMU_CHAT_ROOM_MEMBERS WHERE room_id IN (
                    SELECT id FROM SMU_CHAT_ROOMS WHERE room_type IS NULL OR room_type = ''
                )
            """))
            db.execute(text("""
                DELETE FROM SMU_CHAT_ROOMS WHERE room_type IS NULL OR room_type = ''
            """))
            db.commit()
        except Exception:
            db.rollback()

        # 전체 채팅방 존재 확인 및 생성
        try:
            result = db.execute(text("""
                SELECT id FROM SMU_CHAT_ROOMS WHERE room_type = 'global' LIMIT 1
            """)).fetchone()

            if not result:
                db.execute(text("""
                    INSERT INTO SMU_CHAT_ROOMS (name, description, room_type, subject_key)
                    VALUES ('전체 채팅', '선문대학교 전체 익명 채팅방', 'global', NULL)
                """))
                db.commit()
        except Exception:
            db.rollback()

    finally:
        db.close()

init_chat_system()

# 등하교 테이블 컬럼 업데이트
def init_commute_system():
    db = SessionLocal()
    try:
        # SMU_COMMUTE_SCHEDULES 테이블에 location 컬럼 추가
        try:
            db.execute(text("""
                ALTER TABLE SMU_COMMUTE_SCHEDULES
                ADD COLUMN location VARCHAR(100) NULL
            """))
            db.commit()
        except Exception:
            db.rollback()

        # SMU_COMMUTE_GROUPS 테이블에 location 컬럼 추가
        try:
            db.execute(text("""
                ALTER TABLE SMU_COMMUTE_GROUPS
                ADD COLUMN location VARCHAR(100) NULL
            """))
            db.commit()
        except Exception:
            db.rollback()

    finally:
        db.close()

init_commute_system()

# 등하교 그룹 멤버 is_confirmed 컬럼 추가
def init_commute_confirmed():
    db = SessionLocal()
    try:
        try:
            db.execute(text("""
                ALTER TABLE SMU_COMMUTE_GROUP_MEMBERS
                ADD COLUMN is_confirmed INT DEFAULT 0 COMMENT '참석 확인 여부: 0=미확인, 1=확인'
            """))
            db.commit()
            print("is_confirmed 컬럼 추가 완료")
        except Exception:
            db.rollback()
    finally:
        db.close()

init_commute_confirmed()

# 공지사항 테이블 컬럼 업데이트
def init_announcement_system():
    db = SessionLocal()
    try:
        # notice_no 컬럼 추가
        try:
            db.execute(text("""
                ALTER TABLE SMU_ANNOUNCEMENTS
                ADD COLUMN notice_no INT NULL
            """))
            db.commit()
        except Exception:
            db.rollback()

        # writer 컬럼 추가
        try:
            db.execute(text("""
                ALTER TABLE SMU_ANNOUNCEMENTS
                ADD COLUMN writer VARCHAR(100) NULL
            """))
            db.commit()
        except Exception:
            db.rollback()

        # notice_date 컬럼 추가
        try:
            db.execute(text("""
                ALTER TABLE SMU_ANNOUNCEMENTS
                ADD COLUMN notice_date VARCHAR(20) NULL
            """))
            db.commit()
        except Exception:
            db.rollback()

        # views 컬럼 추가
        try:
            db.execute(text("""
                ALTER TABLE SMU_ANNOUNCEMENTS
                ADD COLUMN views INT DEFAULT 0
            """))
            db.commit()
        except Exception:
            db.rollback()

        # external_url 컬럼 추가
        try:
            db.execute(text("""
                ALTER TABLE SMU_ANNOUNCEMENTS
                ADD COLUMN external_url VARCHAR(500) NULL
            """))
            db.commit()
        except Exception:
            db.rollback()

        # updated_at 컬럼 추가
        try:
            db.execute(text("""
                ALTER TABLE SMU_ANNOUNCEMENTS
                ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            """))
            db.commit()
        except Exception:
            db.rollback()

    finally:
        db.close()

init_announcement_system()

# 과목 채팅방 정리 (기존 요일/시간 포함 키를 과목/교수 키로 변환)
def cleanup_subject_chat_rooms():
    db = SessionLocal()
    try:
        # 기존 과목 채팅방 중 키가 4개 부분으로 나뉘는 것들 삭제 (과목|요일|시작|종료 형식)
        from app.models.chat import ChatRoom, ChatRoomMember, ChatMessage
        old_rooms = db.query(ChatRoom).filter(
            ChatRoom.room_type == "subject"
        ).all()

        for room in old_rooms:
            if room.subject_key and len(room.subject_key.split("|")) == 4:
                # 이 방의 메시지와 멤버 삭제
                db.query(ChatMessage).filter(ChatMessage.room_id == room.id).delete()
                db.query(ChatRoomMember).filter(ChatRoomMember.room_id == room.id).delete()
                db.delete(room)

        db.commit()
        print("과목 채팅방 정리 완료")
    except Exception as e:
        print(f"채팅방 정리 오류: {e}")
        db.rollback()
    finally:
        db.close()

cleanup_subject_chat_rooms()

# DB 인덱스 추가
def add_database_indexes():
    db = SessionLocal()
    try:
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_schedule_user ON SMU_SCHEDULES(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_schedule_subject ON SMU_SCHEDULES(subject)",
            "CREATE INDEX IF NOT EXISTS idx_schedule_subject_professor ON SMU_SCHEDULES(subject, professor)",
            "CREATE INDEX IF NOT EXISTS idx_chatroom_type ON SMU_CHAT_ROOMS(room_type)",
            "CREATE INDEX IF NOT EXISTS idx_chatroom_subject_key ON SMU_CHAT_ROOMS(subject_key)",
            "CREATE INDEX IF NOT EXISTS idx_chatmember_room ON SMU_CHAT_ROOM_MEMBERS(room_id)",
            "CREATE INDEX IF NOT EXISTS idx_chatmember_user ON SMU_CHAT_ROOM_MEMBERS(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_chatmsg_room ON SMU_CHAT_MESSAGES(room_id)",
            "CREATE INDEX IF NOT EXISTS idx_chatmsg_created ON SMU_CHAT_MESSAGES(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_announcement_date ON SMU_ANNOUNCEMENTS(notice_date)",
            "CREATE INDEX IF NOT EXISTS idx_announcement_category ON SMU_ANNOUNCEMENTS(category)",
        ]
        for idx_sql in indexes:
            try:
                db.execute(text(idx_sql))
                db.commit()
            except Exception:
                db.rollback()
        print("DB 인덱스 추가 완료")
    except Exception as e:
        print(f"인덱스 추가 오류: {e}")
    finally:
        db.close()

add_database_indexes()

# 전화번호부 인덱스 추가
def add_phonebook_indexes():
    db = SessionLocal()
    try:
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_phone_dept ON SMU_PHONE_DIRECTORY(department)",
            "CREATE INDEX IF NOT EXISTS idx_phone_name ON SMU_PHONE_DIRECTORY(name)",
            "CREATE INDEX IF NOT EXISTS idx_phone_phone ON SMU_PHONE_DIRECTORY(phone)",
            "CREATE INDEX IF NOT EXISTS idx_phone_dept_name ON SMU_PHONE_DIRECTORY(department, name)",
        ]
        for idx_sql in indexes:
            try:
                db.execute(text(idx_sql))
                db.commit()
            except Exception:
                db.rollback()
        print("전화번호부 인덱스 추가 완료")
    except Exception as e:
        print(f"전화번호부 인덱스 추가 오류: {e}")
    finally:
        db.close()

add_phonebook_indexes()

# 전화번호부 컬럼 추가 및 데이터 초기화
def init_phonebook_data():
    db = SessionLocal()
    try:
        # 새 컬럼 추가
        for col_sql in [
            "ALTER TABLE SMU_PHONE_DIRECTORY ADD COLUMN category VARCHAR(20) DEFAULT 'dept'",
            "ALTER TABLE SMU_PHONE_DIRECTORY ADD COLUMN location VARCHAR(100) NULL",
            "ALTER TABLE SMU_PHONE_DIRECTORY ADD COLUMN fax VARCHAR(50) NULL",
        ]:
            try:
                db.execute(text(col_sql))
                db.commit()
            except Exception:
                db.rollback()

        # 기존 데이터 삭제 후 새 데이터 삽입
        from app.models.phonebook import PhoneEntry

        # 데이터가 이미 있으면 스킵
        count = db.query(PhoneEntry).count()
        if count >= 70:  # 이미 데이터가 있으면 스킵
            print(f"[Phonebook] 이미 {count}개 데이터 존재, 스킵")
            return

        # 기존 데이터 삭제
        db.query(PhoneEntry).delete()
        db.commit()

        # 학과 및 단대 데이터
        dept_data = [
            ("신학대학", "교학팀", "530-2501, 2503", "본관 317A"),
            ("신학대학", "신학과", "530-2686", "본관 613A"),
            ("인문사회대학", "교학팀", "530-2501, 2503", "본관 317A"),
            ("인문사회대학", "사학과", "530-2455", "인문관 246"),
            ("인문사회대학", "디지털콘텐츠학과", "530-2593", "본관 201A + 201B"),
            ("인문사회대학", "경찰행정법학과(법·경찰학과)", "530-8403", "체육관 202 + 205 + 206"),
            ("인문사회대학", "상담심리학과", "530-2568", "본관 201A + 201B"),
            ("인문사회대학", "사회복지학과", "530-2509", "본관 201A + 201B"),
            ("인문사회대학", "미디어커뮤니케이션학부", "530-2504, 2506", "본관 201A + 201B"),
            ("인문사회대학", "한국문학콘텐츠창작학과", "530-2403", "인문관 246"),
            ("인문사회대학", "글로벌한국어교육학과", "530-2541", "본관 201A + 201B"),
            ("인문사회대학", "행정·공기업학과", "530-2593", "본관 201A"),
            ("글로벌비즈니스대학", "교학팀", "530-2404, 2407", "인문관 245"),
            ("글로벌비즈니스대학", "외국어학부(영어전공)", "530-2402", "인문관 245"),
            ("글로벌비즈니스대학", "외국어학부(중국어문화전공)", "530-2424", "인문관 245"),
            ("글로벌비즈니스대학", "외국어학부(일본어전공)", "530-2406", "인문관 245"),
            ("글로벌비즈니스대학", "외국어학부(러시아어전공)", "530-2492", "인문관 245"),
            ("글로벌비즈니스대학", "외국어학부(스페인어중남미전공)", "530-2490", "인문관 245"),
            ("글로벌비즈니스대학", "아시아문화학부", "530-2492", "인문관 245"),
            ("글로벌비즈니스대학", "국제관계학과", "530-2505", "본관 226A + 226B"),
            ("글로벌비즈니스대학", "경영학과", "530-2507, 2567", "본관 226A + 226B"),
            ("글로벌비즈니스대학", "글로벌경제학과", "530-2556", "본관 226A + 226B"),
            ("글로벌비즈니스대학", "IT경영학과", "530-2597", "본관 226A + 226B"),
            ("글로벌비즈니스대학", "항공서비스학과(관광호텔경영학과)", "530-2551, 8561", "본관 226A + 226B"),
            ("건강보건대학", "교학팀", "530-2201", "자연관 228B"),
            ("건강보건대학", "수산생명의학과", "530-2280", "자연관 111 + 112"),
            ("건강보건대학", "식품공학·영양학부", "530-2278, 8273", "자연관 111 + 112"),
            ("건강보건대학", "제약생명학과(제약화장품학과)", "530-2251, 2270", "자연관 111 + 112"),
            ("건강보건대학", "간호학과", "530-2735, 2736, 2762, 2764", "보건관 203"),
            ("건강보건대학", "물리치료학과", "530-2749, 2765", "보건관 102"),
            ("건강보건대학", "치위생학과", "530-2734, 2766", "보건관 302"),
            ("건강보건대학", "응급구조학과", "530-2763, 2787", "보건관 402"),
            ("공과대학", "교학팀", "530-2301", "공학관 301A"),
            ("공과대학", "건축학부", "530-2320, 2322, 2652", "원화관 420, 531"),
            ("공과대학", "기계공학과", "530-2303, 8328", "산학협력관 214"),
            ("공과대학", "반도체소재공학과", "530-2312", "공학관 222B + 222C + 222D"),
            ("공과대학", "산업안전경영공학과", "530-2317", "공학관 222B + 222C + 222D"),
            ("공과대학", "소방방재안전학과", "530-2319, 8144", "공학관 222B + 222C + 222D"),
            ("공과대학", "미래자동차공학부", "530-8329, 8330, 8331", "공학관 222B + 222C + 222D"),
            ("공과대학", "전자공학과", "530-2313, 8094", "공학관 222B + 222C + 222D"),
            ("공과대학", "AI소프트웨어학과", "530-8480", "원화관 607"),
            ("공과대학", "컴퓨터공학부", "530-2211, 2212, 2213", "인문관 403"),
            ("공과대학", "지능로봇공학과", "530-2308, 2309", "공학관 222B + 222C + 222D"),
            ("공과대학", "스마트정보통신공학과", "530-2308, 2309", "공학관 222B + 222C + 222D"),
            ("공과대학", "디스플레이반도체공학과", "530-2204, 2208", "자연관 111 + 112"),
            ("공과대학", "신소재공학과", "530-2306, 2312", "공학관 320"),
            ("공과대학", "에너지화학공학과", "530-2314", "공학관 418"),
            ("소프트웨어융합학부", "교학팀(IT교육학부)", "530-8589", "원화관 510"),
            ("예술체육대학", "교학팀", "530-2202", "자연관 228B"),
            ("예술체육대학", "태권도학과/무도경호학과", "530-2272, 2298", "체육관 202 + 205 + 206"),
            ("예술체육대학", "스포츠과학과/피트니스재활", "530-2290, 2919", "체육관 202 + 205 + 206"),
            ("예술체육대학", "디자인학부", "530-2564, 2594", "원화관 628A"),
            ("예술체육대학", "영화영상학과", "530-8405", "원화관 235"),
            ("자유전공대학", "교학팀", "530-8791, 8792, 8797", "인문관 105"),
            ("자유전공대학", "자유전공학부", "530-8795", "인문관 105"),
            ("자유전공대학", "글로벌자유전공학부", "530-8477, 2541", "인문관 245 / 본관 201B"),
            ("대학원", "교학팀", "530-2602, 2684", "본관 409B"),
        ]

        for dept, name, phone, location in dept_data:
            db.add(PhoneEntry(
                category="dept",
                department=dept,
                name=name,
                phone=phone,
                location=location
            ))

        # 행정부서 데이터
        admin_data = [
            ("선문대학교", "대표전화", "530-2114", "541-7424"),
            ("국제교류처", "국제/일본/중국/글로벌", "530-2076, 2077, 2073, 2085", "530-2075"),
            ("교무처(학사팀)", "수업/성적/학적/교육과정", "530-2142~5", "530-2139"),
            ("원격교육지원센터", "사이버 강의(e-강의동)", "530-8064", "-"),
            ("취업·학생처", "학생지도/셔틀/복지/장학", "530-2153, 2152, 2154~6", "530-2965"),
            ("취업진로팀", "취업 프로그램/학생증 발급", "530-2052~3", "530-2055"),
            ("선문건강센터", "보건진료", "530-2835", "-"),
            ("학생상담센터", "성폭력/인권/학생상담", "530-2852, 2856", "530-2907"),
            ("입학처", "입시담당", "530-2032~9", "530-2976"),
            ("성화학숙(생활관)", "사무실", "530-8502~4", "530-2971"),
            ("중앙도서관", "간행물/자료실/라운지", "530-2812, 2814~6, 2806", "-"),
            ("사무처(재무팀)", "등록금", "530-2184", "541-7424"),
            ("예비군연대", "사무실", "530-2830", "530-2982"),
            ("한국어교육원", "교학지원", "530-8302~5", "530-8310"),
            ("평생교육원", "교학지원", "530-8341~3", "530-2987"),
        ]

        for dept, name, phone, fax in admin_data:
            db.add(PhoneEntry(
                category="admin",
                department=dept,
                name=name,
                phone=phone,
                fax=fax if fax != "-" else None
            ))

        db.commit()
        print(f"[Phonebook] 데이터 초기화 완료: 학과 {len(dept_data)}개 + 행정 {len(admin_data)}개")

    except Exception as e:
        print(f"[Phonebook] 초기화 오류: {e}")
        db.rollback()
    finally:
        db.close()

init_phonebook_data()

# 도토리 시스템 초기화
def init_dotori_system():
    """도토리 시스템 컬럼 추가"""
    db = SessionLocal()
    try:
        # User 테이블에 도토리 관련 컬럼 추가
        columns = [
            "ALTER TABLE SMU_USERS ADD COLUMN dotori_point INT DEFAULT 0 COMMENT '도토리 포인트'",
            "ALTER TABLE SMU_USERS ADD COLUMN last_attendance_date DATE NULL COMMENT '마지막 출석 일자'",
            "ALTER TABLE SMU_USERS ADD COLUMN nickname_color VARCHAR(7) NULL COMMENT '닉네임 색상'",
            "ALTER TABLE SMU_USERS ADD COLUMN title VARCHAR(10) NULL COMMENT '칭호'",
        ]
        for col_sql in columns:
            try:
                db.execute(text(col_sql))
                db.commit()
            except Exception:
                db.rollback()

        # 인덱스 추가
        try:
            db.execute(text("CREATE INDEX idx_user_dept_dotori ON SMU_USERS(department, dotori_point)"))
            db.commit()
        except Exception:
            db.rollback()

        # 랭킹 캐시 테이블 생성
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS SMU_DEPARTMENT_RANKINGS (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    cache_date DATE NOT NULL,
                    `rank` INT NOT NULL,
                    department VARCHAR(100) NOT NULL,
                    total_dotori INT DEFAULT 0,
                    user_count INT DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_ranking_date (cache_date)
                )
            """))
            db.commit()
        except Exception:
            db.rollback()

        # 도토리 선물 테이블 생성
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS SMU_DOTORI_GIFTS (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    sender_id INT NOT NULL,
                    receiver_id INT NOT NULL,
                    amount INT NOT NULL,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_gift_receiver (receiver_id),
                    INDEX idx_gift_unread (receiver_id, is_read),
                    FOREIGN KEY (sender_id) REFERENCES SMU_USERS(id),
                    FOREIGN KEY (receiver_id) REFERENCES SMU_USERS(id)
                )
            """))
            db.commit()
        except Exception:
            db.rollback()

        print("[Dotori] 시스템 초기화 완료")
    except Exception as e:
        print(f"[Dotori] 초기화 오류: {e}")
    finally:
        db.close()

init_dotori_system()


# 도토리 랭킹 캐시 갱신 (매일 자정)
def refresh_dotori_ranking_cache():
    """랭킹 캐시 갱신"""
    from app.models.dotori import DepartmentRankingCache
    from sqlalchemy import func, desc

    db = SessionLocal()
    try:
        today = date.today()

        # 오늘 캐시가 이미 있는지 확인
        existing = db.query(DepartmentRankingCache).filter(
            DepartmentRankingCache.cache_date == today
        ).first()

        if existing:
            return

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
        print(f"[Dotori] 랭킹 캐시 갱신 완료: {len(rankings)}개 학과")
    except Exception as e:
        print(f"[Dotori] 랭킹 캐시 갱신 오류: {e}")
        db.rollback()
    finally:
        db.close()

# DB 연결 풀 워밍업 및 캐시 프리로딩
def warmup_database_and_cache():
    """서버 시작 시 DB 연결 풀 워밍업 및 자주 사용되는 데이터 캐시"""
    from app.core.cache import smart_cache_set, smart_cache_get
    from app.models.phonebook import PhoneEntry
    from app.models.announcement import Announcement
    from app.schemas.phonebook import PhoneEntryResponse

    db = SessionLocal()
    try:
        # 1. DB 연결 풀 워밍업 (간단한 쿼리 실행)
        for _ in range(3):  # 3개의 연결 미리 생성
            db.execute(text("SELECT 1"))
        print("DB 연결 풀 워밍업 완료")

        # 2. 전화번호부 캐시 프리로딩
        cache_key = "phonebook:list:all:none"
        if not smart_cache_get(cache_key):
            entries = db.query(PhoneEntry).order_by(PhoneEntry.department, PhoneEntry.name).all()
            result = [PhoneEntryResponse.model_validate(e).model_dump() for e in entries]
            smart_cache_set(cache_key, result, 3600)
            print(f"전화번호부 캐시 로딩 완료 ({len(result)}개)")

        # 3. 공지사항 캐시 프리로딩
        from app.schemas.announcement import AnnouncementResponse
        ann_cache_key = "announcements:list:None:50:0"
        if not smart_cache_get(ann_cache_key):
            announcements = db.query(Announcement).order_by(
                Announcement.notice_date.desc()
            ).limit(50).all()
            ann_result = [AnnouncementResponse.model_validate(a).model_dump() for a in announcements]
            smart_cache_set(ann_cache_key, ann_result, 1800)
            print(f"공지사항 캐시 로딩 완료 ({len(ann_result)}개)")

    except Exception as e:
        print(f"워밍업 오류: {e}")
    finally:
        db.close()

# warmup_database_and_cache()  # 시작 시 호출 비활성화

# 자동 매칭 스케줄러
WEEKDAY_MAP = {0: "월", 1: "화", 2: "수", 3: "목", 4: "금", 5: "토", 6: "일"}

def time_to_minutes(time_str: str) -> int:
    h, m = map(int, time_str.split(":"))
    return h * 60 + m

def minutes_to_time(minutes: int) -> str:
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"

def is_within_range(time1: str, time2: str, range_minutes: int = 10) -> bool:
    m1 = time_to_minutes(time1)
    m2 = time_to_minutes(time2)
    return abs(m1 - m2) <= range_minutes

def auto_match_commute():
    """1시간 후 스케줄을 가진 사용자들 자동 매칭"""
    db = SessionLocal()
    try:
        now = datetime.now()
        target_time = now + timedelta(hours=1)
        target_time_str = target_time.strftime("%H:%M")
        today = date.today()
        today_weekday = WEEKDAY_MAP[today.weekday()]

        # 1시간 후 시간 ±5분 범위의 스케줄 조회
        schedules = db.query(CommuteSchedule, User).join(
            User, CommuteSchedule.user_id == User.id
        ).filter(
            CommuteSchedule.day == today_weekday,
            CommuteSchedule.is_active == 1
        ).all()

        # 시간 필터링 (1시간 후 ±5분)
        target_schedules = []
        for schedule, user in schedules:
            if is_within_range(schedule.time, target_time_str, 5):
                target_schedules.append({"schedule": schedule, "user": user})

        if len(target_schedules) < 2:
            return

        # 등교/하교 + 장소별로 분류
        groups_by_key = {}
        for item in target_schedules:
            key = f"{item['schedule'].commute_type}|{item['schedule'].location or ''}"
            if key not in groups_by_key:
                groups_by_key[key] = []
            groups_by_key[key].append(item)

        # 매칭 실행 (같은 학과 우선)
        for key, items in groups_by_key.items():
            if len(items) < 2:
                continue

            commute_type, location = key.split("|", 1)

            # 학과별로 그룹화
            dept_groups = {}
            for item in items:
                dept = item["user"].department or "기타"
                if dept not in dept_groups:
                    dept_groups[dept] = []
                dept_groups[dept].append(item)

            # 같은 학과끼리 먼저 매칭, 남은 인원은 다른 학과와 매칭
            matched_items = []
            remaining_items = []

            for dept, dept_items in dept_groups.items():
                random.shuffle(dept_items)
                # 같은 학과 2명 이상이면 우선 매칭 그룹에 추가
                if len(dept_items) >= 2:
                    matched_items.extend(dept_items)
                else:
                    remaining_items.extend(dept_items)

            # 남은 인원을 매칭 그룹 뒤에 추가
            random.shuffle(remaining_items)
            all_items = matched_items + remaining_items

            for k in range(0, len(all_items), 4):
                sub_group = all_items[k:k+4]
                if len(sub_group) < 2:
                    continue

                avg_minutes = sum(time_to_minutes(m["schedule"].time) for m in sub_group) // len(sub_group)
                time_slot = minutes_to_time(avg_minutes)

                # 기존 그룹 확인
                existing_group = None
                for member in sub_group:
                    existing = db.query(CommuteGroup).join(
                        CommuteGroupMember, CommuteGroup.id == CommuteGroupMember.group_id
                    ).filter(
                        CommuteGroup.match_date == today,
                        CommuteGroup.commute_type == commute_type,
                        CommuteGroup.location == location,
                        CommuteGroupMember.user_id == member["user"].id
                    ).first()
                    if existing:
                        existing_group = existing
                        break

                if not existing_group:
                    new_group = CommuteGroup(
                        match_date=today,
                        day=today_weekday,
                        commute_type=commute_type,
                        location=location,
                        time_slot=time_slot
                    )
                    db.add(new_group)
                    db.commit()
                    db.refresh(new_group)
                    existing_group = new_group

                new_members = []
                for member in sub_group:
                    exists = db.query(CommuteGroupMember).filter(
                        CommuteGroupMember.group_id == existing_group.id,
                        CommuteGroupMember.user_id == member["user"].id
                    ).first()
                    if not exists:
                        db.add(CommuteGroupMember(
                            group_id=existing_group.id,
                            user_id=member["user"].id
                        ))
                        new_members.append(member["user"])
                db.commit()

                # 새로 매칭된 멤버들에게 푸시 알림 전송
                if new_members:
                    user_ids = [u.student_id for u in new_members]
                    type_text = "등교" if commute_type == "등교" else "하교"
                    location_text = f" ({location})" if location else ""
                    send_push_sync(
                        user_ids=user_ids,
                        title=f"🚗 {type_text} 메이트 매칭 완료!",
                        content=f"{time_slot}{location_text} - 채팅방에서 메이트를 확인하세요!"
                    )

    except Exception as e:
        print(f"자동 매칭 오류: {e}")
        db.rollback()
    finally:
        db.close()

def cleanup_old_commute_groups():
    """하루 지난 등하교 채팅방 자동 삭제"""
    from app.models.commute import CommuteChat

    db = SessionLocal()
    try:
        yesterday = date.today() - timedelta(days=1)

        # 어제 이전의 그룹 조회
        old_groups = db.query(CommuteGroup).filter(
            CommuteGroup.match_date < date.today()
        ).all()

        if not old_groups:
            return

        old_group_ids = [g.id for g in old_groups]

        # 채팅 메시지 삭제
        db.query(CommuteChat).filter(
            CommuteChat.group_id.in_(old_group_ids)
        ).delete(synchronize_session=False)

        # 그룹 멤버 삭제
        db.query(CommuteGroupMember).filter(
            CommuteGroupMember.group_id.in_(old_group_ids)
        ).delete(synchronize_session=False)

        # 그룹 삭제
        db.query(CommuteGroup).filter(
            CommuteGroup.id.in_(old_group_ids)
        ).delete(synchronize_session=False)

        db.commit()
        print(f"[Cleanup] {len(old_group_ids)}개의 오래된 등하교 그룹 삭제 완료")

    except Exception as e:
        print(f"[Cleanup] 등하교 그룹 삭제 오류: {e}")
        db.rollback()
    finally:
        db.close()


# APScheduler 설정
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()
scheduler.add_job(auto_match_commute, 'interval', minutes=1)
scheduler.add_job(sync_run_crawler, 'interval', hours=1)
# 매일 자정에 오래된 등하교 채팅방 삭제
scheduler.add_job(cleanup_old_commute_groups, 'cron', hour=0, minute=0)
# 매일 자정에 도토리 랭킹 캐시 갱신 (KST 자정 = UTC 15:00)
scheduler.add_job(refresh_dotori_ranking_cache, 'cron', hour=0, minute=5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시 스케줄러 시작
    scheduler.start()

    # 서버 시작 시 초기 크롤링 실행
    from app.services.crawler import run_crawler
    import asyncio
    asyncio.create_task(run_crawler())

    yield

    # 종료 시 스케줄러 종료
    scheduler.shutdown()

# Rate Limiting 저장소
rate_limit_store = defaultdict(list)

# 로그인 시도 저장소 (IP -> {attempts: int, blocked_until: datetime})
login_attempt_store: dict = {}


def cleanup_old_requests(client_ip: str, window: int = 60):
    """오래된 요청 기록 정리"""
    current_time = time.time()
    rate_limit_store[client_ip] = [
        req_time for req_time in rate_limit_store[client_ip]
        if current_time - req_time < window
    ]


app = FastAPI(
    title="선문대학교 가이드 API",
    description="선문대학교 캠퍼스 생활 가이드 백엔드 API",
    version="1.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    lifespan=lifespan
)


# 보안 헤더 미들웨어
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)

    # HSTS (Strict-Transport-Security) - HTTPS 강제
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    # CSP (Content-Security-Policy) - XSS 방어
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' wss: https:; "
        "frame-ancestors 'self';"
    )

    # 추가 보안 헤더 (기존 헤더가 없는 경우에만 추가)
    if "X-Content-Type-Options" not in response.headers:
        response.headers["X-Content-Type-Options"] = "nosniff"
    if "X-Frame-Options" not in response.headers:
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
    if "X-XSS-Protection" not in response.headers:
        response.headers["X-XSS-Protection"] = "1; mode=block"
    if "Referrer-Policy" not in response.headers:
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if "Permissions-Policy" not in response.headers:
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

    return response


# Rate Limiting 미들웨어 (비활성화 - 리버스 프록시 환경에서 모든 유저가 같은 IP로 잡힘)
# @app.middleware("http")
# async def rate_limit_middleware(request: Request, call_next):
#     if request.url.path.startswith("/ws") or request.url.path == "/health":
#         return await call_next(request)
#     client_ip = request.client.host if request.client else "unknown"
#     cleanup_old_requests(client_ip)
#     if len(rate_limit_store[client_ip]) >= settings.RATE_LIMIT_PER_MINUTE:
#         return JSONResponse(
#             status_code=429,
#             content={"detail": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."}
#         )
#     rate_limit_store[client_ip].append(time.time())
#     response = await call_next(request)
#     return response


# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(commute.router, prefix="/api")
app.include_router(announcement.router, prefix="/api")
app.include_router(phonebook.router, prefix="/api")
app.include_router(friend.router, prefix="/api")
app.include_router(sunmoon.router, prefix="/api")
app.include_router(random_chat.router, prefix="/api")
app.include_router(block.router, prefix="/api")
app.include_router(gpt.router, prefix="/api")
app.include_router(canvas.router, prefix="/api")
app.include_router(cafeteria.router, prefix="/api")
app.include_router(club.router, prefix="/api")
app.include_router(meeting.router, prefix="/api")
app.include_router(scholarship.router, prefix="/api")
app.include_router(notification.router, prefix="/api")
app.include_router(shuttle.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(banner.router, prefix="/api")
app.include_router(dotori.router, prefix="/api")
app.include_router(quick_room.router, prefix="/api")
app.include_router(ws_chat.router)


@app.get("/")
def root():
    return {
        "message": "선문대학교 가이드 API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
