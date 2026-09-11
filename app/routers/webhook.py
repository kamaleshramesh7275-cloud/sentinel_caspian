"""
POST /webhook — Main event ingestion endpoint and dedicated APM adapters (Sentry, Datadog, GitHub Actions).

Flow:
1. Validate API key
2. Store event in DB
3. Run 30-min cluster check (same source + error_signature)
4. Attach to existing incident OR create new one
5. Trigger severity reasoning agent (async background)
6. Send initial channel notification
7. Broadcast real-time update to WebSocket clients
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Event, Incident, ThreadContext, EscalationRule
from app.schemas import WebhookPayload, WebhookResponse
from app.agents.severity_agent import run_severity_agent
from app.services.notifier import send_channel_notification
from app.services.apm_adapters import (
    parse_sentry_payload,
    parse_datadog_payload,
    parse_github_actions_payload,
)
from app.services.broadcaster import broadcaster

logger = logging.getLogger("sentinel.webhook")
router = APIRouter()


def _verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != settings.sentinel_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key


async def _process_ingestion(
    payload: WebhookPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession,
) -> WebhookResponse:
    """Core logic to store event, cluster incident, evaluate severity, and notify."""
    # 1. Store raw event
    event = Event(
        source=payload.source,
        raw_payload={"title": payload.title, **payload.payload},
        error_signature=payload.error_signature,
    )
    db.add(event)
    await db.flush()  # get event.id without full commit

    logger.info(f"[Webhook] Received event {event.id} from source={payload.source}")

    # 2. Cluster check — find existing open incident in 30-min window
    incident, action = await _cluster_or_create(event, payload, db)
    event.incident_id = incident.id
    db.add(event)

    # 3. Run severity agent (this updates incident in place)
    severity, reasoning, override = await run_severity_agent(new_event=event, db=db)
    incident.severity = severity
    incident.agent_reasoning = reasoning
    db.add(incident)

    # Log severity assessment to thread_context
    thread_entry = ThreadContext(
        incident_id=incident.id,
        channel="system",
        sender="sentinel-agent",
        message=f"Severity assessed: {severity.upper()}. {'[CLUSTERING OVERRIDE TRIGGERED] ' if override else ''}{reasoning}",
        intent_parsed="severity_assessment",
    )
    db.add(thread_entry)

    # Activity Logging: Gemini Severity Triage
    try:
        from app.services.activity_logger import activity_logger
        await activity_logger.log_activity(
            category="llm",
            title=f"Gemini Severity Triage [{severity.upper()}]",
            summary=f"Evaluated event from {payload.source} -> {severity.upper()} {'(Clustering Boost)' if override else ''}",
            details=reasoning,
            incident_id=str(incident.id),
            incident_title=incident.title,
            severity=severity,
            metadata={"agent": "severity_agent", "override": override, "source": payload.source},
        )
    except Exception as e:
        logger.debug(f"[Webhook] Activity log failed: {e}")

    logger.info(
        f"[Webhook] Incident {str(incident.id)[:8]} | action={action} | "
        f"severity={severity} | override={override}"
    )

    # 4. Determine initial notification channel from escalation rules
    channel = await _get_initial_channel(severity, db)
    if incident.current_channel is None:
        incident.current_channel = channel
        db.add(incident)

    await db.flush()

    # 5. Send notification in background (don't block webhook response)
    background_tasks.add_task(send_channel_notification, incident, channel)

    # 6. Broadcast real-time event to connected WebSocket clients
    incident_dict = {
        "id": str(incident.id),
        "title": incident.title,
        "severity": incident.severity,
        "status": incident.status,
        "current_channel": incident.current_channel,
        "escalation_count": incident.escalation_count,
        "agent_reasoning": incident.agent_reasoning,
        "created_at": incident.created_at.isoformat() if incident.created_at else None,
        "last_notified_at": incident.last_notified_at.isoformat() if incident.last_notified_at else None,
    }
    background_tasks.add_task(
        broadcaster.broadcast,
        "incident_created" if action == "created" else "incident_updated",
        {"incident": incident_dict, "action": action, "override": override},
    )

    return WebhookResponse(
        event_id=event.id,
        incident_id=incident.id,
        action=action,
        severity=severity,
        agent_reasoning=reasoning,
    )


@router.post("/webhook", response_model=WebhookResponse, tags=["Ingestion"])
async def ingest_webhook(
    payload: WebhookPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_verify_api_key),
):
    """
    Ingest generic webhook payload (custom, CI/CD, or monitoring).
    """
    return await _process_ingestion(payload, background_tasks, db)


@router.post("/webhook/sentry", response_model=WebhookResponse, tags=["Ingestion"])
async def ingest_sentry_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_verify_api_key),
):
    """
    Ingest native Sentry webhook payload, extract stack trace signature, and triage.
    """
    raw_json = await request.json()
    normalized = parse_sentry_payload(raw_json)
    payload = WebhookPayload(**normalized)
    return await _process_ingestion(payload, background_tasks, db)


@router.post("/webhook/datadog", response_model=WebhookResponse, tags=["Ingestion"])
async def ingest_datadog_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_verify_api_key),
):
    """
    Ingest native Datadog Monitor webhook alert.
    """
    raw_json = await request.json()
    normalized = parse_datadog_payload(raw_json)
    payload = WebhookPayload(**normalized)
    return await _process_ingestion(payload, background_tasks, db)


@router.post("/webhook/github", response_model=WebhookResponse, tags=["Ingestion"])
async def ingest_github_actions_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_verify_api_key),
):
    """
    Ingest GitHub Actions workflow_job / workflow_run failure webhook.
    """
    raw_json = await request.json()
    normalized = parse_github_actions_payload(raw_json)
    payload = WebhookPayload(**normalized)
    return await _process_ingestion(payload, background_tasks, db)


async def _cluster_or_create(
    event: Event,
    payload: WebhookPayload,
    db: AsyncSession,
) -> tuple[Incident, str]:
    """
    Find an open incident with same source+signature in last 30 min, or create new.
    Returns (incident, "attached"|"created")
    """
    if payload.error_signature:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
        stmt = (
            select(Incident)
            .join(Event, Event.incident_id == Incident.id)
            .where(
                and_(
                    Event.source == payload.source,
                    Event.error_signature == payload.error_signature,
                    Event.received_at >= cutoff,
                    Incident.status.in_(["open", "escalated"]),
                )
            )
            .order_by(Incident.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            logger.info(f"[Webhook] Clustering event into existing incident {existing.id}")
            return existing, "attached"

    # Create new incident
    title = (
        payload.title
        or f"[{payload.source}] {payload.error_signature or 'Unknown error'}"
    )
    incident = Incident(
        title=title,
        severity="medium",  # will be updated by severity agent
        status="open",
        channel_metadata={},
    )
    db.add(incident)
    await db.flush()
    return incident, "created"


async def _get_initial_channel(severity: str, db: AsyncSession) -> str:
    """Get the first channel from escalation rules for this severity."""
    stmt = select(EscalationRule).where(EscalationRule.severity == severity)
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if rule and rule.escalation_path:
        return rule.escalation_path[0]
    return "slack"  # default
