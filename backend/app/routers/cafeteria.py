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


def extract_menu_items(cell) -> List[str]:
    """셀에서 메뉴 항목 추출 (br 태그로 구분)"""
    # br 태그를 특수 구분자로 치환
    cell_html = str(cell)
    cell_html = re.sub(r'<br\s*/?>', '|||', cell_html, flags=re.IGNORECASE)

    # 다시 파싱해서 텍스트만 추출
    cell_soup = BeautifulSoup(cell_html, 'html.parser')
    text = cell_soup.get_text()

    # 구분자로 분리하고 정리
    items = [item.strip() for item in text.split('|||') if item.strip()]
    return items


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

    # thead에서 카테고리 추출
    thead = table.find('thead')
    if thead:
        header_rows = thead.find_all('tr')
        for row in header_rows:
            ths = row.find_all('th')
            # '일자' 헤더가 있는 행 찾기
            if ths and ths[0].get_text(strip=True) == '일자':
                for th in ths[1:]:
                    cat_text = th.get_text(strip=True)
                    if cat_text:
                        result["menu_categories"].append(cat_text)
                break

    # tbody에서 일별 메뉴 추출
    tbody = table.find('tbody')
    if tbody:
        rows = tbody.find_all('tr')
    else:
        rows = table.find_all('tr')

    for row in rows:
        # 첫 번째 셀에서 날짜 찾기
        first_cell = row.find(['th', 'td'])
        if not first_cell:
            continue

        date_text = first_cell.get_text(strip=True)

        # 날짜 형식 확인 (예: "03.02 (월)" 또는 "03.02(월)")
        if not re.match(r'\d{2}\.\d{2}', date_text):
            continue

        # 메뉴 셀들 찾기 (td만)
        menu_cells = row.find_all('td')

        if not menu_cells:
            continue

        day_menu = {
            "date": date_text,
            "menus": []
        }

        for td in menu_cells:
            menu_items = extract_menu_items(td)
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
