import secrets
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"  # development, production

    # Database - 환경변수에서 로드
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = ""
    DB_PASSWORD: str = ""
    DB_NAME: str = ""

    # JWT - 환경변수에서 로드
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24시간

    # CORS - 허용할 도메인 목록
    CORS_ORIGINS: str = "*"  # 콤마로 구분: "https://example.com,https://app.example.com"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    @property
    def DATABASE_URL(self) -> str:
        password = quote_plus(self.DB_PASSWORD)
        return f"mysql+pymysql://{self.DB_USER}:{password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"

    @property
    def cors_origins_list(self) -> List[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    def get_secret_key(self) -> str:
        """시크릿 키 반환 - 없으면 랜덤 생성 (개발용)"""
        if self.SECRET_KEY:
            return self.SECRET_KEY
        # 개발 환경에서만 자동 생성 (프로덕션에서는 필수)
        if not self.is_production:
            return secrets.token_hex(32)
        raise ValueError("SECRET_KEY must be set in production environment")

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
