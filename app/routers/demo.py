"""
POST /demo/chaos — Demo endpoint that fires a synthetic multi-event burst.

Designed for live hackathon demo:
- Fires 3 synthetic events with the same error_signature in rapid succession
- Triggers clustering detection + severity override in the agent
- Returns full agent reasoning so judges can see the logic

Bypasses API key auth (for demo convenience).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Event, Incident, ThreadContext, EscalationRule
from app.schemas import ChaosResponse
from app.agents.severity_agent import run_severity_agent
from app.services.notifier import send_channel_notification

logger = logging.getLogger("sentinel.demo")
router = APIRouter()

CHAOS_SCENARIOS = [
    {
        "source": "github-actions",
        "error_signature": "payment-service::deploy::exit-code-1",
        "title": "Payment Service Deploy Failed",
        "payload": {
            "workflow": "Deploy Production",
            "job": "deploy-payment-service",
            "step": "Run migrations",
            "error": "ERROR:  relation \"payment_transactions\" already exists",
            "stack_trace": "alembic.util.exc.CommandError: Can't locate revision identified by '3a8f2b1c'",
            "branch": "main",
            "commit": "abc1234",
            "repo": "org/payment-service",
            "runner": "ubuntu-latest",
        },
    },
    {
        "source": "datadog",
        "error_signature": "payment-service::deploy::exit-code-1",
        "title": "Payment API Error Rate Spike",
        "payload": {
            "monitor": "Payment API - Error Rate",
            "status": "Alert",
            "metric": "trace.web.request.errors",
            "value": "18.7%",
            "threshold": "5%",
            "service": "payment-service",
            "env": "production",
            "message": "Error rate 18.7% exceeds 5% threshold for 3 consecutive minutes",
        },
    },
    {
        "source": "github-actions",
        "error_signature": "payment-service::deploy::exit-code-1",
        "title": "Payment Service Health Check Failing",
        "payload": {
            "workflow": "Health Check",
            "job": "smoke-test",
            "step": "POST /api/payments",
            "error": "HTTP 503 Service Unavailable",
            "response_body": '{"error": "database connection pool exhausted"}',
            "endpoint": "https://api.prod.example.com/api/payments",
            "latency_p99_ms": 12400,
            "consecutive_failures": 3,
        },
    },
]


@router.post("/demo/chaos", response_model=ChaosResponse, tags=["Demo"])
async def trigger_chaos(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Fire a synthetic multi-event burst to demonstrate Sentinel's clustering
    and severity override capabilities.

    Fires 3 events with the same error_signature within seconds — triggering
    the agent's clustering override and bumping severity.
    """
    logger.info("[Demo] 🔥 CHAOS MODE ACTIVATED — firing synthetic incident burst")

    incident = None
    severity = None
    reasoning = None
    events_created = 0

    for i, scenario in enumerate(CHAOS_SCENARIOS):
        # Create event
        event = Event(
            source=scenario["source"],
            raw_payload={"title": scenario["title"], **scenario["payload"]},
            error_signature=scenario["error_signature"],
        )
        db.add(event)
        await db.flush()
        events_created += 1

        logger.info(f"[Demo] Event {i+1}/3 created: {scenario['title']}")

        if incident is None:
            # First event — create incident
            incident = Incident(
                title=scenario["title"],
                severity="medium",
                status="open",
            )
            db.add(incident)
            await db.flush()

        # Always attach event to incident
        event.incident_id = incident.id
        db.add(event)

        # Run severity agent on each event (the 3rd will trigger clustering override)
        severity, reasoning, override = await run_severity_agent(
            new_event=event,
            db=db,
        )

        logger.info(
            f"[Demo] Event {i+1}/3 → severity={severity} override={override}\n"
            f"  Reasoning: {reasoning[:200]}"
        )

        # Update incident with latest severity assessment
        incident.severity = severity
        incident.agent_reasoning = reasoning
        db.add(incident)

        # Log to thread_context
        thread_entry = ThreadContext(
            incident_id=incident.id,
            channel="system",
            sender="sentinel-agent",
            message=(
                f"[Event {i+1}/3] {scenario['source']} event received. "
                f"Severity: {severity.upper()}. "
                f"{'🚨 CLUSTERING OVERRIDE TRIGGERED — repeated error pattern detected!' if override else ''} "
                f"{reasoning}"
            ),
            intent_parsed="severity_assessment",
        )
        db.add(thread_entry)

    # Determine initial channel and update incident
    if incident:
        channel = await _get_initial_channel(severity or "high", db)
        incident.current_channel = channel
        db.add(incident)

        # Send notification in background (guarded by quota manager for demo runs)
        background_tasks.add_task(send_channel_notification, incident, channel, is_demo=True)

        logger.info(
            f"[Demo] ✅ Chaos complete! incident={str(incident.id)[:8]} "
            f"severity={severity} channel={channel}"
        )

    return ChaosResponse(
        message=(
            f"🔥 Chaos triggered! {events_created} synthetic events fired. "
            f"Severity escalated to {severity.upper() if severity else 'unknown'} via clustering. "
            f"Notification dispatched to {incident.current_channel if incident else 'unknown'}."
        ),
        events_fired=events_created,
        incident_id=incident.id if incident else None,
        severity=severity,
        agent_reasoning=reasoning,
    )


async def _get_initial_channel(severity: str, db) -> str:
    from sqlalchemy import select
    from app.models import EscalationRule
    stmt = select(EscalationRule).where(EscalationRule.severity == severity)
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if rule and rule.escalation_path:
        return rule.escalation_path[0]
    return "slack"
