"""
배너/팝업 관리 API
"""
import os
import base64
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter(prefix="/banner", tags=["배너"])

# 배너 데이터 저장 (메모리 - 실제 운영에서는 DB 사용 권장)
banner_data = {
    "main_banner": {
        "image_url": None,
        "link_url": None,
        "is_active": False,
        "updated_at": None
    },
    "popup": {
        "image_url": None,
        "link_url": None,
        "is_active": False,
        "title": "",
        "updated_at": None
    }
}

# 환경변수에서 비밀번호 가져오기
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "bang0622@")

# 활성 세션 (admin.py와 공유해야 하지만 간단히 별도 관리)
active_sessions: dict[str, datetime] = {}


def verify_admin_token(x_admin_token: Optional[str] = Header(None)) -> bool:
    """관리자 토큰 검증 (간단 버전)"""
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="관리자 인증이 필요합니다.")
    # admin.py의 세션과 연동하려면 공유 모듈 필요 - 여기서는 토큰 존재만 확인
    return True


class BannerUpdate(BaseModel):
    image_data: Optional[str] = None  # base64 이미지 데이터
    link_url: Optional[str] = None
    is_active: bool = True
    title: Optional[str] = None  # 팝업용


@router.get("/main")
async def get_main_banner():
    """메인 배너 조회 (공개)"""
    if not banner_data["main_banner"]["is_active"]:
        return {"is_active": False}
    return banner_data["main_banner"]


@router.get("/popup")
async def get_popup():
    """팝업 조회 (공개)"""
    if not banner_data["popup"]["is_active"]:
        return {"is_active": False}
    return banner_data["popup"]


@router.post("/main")
async def update_main_banner(
    request: BannerUpdate,
    _: bool = Depends(verify_admin_token)
):
    """메인 배너 업데이트 (관리자)"""
    if request.image_data:
        banner_data["main_banner"]["image_url"] = request.image_data
    if request.link_url is not None:
        banner_data["main_banner"]["link_url"] = request.link_url
    banner_data["main_banner"]["is_active"] = request.is_active
    banner_data["main_banner"]["updated_at"] = datetime.now().isoformat()

    return {"success": True, "message": "메인 배너가 업데이트되었습니다."}


@router.post("/popup")
async def update_popup(
    request: BannerUpdate,
    _: bool = Depends(verify_admin_token)
):
    """팝업 업데이트 (관리자)"""
    if request.image_data:
        banner_data["popup"]["image_url"] = request.image_data
    if request.link_url is not None:
        banner_data["popup"]["link_url"] = request.link_url
    if request.title is not None:
        banner_data["popup"]["title"] = request.title
    banner_data["popup"]["is_active"] = request.is_active
    banner_data["popup"]["updated_at"] = datetime.now().isoformat()

    return {"success": True, "message": "팝업이 업데이트되었습니다."}


@router.delete("/main")
async def delete_main_banner(_: bool = Depends(verify_admin_token)):
    """메인 배너 삭제 (관리자)"""
    banner_data["main_banner"] = {
        "image_url": None,
        "link_url": None,
        "is_active": False,
        "updated_at": None
    }
    return {"success": True, "message": "메인 배너가 삭제되었습니다."}


@router.delete("/popup")
async def delete_popup(_: bool = Depends(verify_admin_token)):
    """팝업 삭제 (관리자)"""
    banner_data["popup"] = {
        "image_url": None,
        "link_url": None,
        "is_active": False,
        "title": "",
        "updated_at": None
    }
    return {"success": True, "message": "팝업이 삭제되었습니다."}
