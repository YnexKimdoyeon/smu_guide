"""
선문대 Canvas LMS API
"""
import re
import base64
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User

# RSA 암호화를 위한 라이브러리
try:
    from Crypto.PublicKey import RSA
    from Crypto.Cipher import PKCS1_v1_5
except ImportError:
    from Cryptodome.PublicKey import RSA
    from Cryptodome.Cipher import PKCS1_v1_5

router = APIRouter(prefix="/canvas", tags=["Canvas LMS"])

# Canvas 세션 캐시 (user_id -> cookies dict)
canvas_session_cache = {}

# =========================
# RSA 복호화 함수
# =========================

def decrypt_password(encrypted_b64: str, private_key_pem: str) -> Optional[str]:
    """JSEncrypt와 호환되는 RSA 복호화"""
    try:
        encrypted = base64.b64decode(encrypted_b64)

        # PEM 형식 정리 (개행 추가)
        if "-----BEGIN RSA PRIVATE KEY-----" in private_key_pem:
            key_body = private_key_pem.replace("-----BEGIN RSA PRIVATE KEY-----", "").replace("-----END RSA PRIVATE KEY-----", "").strip()
            formatted_body = "\n".join([key_body[i:i+64] for i in range(0, len(key_body), 64)])
            private_key_pem = f"-----BEGIN RSA PRIVATE KEY-----\n{formatted_body}\n-----END RSA PRIVATE KEY-----"

        key = RSA.import_key(private_key_pem)
        cipher = PKCS1_v1_5.new(key)
        decrypted = cipher.decrypt(encrypted, None)

        if decrypted:
            return decrypted.decode('utf-8')
        return None
    except Exception as e:
        print(f"[Canvas] RSA 복호화 실패: {e}")
        return None


async def login_canvas(username: str, password: str) -> dict:
    """Canvas LMS에 로그인하고 쿠키를 반환"""

    async with httpx.AsyncClient(follow_redirects=True, verify=False, timeout=30.0) as client:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
        }

        # 1. Canvas 로그인 페이지에서 authenticity_token 획득
        canvas_login_page = await client.get(
            "https://canvas.sunmoon.ac.kr/login/canvas",
            headers=headers
        )

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(canvas_login_page.text, 'html.parser')
        auth_token_input = soup.find('input', {'name': 'authenticity_token'})
        authenticity_token = auth_token_input.get('value', '') if auth_token_input else ''

        if not authenticity_token:
            raise HTTPException(status_code=401, detail="Canvas authenticity_token을 찾을 수 없습니다")

        # 2. LMS SSO 로그인 페이지 접속
        gw_url = "https://lms.sunmoon.ac.kr/xn-sso/gw.php?login_type=standalone&callback_url=https%3A%2F%2Flms.sunmoon.ac.kr%2Flogin%2Fcallback"
        await client.get(gw_url, headers=headers)

        csrf_token = client.cookies.get('xn_sso_csrf_token_for_this_login', '')
        if not csrf_token:
            raise HTTPException(status_code=401, detail="Canvas CSRF 토큰을 찾을 수 없습니다")

        # 3. SSO 로그인 POST
        login_data = {
            'csrf_token': csrf_token,
            'login_type_general_or_sso': 'sso',
            'login_user_id': username,
            'login_user_password': password
        }

        gw_cb_url = "https://lms.sunmoon.ac.kr/xn-sso/gw-cb.php?from=&site=&login_type=standalone&return_url=https%3A%2F%2Flms.sunmoon.ac.kr%2Flogin%2Fcallback"
        login_resp = await client.post(gw_cb_url, data=login_data, headers=headers, follow_redirects=False)

        if login_resp.status_code != 302:
            raise HTTPException(status_code=401, detail="Canvas SSO 로그인 실패")

        redirect_url = login_resp.headers.get('Location', '')

        # callback 페이지 접속
        await client.get(redirect_url, headers=headers, follow_redirects=False)

        # result 토큰 추출
        from urllib.parse import urlparse, parse_qs, unquote
        parsed = urlparse(redirect_url)
        params = parse_qs(parsed.query)
        result_token = params.get('result', [''])[0]

        if not result_token:
            raise HTTPException(status_code=401, detail="Canvas result 토큰을 찾을 수 없습니다")

        result_token_decoded = unquote(result_token)

        # 4. Canvas from_cc 호출
        canvas_sso_url = "https://canvas.sunmoon.ac.kr/learningx/login/from_cc"
        canvas_resp = await client.get(canvas_sso_url, params={'result': result_token_decoded}, headers=headers)

        if canvas_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Canvas from_cc 실패")

        # loginCryption 파라미터 추출
        html = canvas_resp.text
        cryption_match = re.search(
            r'window\.loginCryption\("([^"]+)",\s*"(-----BEGIN RSA PRIVATE KEY-----[^"]+-----END RSA PRIVATE KEY-----)"\)',
            html
        )

        if not cryption_match:
            raise HTTPException(status_code=401, detail="Canvas loginCryption을 찾을 수 없습니다")

        encrypted_password = cryption_match.group(1)
        private_key = cryption_match.group(2)

        # 5. 비밀번호 RSA 복호화
        decrypted_password = decrypt_password(encrypted_password, private_key)

        if not decrypted_password:
            raise HTTPException(status_code=401, detail="Canvas 비밀번호 복호화 실패")

        # 폼 데이터 추출
        soup = BeautifulSoup(html, 'html.parser')
        form = soup.find('form')

        if not form:
            raise HTTPException(status_code=401, detail="Canvas 로그인 폼을 찾을 수 없습니다")

        action = form.get('action', '')
        inputs = form.find_all('input')
        form_data = {}

        for inp in inputs:
            name = inp.get('name', '')
            value = inp.get('value', '')
            if name:
                form_data[name] = value

        # 복호화된 비밀번호와 authenticity_token 설정
        form_data['pseudonym_session[password]'] = decrypted_password
        form_data['authenticity_token'] = authenticity_token

        # 6. Canvas 로그인 POST
        if action.startswith('/'):
            login_url = f"https://canvas.sunmoon.ac.kr{action}"
        else:
            login_url = action

        canvas_login_resp = await client.post(login_url, data=form_data, headers=headers)

        if "login_success=1" in str(canvas_login_resp.url) or ("canvas.sunmoon.ac.kr" in str(canvas_login_resp.url) and "login" not in str(canvas_login_resp.url).lower()):
            # Canvas 및 LMS 도메인 쿠키 추출 (중복 시 마지막 값 사용)
            all_cookies = {}
            for cookie in client.cookies.jar:
                domain = cookie.domain or ''
                if 'canvas.sunmoon.ac.kr' in domain or 'lms.sunmoon.ac.kr' in domain or 'sunmoon.ac.kr' in domain:
                    all_cookies[cookie.name] = cookie.value
            print(f"[Canvas] 추출된 쿠키: {list(all_cookies.keys())}")
            return all_cookies
        else:
            raise HTTPException(status_code=401, detail="Canvas 로그인 실패")


