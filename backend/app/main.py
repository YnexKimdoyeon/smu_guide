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
from app.routers import auth, schedule, chat, commute, announcement, phonebook, friend, sunmoon, random_chat, ws_chat, block, gpt
from app.models.commute import CommuteSchedule, CommuteGroup, CommuteGroupMember
from app.models.user import User
from app.services.crawler import sync_run_crawler

# 모든 모델 임포트 (테이블 생성을 위해)
from app.models import user, schedule as schedule_model, chat as chat_model
from app.models import commute as commute_model, announcement as announcement_model
from app.models import phonebook as phonebook_model, friend as friend_model
from app.models import block as block_model

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

        # 매칭 실행
        for key, items in groups_by_key.items():
            if len(items) < 2:
                continue

            commute_type, location = key.split("|", 1)
            random.shuffle(items)

            for k in range(0, len(items), 4):
                sub_group = items[k:k+4]
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
                db.commit()

    except Exception as e:
        print(f"자동 매칭 오류: {e}")
        db.rollback()
    finally:
        db.close()

# APScheduler 설정
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()
scheduler.add_job(auto_match_commute, 'interval', minutes=1)
scheduler.add_job(sync_run_crawler, 'interval', hours=1)

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


# Rate Limiting 미들웨어
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # WebSocket 및 헬스체크는 제외
    if request.url.path.startswith("/ws") or request.url.path == "/health":
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    cleanup_old_requests(client_ip)

    # 요청 횟수 체크
    if len(rate_limit_store[client_ip]) >= settings.RATE_LIMIT_PER_MINUTE:
        return JSONResponse(
            status_code=429,
            content={"detail": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."}
        )

    # 현재 요청 기록
    rate_limit_store[client_ip].append(time.time())

    response = await call_next(request)
    return response


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
