"""
Seed script — seeds the escalation_rules table with default values.
Run with: python scripts/seed_db.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func
from app.database import AsyncSessionLocal, init_db
from app.models import EscalationRule


DEFAULT_RULES = [
    {
        "severity": "low",
        "time_to_ack_minutes": 60,
        "escalation_path": ["slack"],
    },
    {
        "severity": "medium",
        "time_to_ack_minutes": 15,
        "escalation_path": ["slack", "telegram"],
    },
    {
        "severity": "high",
        "time_to_ack_minutes": 5,
        "escalation_path": ["slack", "telegram"],
    },
    {
        "severity": "critical",
        "time_to_ack_minutes": 2,
        "escalation_path": ["slack", "telegram", "email"],
    },
]


async def seed():
    print("🌱 Seeding Sentinel database...")
    await init_db()

    async with AsyncSessionLocal() as db:
        count_result = await db.execute(select(func.count()).select_from(EscalationRule))
        count = count_result.scalar_one()

        if count > 0:
            print(f"   ✓ Escalation rules already exist ({count} rules) — skipping")
            return

        for rule_data in DEFAULT_RULES:
            rule = EscalationRule(**rule_data)
            db.add(rule)
            print(f"   + Adding rule: {rule_data['severity']} → {rule_data['escalation_path']} / {rule_data['time_to_ack_minutes']}min SLA")

        await db.commit()
        print("✅ Seeded 4 escalation rules successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