class InitRequest(BaseModel):
    password: str


@router.post("/init")
async def init_canvas_session(
    request: InitRequest,
    current_user: User = Depends(get_current_user)
):
    """Canvas 세션 초기화"""
    try:
        cookies = await login_canvas(current_user.student_id, request.password)
        canvas_session_cache[current_user.id] = cookies
        print(f"[Canvas] 세션 초기화 성공: user_id={current_user.id}")
        return {"message": "Canvas 세션이 초기화되었습니다"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Canvas] 세션 초기화 실패: {e}")
        raise HTTPException(status_code=500, detail=f"Canvas 세션 초기화 실패: {str(e)}")


@router.get("/status")
async def get_canvas_status(current_user: User = Depends(get_current_user)):
    """Canvas 세션 상태 확인"""
    is_active = current_user.id in canvas_session_cache
    return {"active": is_active}


@router.get("/todos")
async def get_canvas_todos(
    current_user: User = Depends(get_current_user)
):
    """Canvas 할 일 목록 조회"""
    user_id = current_user.id

    if user_id not in canvas_session_cache:
        raise HTTPException(status_code=401, detail="Canvas 세션이 필요합니다. 먼저 로그인하세요.")

    cookies = canvas_session_cache[user_id]

    async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
        }

        # term_ids[]=10 은 현재 학기
        response = await client.get(
            "https://canvas.sunmoon.ac.kr/learningx/api/v1/learn_activities/to_dos",
            params={"term_ids[]": "10"},
            headers=headers,
            cookies=cookies
        )

        if response.status_code != 200:
            print(f"[Canvas] todos API 실패: status={response.status_code}, url={response.url}")
            print(f"[Canvas] 응답: {response.text[:500]}")
            # 세션 만료
            if user_id in canvas_session_cache:
                del canvas_session_cache[user_id]
            raise HTTPException(status_code=401, detail="Canvas 세션이 만료되었습니다")

        return response.json()


@router.get("/courses")
async def get_canvas_courses(
    current_user: User = Depends(get_current_user)
):
    """Canvas 수강 과목 목록 조회"""
    user_id = current_user.id

    if user_id not in canvas_session_cache:
        raise HTTPException(status_code=401, detail="Canvas 세션이 필요합니다.")

    cookies = canvas_session_cache[user_id]

    async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
        }

        response = await client.get(
            "https://canvas.sunmoon.ac.kr/api/v1/courses",
            params={"enrollment_state": "active", "per_page": "50"},
            headers=headers,
            cookies=cookies
        )

        if response.status_code != 200:
            if user_id in canvas_session_cache:
                del canvas_session_cache[user_id]
            raise HTTPException(status_code=401, detail="Canvas 세션이 만료되었습니다")

        return response.json()
