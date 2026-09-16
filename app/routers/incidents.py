"""
GET /incidents — List and retrieve incidents for dashboard.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Event, Incident, ThreadContext, EscalationRule
from app.schemas import (
    IncidentOut,
    IncidentListResponse,
    ThreadContextOut,
    TriggerIncidentRequest,
    TriggerIncidentResponse,
)
from app.agents.severity_agent import run_severity_agent
from app.services.notifier import send_channel_notification
from app.services.broadcaster import broadcaster

logger = logging.getLogger("sentinel.incidents")
router = APIRouter()


async def _get_initial_channel(severity: str, db: AsyncSession) -> str:
    stmt = select(EscalationRule).where(EscalationRule.severity == severity)
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if rule and rule.escalation_path:
        return rule.escalation_path[0]
    return "slack"


@router.post("/incidents/trigger", response_model=TriggerIncidentResponse, tags=["Incidents"])
async def trigger_incident(
    req: TriggerIncidentRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Operator endpoint to declare or simulate an incident with specified severity,
    target service, error details, and notification preferences.
    """
    logger.info(
        f"[Trigger] Operator declaring incident: title='{req.title}' "
        f"severity='{req.severity}' service='{req.service}' is_demo={req.is_demo}"
    )

    # 1. Normalize error signature
    error_signature = (
        req.error_signature
        or f"{req.service}::{req.source}::{req.title.lower().replace(' ', '-')[:30]}"
    )

    # 2. Store underlying event
    raw_payload = req.raw_payload or {}
    raw_payload.update({
        "title": req.title,
        "service": req.service,
        "details": req.details,
        "source": req.source,
        "triggered_by": "operations_console",
    })

    event = Event(
        source=req.source,
        raw_payload=raw_payload,
        error_signature=error_signature,
    )
    db.add(event)
    await db.flush()

    # 3. Determine severity & agent reasoning
    target_sev = (req.severity or "medium").lower().strip()
    valid_severities = {"low", "medium", "high", "critical"}

    if target_sev == "auto":
        # Let severity agent evaluate via LLM/heuristics
        severity, reasoning, _ = await run_severity_agent(new_event=event, db=db)
        if severity not in valid_severities:
            severity = "medium"
    else:
        if target_sev not in valid_severities:
            target_sev = "medium"
        severity = target_sev
        try:
            _, ai_reasoning, _ = await run_severity_agent(new_event=event, db=db)
            reasoning = f"[Manual Declaration: {severity.upper()}] {ai_reasoning}"
        except Exception as e:
            logger.warning(f"[Trigger] AI reasoning generation skipped: {e}")
            reasoning = (
                f"[Manual Declaration: {severity.upper()}] Incident manually declared for service '{req.service}'. "
                f"Operator assigned severity: {severity.upper()}. {req.details or ''}"
            )

    # 4. Create Incident
    incident = Incident(
        title=req.title,
        severity=severity,
        status="open",
        agent_reasoning=reasoning,
        channel_metadata={"is_demo": req.is_demo, "service": req.service},
    )
    db.add(incident)
    await db.flush()

    event.incident_id = incident.id
    db.add(event)

    # 5. Determine initial channel
    channel = await _get_initial_channel(severity, db)
    incident.current_channel = channel
    db.add(incident)

    # 6. Add initial timeline entry
    timeline_msg = (
        f"🚨 Incident declared via Operations Console.\n"
        f"• Service: {req.service}\n"
        f"• Source: {req.source}\n"
        f"• Assigned Severity: {severity.upper()}\n"
        f"• Mode: {'Safe Simulation (Demo)' if req.is_demo else 'Live Production Dispatch'}\n"
        f"• Details: {req.details or 'None provided'}"
    )
    thread_entry = ThreadContext(
        incident_id=incident.id,
        channel="system",
        sender="operations-console",
        message=timeline_msg,
        intent_parsed="manual_declaration",
    )
    db.add(thread_entry)
    await db.flush()

    # Activity Logging: Manual incident declaration
    try:
        from app.services.activity_logger import activity_logger
        await activity_logger.log_activity(
            category="system",
            title=f"Incident Declared: {incident.title}",
            summary=f"Operator declared incident [{severity.upper()}] for service {req.service}",
            details=timeline_msg,
            incident_id=str(incident.id),
            incident_title=incident.title,
            severity=severity,
            metadata={"service": req.service, "source": req.source, "is_demo": req.is_demo},
        )
    except Exception as e:
        logger.debug(f"[Incidents] Activity log failed: {e}")

    # 7. Dispatch notifications if requested
    if req.send_notifications:
        background_tasks.add_task(
            send_channel_notification,
            incident,
            channel,
            is_demo=req.is_demo,
        )

    # 8. Broadcast live update to WebSockets
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
        "incident_created",
        {"incident": incident_dict, "action": "created"},
    )

    return TriggerIncidentResponse(
        incident_id=incident.id,
        title=incident.title,
        severity=incident.severity,
        status=incident.status,
        current_channel=incident.current_channel,
        agent_reasoning=incident.agent_reasoning,
        action="created",
        message=f"Incident '{incident.title}' successfully declared with severity {severity.upper()}.",
    )



