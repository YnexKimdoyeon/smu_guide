#!/bin/bash
# 프로덕션 서버 시작 스크립트

# 가상환경 활성화
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# Gunicorn으로 서버 시작
gunicorn app.main:app -c gunicorn.conf.py
