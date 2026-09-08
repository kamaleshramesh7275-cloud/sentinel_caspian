"""
GET /incidents — List and retrieve incidents for dashboard.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Incident, ThreadContext
from app.schemas import IncidentOut, IncidentListResponse, ThreadContextOut

logger = logging.getLogger("sentinel.incidents")
router = APIRouter()


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
