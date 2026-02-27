# Gunicorn 설정 파일
import multiprocessing

# 서버 소켓
bind = "0.0.0.0:8000"
backlog = 2048

# 워커 프로세스
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 5000
max_requests_jitter = 500
timeout = 120
keepalive = 5

# 프로세스 이름
proc_name = "sunmoon-guide"

# 로깅
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# 개발 환경에서는 리로드 활성화
reload = False

# 그레이스풀 재시작
graceful_timeout = 30

# 프리로드 (메모리 공유)
preload_app = True
