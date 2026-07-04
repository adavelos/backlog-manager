import time


def now_ms() -> int:
    """Current time in epoch milliseconds, matching the frontend's Date.now()."""
    return int(time.time() * 1000)
