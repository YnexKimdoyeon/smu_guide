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
    text = re.sub(r'\s+', ' ', text.strip())
    text = text.replace('\xa0', ' ').replace('&nbsp;', ' ')
    return text.strip()


def parse_shuttle_html(html: str, route: str) -> dict:
    """셔틀버스 HTML에서 테이블 추출"""
    soup = BeautifulSoup(html, 'html.parser')

    result = {
        "route": route,
        "route_name": ROUTE_NAMES.get(route, route),
        "route_info": "",
        "notice": "",
        "table_html": ""
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

    # 테이블 HTML 추출 (table_type2 div 내의 테이블)
    table_div = soup.find('div', class_='table_type2')
    if table_div:
        # 빈 table 태그 제거하고 실제 테이블만 추출
        tables = table_div.find_all('table')
        for table in tables:
            # thead나 tbody가 있는 테이블만 사용
            if table.find('thead') or table.find('tbody') or table.find('tr'):
                # 테이블 내용이 있는지 확인
                if table.get_text(strip=True):
                    # 스타일 추가하여 반환
                    result["table_html"] = str(table)
                    break

    # 안내사항 추출
    notice_parts = []

    # mgT30 div에서 안내사항 추출
    content_div = soup.find('div', id='tabcontent22') or soup.find('div', class_='shuttle_wrap')
    if content_div:
        for div in content_div.find_all('div', class_='mgT30'):
            # 테이블이 아닌 텍스트만
            if not div.find('table'):
                text = clean_text(div.get_text())
                if text and ('*' in text or '안내' in text or '운행' in text):
                    notice_parts.append(text)

    if notice_parts:
        result["notice"] = '\n'.join(notice_parts[:15])

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
