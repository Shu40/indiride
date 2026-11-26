import time
import threading
from typing import Dict, List, Optional, Callable
from fastapi import Request, HTTPException, status


class SlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding-window rate limiter for brute-force and abuse protection.
    Keyed by IP address, phone number, user ID, or custom key extractor.
    """

    def __init__(self, max_requests: int = 5, window_seconds: int = 60, name: str = "rate_limit"):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.name = name
        self.lock = threading.Lock()
        self.history: Dict[str, List[float]] = {}

    def _get_client_identifier(self, request: Request) -> str:
        # Check forwarded headers for proxies
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "127.0.0.1"
        return f"{self.name}:{ip}"

    def check(self, key: str) -> None:
        now = time.time()
        cutoff = now - self.window_seconds

        with self.lock:
            timestamps = self.history.get(key, [])
            # Filter out timestamps outside window
            valid_timestamps = [t for t in timestamps if t > cutoff]

            if len(valid_timestamps) >= self.max_requests:
                oldest = valid_timestamps[0]
                retry_after = max(1, int(self.window_seconds - (now - oldest)))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded for {self.name}. Maximum {self.max_requests} requests per {self.window_seconds}s. Please retry in {retry_after}s.",
                    headers={"Retry-After": str(retry_after)}
                )

            valid_timestamps.append(now)
            self.history[key] = valid_timestamps

    def cleanup(self) -> None:
        """Periodic cleanup of stale keys to prevent memory growth."""
        now = time.time()
        cutoff = now - self.window_seconds
        with self.lock:
            stale_keys = [k for k, v in self.history.items() if not v or v[-1] <= cutoff]
            for k in stale_keys:
                del self.history[k]

    def __call__(self, request: Request) -> None:
        key = self._get_client_identifier(request)
        self.check(key)


# Pre-configured standard limiters
auth_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60, name="auth_login")
otp_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60, name="otp_endpoint")
booking_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=60, name="booking_create")
account_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60, name="sensitive_account_change")