@router.get("/incidents", response_model=IncidentListResponse, tags=["Incidents"])
async def list_incidents(
    status: str | None = Query(None, description="Filter by status: open|escalated|ack|resolved"),
    severity: str | None = Query(None, description="Filter by severity: low|medium|high|critical"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List incidents with optional status/severity filters."""
    stmt = select(Incident).order_by(Incident.created_at.desc())

    if status:
        stmt = stmt.where(Incident.status == status)
    if severity:
        stmt = stmt.where(Incident.severity == severity)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    incidents = result.scalars().all()

    return IncidentListResponse(
        total=total,
        incidents=[IncidentOut.model_validate(i) for i in incidents],
    )


@router.get("/incidents/{incident_id}", response_model=IncidentOut, tags=["Incidents"])
async def get_incident(
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific incident by ID."""
    stmt = select(Incident).where(Incident.id == incident_id)
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return IncidentOut.model_validate(incident)


@router.get("/incidents/{incident_id}/timeline", response_model=list[ThreadContextOut], tags=["Incidents"])
async def get_incident_timeline(
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get the full cross-channel message timeline for an incident."""
    stmt = (
        select(ThreadContext)
        .where(ThreadContext.incident_id == incident_id)
        .order_by(ThreadContext.created_at.asc())
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()
    return [ThreadContextOut.model_validate(e) for e in entries]


# ── Feature 1: Time-Travel Outage Simulation Endpoint ─────────────────────────

from app.schemas import (
    CascadeSimulationResponse,
    SpeculativeHealResponse,
    ChaosExperimentResponse,
)
from app.agents.simulator_agent import simulate_outage_cascade
from app.agents.speculative_patch_agent import run_speculative_healing
from app.agents.chaos_agent import generate_chaos_experiment


@router.post(
    "/incidents/{incident_id}/simulate-cascade",
    response_model=CascadeSimulationResponse,
    tags=["SRE Innovations"],
)
async def endpoint_simulate_cascade(
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Feature 1: Autoregressive 30-Minute Outage Cascade Simulator.
    Forecasts failure escalation across T+5m, T+15m, and T+30m horizons.
    """
    stmt = select(Incident).where(Incident.id == incident_id)
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    ev_stmt = select(Event).where(Event.incident_id == incident_id).order_by(Event.received_at.desc())
    ev_result = await db.execute(ev_stmt)
    events = ev_result.scalars().all()

    simulation = await simulate_outage_cascade(incident=incident, events=events)
    return simulation


@router.post(
    "/incidents/{incident_id}/speculative-heal",
    response_model=SpeculativeHealResponse,
    tags=["SRE Innovations"],
)
async def endpoint_speculative_heal(
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Feature 3: Speculative Self-Healing in Isolated Shadow Sandboxes.
    Generates a patch, executes tests in a safe container sandbox, and computes safety confidence.
    """
    stmt = select(Incident).where(Incident.id == incident_id)
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    ev_stmt = select(Event).where(Event.incident_id == incident_id).order_by(Event.received_at.desc())
    ev_result = await db.execute(ev_stmt)
    events = ev_result.scalars().all()

    healing_result = await run_speculative_healing(incident=incident, events=events)
    return healing_result


@router.post(
    "/incidents/{incident_id}/chaos-experiment",
    response_model=ChaosExperimentResponse,
    tags=["SRE Innovations"],
)
async def endpoint_chaos_experiment(
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Feature 5: Autonomous Chaos Engineering Test Generator.
    Synthesizes Chaos Mesh / Litmus YAML and Locust load scripts from resolved postmortems.
    """
    stmt = select(Incident).where(Incident.id == incident_id)
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    ev_stmt = select(Event).where(Event.incident_id == incident_id).order_by(Event.received_at.desc())
    ev_result = await db.execute(ev_stmt)
    events = ev_result.scalars().all()

    chaos_res = await generate_chaos_experiment(incident=incident, events=events)
    return chaos_res

