"""
선문대학교 식단 정보 API
"""
import re
import httpx
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException
from bs4 import BeautifulSoup

router = APIRouter(prefix="/cafeteria", tags=["식단"])

# 식당 코드
CAFETERIA_CODES = {
    "student": "003",  # 학생회관 식당
    "orange": "002",   # 오렌지식당
    "staff": "001",    # 교직원식당
}

CAFETERIA_NAMES = {
    "003": "학생회관 식당",
    "002": "오렌지식당",
    "001": "본관 교직원식당",
}


def parse_menu_html(html: str) -> dict:
    """식단 HTML 파싱"""
    soup = BeautifulSoup(html, 'html.parser')

    result = {
        "cafeteria_name": "",
        "operating_info": [],
        "date_range": "",
        "menu_categories": [],
        "daily_menus": []
    }

    # 운영 정보 추출
    info_list = soup.find('ul', class_='bu_dot')
    if info_list:
        for li in info_list.find_all('li'):
            text = li.get_text(strip=True)
            if text:
                result["operating_info"].append(text)

    # 테이블 파싱
    table = soup.find('table')
    if not table:
        return result

    # 날짜 범위 추출
    date_span = soup.find('span', class_='tit_day')
    if date_span:
        result["date_range"] = date_span.get_text(strip=True)

    # 헤더에서 카테고리 추출
    # thead 안의 모든 행 확인
    all_rows = table.find_all('tr')
    for row in all_rows:
        ths = row.find_all('th')
        # 첫 번째 th가 "일자"인 행 찾기 (카테고리 헤더 행)
        if len(ths) > 1:
            first_th_text = ths[0].get_text(strip=True)
            if first_th_text == '일자':
                # 나머지 th들이 카테고리 (아침/점심/저녁 또는 한식/즉석/양식 등)
                for th in ths[1:]:
                    cat_text = th.get_text(strip=True)
                    if cat_text:
                        result["menu_categories"].append(cat_text)
                break

    # 일별 메뉴 추출
    rows = table.find_all('tr')
    for row in rows:
        th = row.find('th')
        tds = row.find_all('td')

        if th and tds:
            date_text = th.get_text(strip=True)
            # 날짜 형식 확인 (예: "03.02 (월)")
            if re.match(r'\d{2}\.\d{2}', date_text):
                day_menu = {
                    "date": date_text,
                    "menus": []
                }

                for td in tds:
                    # br 태그로 구분된 메뉴들 추출
                    menu_items = []
                    for content in td.contents:
                        if isinstance(content, str):
                            text = content.strip()
                            if text:
                                menu_items.append(text)
                        elif content.name == 'br':
                            continue
                        else:
                            text = content.get_text(strip=True)
                            if text:
                                menu_items.append(text)

                    # td의 텍스트를 br로 분리
                    td_text = td.get_text(separator='\n', strip=True)
                    if td_text:
                        menu_items = [item.strip() for item in td_text.split('\n') if item.strip()]

                    day_menu["menus"].append(menu_items)

                result["daily_menus"].append(day_menu)

    return result


async def fetch_cafeteria_menu(ca: str, day: Optional[str] = None) -> dict:
    """식단 페이지 가져오기"""
    url = f"https://info.sunmoon.ac.kr/PageN/content/activity_10.aspx?ca={ca}"
    if day:
        url += f"&day={day}"

    async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = await client.get(url, headers=headers)

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="식단 정보를 가져올 수 없습니다.")

        return parse_menu_html(response.text)


@router.get("/menu/{cafeteria_type}")
async def get_cafeteria_menu(cafeteria_type: str, day: Optional[str] = None):
    """
    식당별 식단 조회
    - cafeteria_type: student(학생회관), orange(오렌지), staff(교직원)
    - day: 날짜 (YYYYMMDD 형식, 선택)
    """
    if cafeteria_type not in CAFETERIA_CODES:
        raise HTTPException(status_code=400, detail="잘못된 식당 코드입니다. (student, orange, staff)")

    ca = CAFETERIA_CODES[cafeteria_type]
    menu_data = await fetch_cafeteria_menu(ca, day)
    menu_data["cafeteria_name"] = CAFETERIA_NAMES.get(ca, "")
    menu_data["cafeteria_type"] = cafeteria_type

    return menu_data


@router.get("/list")
async def get_cafeteria_list():
    """식당 목록 조회"""
    return [
        {"type": "student", "name": "학생회관 식당", "code": "003"},
        {"type": "orange", "name": "오렌지식당", "code": "002"},
        {"type": "staff", "name": "본관 교직원식당", "code": "001"},
    ]
