"""
선문대학교 종합정보시스템 연동 라우터
"""
import re
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User
from app.models.schedule import Schedule
from app.routers.gpt import get_gpt_session, session_cache as gpt_session_cache
from app.routers.canvas import login_canvas, canvas_session_cache

router = APIRouter(prefix="/sunmoon", tags=["선문대 연동"])

SWS_BASE_URL = "https://sws.sunmoon.ac.kr"
SWS_LOGIN_URL = f"{SWS_BASE_URL}/Login.aspx"
SWS_MAIN_URL = f"{SWS_BASE_URL}/MainQ.aspx"
SWS_TIMETABLE_URL = f"{SWS_BASE_URL}/UA/Course/CourseRegisterCal.aspx"
SWS_STUDENT_INFO_URL = f"{SWS_BASE_URL}/UA/Haksa/StudentUpdateLog.aspx"


class SunmoonLoginRequest(BaseModel):
    student_id: str
    password: str


class SunmoonLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    student_id: str
    department: str
    grade: str
    status: str


def get_headers(referer: str = SWS_LOGIN_URL):
    return {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "max-age=0",
        "Connection": "keep-alive",
        "Content-Type": "application/x-www-form-urlencoded",
        "Host": "sws.sunmoon.ac.kr",
        "Origin": SWS_BASE_URL,
        "Referer": referer,
        "Sec-Ch-Ua": '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
    }


def parse_user_info(html: str) -> dict:
    """메인 페이지에서 사용자 정보 파싱"""
    info = {
        "student_id": "",
        "department": "",
        "major": "",
        "grade": "",
        "name": "",
        "status": ""
    }

    # JSON 이스케이프 처리 (\" -> ")
    html = html.replace('\\"', '"').replace('\\r\\n', ' ').replace('\\n', ' ')

    # <span class="bold">학부</span>경영학과
    dept_match = re.search(r'<span\s+class="bold">학부</span>\s*([^<\s]+)', html)
    if dept_match:
        info["department"] = dept_match.group(1).strip()

    # <span class="bold">경영학</span>2학년
    grade_match = re.search(r'<span\s+class="bold">[^<]+</span>\s*(\d+)학년', html)
    if grade_match:
        info["grade"] = grade_match.group(1) + "학년"

    # <span class="bold">성명</span>김예솔
    name_match = re.search(r'<span\s+class="bold">성명</span>\s*([^<\s]+)', html)
    if name_match:
        info["name"] = name_match.group(1).strip()

    # <span class="bold">상태</span>재학
    status_match = re.search(r'<span\s+class="bold">상태</span>\s*([^<\s]+)', html)
    if status_match:
        info["status"] = status_match.group(1).strip()

    return info


def parse_student_info(html: str) -> dict:
    """학적정보 페이지에서 학번 등 파싱"""
    info = {
        "student_id": "",
        "name": "",
        "grade": "",
        "department": "",
        "major": ""
    }

    # <th>학번</th><td>2025560038</td>
    student_id_match = re.search(r'<th>학번</th>\s*<td>(\d+)</td>', html)
    if student_id_match:
        info["student_id"] = student_id_match.group(1)

    # <th>성명</th><td>김예솔</td>
    name_match = re.search(r'<th>성명</th>\s*<td>([^<]+)</td>', html)
    if name_match:
        info["name"] = name_match.group(1).strip()

    # <th>학년</th><td>2</td>
    grade_match = re.search(r'<th>학년</th>\s*<td>(\d+)</td>', html)
    if grade_match:
        info["grade"] = grade_match.group(1) + "학년"

    # <th>학과</th><td>경영학과</td>
    dept_match = re.search(r'<th>학과</th>\s*<td>([^<]+)</td>', html)
    if dept_match:
        info["department"] = dept_match.group(1).strip()

    # <th>전공</th><td>경영학</td>
    major_match = re.search(r'<th>전공</th>\s*<td>([^<]+)</td>', html)
    if major_match:
        info["major"] = major_match.group(1).strip()

    return info


