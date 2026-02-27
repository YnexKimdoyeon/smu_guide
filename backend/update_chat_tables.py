"""
채팅 테이블 업데이트 스크립트
새로운 컬럼(room_type, subject_key) 추가
실행: python update_chat_tables.py
"""
import sys
sys.path.append(".")

from sqlalchemy import text
from app.core.database import engine, SessionLocal

def update_chat_tables():
    db = SessionLocal()

    try:
        # 1. 기존 채팅 테이블에 새 컬럼 추가
        print("채팅 테이블 업데이트 중...")

        # room_type 컬럼 추가
        try:
            db.execute(text("""
                ALTER TABLE SMU_CHAT_ROOMS
                ADD COLUMN room_type VARCHAR(20) DEFAULT 'subject' COMMENT '채팅방 유형: global, subject'
            """))
            print("room_type 컬럼 추가 완료")
        except Exception as e:
            if "Duplicate column" in str(e):
                print("room_type 컬럼이 이미 존재합니다")
            else:
                print(f"room_type 컬럼 추가 오류: {e}")

        # subject_key 컬럼 추가
        try:
            db.execute(text("""
                ALTER TABLE SMU_CHAT_ROOMS
                ADD COLUMN subject_key VARCHAR(200) NULL COMMENT '과목 키: subject|day|start_time|end_time'
            """))
            print("subject_key 컬럼 추가 완료")
        except Exception as e:
            if "Duplicate column" in str(e):
                print("subject_key 컬럼이 이미 존재합니다")
            else:
                print(f"subject_key 컬럼 추가 오류: {e}")

        db.commit()

        # 2. 기존 채팅방 삭제 (새 시스템과 호환되지 않음)
        try:
            db.execute(text("DELETE FROM SMU_CHAT_MESSAGES"))
            db.execute(text("DELETE FROM SMU_CHAT_ROOM_MEMBERS"))
            db.execute(text("DELETE FROM SMU_CHAT_ROOMS"))
            db.commit()
            print("기존 채팅방 데이터 삭제 완료")
        except Exception as e:
            print(f"기존 데이터 삭제 오류: {e}")
            db.rollback()

        # 3. 전체 채팅방 생성
        try:
            db.execute(text("""
                INSERT INTO SMU_CHAT_ROOMS (name, description, room_type, subject_key, created_by)
                VALUES ('전체 채팅', '선문대학교 전체 익명 채팅방', 'global', NULL, NULL)
            """))
            db.commit()
            print("전체 채팅방 생성 완료")
        except Exception as e:
            print(f"전체 채팅방 생성 오류: {e}")
            db.rollback()

        print("\n채팅 테이블 업데이트 완료!")

    except Exception as e:
        print(f"오류 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("채팅 테이블 업데이트 시작...")
    update_chat_tables()
