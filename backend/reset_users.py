"""
사용자 데이터 전체 초기화 스크립트
모든 사용자 및 관련 데이터 삭제
"""
import sys
sys.path.append(".")

from sqlalchemy import text
from app.core.database import SessionLocal, engine

def reset_all_users():
    db = SessionLocal()
    try:
        print("사용자 데이터 전체 초기화 중...")

        # 외래키 제약 비활성화
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        db.commit()

        # 모든 데이터 DELETE 후 AUTO_INCREMENT 리셋
        tables = [
            "SMU_RANDOM_CHAT_MESSAGES",
            "SMU_RANDOM_CHAT_ROOMS",
            "SMU_RANDOM_CHAT_QUEUE",
            "SMU_CHAT_MESSAGES",
            "SMU_CHAT_ROOM_MEMBERS",
            "SMU_CHAT_ROOMS",
            "SMU_COMMUTE_CHATS",
            "SMU_COMMUTE_GROUP_MEMBERS",
            "SMU_COMMUTE_GROUPS",
            "SMU_COMMUTE_SCHEDULES",
            "SMU_COMMUTE_MATES",
            "SMU_FRIENDS",
            "SMU_SCHEDULES",
            "SMU_USERS"
        ]

        for table in tables:
            try:
                db.execute(text(f"DELETE FROM {table}"))
                db.execute(text(f"ALTER TABLE {table} AUTO_INCREMENT = 1"))
                db.commit()
                print(f"- {table} 데이터 삭제 완료")
            except Exception as e:
                print(f"- {table} 삭제 실패: {e}")
                db.rollback()

        # 외래키 제약 다시 활성화
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        db.commit()

        # 전체 채팅방 생성
        try:
            db.execute(text("""
                INSERT INTO SMU_CHAT_ROOMS (name, description, room_type, subject_key)
                VALUES ('전체 채팅', '선문대학교 전체 익명 채팅방', 'global', NULL)
            """))
            db.commit()
            print("- 전체 채팅방 생성 완료")
        except Exception as e:
            print(f"- 전체 채팅방 생성 실패: {e}")

        print("\n모든 데이터가 초기화되었습니다.")
        print("백엔드 서버를 재시작하세요.")

    except Exception as e:
        print(f"오류: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    confirm = input("정말 모든 데이터를 삭제하시겠습니까? (yes 입력): ")
    if confirm.lower() == "yes":
        reset_all_users()
    else:
        print("취소되었습니다.")
