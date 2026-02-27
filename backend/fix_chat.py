"""
채팅방 데이터 정리 스크립트
기존 샘플 데이터 삭제 후 전체 채팅방만 생성
"""
import sys
sys.path.append(".")

from sqlalchemy import text
from app.core.database import SessionLocal

def fix_chat_rooms():
    db = SessionLocal()
    try:
        print("채팅방 데이터 정리 중...")

        # 1. 모든 채팅 메시지 삭제
        db.execute(text("DELETE FROM SMU_CHAT_MESSAGES"))
        print("- 메시지 삭제 완료")

        # 2. 모든 채팅방 멤버 삭제
        db.execute(text("DELETE FROM SMU_CHAT_ROOM_MEMBERS"))
        print("- 멤버 삭제 완료")

        # 3. 모든 채팅방 삭제
        db.execute(text("DELETE FROM SMU_CHAT_ROOMS"))
        print("- 채팅방 삭제 완료")

        db.commit()

        # 4. 전체 채팅방 생성
        db.execute(text("""
            INSERT INTO SMU_CHAT_ROOMS (name, description, room_type, subject_key)
            VALUES ('전체 채팅', '선문대학교 전체 익명 채팅방', 'global', NULL)
        """))
        db.commit()
        print("- 전체 채팅방 생성 완료")

        print("\n완료! 백엔드 서버를 재시작하세요.")

    except Exception as e:
        print(f"오류: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_chat_rooms()
