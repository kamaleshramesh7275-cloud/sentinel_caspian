"""
Sentinel — Autonomous Incident Commander
FastAPI application entry point.

Lifespan:
- Initializes DB (creates tables if not migrated yet)
- Seeds escalation rules if empty
- Starts APScheduler escalation background job
- Initializes Caspian CommClient with unified @on_message handler
"""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, AsyncSessionLocal
from app.routers import webhook, reply, incidents, demo
from app.services.escalation import run_escalation_check

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("sentinel")

# Global scheduler reference
scheduler: Optional[AsyncIOScheduler] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown."""
    global scheduler

    logger.info("🛡️  Sentinel starting up...")

    # 1. Initialize DB
    logger.info("📦 Initializing database...")
    await init_db()

    # 2. Seed escalation rules
    logger.info("🌱 Seeding escalation rules...")
    await _seed_escalation_rules()

    # 3. Start APScheduler escalation timer
    logger.info(f"⏰ Starting escalation timer (every {settings.escalation_interval_seconds}s)...")
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_escalation_check,
        "interval",
        seconds=settings.escalation_interval_seconds,
        id="escalation_check",
        max_instances=1,  # prevent overlap
    )
    scheduler.start()

    # 4. Initialize Caspian CommClient (if key is configured)
    await _init_caspian()

    logger.info("✅ Sentinel is ready. It doesn't just tell you what's happening.")
    logger.info("   It decides who needs to know, how urgently, and follows up until it's resolved.")

    yield

    # Shutdown
    logger.info("🛑 Sentinel shutting down...")
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)


async def _seed_escalation_rules():
    """Seed escalation_rules table with defaults if empty."""
    from sqlalchemy import select, func
    from app.models import EscalationRule

    async with AsyncSessionLocal() as db:
        count_result = await db.execute(select(func.count()).select_from(EscalationRule))
        count = count_result.scalar_one()
        if count > 0:
            logger.info(f"   Escalation rules already exist ({count} rules) — skipping seed.")
            return

        rules = [
            EscalationRule(
                severity="low",
                time_to_ack_minutes=60,
                escalation_path=["slack"],
            ),
            EscalationRule(
                severity="medium",
                time_to_ack_minutes=15,
                escalation_path=["slack", "telegram"],
            ),
            EscalationRule(
                severity="high",
                time_to_ack_minutes=5,
                escalation_path=["slack", "telegram"],
            ),
            EscalationRule(
                severity="critical",
                time_to_ack_minutes=2,
                escalation_path=["slack", "telegram", "email"],
            ),
        ]
        db.add_all(rules)
        await db.commit()
        logger.info("   ✅ Seeded 4 escalation rules (low/medium/high/critical)")


async def _init_caspian():
    """Initialize Caspian CommClient and register unified message handler."""
    if not settings.caspian_api_key:
        logger.warning("⚠️  CASPIAN_API_KEY not set — Caspian channel handler disabled.")
        logger.warning("   Direct Slack/Telegram/Email SDKs will still be used for outbound notifications.")
        return

    try:
        from caspian_sdk import CommClient
        from app.caspian_handler import init_caspian_handler

        client = CommClient(
            api_key=settings.caspian_api_key,
            base_url=settings.caspian_base_url,
        )

        # Helper to execute Caspian connect methods whether they return coroutines or dicts
        async def _safe_connect(func, **kwargs):
            res = func(**kwargs)
            if hasattr(res, "__await__"):
                await res
            return res

        # Connect channels that are configured (only if real token is set, not placeholders)
        if settings.slack_bot_token and not settings.slack_bot_token.startswith("xoxb-YOUR"):
            await _safe_connect(client.connect_slack, token=settings.slack_bot_token, username=settings.caspian_agent_username)
            logger.info("   ✅ Caspian: Slack connected")

        if settings.telegram_bot_token and "YOUR_TELEGRAM" not in settings.telegram_bot_token:
            await _safe_connect(client.connect_telegram, bot_token=settings.telegram_bot_token, username=settings.caspian_agent_username)
            logger.info("   ✅ Caspian: Telegram connected")

        if settings.resend_api_key and "YOUR_RESEND" not in settings.resend_api_key:
            await _safe_connect(client.connect_email, api_key=settings.resend_api_key, username=settings.caspian_agent_username)
            logger.info("   ✅ Caspian: Email connected")

        # Register unified @on_message handler
        init_caspian_handler(client)

        # Start Caspian listener in a background thread (non-blocking)
        thread = threading.Thread(target=client.listen, daemon=True)
        thread.start()

        logger.info("✅ Caspian CommClient initialized — unified handler active across all channels")

    except ImportError:
        logger.warning("⚠️  caspian-sdk not installed — run: pip install caspian-sdk")
    except Exception as e:
        logger.error(f"❌ Caspian initialization failed: {e}")


# ── FastAPI App ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Sentinel — Autonomous Incident Commander",
    description=(
        "It doesn't just tell you what's happening. "
        "It decides who needs to know, how urgently, and follows up until it's resolved."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import webhook, reply, incidents, demo, ws, remediation

# Mount routers
app.include_router(webhook.router)
app.include_router(reply.router)
app.include_router(incidents.router)
app.include_router(demo.router)
app.include_router(ws.router)
app.include_router(remediation.router)


@app.get("/health", tags=["Health"])
async def health():
    """Health check endpoint."""
    from app.schemas import HealthResponse
    return HealthResponse(
        status="ok",
        version="1.0.0",
        db="connected",
        channels_available=settings.available_channels,
    )


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": "Sentinel",
        "tagline": "Autonomous Incident Commander",
        "version": "1.0.0",
        "docs": "/docs",
        "team": "Nova Legions",
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
