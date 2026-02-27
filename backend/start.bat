@echo off
chcp 65001 > nul
echo ========================================
echo    선문대학교 가이드 백엔드 서버
echo ========================================
echo.

cd /d "%~dp0"

:: 가상환경 확인 및 생성
if not exist "venv" (
    echo [1/4] 가상환경 생성 중...
    python -m venv venv
    echo 가상환경 생성 완료!
) else (
    echo [1/4] 가상환경 이미 존재함
)

echo.
echo [2/4] 가상환경 활성화 중...
call venv\Scripts\activate.bat

echo.
echo [3/4] 패키지 설치 중...
pip install -r requirements.txt -q

echo.
echo [4/4] 데이터베이스 초기화 및 서버 시작...
python init_db.py

echo.
echo ========================================
echo 서버 시작! http://localhost:8000
echo API 문서: http://localhost:8000/docs
echo 테스트 계정: 학번 20230001 / 비번 1234
echo 종료하려면 Ctrl+C
echo ========================================
echo.

python run.py

pause
