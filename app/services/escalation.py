"""
Escalation Service — APScheduler background job.

Runs every 60 seconds:
1. Queries all unresolved incidents (status NOT IN ['resolved', 'ack'])
2. Checks last_notified_at against escalation_rules.time_to_ack_minutes
3. Advances to next channel in escalation_path
4. Sends notification, increments escalation_count, logs to thread_context
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import Incident, EscalationRule, ThreadContext
from app.services.notifier import send_channel_notification

logger = logging.getLogger("sentinel.escalation")


async def run_escalation_check():
    """
    Main escalation job — called by APScheduler every N seconds.
    Creates its own DB session (not a FastAPI request context).
    """
    logger.info("[Escalation] Running escalation check...")
    async with AsyncSessionLocal() as db:
        try:
            await _process_escalations(db)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"[Escalation] Error during check: {e}", exc_info=True)


async def _process_escalations(db: AsyncSession):
    """Core escalation logic."""
    now = datetime.now(timezone.utc)

    # Fetch all unresolved, unacknowledged incidents
    stmt = select(Incident).where(
        Incident.status.in_(["open", "escalated"])
    )
    result = await db.execute(stmt)
    incidents = result.scalars().all()

    if not incidents:
        logger.debug("[Escalation] No active incidents to check.")
        return

    # Fetch all escalation rules
    rules_result = await db.execute(select(EscalationRule))
    all_rules = {r.severity: r for r in rules_result.scalars().all()}

    for incident in incidents:
        try:
            await _maybe_escalate(incident, all_rules, db, now)
        except Exception as e:
            logger.error(f"[Escalation] Failed to process incident {incident.id}: {e}")


async def _maybe_escalate(
    incident: Incident,
    rules: dict,
    db: AsyncSession,
    now: datetime,
):
    """Decide whether to escalate a single incident."""
    rule = rules.get(incident.severity)
    if not rule:
        logger.warning(f"[Escalation] No rule for severity={incident.severity}, skipping incident {incident.id}")
        return

    # Calculate time since last notification
    last_notified = incident.last_notified_at
    if last_notified is None:
        last_notified = incident.created_at
    if last_notified is None:
        return

    # SQLite returns naive datetimes, make it offset-aware for comparison
    if last_notified.tzinfo is None:
        last_notified = last_notified.replace(tzinfo=timezone.utc)

    elapsed_minutes = (now - last_notified).total_seconds() / 60

    if elapsed_minutes < rule.time_to_ack_minutes:
        logger.debug(
            f"[Escalation] Incident {str(incident.id)[:8]} — "
            f"{elapsed_minutes:.1f}min elapsed, threshold={rule.time_to_ack_minutes}min. No action."
        )
        return

    # Determine next channel
    escalation_path: list = rule.escalation_path
    current_channel = incident.current_channel
    
    # If already at the end of the escalation path and notified, avoid repeat spam
    current_idx = escalation_path.index(current_channel) if current_channel in escalation_path else -1
    if current_idx == len(escalation_path) - 1 and (incident.escalation_count or 0) >= len(escalation_path):
        logger.debug(
            f"[Escalation] Incident {str(incident.id)[:8]} reached end of escalation path ({current_channel}). Capping alerts."
        )
        return

    next_channel = _get_next_channel(escalation_path, current_channel)

    logger.info(
        f"[Escalation] ⏫ Incident {str(incident.id)[:8]} ({incident.severity}) "
        f"exceeded {rule.time_to_ack_minutes}min SLA. "
        f"Escalating: {current_channel} → {next_channel}"
    )

    # Send notification to next channel
    sent = await send_channel_notification(incident, next_channel)

    # Update incident
    incident.current_channel = next_channel
    incident.escalation_count = (incident.escalation_count or 0) + 1
    incident.status = "escalated"
    incident.last_notified_at = now
    db.add(incident)

    # Log escalation to thread_context
    log_entry = ThreadContext(
        incident_id=incident.id,
        channel=next_channel,
        sender="system",
        message=(
            f"Escalation triggered after {elapsed_minutes:.0f}min with no response. "
            f"Moved from {current_channel or 'none'} → {next_channel}. "
            f"Notification {'sent' if sent else 'FAILED'}."
        ),
        intent_parsed="escalation",
    )
    db.add(log_entry)

    # Real-time broadcast
    from app.services.broadcaster import broadcaster
    await broadcaster.broadcast(
        "incident_escalated",
        {
            "incident_id": str(incident.id),
            "status": incident.status,
            "current_channel": next_channel,
            "escalation_count": incident.escalation_count,
            "last_notified_at": now.isoformat(),
        },
    )


def _get_next_channel(escalation_path: list, current_channel: Optional[str]) -> str:
    """Get the next channel in the escalation path, cycling through."""
    if not escalation_path:
        return "slack"
    if current_channel not in escalation_path:
        return escalation_path[0]

    current_idx = escalation_path.index(current_channel)
    # Stay on last channel if we've exhausted the path
    next_idx = min(current_idx + 1, len(escalation_path) - 1)
    return escalation_path[next_idx]
