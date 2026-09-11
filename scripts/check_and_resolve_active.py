import asyncio
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from app.database import AsyncSessionLocal
from sqlalchemy import select, update
from app.models import Incident


async def main():
    async with AsyncSessionLocal() as session:
        res = await session.execute(
            select(Incident).where(Incident.status.in_(["open", "escalated"]))
        )
        incidents = res.scalars().all()
        print(f"Found {len(incidents)} active unacknowledged incidents:")
        for inc in incidents:
            print(f"  - [{str(inc.id)[:8]}] {inc.title} (severity={inc.severity}, status={inc.status}, esc_count={inc.escalation_count})")

        if incidents:
            # Mark all active demo incidents as resolved so background workers immediately stop
            await session.execute(
                update(Incident)
                .where(Incident.status.in_(["open", "escalated"]))
                .values(status="resolved")
            )
            await session.commit()
            print(f"\n[DONE] Successfully resolved all {len(incidents)} active incidents.")
        else:
            print("No active incidents pending.")


if __name__ == "__main__":
    asyncio.run(main())
