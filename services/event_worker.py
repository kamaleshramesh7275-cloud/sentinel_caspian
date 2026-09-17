"""
Event Ingestion Worker (services/event_worker.py)
Vulnerable to: Unbounded Async Task Accumulation (Container OOM Kill 137)

Background coroutines are spawned on each incoming Kafka event without backpressure,
consuming 100% of container memory (4GB limit).
"""

from __future__ import annotations
import asyncio
from typing import Any

# Global unbounded queue backlog
UNBOUNDED_QUEUE: list[dict[str, Any]] = []


# ❌ VULNERABLE IMPLEMENTATION: Missing asyncio.Semaphore backpressure
# Spawns fire-and-forget background tasks without concurrency ceiling
async def ingest_event_stream(events: list[dict[str, Any]]):
    for event in events:
        # BUG: Accumulates indefinitely in memory without bounded queue / worker pool
        UNBOUNDED_QUEUE.append(event)
        asyncio.create_task(_process_event_unbounded(event))


async def _process_event_unbounded(event: dict[str, Any]):
    await asyncio.sleep(0.5)  # Heavy analytics processing
    # Memory retained until garbage collection cycle