def parse_timetable(html: str) -> list:
    """시간표 HTML에서 수업 정보 파싱"""
    schedules = []
    colors = ["#3B82F6", "#0EA5E9", "#06B6D4", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#EC4899"]
    color_idx = 0
    subject_colors = {}

    period_times = {
        0: ("08:30", "09:20"),
        1: ("09:30", "10:20"),
        2: ("10:30", "11:20"),
        3: ("11:30", "12:20"),
        4: ("12:30", "13:20"),
        5: ("13:30", "14:20"),
        6: ("14:30", "15:20"),
        7: ("15:30", "16:20"),
        8: ("16:30", "17:20"),
        9: ("17:30", "18:20"),
        10: ("18:30", "19:20"),
        11: ("19:30", "20:20"),
        12: ("20:30", "21:20"),
        13: ("21:30", "22:20"),
    }

    days = ["월", "화", "수", "목", "금"]

    # tbody 내의 tr들 파싱
    rows = re.findall(r'<tr>(.*?)</tr>', html, re.DOTALL)

    period_idx = -1
    for row in rows:
        # 교시 정보 확인
        period_match = re.search(r'(\d+)교시', row)
        if period_match:
            period_idx = int(period_match.group(1))

        if period_idx < 0 or period_idx > 13:
            continue

        # td 셀들 추출
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)

        for day_idx, cell in enumerate(cells[:5]):
            if '&nbsp;' in cell or not cell.strip():
                continue

            # 과목명 추출
            cell_clean = re.sub(r'<[^>]+>', '\n', cell)
            lines = [l.strip() for l in cell_clean.split('\n') if l.strip()]

            if not lines:
                continue

            subject = lines[0]
            class_num = lines[1] if len(lines) > 1 else ""
            professor = lines[2] if len(lines) > 2 else ""
            room = lines[3] if len(lines) > 3 else ""

            if subject in ['', '&nbsp;']:
                continue

            # 색상 할당
            if subject not in subject_colors:
                subject_colors[subject] = colors[color_idx % len(colors)]
                color_idx += 1

            start_time, end_time = period_times.get(period_idx, ("09:00", "10:00"))

            schedules.append({
                "day": days[day_idx],
                "start_time": start_time,
                "end_time": end_time,
                "subject": subject,
                "professor": professor,
                "room": room,
                "color": subject_colors[subject]
            })

    # 연속 수업 병합
    return merge_consecutive_classes(schedules)


def merge_consecutive_classes(schedules: list) -> list:
    if not schedules:
        return []

    groups = {}
    for s in schedules:
        key = (s["subject"], s["day"])
        if key not in groups:
            groups[key] = []
        groups[key].append(s)

    merged = []
    for key, classes in groups.items():
        classes.sort(key=lambda x: x["start_time"])
        current = classes[0].copy()

        for i in range(1, len(classes)):
            next_class = classes[i]
            current_end = int(current["end_time"].replace(":", ""))
            next_start = int(next_class["start_time"].replace(":", ""))

            if next_start - current_end <= 10:
                current["end_time"] = next_class["end_time"]
            else:
                merged.append(current)
                current = next_class.copy()

        merged.append(current)

    return merged


