"""
Webhook Dispatcher (services/webhook_dispatcher.py)
Vulnerable to: Synchronous Retry Storm and Worker Thread Starvation

When 3rd-party webhook endpoint returns 504, the dispatcher retries immediately
in a tight loop without exponential backoff or full jitter, blocking the worker pool.
"""

from __future__ import annotations
import asyncio
from typing import Any


# ❌ VULNERABLE IMPLEMENTATION: Tight synchronous retry loop without backoff/jitter
async def dispatch_customer_webhook(url: str, payload: dict[str, Any], max_attempts: int = 5) -> bool:
    for attempt in range(max_attempts):
        try:
            # Emulates 3rd-party timeout (504 Gateway Timeout)
            await asyncio.sleep(0.05)
            raise TimeoutError("Third-party webhook endpoint timed out (504)")
        except TimeoutError:
            if attempt == max_attempts - 1:
                return False
            # BUG: Immediate retry without exponential backoff or jitter creates retry storm
            continue
    return True
