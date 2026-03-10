"""
세션 자격 증명 영속화
서버 재시작 시에도 사용자 세션을 유지하기 위해
자격 증명을 파일에 저장/복원
"""
import json
import base64
from pathlib import Path
from typing import Dict, Optional

SESSION_FILE = Path(__file__).parent.parent.parent / '.session_store.json'


def _encode(text: str) -> str:
    """간단한 난독화 (base64)"""
    return base64.b64encode(text.encode('utf-8')).decode('utf-8')


def _decode(text: str) -> str:
    """난독화 해제"""
    return base64.b64decode(text.encode('utf-8')).decode('utf-8')


def save_credentials(service: str, user_id: int, credentials: dict):
    """자격 증명 저장 (서비스별)"""
    data = _load_all()
    if service not in data:
        data[service] = {}

    # 비밀번호 난독화
    encoded_creds = {}
    for k, v in credentials.items():
        if k in ('password', 'login_password'):
            encoded_creds[k] = _encode(str(v))
        else:
            encoded_creds[k] = str(v)

    data[service][str(user_id)] = encoded_creds
    _save_all(data)


def load_credentials(service: str, user_id: int) -> Optional[dict]:
    """자격 증명 복원"""
    data = _load_all()
    service_data = data.get(service, {})
    encoded_creds = service_data.get(str(user_id))

    if not encoded_creds:
        return None

    # 비밀번호 디코딩
    decoded_creds = {}
    for k, v in encoded_creds.items():
        if k in ('password', 'login_password'):
            try:
                decoded_creds[k] = _decode(v)
            except Exception:
                decoded_creds[k] = v
        else:
            decoded_creds[k] = v

    return decoded_creds


def remove_credentials(service: str, user_id: int):
    """자격 증명 삭제"""
    data = _load_all()
    service_data = data.get(service, {})
    if str(user_id) in service_data:
        del service_data[str(user_id)]
        data[service] = service_data
        _save_all(data)


def _load_all() -> dict:
    """전체 데이터 로드"""
    if not SESSION_FILE.exists():
        return {}
    try:
        with open(SESSION_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _save_all(data: dict):
    """전체 데이터 저장"""
    try:
        with open(SESSION_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception as e:
        print(f"[SessionStore] 저장 실패: {e}")
