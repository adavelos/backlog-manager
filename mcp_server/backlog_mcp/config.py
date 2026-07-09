import os

BASE_URL = os.environ.get("BACKLOG_API_BASE_URL", "http://localhost:8001/api")
TIMEOUT = float(os.environ.get("BACKLOG_API_TIMEOUT", "10"))
