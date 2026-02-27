"""
Redis 캐싱 모듈
"""
import json
from typing import Optional, Any
from functools import wraps

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

# Redis 연결 설정
REDIS_URL = "redis://localhost:6379/0"

# Redis 클라이언트 (옵션)
_redis_client = None


def get_redis():
    """Redis 클라이언트 반환 (연결 실패 시 None)"""
    global _redis_client
    if not REDIS_AVAILABLE:
        return None

    if _redis_client is None:
        try:
            _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
            _redis_client.ping()
        except Exception:
            _redis_client = None

    return _redis_client


def cache_get(key: str) -> Optional[Any]:
    """캐시에서 값 조회"""
    client = get_redis()
    if not client:
        return None

    try:
        data = client.get(key)
        if data:
            return json.loads(data)
    except Exception:
        pass

    return None


def cache_set(key: str, value: Any, expire: int = 300):
    """캐시에 값 저장 (기본 5분)"""
    client = get_redis()
    if not client:
        return

    try:
        client.setex(key, expire, json.dumps(value, default=str))
    except Exception:
        pass


def cache_delete(key: str):
    """캐시에서 값 삭제"""
    client = get_redis()
    if not client:
        return

    try:
        client.delete(key)
    except Exception:
        pass


def cache_delete_pattern(pattern: str):
    """패턴에 맞는 키 모두 삭제"""
    client = get_redis()
    if not client:
        return

    try:
        keys = client.keys(pattern)
        if keys:
            client.delete(*keys)
    except Exception:
        pass


# 인메모리 캐시 (Redis 없을 때 대안)
_memory_cache = {}
_memory_cache_expiry = {}


def memory_cache_get(key: str) -> Optional[Any]:
    """인메모리 캐시에서 값 조회"""
    import time
    if key in _memory_cache:
        if _memory_cache_expiry.get(key, 0) > time.time():
            return _memory_cache[key]
        else:
            del _memory_cache[key]
            del _memory_cache_expiry[key]
    return None


def memory_cache_set(key: str, value: Any, expire: int = 300):
    """인메모리 캐시에 값 저장"""
    import time
    _memory_cache[key] = value
    _memory_cache_expiry[key] = time.time() + expire


def smart_cache_get(key: str) -> Optional[Any]:
    """Redis 또는 인메모리 캐시에서 조회"""
    result = cache_get(key)
    if result is not None:
        return result
    return memory_cache_get(key)


def smart_cache_set(key: str, value: Any, expire: int = 300):
    """Redis 또는 인메모리 캐시에 저장"""
    cache_set(key, value, expire)
    memory_cache_set(key, value, expire)


def cached(key_prefix: str, expire: int = 300):
    """캐싱 데코레이터"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 캐시 키 생성
            cache_key = f"{key_prefix}:{hash(str(args) + str(kwargs))}"

            # 캐시 확인
            cached_result = smart_cache_get(cache_key)
            if cached_result is not None:
                return cached_result

            # 함수 실행
            result = func(*args, **kwargs)

            # 캐시 저장
            smart_cache_set(cache_key, result, expire)

            return result
        return wrapper
    return decorator
