"""
Swing2App 푸시 알림 서비스
"""
import httpx
from typing import List, Optional

# Swing2App API 설정
SWING_APP_ID = "eacb1c4b-06c5-4244-b17e-da99d2635921"
SWING_API_KEY = "6fe3e7d9-db53-416a-a721-7fc2d82976b6"
SWING_PUSH_URL = "https://www.swing2app.com/swapi/push_api_send_message"


async def send_push_notification(
    user_ids: List[str],
    title: str,
    content: str,
    image_url: Optional[str] = None,
    link_url: Optional[str] = None
) -> dict:
    """
    Swing2App 푸시 알림 전송

    Args:
        user_ids: 발송 대상 사용자 ID 리스트 (학번)
        title: 푸시 알림 제목
        content: 푸시 알림 내용
        image_url: 이미지 URL (선택)
        link_url: 클릭 시 이동할 URL (선택)

    Returns:
        API 응답 결과
    """
    if not user_ids:
        return {"success": False, "error": "No user IDs provided"}

    # 사용자 ID 리스트를 쉼표로 구분된 문자열로 변환
    send_target = ",".join(user_ids)

    form_data = {
        "app_id": SWING_APP_ID,
        "app_api_key": SWING_API_KEY,
        "send_target_list": send_target,
        "send_type": "push",
        "message_title": title,
        "message_content": content
    }

    if image_url:
        form_data["message_image_url"] = image_url

    if link_url:
        form_data["message_link_url"] = link_url

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                SWING_PUSH_URL,
                data=form_data
            )

            result = response.json() if response.status_code == 200 else {}
            print(f"[Push] 푸시 알림 전송 결과: {result}")

            return {
                "success": response.status_code == 200 and result.get("result", False),
                "response": result
            }
    except Exception as e:
        print(f"[Push] 푸시 알림 전송 실패: {e}")
        return {"success": False, "error": str(e)}


async def send_push_to_all(
    title: str,
    content: str,
    image_url: Optional[str] = None,
    link_url: Optional[str] = None
) -> dict:
    """
    모든 사용자에게 푸시 알림 전송
    """
    form_data = {
        "app_id": SWING_APP_ID,
        "app_api_key": SWING_API_KEY,
        "send_target_list": "-1",  # -1은 전체 발송
        "send_type": "push",
        "message_title": title,
        "message_content": content
    }

    if image_url:
        form_data["message_image_url"] = image_url

    if link_url:
        form_data["message_link_url"] = link_url

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                SWING_PUSH_URL,
                data=form_data
            )

            result = response.json() if response.status_code == 200 else {}
            print(f"[Push] 전체 푸시 알림 전송 결과: {result}")

            return {
                "success": response.status_code == 200 and result.get("result", False),
                "response": result
            }
    except Exception as e:
        print(f"[Push] 전체 푸시 알림 전송 실패: {e}")
        return {"success": False, "error": str(e)}


def send_push_sync(
    user_ids: List[str],
    title: str,
    content: str,
    image_url: Optional[str] = None,
    link_url: Optional[str] = None
) -> dict:
    """
    동기 방식 푸시 알림 전송 (스케줄러에서 사용)
    """
    import requests

    if not user_ids:
        return {"success": False, "error": "No user IDs provided"}

    send_target = ",".join(user_ids)

    form_data = {
        "app_id": SWING_APP_ID,
        "app_api_key": SWING_API_KEY,
        "send_target_list": send_target,
        "send_type": "push",
        "message_title": title,
        "message_content": content
    }

    if image_url:
        form_data["message_image_url"] = image_url

    if link_url:
        form_data["message_link_url"] = link_url

    try:
        response = requests.post(SWING_PUSH_URL, data=form_data, timeout=30)
        result = response.json() if response.status_code == 200 else {}
        print(f"[Push] 푸시 알림 전송 결과: {result}")

        return {
            "success": response.status_code == 200 and result.get("result", False),
            "response": result
        }
    except Exception as e:
        print(f"[Push] 푸시 알림 전송 실패: {e}")
        return {"success": False, "error": str(e)}
