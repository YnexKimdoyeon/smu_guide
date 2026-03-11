"""
선문대 EARS 출석 관리 시스템 API
SSO 플로우: SWS MenuAuthCheck → EARS SSO LoginSSO.jsp → iwin_sin → 세션 확보
"""
import re
import httpx
from typing import Dict
from urllib.parse import urlparse, parse_qs, unquote
from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_user
from app.core.session_store import save_credentials, load_credentials
from app.models.user import User

router = APIRouter(prefix="/ears", tags=["EARS 출석"])

EARS_BASE_URL = "https://ears.sunmoon.ac.kr"
EARS_SSO_URL = "https://ears.sunmoon.ac.kr:6080/sso/LoginSSO.jsp"
SWS_MENU_AUTH_URL = "https://sws.sunmoon.ac.kr/MenuAuthCheck"

# EARS 세션 캐시 (user_id -> {cookies, courses, student_id})
ears_session_cache: Dict[int, dict] = {}


def _parse_attend_kind(kind: str) -> str:
    """출석 상태 코드를 문자열로 변환 (function3.js attend_state 기반)"""
    mapping = {
        "0": "결석", "1": "결석", "11": "결석", "21": "결석",
        "2": "출석", "12": "출석", "22": "출석",
        "5": "출석(1차)", "6": "출석(위치X)",
        "3": "지각", "13": "지각", "23": "지각",
        "35": "지각(1차)", "36": "지각(위치X)",
        "4": "조퇴", "14": "조퇴", "24": "조퇴",
        "92": "공결",
        "NONE": "미출결",
        "OUT": "미수강",
    }
    return mapping.get(kind, kind)


