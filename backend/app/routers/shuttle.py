"""
선문대학교 셔틀버스 시간표 API
"""
import re
import httpx
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, Query
from bs4 import BeautifulSoup

router = APIRouter(prefix="/shuttle", tags=["셔틀버스"])

# 셔틀버스 URL 매핑
# 평일
WEEKDAY_URLS = {
    "asan_ktx": "/Page2/About/About08_04_02_01_01_01.aspx",
    "cheonan_station": "/Page2/About/About08_04_02_01_01_02.aspx",
    "cheonan_terminal": "/Page2/About/About08_04_02_01_02.aspx",
    "onyang": "/Page2/About/About08_04_02_01_03.aspx",
    "cheonan_campus": "/Page2/About/About08_04_02_01_04.aspx",
}

# 토요일/공휴일
SATURDAY_URLS = {
    "asan_ktx": "/Page2/About/About08_04_02_02_01.aspx",
    "cheonan_station": "/Page2/About/About08_04_03_02_03.aspx",
    "cheonan_terminal": "/Page2/About/About08_04_02_02_02.aspx",
}

# 일요일
SUNDAY_URLS = {
    "asan_ktx": "/Page2/About/About08_04_02_03_01.aspx",
    "cheonan_station": "/Page2/About/About08_04_03_03_03.aspx",
    "cheonan_terminal": "/Page2/About/About08_04_02_03_02.aspx",
}

ROUTE_NAMES = {
    "asan_ktx": "아산(KTX)역",
    "cheonan_station": "천안역",
    "cheonan_terminal": "천안터미널",
    "onyang": "온양역/터미널",
    "cheonan_campus": "천안캠퍼스",
}

BASE_URL = "https://lily.sunmoon.ac.kr"


def clean_text(text: str) -> str:
    """텍스트 정리"""
    if not text:
        return ""
    # 공백 정리
    text = re.sub(r'\s+', ' ', text.strip())
    # HTML 엔티티 치환
    text = text.replace('\xa0', ' ').replace('&nbsp;', ' ')
    return text.strip()


def parse_time(text: str) -> str:
    """시간 형식 추출"""
    if not text:
        return ""
    text = clean_text(text)
    # X 표시 처리
    if text in ['Χ', 'X', 'x', '-', '']:
        return '-'
    # 시간 형식 추출 (HH:MM)
    match = re.search(r'(\d{1,2}:\d{2})', text)
    if match:
        return match.group(1)
    return text


def parse_shuttle_html(html: str, route: str) -> dict:
    """셔틀버스 HTML 파싱"""
    soup = BeautifulSoup(html, 'html.parser')

    result = {
        "route": route,
        "route_name": ROUTE_NAMES.get(route, route),
        "route_info": "",
        "notice": "",
        "schedule": []
    }

    # 노선 정보 추출 (grayBox 내의 정보)
    gray_box = soup.find('div', class_='grayBox')
    if gray_box:
        route_info_parts = []
        title = gray_box.find('h4', class_='title22')
        if title:
            route_info_parts.append(clean_text(title.get_text()))

        for p in gray_box.find_all('p', class_='blue_gray'):
            text = clean_text(p.get_text())
            if text:
                route_info_parts.append(text)

        result["route_info"] = ' / '.join(route_info_parts)

    # 테이블 파싱
    table = soup.find('table')
    if not table:
        return result

    # thead에서 헤더 추출
    headers = []
    thead = table.find('thead')
    if thead:
        header_row = thead.find('tr')
        if header_row:
            for th in header_row.find_all('th'):
                headers.append(clean_text(th.get_text()))

    # tbody에서 데이터 추출
    tbody = table.find('tbody')
    rows = tbody.find_all('tr') if tbody else table.find_all('tr')[1:]

    for row in rows:
        cells = row.find_all('td')
        if not cells:
            continue

        # 기본 구조: 순번, 캠퍼스출발, 역출발, 중간경유, 캠퍼스도착, 비고
        schedule_item = {
            "seq": 0,
            "departure_campus": "",
            "departure_station": "",
            "intermediate_stop1": "",
            "intermediate_stop2": "",
            "arrival_campus": "",
            "note": ""
        }

        # 셀 수에 따라 파싱
        cell_texts = [clean_text(cell.get_text()) for cell in cells]

        if len(cell_texts) >= 1:
            try:
                schedule_item["seq"] = int(cell_texts[0]) if cell_texts[0].isdigit() else 0
            except:
                schedule_item["seq"] = 0

        if len(cell_texts) >= 2:
            schedule_item["departure_campus"] = parse_time(cell_texts[1])

        if len(cell_texts) >= 3:
            schedule_item["departure_station"] = parse_time(cell_texts[2])

        # colspan이 있는 경우 (중간 경유가 합쳐진 경우)
        colspan_cell = None
        for cell in cells:
            if cell.get('colspan'):
                colspan_cell = cell
                break

        if colspan_cell:
            # colspan이 있으면 중간 경유가 합쳐진 것
            schedule_item["intermediate_stop1"] = clean_text(colspan_cell.get_text())

            # 나머지 셀 처리
            remaining_cells = [c for c in cells if c != colspan_cell]
            if len(remaining_cells) >= 5:
                schedule_item["arrival_campus"] = parse_time(clean_text(remaining_cells[4].get_text()))
            if len(remaining_cells) >= 6:
                schedule_item["note"] = clean_text(remaining_cells[5].get_text())
        else:
            # colspan이 없으면 개별 처리
            if len(cell_texts) >= 4:
                schedule_item["intermediate_stop1"] = clean_text(cell_texts[3])
            if len(cell_texts) >= 5:
                schedule_item["arrival_campus"] = parse_time(cell_texts[4])
            if len(cell_texts) >= 6:
                schedule_item["note"] = clean_text(cell_texts[5])
            if len(cell_texts) >= 7:
                schedule_item["note"] = clean_text(cell_texts[6])

        # 유효한 데이터만 추가
        if schedule_item["seq"] > 0 or schedule_item["departure_campus"] or schedule_item["departure_station"]:
            result["schedule"].append(schedule_item)

    # 안내사항 추출 (mgT30 div들)
    notice_parts = []
    for div in soup.find_all('div', class_='mgT30'):
        text = clean_text(div.get_text())
        # 특정 패턴만 포함 (공휴일, 안내 관련)
        if '*' in text or '안내' in text:
            notice_parts.append(text)

    # 별도 안내사항 영역
    for span in soup.find_all('span', style=lambda x: x and 'background-color' in str(x)):
        text = clean_text(span.get_text())
        if text and text not in notice_parts:
            notice_parts.append(text)

    if notice_parts:
        result["notice"] = '\n'.join(notice_parts[:10])  # 최대 10개

    return result


