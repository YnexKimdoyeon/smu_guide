# 선문가이드 (Sunmoon Guide)

선문대학교 학생들을 위한 통합 캠퍼스 가이드 앱

## 주요 기능

### 학사 관련
- **내 시간표**: 개인 시간표 등록 및 관리
- **E-러닝**: Canvas LMS 연동 (강의, 과제, 공지사항, 수강생 목록, 수업계획서)
- **장학금**: 마일리지 장학금 조회
- **학사 일정**: 학교 공지사항 및 학사 일정 확인

### 캠퍼스 생활
- **선문대 정보**: 학교 관련 정보 제공
- **셔틀버스**: 셔틀버스 시간표 조회
- **식단표**: 학식 메뉴 조회
- **전화번호부**: 학교 내 연락처 검색

### 소셜 기능
- **익명 채팅**: 학과별 익명 채팅방
- **랜덤 채팅**: 랜덤 1:1 채팅 매칭
- **등하교 메이트**: 같은 시간대 등하교 학생 매칭
- **급하게 매칭**: 급하게 동행 구하기
- **친구 관리**: 친구 추가 및 공강 시간 비교
- **동아리**: 동아리 등록 및 가입 신청
- **과팅**: 과팅 매칭 시스템

### 보상 시스템
- **도토리**: 출석체크 등으로 포인트 획득
- **도토리 상점**: 닉네임 색상, 칭호 등 구매
- **학과 랭킹**: 학과별 도토리 총합 랭킹
- **선물하기**: 친구에게 도토리 선물

### AI 기능
- **GPT 챗봇**: AI 기반 학교 정보 질의응답

## 기술 스택

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI, shadcn/ui
- **State Management**: Zustand

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.11+
- **Database**: MySQL (SQLAlchemy ORM)
- **WebSocket**: 실시간 채팅
- **Authentication**: JWT (python-jose)

### Infrastructure
- **Frontend Hosting**: Vercel
- **Backend Hosting**: AWS / 자체 서버
- **Push Notification**: OneSignal

## 프로젝트 구조

```
선문가이드/
├── app/                    # Next.js App Router 페이지
│   ├── admin/             # 관리자 페이지
│   ├── layout.tsx         # 루트 레이아웃
│   └── page.tsx           # 메인 페이지
├── components/            # React 컴포넌트
│   ├── dashboard.tsx      # 대시보드 (메인 화면)
│   ├── timetable-screen.tsx
│   ├── elearning-screen.tsx
│   ├── chat-screen.tsx
│   ├── commute-screen.tsx
│   ├── friends-screen.tsx
│   ├── community-screen.tsx
│   ├── dotori-shop.tsx
│   ├── chatbot.tsx
│   └── ui/                # shadcn/ui 컴포넌트
├── lib/                   # 유틸리티
│   ├── api.ts            # API 클라이언트
│   ├── store.ts          # Zustand 스토어
│   └── utils.ts          # 공통 유틸리티
├── backend/              # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py       # FastAPI 앱 진입점
│   │   ├── core/         # 설정, DB 연결
│   │   ├── models/       # SQLAlchemy 모델
│   │   ├── routers/      # API 라우터
│   │   │   ├── admin.py      # 관리자 API
│   │   │   ├── auth.py       # 인증 API
│   │   │   ├── canvas.py     # E-러닝 API
│   │   │   ├── chat.py       # 채팅 API
│   │   │   ├── commute.py    # 등하교 메이트 API
│   │   │   ├── dotori.py     # 도토리 API
│   │   │   ├── friend.py     # 친구 API
│   │   │   ├── meeting.py    # 과팅 API
│   │   │   ├── club.py       # 동아리 API
│   │   │   └── ...
│   │   └── services/     # 비즈니스 로직
│   └── requirements.txt
└── public/               # 정적 파일
```

## 설치 및 실행

### Frontend

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

### Backend

```bash
cd backend

# 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정
cp .env.example .env
# .env 파일 편집

# 개발 서버 실행
python run.py

# 프로덕션 실행
gunicorn -c gunicorn.conf.py app.main:app
```

## 환경 변수

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Backend (.env)
```env
DATABASE_URL=mysql+pymysql://user:password@localhost/sunmoon_guide
SECRET_KEY=your-secret-key
ADMIN_PASSWORD=your-admin-password
ONESIGNAL_APP_ID=your-onesignal-app-id
ONESIGNAL_API_KEY=your-onesignal-api-key
```

## API 문서

백엔드 실행 후 아래 URL에서 API 문서 확인:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
