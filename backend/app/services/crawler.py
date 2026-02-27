"""
선문대학교 공지사항 크롤러
https://lily.sunmoon.ac.kr/Page2/Story/Notice.aspx
"""
import re
import asyncio
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from app.core.database import SessionLocal
from app.models.announcement import Announcement


BASE_URL = "https://lily.sunmoon.ac.kr/Page2/Story/Notice.aspx"
VIEW_URL = "https://lily.sunmoon.ac.kr/Page2/Story/Notice_view.aspx"


def clean_text(text: str) -> str:
    """특수 문자 정리 및 MySQL 호환성 보장"""
    import re

    # 문제가 되는 유니코드 문자들을 제거하거나 변환
    # \x00-\x1f: 제어 문자들 (탭, 개행 제외)
    # 탭(\x09), 개행(\x0a), 캐리지리턴(\x0d)은 유지
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

    # NBSP 및 특수 공백을 일반 공백으로
    text = text.replace('\u00a0', ' ')
    text = text.replace('\u3000', ' ')

    # Zero-width 문자들 제거
    text = re.sub(r'[\u200b-\u200f\u2028-\u202f\ufeff]', '', text)

    return text


async def fetch_notice_content(client: httpx.AsyncClient, url: str) -> Optional[str]:
    """공지사항 상세 페이지에서 본문 내용 크롤링"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = await client.get(url, headers=headers, timeout=30.0)
        soup = BeautifulSoup(response.text, 'lxml')

        # 본문 내용 추출 (view_con 클래스)
        content_td = soup.find('td', class_='view_con')
        if content_td:
            # 이미지 src를 절대 경로로 변환
            for img in content_td.find_all('img'):
                src = img.get('src', '')
                if src and not src.startswith('http'):
                    if src.startswith('/'):
                        img['src'] = f"https://lily.sunmoon.ac.kr{src}"
                    else:
                        img['src'] = f"https://lily.sunmoon.ac.kr/{src}"

            # 링크도 절대 경로로 변환
            for a in content_td.find_all('a'):
                href = a.get('href', '')
                if href and not href.startswith('http') and not href.startswith('mailto:'):
                    if href.startswith('/'):
                        a['href'] = f"https://lily.sunmoon.ac.kr{href}"
                    else:
                        a['href'] = f"https://lily.sunmoon.ac.kr/{href}"

            content_html = str(content_td.decode_contents())
            return clean_text(content_html)

        return None
    except Exception as e:
        print(f"상세 페이지 크롤링 오류 ({url}): {e}")
        return None


def extract_form_data(html: str) -> Dict[str, str]:
    """HTML에서 ASP.NET 폼 데이터 추출"""
    soup = BeautifulSoup(html, 'html.parser')

    form_data = {}

    # Hidden fields 추출
    hidden_fields = [
        '__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION',
        '__SCROLLPOSITIONX', '__SCROLLPOSITIONY',
        'ctl00$ContentPlaceHolder_Main$BoardList$hidBoardCode',
        'ctl00$ContentPlaceHolder_Main$BoardList$txtSearch',
        'ctl00$ContentPlaceHolder_Main$BoardList$pagPager$hidItemTotal',
        'ctl00$ContentPlaceHolder_Main$BoardList$pagPager$hidCurPage',
        'ctl00$ContentPlaceHolder_Main$BoardList$pagPager$hidItemInOnePage',
        'ctl00$ContentPlaceHolder_Main$BoardList$pagPager$hidPagesInScreen'
    ]

    for field in hidden_fields:
        element = soup.find('input', {'name': field})
        if element:
            form_data[field] = element.get('value', '')

    return form_data


def parse_notices(html: str) -> List[Dict]:
    """HTML에서 공지사항 목록 파싱"""
    soup = BeautifulSoup(html, 'html.parser')
    notices = []

    table = soup.find('div', class_='table_list')
    if not table:
        return notices

    rows = table.find('tbody')
    if not rows:
        return notices

    for row in rows.find_all('tr'):
        cols = row.find_all('td')
        if len(cols) < 6:
            continue

        try:
            # 번호
            num_text = cols[0].get_text(strip=True)
            if not num_text.isdigit():
                continue
            notice_no = int(num_text)

            # 카테고리
            category_span = cols[1].find('span', class_='cate')
            category = category_span.get_text(strip=True) if category_span else "일반"

            # 제목과 링크
            title_td = cols[2]
            title_link = title_td.find('a')
            if not title_link:
                continue

            title = title_link.get_text(strip=True)
            href = title_link.get('href', '')

            # URL에서 no와 cp 파라미터 추출
            no_match = re.search(r'no=(\d+)', href)
            cp_match = re.search(r'cp=(\d+)', href)

            if no_match:
                external_url = f"{VIEW_URL}?no={no_match.group(1)}"
                if cp_match:
                    external_url += f"&cp={cp_match.group(1)}"
            else:
                external_url = f"https://lily.sunmoon.ac.kr{href}" if href.startswith('/') else href

            # 작성자
            writer = cols[3].get_text(strip=True)

            # 날짜
            notice_date = cols[4].get_text(strip=True)

            # 조회수
            views_text = cols[5].get_text(strip=True)
            views = int(views_text) if views_text.isdigit() else 0

            notices.append({
                'notice_no': notice_no,
                'title': title,
                'category': category,
                'writer': writer,
                'notice_date': notice_date,
                'views': views,
                'external_url': external_url
            })
        except Exception as e:
            print(f"공지 파싱 오류: {e}")
            continue

    return notices


async def fetch_page(client: httpx.AsyncClient, page: int, form_data: Dict[str, str] = None) -> str:
    """특정 페이지 가져오기"""
    if page == 1 or form_data is None:
        # 첫 페이지는 GET 요청
        response = await client.get(BASE_URL, timeout=30.0)
        return response.text

    # 페이지 번호에 맞는 버튼 이름 생성
    btn_num = f"ctl00$ContentPlaceHolder_Main$BoardList$pagPager$btnNum{page:02d}"

    post_data = {
        '__EVENTTARGET': btn_num,
        '__EVENTARGUMENT': '',
        **form_data
    }

    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': BASE_URL,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    response = await client.post(BASE_URL, data=post_data, headers=headers, timeout=30.0)
    return response.text


async def crawl_notices(max_pages: int = 5) -> List[Dict]:
    """공지사항 크롤링 (1~max_pages 페이지)"""
    all_notices = []

    async with httpx.AsyncClient() as client:
        # 첫 페이지 가져오기
        print("크롤링 시작: 페이지 1")
        html = await fetch_page(client, 1)
        notices = parse_notices(html)
        all_notices.extend(notices)
        print(f"페이지 1: {len(notices)}개 공지 수집")

        # 폼 데이터 추출
        form_data = extract_form_data(html)

        # 나머지 페이지 가져오기
        for page in range(2, max_pages + 1):
            try:
                print(f"크롤링: 페이지 {page}")
                html = await fetch_page(client, page, form_data)
                notices = parse_notices(html)
                all_notices.extend(notices)
                print(f"페이지 {page}: {len(notices)}개 공지 수집")

                # 폼 데이터 업데이트
                form_data = extract_form_data(html)
            except Exception as e:
                print(f"페이지 {page} 크롤링 오류: {e}")
                continue

        # 각 공지의 상세 내용 크롤링
        print(f"상세 내용 크롤링 시작 ({len(all_notices)}개)")
        for i, notice in enumerate(all_notices):
            if notice.get('external_url'):
                content = await fetch_notice_content(client, notice['external_url'])
                notice['content'] = content
                if (i + 1) % 10 == 0:
                    print(f"상세 내용 크롤링: {i + 1}/{len(all_notices)}")
                # 서버 부하 방지를 위한 짧은 대기
                await asyncio.sleep(0.2)

    return all_notices


def save_notices_to_db(notices: List[Dict]):
    """공지사항을 DB에 저장 (덮어쓰기)"""
    db = SessionLocal()
    try:
        # 기존 공지사항 모두 삭제
        db.query(Announcement).delete()
        db.commit()

        # 새 공지사항 저장
        for notice in notices:
            announcement = Announcement(
                notice_no=notice['notice_no'],
                title=notice['title'],
                content=notice.get('content'),
                category=notice['category'],
                writer=notice['writer'],
                notice_date=notice['notice_date'],
                views=notice['views'],
                external_url=notice['external_url'],
                is_new=1
            )
            db.add(announcement)

        db.commit()
        print(f"총 {len(notices)}개 공지사항 저장 완료")
    except Exception as e:
        print(f"DB 저장 오류: {e}")
        db.rollback()
    finally:
        db.close()


async def run_crawler():
    """크롤러 실행"""
    print("=" * 50)
    print("선문대 공지사항 크롤링 시작")
    print("=" * 50)

    try:
        notices = await crawl_notices(max_pages=5)
        if notices:
            save_notices_to_db(notices)
            print(f"크롤링 완료: 총 {len(notices)}개 공지")
        else:
            print("크롤링된 공지가 없습니다")
    except Exception as e:
        print(f"크롤러 오류: {e}")


def sync_run_crawler():
    """동기 버전 크롤러 실행 (APScheduler용)"""
    import asyncio

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    loop.run_until_complete(run_crawler())