async def fetch_shuttle_schedule(day_type: str, route: str) -> dict:
    """셔틀버스 시간표 페이지 가져오기"""

    # URL 선택
    if day_type == "weekday":
        url_map = WEEKDAY_URLS
    elif day_type == "saturday":
        url_map = SATURDAY_URLS
    elif day_type == "sunday":
        url_map = SUNDAY_URLS
    else:
        raise HTTPException(status_code=400, detail="잘못된 요일 타입입니다. (weekday, saturday, sunday)")

    if route not in url_map:
        raise HTTPException(status_code=400, detail=f"해당 요일에 {ROUTE_NAMES.get(route, route)} 노선이 없습니다.")

    url = BASE_URL + url_map[route]

    async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = await client.get(url, headers=headers)

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="셔틀버스 시간표를 가져올 수 없습니다.")

        return parse_shuttle_html(response.text, route)


@router.get("/schedule")
async def get_shuttle_schedule(
    day_type: str = Query(..., description="요일 타입 (weekday, saturday, sunday)"),
    route: str = Query(..., description="노선 (asan_ktx, cheonan_station, cheonan_terminal, onyang, cheonan_campus)")
):
    """
    셔틀버스 시간표 조회
    - day_type: weekday(평일), saturday(토요일/공휴일), sunday(일요일)
    - route: asan_ktx(아산역), cheonan_station(천안역), cheonan_terminal(천안터미널),
             onyang(온양역/터미널), cheonan_campus(천안캠퍼스)
    """
    schedule_data = await fetch_shuttle_schedule(day_type, route)
    schedule_data["day_type"] = day_type

    return schedule_data


@router.get("/routes")
async def get_shuttle_routes():
    """셔틀버스 노선 목록 조회"""
    return {
        "weekday": [
            {"id": "asan_ktx", "name": "아산(KTX)역"},
            {"id": "cheonan_station", "name": "천안역"},
            {"id": "cheonan_terminal", "name": "천안터미널"},
            {"id": "onyang", "name": "온양역/터미널"},
            {"id": "cheonan_campus", "name": "천안캠퍼스"},
        ],
        "saturday": [
            {"id": "asan_ktx", "name": "아산(KTX)역"},
            {"id": "cheonan_station", "name": "천안역"},
            {"id": "cheonan_terminal", "name": "천안터미널"},
        ],
        "sunday": [
            {"id": "asan_ktx", "name": "아산(KTX)역"},
            {"id": "cheonan_station", "name": "천안역"},
            {"id": "cheonan_terminal", "name": "천안터미널"},
        ]
    }
