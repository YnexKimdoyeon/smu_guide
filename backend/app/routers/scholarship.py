"""
장학금 마일리지 API
"""
import httpx
from typing import Optional, Dict
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from bs4 import BeautifulSoup

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from sqlalchemy.orm import Session

router = APIRouter(prefix="/scholarship", tags=["장학금"])

# folio 세션 캐시 (user_id -> credentials)
folio_credentials_cache: Dict[int, dict] = {}

FOLIO_LOGIN_URL = "https://folio.sunmoon.ac.kr/hmpg/com/login/LoginConfirm.do"
FOLIO_MILEAGE_URL = "https://folio.sunmoon.ac.kr/hmpg/efo/album/mlg/MlgList.do"


class MileageData(BaseModel):
    s_subject: int = 0  # S-교과목
    s_self_diagnosis: int = 0  # S-자기진단
    s_career_counseling: int = 0  # S-취업상담
    s_certification: int = 0  # S-자격증취득
    s_extracurricular: int = 0  # S-비교과활동
    s_total: int = 0

    t_subject: int = 0  # T-교과목
    t_awards: int = 0  # T-수상경력
    t_extracurricular: int = 0  # T-비교과활동
    t_total: int = 0

    a_subject: int = 0  # A-교과목
    a_volunteer: int = 0  # A-봉사활동
    a_language_test: int = 0  # A-어학시험
    a_language_training: int = 0  # A-어학연수
    a_internship: int = 0  # A-현장실습·인턴십
    a_extracurricular: int = 0  # A-비교과활동
    a_total: int = 0

    r_subject: int = 0  # R-교과목
    r_student_council: int = 0  # R-학생회활동
    r_club: int = 0  # R-동아리활동
    r_extracurricular: int = 0  # R-비교과활동
    r_total: int = 0

    total: int = 0


def parse_mileage_html(html: str) -> MileageData:
    """마일리지 HTML 파싱"""
    soup = BeautifulSoup(html, 'html.parser')

    data = MileageData()

    def get_value(td) -> int:
        text = td.get_text(strip=True)
        try:
            return int(text)
        except:
            return 0

    # 방법 1: tbody id='tbMileageList'에서 찾기
    tbody = soup.find('tbody', id='tbMileageList')
    if tbody:
        tr = tbody.find('tr')
        if tr:
            tds = tr.find_all('td')
            if len(tds) >= 19:
                return parse_tds(tds, data, get_value)

    # 방법 2: class='a_C'인 td들 직접 찾기
    tds = soup.find_all('td', class_='a_C')
    if len(tds) >= 19:
        return parse_tds(tds, data, get_value)

    # 방법 3: 모든 tr에서 td 19개 이상 있는 행 찾기
    for tr in soup.find_all('tr'):
        tds = tr.find_all('td')
        if len(tds) >= 19:
            return parse_tds(tds, data, get_value)

    return data


def parse_tds(tds, data: MileageData, get_value) -> MileageData:
    """td 리스트에서 마일리지 데이터 추출"""
    # S 영역 (5개)
    data.s_subject = get_value(tds[0])
    data.s_self_diagnosis = get_value(tds[1])
    data.s_career_counseling = get_value(tds[2])
    data.s_certification = get_value(tds[3])
    data.s_extracurricular = get_value(tds[4])
    data.s_total = data.s_subject + data.s_self_diagnosis + data.s_career_counseling + data.s_certification + data.s_extracurricular

    # T 영역 (3개)
    data.t_subject = get_value(tds[5])
    data.t_awards = get_value(tds[6])
    data.t_extracurricular = get_value(tds[7])
    data.t_total = data.t_subject + data.t_awards + data.t_extracurricular

    # A 영역 (6개)
    data.a_subject = get_value(tds[8])
    data.a_volunteer = get_value(tds[9])
    data.a_language_test = get_value(tds[10])
    data.a_language_training = get_value(tds[11])
    data.a_internship = get_value(tds[12])
    data.a_extracurricular = get_value(tds[13])
    data.a_total = data.a_subject + data.a_volunteer + data.a_language_test + data.a_language_training + data.a_internship + data.a_extracurricular

    # R 영역 (4개)
    data.r_subject = get_value(tds[14])
    data.r_student_council = get_value(tds[15])
    data.r_club = get_value(tds[16])
    data.r_extracurricular = get_value(tds[17])
    data.r_total = data.r_subject + data.r_student_council + data.r_club + data.r_extracurricular

    # 합계
    data.total = get_value(tds[18])

    return data


async def login_folio(client: httpx.AsyncClient, login_id: str, password: str) -> bool:
    """folio 로그인"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
    }

    login_data = {
        'rtnUrl': '',
        'bbsSn': '',
        'loginId': login_id,
        'loginPassword': password
    }

    response = await client.post(FOLIO_LOGIN_URL, headers=headers, data=login_data)
    # 로그인 성공 여부 확인 (쿠키가 설정되면 성공)
    return response.status_code == 200


@router.get("/mileage")
async def get_mileage(
    year: int = 2025,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    마일리지 조회
    - year: 조회 연도 (2025, 2026 등)
    """
    # 저장된 자격증명 확인
    credentials = folio_credentials_cache.get(current_user.id)
    if not credentials:
        raise HTTPException(status_code=401, detail="다시 로그인해주세요.")

    async with httpx.AsyncClient(verify=False, timeout=30.0, follow_redirects=True) as client:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
        }

        try:
            # 1. folio 로그인
            login_success = await login_folio(client, credentials['login_id'], credentials['password'])
            if not login_success:
                raise HTTPException(status_code=401, detail="포트폴리오 로그인 실패")

            # 2. 마일리지 조회 (세션 쿠키 자동 사용)
            mileage_data_form = {
                'userId': '',
                'year': str(year)
            }

            response = await client.post(FOLIO_MILEAGE_URL, headers=headers, data=mileage_data_form)

            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="마일리지 정보를 가져올 수 없습니다.")

            mileage_data = parse_mileage_html(response.text)

            return {
                "year": year,
                "student_id": current_user.student_id,
                "data": mileage_data.model_dump()
            }
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"요청 실패: {str(e)}")