async def login_ears(student_id: str, password: str) -> dict:
    """
    EARS 로그인 (SWS SSO 경유)
    1. SWS MenuAuthCheck로 암호화된 비밀번호 획득
    2. EARS SSO에 POST → redirect에서 suser_id, suser_name 획득
    3. iwin_sin으로 EARS 세션 확보 + 수강과목 목록 획득
    """
    async with httpx.AsyncClient(follow_redirects=False, verify=False, timeout=30.0) as client:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
        }

        # 1. SWS 로그인 (세션 확보)
        from app.routers.sunmoon import SWS_LOGIN_URL, SWS_MAIN_URL, get_headers
        login_page = await client.get(SWS_LOGIN_URL, headers=get_headers())

        viewstate = ""
        vs_match = re.search(r'id="__VIEWSTATE"\s+value="([^"]*)"', login_page.text)
        if vs_match:
            viewstate = vs_match.group(1)
        viewstate_gen = ""
        gen_match = re.search(r'id="__VIEWSTATEGENERATOR"\s+value="([^"]*)"', login_page.text)
        if gen_match:
            viewstate_gen = gen_match.group(1)

        login_form = {
            "__EVENTTARGET": "btnLogin",
            "__EVENTARGUMENT": "",
            "__VIEWSTATE": viewstate,
            "__VIEWSTATEGENERATOR": viewstate_gen,
            "__SCROLLPOSITIONX": "0",
            "__SCROLLPOSITIONY": "0",
            "txtID": student_id,
            "txtPasswd": password
        }
        await client.post(SWS_LOGIN_URL, data=login_form, headers=get_headers(SWS_LOGIN_URL))

        # 2. SWS MenuAuthCheck 호출 → EARS SSO 폼 데이터 획득
        menu_resp = await client.get(
            SWS_MENU_AUTH_URL,
            params={"menu": "출결현황 일반 교과목"},
            headers=get_headers(SWS_MAIN_URL)
        )

        # MenuAuthCheck 응답에서 form 데이터 추출
        form_match = re.search(
            r'action=["\']([^"\']*LoginSSO[^"\']*)["\']',
            menu_resp.text, re.IGNORECASE
        )
        id_match = re.search(r'name=["\']id["\']\s+value=["\']([^"\']+)["\']', menu_resp.text)
        pw_match = re.search(r'name=["\']pw["\']\s+value=["\']([^"\']+)["\']', menu_resp.text)
        type_match = re.search(r'name=["\']type["\']\s+value=["\']([^"\']+)["\']', menu_resp.text)

        if not pw_match:
            raise HTTPException(status_code=401, detail="EARS SSO 자격 증명을 가져올 수 없습니다")

        sso_id = id_match.group(1) if id_match else student_id
        sso_pw = pw_match.group(1)
        sso_type = type_match.group(1) if type_match else "3"

        # 3. EARS SSO에 POST → redirect URL에서 suser_id, suser_name 추출
        sso_data = {
            "id": sso_id,
            "pw": sso_pw,
            "type": sso_type,
            "returnUrl": "http://sws.sunmoon.ac.kr/ErrorPage.aspx"
        }

        sso_resp = await client.post(
            EARS_SSO_URL,
            data=sso_data,
            headers={**headers, 'Origin': 'https://sws.sunmoon.ac.kr', 'Referer': 'https://sws.sunmoon.ac.kr/'}
        )

        if sso_resp.status_code != 302:
            raise HTTPException(status_code=401, detail="EARS SSO 인증 실패")

        redirect_url = sso_resp.headers.get('Location', '')
        parsed = urlparse(redirect_url)
        params = parse_qs(parsed.query)

        suser_id = params.get('suser_id', [''])[0]
        suser_name = params.get('suser_name', [''])[0]

        if not suser_id or not suser_name:
            raise HTTPException(status_code=401, detail="EARS SSO 토큰을 가져올 수 없습니다")

        # 4. EARS index.html 접근 (JSESSIONID 쿠키 획득)
        await client.get(redirect_url, headers=headers, follow_redirects=True)

        # 5. iwin_sin으로 EARS 로그인 + 수강과목 획득
        ikey = f'{{"duser_id":"{suser_id}","duser_pw":"{suser_name}"}}'
        sin_resp = await client.post(
            f"{EARS_BASE_URL}/attend/iwin_sin",
            data={"ikey": ikey},
            headers={
                **headers,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': EARS_BASE_URL,
                'Referer': redirect_url,
            }
        )

        if sin_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="EARS 로그인 실패")

        sin_data = sin_resp.json()

        if sin_data.get("xidedu", {}).get("xmsg") != "Ok":
            msg = sin_data.get("xidedu", {}).get("xmsg", "Unknown")
            raise HTTPException(status_code=401, detail=f"EARS 로그인 실패: {msg}")

        # 쿠키 추출
        all_cookies = {}
        for cookie in client.cookies.jar:
            all_cookies[cookie.name] = cookie.value

        print(f"[EARS] 로그인 성공: student_id={student_id}, 쿠키={list(all_cookies.keys())}")

        # 수강과목 목록 추출
        courses = []
        rollbook = sin_data.get("rollbook", [])
        # 과목별로 그룹핑 (같은 과목의 다른 시간대를 하나로)
        course_groups = {}
        for rb in rollbook:
            name_class = f"{rb.get('sugang_name', '')} ({rb.get('sugang_class', '')})"
            if name_class not in course_groups:
                course_groups[name_class] = {
                    "course_name": rb.get("sugang_name", ""),
                    "sugang_class": rb.get("sugang_class", ""),
                    "sugang_sub_code": rb.get("sugang_sub_code", ""),
                    "professor": rb.get("professor_name", ""),
                    "classroom": rb.get("class_room", ""),
                    "credits": rb.get("sugang_points", ""),
                    "department": rb.get("sugang_department_name", ""),
                    "sugang_codes": [],
                }
            course_groups[name_class]["sugang_codes"].append(rb.get("sugang_code", ""))

        courses = list(course_groups.values())

        return {
            "cookies": all_cookies,
            "courses": courses,
            "user_info": sin_data.get("xuser"),
        }


async def ensure_ears_session(user_id: int) -> dict:
    """EARS 세션 확인 및 필요시 재로그인"""
    if user_id in ears_session_cache:
        return ears_session_cache[user_id]

    # 저장된 자격 증명으로 복원 시도 (ears → canvas 폴백)
    creds = load_credentials('ears', user_id)
    if not (creds and creds.get('student_id') and creds.get('password')):
        # EARS 자격증명이 없으면 canvas 자격증명으로 폴백 (동일 계정)
        canvas_creds = load_credentials('canvas', user_id)
        if canvas_creds and canvas_creds.get('username') and canvas_creds.get('password'):
            creds = {'student_id': canvas_creds['username'], 'password': canvas_creds['password']}

    if creds and creds.get('student_id') and creds.get('password'):
        try:
            print(f"[EARS] 저장된 자격 증명으로 세션 복원: user_id={user_id}")
            session_data = await login_ears(creds['student_id'], creds['password'])
            ears_session_cache[user_id] = session_data
            # EARS 자격증명도 저장
            save_credentials('ears', user_id, {
                'student_id': creds['student_id'],
                'password': creds['password']
            })
            return session_data
        except Exception as e:
            print(f"[EARS] 세션 복원 실패: {e}")

    raise HTTPException(status_code=401, detail="EARS 세션이 필요합니다. 다시 로그인하세요.")


