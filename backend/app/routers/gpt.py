"""
선문대 GPT 챗봇 API
"""
import re
import json
import httpx
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/gpt", tags=["GPT 챗봇"])

# 설정
SWS_LOGIN_URL = "https://sws.sunmoon.ac.kr/Login.aspx"
SWS_GPT_MENU_URL = "https://sws.sunmoon.ac.kr/MenuAuthCheck?menu=선문GPT"
GPT_API_URL = "https://gpt.sunmoon.ac.kr/api/chat/getAnswer"

HEADERS = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    rid: Optional[int] = 1


class ChatResponse(BaseModel):
    answer: str
    rid: int


# 세션 캐시 (user_id -> cookies)
session_cache = {}


async def get_gpt_session(student_id: str, password: str) -> dict:
    """선문대 GPT 세션 획득"""
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        # 1. 로그인 페이지에서 토큰 가져오기
        login_page = await client.get(SWS_LOGIN_URL, headers=HEADERS)

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(login_page.text, 'html.parser')

        viewstate = soup.find('input', {'name': '__VIEWSTATE'})
        viewstate_value = viewstate['value'] if viewstate else ''
        viewstate_gen = soup.find('input', {'name': '__VIEWSTATEGENERATOR'})
        viewstate_gen_value = viewstate_gen['value'] if viewstate_gen else ''

        # 2. 로그인
        login_data = {
            '__EVENTTARGET': 'btnLogin',
            '__EVENTARGUMENT': '',
            '__VIEWSTATE': viewstate_value,
            '__VIEWSTATEGENERATOR': viewstate_gen_value,
            '__SCROLLPOSITIONX': '0',
            '__SCROLLPOSITIONY': '0',
            'txtID': student_id,
            'txtPasswd': password
        }

        login_headers = {
            **HEADERS,
            'content-type': 'application/x-www-form-urlencoded',
            'origin': 'https://sws.sunmoon.ac.kr',
            'referer': 'https://sws.sunmoon.ac.kr/Login.aspx'
        }

        login_response = await client.post(SWS_LOGIN_URL, data=login_data, headers=login_headers)

        if "Login.aspx" in str(login_response.url):
            raise HTTPException(status_code=401, detail="GPT 로그인 실패")

        # 3. GPT SSO URL 획득
        gpt_response = await client.get(SWS_GPT_MENU_URL, follow_redirects=False)

        match = re.search(r'gpt\.sunmoon\.ac\.kr/SSOLogin\.aspx\?[^"\'<>\s]+', gpt_response.text)
        if not match:
            raise HTTPException(status_code=403, detail="GPT 권한이 없습니다")

        sso_url = "https://" + match.group(0)

        # 4. GPT SSO 로그인
        await client.get(sso_url)

        # 쿠키 반환
        cookies = dict(client.cookies)
        if "accessToken" not in cookies:
            raise HTTPException(status_code=401, detail="GPT 토큰 획득 실패")

        return cookies


@router.post("/chat", response_model=ChatResponse)
async def chat_with_gpt(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """GPT와 대화"""
    # 세션 캐시 확인
    user_id = current_user.id

    if user_id not in session_cache:
        # 새 세션 필요 - 비밀번호가 필요하므로 에러
        raise HTTPException(
            status_code=401,
            detail="GPT 세션이 필요합니다. 먼저 /gpt/init을 호출하세요."
        )

    cookies = session_cache[user_id]

    # GPT API 호출
    gpt_headers = {
        "content-type": "application/json",
        "x-api-key": "sunmoon000000",
        "origin": "https://gpt.sunmoon.ac.kr",
        "referer": "https://gpt.sunmoon.ac.kr/chat"
    }

    payload = {
        "assistant": None,
        "messages": [{"role": m.role, "content": m.content} for m in request.messages],
        "rid": request.rid,
        "rtype": 1
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            GPT_API_URL,
            headers=gpt_headers,
            json=payload,
            cookies=cookies
        )

        if response.status_code != 200:
            # 세션 만료 - 캐시 삭제
            if user_id in session_cache:
                del session_cache[user_id]
            raise HTTPException(status_code=401, detail="GPT 세션이 만료되었습니다")

        # SSE 응답 파싱
        text = response.content.decode('utf-8')
        lines = text.strip().split('\n')

        for line in reversed(lines):
            if line.startswith('data:'):
                try:
                    data = json.loads(line[5:].strip())
                    if 'answer' in data:
                        return ChatResponse(
                            answer=data['answer'],
                            rid=data.get('id', request.rid)
                        )
                except:
                    continue

        raise HTTPException(status_code=500, detail="GPT 응답 파싱 실패")


class InitRequest(BaseModel):
    password: str


@router.post("/init")
async def init_gpt_session(
    request: InitRequest,
    current_user: User = Depends(get_current_user)
):
    """GPT 세션 초기화"""
    try:
        cookies = await get_gpt_session(current_user.student_id, request.password)
        session_cache[current_user.id] = cookies
        return {"message": "GPT 세션이 초기화되었습니다"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GPT 세션 초기화 실패: {str(e)}")


@router.get("/status")
async def get_gpt_status(current_user: User = Depends(get_current_user)):
    """GPT 세션 상태 확인"""
    is_active = current_user.id in session_cache
    return {"active": is_active}