@router.post("/login", response_model=SunmoonLoginResponse)
async def login_with_sunmoon(
    login_data: SunmoonLoginRequest,
    db: Session = Depends(get_db)
):
    """선문대 종합정보시스템으로 로그인"""
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            verify=False,
            timeout=30.0
        ) as client:

            # 1. 로그인 페이지 GET - 세션 쿠키 및 ViewState 획득
            login_page = await client.get(SWS_LOGIN_URL, headers=get_headers())

            # ViewState 추출
            viewstate = ""
            viewstate_match = re.search(r'id="__VIEWSTATE"\s+value="([^"]*)"', login_page.text)
            if viewstate_match:
                viewstate = viewstate_match.group(1)

            viewstate_gen = ""
            gen_match = re.search(r'id="__VIEWSTATEGENERATOR"\s+value="([^"]*)"', login_page.text)
            if gen_match:
                viewstate_gen = gen_match.group(1)

            # 2. 로그인 POST
            login_form = {
                "__EVENTTARGET": "btnLogin",
                "__EVENTARGUMENT": "",
                "__VIEWSTATE": viewstate,
                "__VIEWSTATEGENERATOR": viewstate_gen,
                "__SCROLLPOSITIONX": "0",
                "__SCROLLPOSITIONY": "0",
                "txtID": login_data.student_id,
                "txtPasswd": login_data.password
            }

            login_response = await client.post(
                SWS_LOGIN_URL,
                data=login_form,
                headers=get_headers(SWS_LOGIN_URL)
            )

            # 3. 메인 페이지 확인
            if "MainQ.aspx" not in str(login_response.url):
                # 직접 메인 페이지 요청
                main_response = await client.get(SWS_MAIN_URL, headers=get_headers(SWS_LOGIN_URL))

                if "btnLogin" in main_response.text or "Login.aspx" in str(main_response.url):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="선문대 로그인 실패: 학번 또는 비밀번호를 확인하세요"
                    )
                main_html = main_response.text
            else:
                main_html = login_response.text

            # 4. 사용자 정보 파싱
            user_info = parse_user_info(main_html)

            if not user_info["name"]:
                # getLocalStorage에서 _litMyinfo 추출
                myinfo_match = re.search(r'"_litMyinfo":\s*"(.*?)"(?=,\s*"|\s*})', main_html, re.DOTALL)
                if myinfo_match:
                    myinfo_html = myinfo_match.group(1)
                    user_info = parse_user_info(myinfo_html)

            if not user_info["name"]:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="아이디 또는 비밀번호가 올바르지 않습니다"
                )

            # 5. 학적정보 페이지에서 실제 학번 가져오기
            student_info_page = await client.get(SWS_STUDENT_INFO_URL, headers=get_headers(SWS_MAIN_URL))
            student_info = parse_student_info(student_info_page.text)

            # 실제 학번이 있으면 사용
            real_student_id = student_info["student_id"] if student_info["student_id"] else login_data.student_id

            # 6. 시간표 가져오기
            timetable_page = await client.get(SWS_TIMETABLE_URL, headers=get_headers(SWS_MAIN_URL))

            tt_viewstate = ""
            tt_vs_match = re.search(r'id="__VIEWSTATE"\s+value="([^"]*)"', timetable_page.text)
            if tt_vs_match:
                tt_viewstate = tt_vs_match.group(1)

            tt_viewstate_gen = ""
            tt_gen_match = re.search(r'id="__VIEWSTATEGENERATOR"\s+value="([^"]*)"', timetable_page.text)
            if tt_gen_match:
                tt_viewstate_gen = tt_gen_match.group(1)

            # 시간표 조회 POST
            timetable_form = {
                "ScriptManager1": "ctl00|btn_s_search",
                "__EVENTTARGET": "btn_s_search",
                "__EVENTARGUMENT": "",
                "__VIEWSTATE": tt_viewstate,
                "__VIEWSTATEGENERATOR": tt_viewstate_gen,
                "__SCROLLPOSITIONX": "0",
                "__SCROLLPOSITIONY": "0",
                "hidYearSeason": "",
                "depttype": "",
                "ddlYear": "2026",
                "ddlSeason": "11",
                "ddlorder": "2",
                "__ASYNCPOST": "true"
            }

            ajax_headers = get_headers(SWS_TIMETABLE_URL)
            ajax_headers["X-Requested-With"] = "XMLHttpRequest"
            ajax_headers["X-MicrosoftAjax"] = "Delta=true"

            timetable_response = await client.post(
                SWS_TIMETABLE_URL,
                data=timetable_form,
                headers=ajax_headers
            )

            schedules = parse_timetable(timetable_response.text)

            # 7. DB 저장
            user = db.query(User).filter(User.student_id == real_student_id).first()

            if not user:
                user = User(
                    student_id=real_student_id,
                    password=get_password_hash(login_data.password),
                    name=user_info["name"],
                    department=user_info["department"]
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            else:
                user.name = user_info["name"]
                user.department = user_info["department"]
                db.commit()

            # 기존 시간표 삭제 후 새로 저장
            db.query(Schedule).filter(Schedule.user_id == user.id).delete()

            for sched in schedules:
                new_schedule = Schedule(
                    user_id=user.id,
                    day=sched["day"],
                    start_time=sched["start_time"],
                    end_time=sched["end_time"],
                    subject=sched["subject"],
                    professor=sched["professor"],
                    room=sched["room"],
                    color=sched["color"]
                )
                db.add(new_schedule)

            db.commit()

            # 7. JWT 토큰 발급
            access_token = create_access_token(data={"sub": str(user.id)})

            # 8. GPT 세션 자동 초기화 (실패해도 로그인은 성공)
            # GPT 로그인은 사용자가 입력한 로그인 ID를 사용해야 함 (학번이 아님)
            try:
                gpt_cookies = await get_gpt_session(login_data.student_id, login_data.password)
                gpt_session_cache[user.id] = gpt_cookies
                print(f"[GPT] 세션 자동 초기화 성공: user_id={user.id}")
            except Exception as e:
                # GPT 세션 실패해도 로그인은 정상 진행
                print(f"[GPT] 세션 자동 초기화 실패: {str(e)}")

            # 9. Canvas LMS 세션 자동 초기화 (로그인 아이디가 LMS 아이디)
            try:
                canvas_cookies = await login_canvas(login_data.student_id, login_data.password)
                canvas_session_cache[user.id] = canvas_cookies
                print(f"[Canvas] 세션 자동 초기화 성공: user_id={user.id}")
            except Exception as e:
                print(f"[Canvas] 세션 자동 초기화 실패: {str(e)}")

            return SunmoonLoginResponse(
                access_token=access_token,
                token_type="bearer",
                user_id=user.id,
                name=user_info["name"],
                student_id=real_student_id,
                department=user_info["department"],
                grade=user_info.get("grade", ""),
                status=user_info.get("status", "")
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"로그인 처리 중 오류: {str(e)}"
        )
