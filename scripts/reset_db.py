"""
Database Reset Utility — clears all incidents/events and re-seeds clean escalation rules.

Usage:
  python scripts/reset_db.py
"""

from __future__ import annotations

import asyncio
import os
import sys

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import delete
from app.database import AsyncSessionLocal, init_db
from app.models import Event, Incident, ThreadContext, EscalationRule


async def reset_database():
    print("=" * 60)
    print("🧹 SENTINEL DATABASE CLEAN-SLATE RESET")
    print("=" * 60)

    # Drop all and recreate to ensure full schema parity with latest models
    from app.database import engine, Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:

        print("🌱 Seeding clean default SLA escalation rules...", flush=True)
        rules = [
            EscalationRule(severity="low", time_to_ack_minutes=60, escalation_path=["slack"]),
            EscalationRule(severity="medium", time_to_ack_minutes=15, escalation_path=["slack", "telegram"]),
            EscalationRule(severity="high", time_to_ack_minutes=5, escalation_path=["slack", "telegram"]),
            EscalationRule(severity="critical", time_to_ack_minutes=2, escalation_path=["slack", "telegram", "email"]),
        ]
        db.add_all(rules)
        await db.commit()

    print("✅ Database successfully reset to clean state!")
    print("   • 0 active incidents")
    print("   • 4 default SLA escalation rules active\n")


if __name__ == "__main__":
    asyncio.run(reset_database())
