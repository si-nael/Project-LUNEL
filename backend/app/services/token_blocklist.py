"""Token revocation storage with an explicit development fallback.

Redis is the shared source of truth in production.  During local development
and unit tests, bringing the API down solely because Redis is absent makes the
rest of Lunel unnecessarily hard to exercise.  In that mode only, a process
local TTL map preserves logout semantics for the current worker.
"""

from datetime import datetime, timezone
from time import monotonic

from fastapi import HTTPException, status
from redis.exceptions import RedisError

from app.config import get_settings
from app.redis import redis_client

_local_blocklist: dict[str, datetime] = {}
_redis_retry_after = 0.0


def _local_is_blocked(token: str) -> bool:
    expires_at = _local_blocklist.get(token)
    if expires_at is None:
        return False
    if expires_at <= datetime.now(timezone.utc):
        _local_blocklist.pop(token, None)
        return False
    return True


async def is_token_blocked(token: str) -> bool:
    global _redis_retry_after
    if get_settings().debug and monotonic() < _redis_retry_after:
        return _local_is_blocked(token)
    try:
        return bool(await redis_client.get(f"blocklist:{token}"))
    except RedisError as exc:
        if not get_settings().debug:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Token revocation store is unavailable",
            ) from exc
        _redis_retry_after = monotonic() + 5
        return _local_is_blocked(token)


async def block_token(token: str, expires_at: datetime) -> None:
    global _redis_retry_after
    ttl = int((expires_at - datetime.now(timezone.utc)).total_seconds())
    if ttl <= 0:
        return
    if get_settings().debug and monotonic() < _redis_retry_after:
        _local_blocklist[token] = expires_at
        return
    try:
        await redis_client.setex(f"blocklist:{token}", ttl, "1")
    except RedisError as exc:
        if not get_settings().debug:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Token revocation store is unavailable",
            ) from exc
        _redis_retry_after = monotonic() + 5
        _local_blocklist[token] = expires_at
