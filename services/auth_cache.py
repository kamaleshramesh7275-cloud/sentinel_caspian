"""
Auth Cache Microservice (services/auth_cache.py)
Vulnerable to: Cache Stampede (Dogpiling / Thundering Herd)

Under high traffic, when session token cache expires, hundreds of concurrent
coroutines simultaneously miss cache and blast downstream PostgreSQL database.
"""

from __future__ import annotations
import asyncio
from typing import Optional, Any


class MockRedis:
    def __init__(self):
        self._cache: dict[str, Any] = {}
        self.miss_count: int = 0
        self.lock_active: bool = False

    async def get(self, key: str) -> Optional[str]:
        return self._cache.get(key)

    async def setex(self, key: str, ttl_seconds: int, value: str):
        self._cache[key] = value


redis_client = MockRedis()


# ❌ VULNERABLE IMPLEMENTATION: Missing singleflight mutex / distributed lock
# When key expires, 5,000 req/s bypass cache directly into DB connection pool
async def authenticate_session_token(token: str) -> dict[str, Any]:
    cached_user = await redis_client.get(f"session:{token}")
    if cached_user:
        return {"status": "authenticated", "user_id": cached_user, "from_cache": True}

    # Cache Miss - Stampede defect: missing distributed lock or probabilistic early refresh
    redis_client.miss_count += 1
    await asyncio.sleep(0.02)  # Simulates slow DB fetch
    user_data = f"usr_{token[:8]}"

    # Write back without concurrency control
    await redis_client.setex(f"session:{token}", 300, user_data)
    return {"status": "authenticated", "user_id": user_data, "from_cache": False}