async def _fetch_attendance(cookies: dict, dclass: str, duser_id: str) -> dict:
    """EARS 출석부 API 호출 (세션 쿠키 사용)"""
    ikey = f'{{"dclass":"{dclass}","duser_id":"{duser_id}"}}'
    async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
        response = await client.post(
            f"{EARS_BASE_URL}/attend/iwin_st_chulseokbu",
            data={"ikey": ikey},
            headers={
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            cookies=cookies
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="EARS API 호출 실패")
        return response.json()


def _process_attendance(data: dict, student_id: str) -> dict:
    """EARS 출석 응답을 프론트엔드용으로 가공"""
    rollbook = data.get("rollbook", [])
    rollbook_user = data.get("rollbookuser", [])

    if not rollbook:
        return {"course_info": None, "time_slots": [], "weekly_summary": []}

    first = rollbook[0]
    course_info = {
        "sugang_code": first.get("sugang_code", ""),
        "course_name": first.get("sugang_name", ""),
        "subject_code": first.get("sugang_sub_code", ""),
        "department": first.get("sugang_department_name", ""),
        "professor": first.get("professor_name", ""),
        "classroom": first.get("class_room", ""),
        "credits": first.get("sugang_points", ""),
    }

    week_map = {"1": "월", "2": "화", "3": "수", "4": "목", "5": "금", "6": "토", "7": "일"}

    time_slots = []
    for rb in rollbook:
        weekday = week_map.get(rb.get("sugang_week", ""), rb.get("sugang_week", ""))
        st = rb.get("sugang_starttime", "")
        if len(st) == 4:
            st = f"{st[:2]}:{st[2:]}"

        slot = {"sugang_code": rb.get("sugang_code", ""), "weekday": weekday, "start_time": st, "weeks": []}

        for wi in rb.get("sugangWeekInfoForJspList", []):
            attend_kind = "NONE"
            for log in wi.get("sugangAttendLogList", []):
                if log.get("sugang_student_id") == student_id:
                    attend_kind = log.get("sugang_attend_kind", "NONE")
                    break

            wd = wi.get("sugang_date", "")
            if len(wd) == 4:
                wd = f"{wd[:2]}/{wd[2:]}"

            slot["weeks"].append({
                "week": wi.get("sugang_order", 0),
                "date": wd,
                "status": _parse_attend_kind(attend_kind),
                "status_code": attend_kind,
            })
        time_slots.append(slot)

    weekly_summary = []
    for user in rollbook_user:
        if user.get("sugang_student_id") == student_id:
            for cr in user.get("attendCountResultList", []):
                weekly_summary.append({
                    "week": cr.get("sugang_order", 0),
                    "attend": cr.get("attend_count", 0),
                    "absent": cr.get("absent_count", 0),
                    "late": cr.get("late_count", 0),
                    "early": cr.get("early_count", 0),
                    "none": cr.get("none_count", 0),
                })
            break

    return {"course_info": course_info, "time_slots": time_slots, "weekly_summary": weekly_summary}


@router.get("/status")
async def get_ears_status(current_user: User = Depends(get_current_user)):
    """EARS 세션 상태 확인"""
    is_active = current_user.id in ears_session_cache
    if not is_active:
        creds = load_credentials('ears', current_user.id)
        if creds and creds.get('student_id'):
            is_active = True
    return {"active": is_active}


@router.get("/courses")
async def get_ears_courses(current_user: User = Depends(get_current_user)):
    """EARS 수강과목 목록 조회 (자동 로그인)"""
    session = await ensure_ears_session(current_user.id)
    return {"courses": session.get("courses", [])}


@router.get("/attendance/all")
async def get_all_attendance(current_user: User = Depends(get_current_user)):
    """모든 수강과목의 출석 현황 일괄 조회"""
    session = await ensure_ears_session(current_user.id)
    cookies = session.get("cookies", {})
    courses = session.get("courses", [])
    student_id = current_user.student_id

    results = []
    for course in courses:
        # 각 과목의 첫 번째 sugang_code로 출석 조회
        if not course.get("sugang_codes"):
            continue
        dclass = course["sugang_codes"][0]
        try:
            data = await _fetch_attendance(cookies, dclass, student_id)
            if data.get("xidedu", {}).get("xmsg") == "NoLogin":
                # 세션 만료 - 재로그인 시도
                if current_user.id in ears_session_cache:
                    del ears_session_cache[current_user.id]
                raise HTTPException(status_code=401, detail="EARS 세션이 만료되었습니다.")
            attendance = _process_attendance(data, student_id)
            attendance["color"] = None  # 프론트에서 할당
            results.append(attendance)
        except HTTPException:
            raise
        except Exception as e:
            print(f"[EARS] 출석 조회 실패: {dclass}, {e}")
            continue

    return {"courses": results}
