"""
Remediation router — endpoints for listing available actions and executing fixes.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Incident, ThreadContext
from app.services.remediator import remediator
from app.services.broadcaster import broadcaster
from app.services.notifier import send_incident_update_notification
from app.agents.postmortem_agent import generate_postmortem

logger = logging.getLogger("sentinel.remediation_router")
router = APIRouter(tags=["Remediation"])


class RemediationRequest(BaseModel):
    action: str = Field(..., description="Action name to execute (e.g. restart_service, flush_cache)")
    params: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Action arguments")
    auto_resolve: bool = Field(default=True, description="Whether to mark incident resolved upon successful fix")


class RemediationResponse(BaseModel):
    incident_id: uuid.UUID
    action: str
    success: bool
    output: str
    details: Dict[str, Any]
    incident_status: str
    postmortem_url: Optional[str] = None


@router.get("/remediation/actions")
async def get_remediation_actions():
    """List all registered automated remediation handlers."""
    return {"actions": remediator.list_actions()}


@router.post("/incidents/{incident_id}/remediate", response_model=RemediationResponse)
async def execute_incident_remediation(
    incident_id: uuid.UUID,
    req: RemediationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Execute a remediation action on an incident, update thread context, and optionally auto-resolve.
    """
    stmt = select(Incident).where(Incident.id == incident_id)
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Execute remediation
    res = await remediator.execute(req.action, req.params)

    # Log to thread_context
    thread_entry = ThreadContext(
        incident_id=incident.id,
        channel="remediator",
        sender="sentinel-auto-healer",
        message=f"🔧 [Auto-Remediation] Action: {req.action}\n{res.output}",
        intent_parsed="remediation_executed",
    )
    db.add(thread_entry)

    # Activity Logging: Remediation Execution
    try:
        from app.services.activity_logger import activity_logger
        await activity_logger.log_activity(
            category="remediation",
            title=f"Auto-Remediation: {req.action}",
            summary=f"Automated fix {'succeeded' if res.success else 'failed'} for incident {str(incident.id)[:8]}",
            details=res.output,
            incident_id=str(incident.id),
            incident_title=incident.title,
            severity=incident.severity,
            metadata={"action": req.action, "success": res.success, "params": req.params},
        )
    except Exception as e:
        logger.debug(f"[Remediation] Activity log failed: {e}")

    postmortem_url = None
    if res.success and req.auto_resolve:
        from datetime import datetime, timezone
        incident.status = "resolved"
        incident.resolved_at = datetime.now(timezone.utc)
        db.add(incident)
        await db.flush()

        # Generate postmortem
        stmt_ctx = select(ThreadContext).where(ThreadContext.incident_id == incident.id)
        res_ctx = await db.execute(stmt_ctx)
        thread_ctx = res_ctx.scalars().all()

        postmortem_url = await generate_postmortem(incident=incident, thread_context=list(thread_ctx))

        postmortem_entry = ThreadContext(
            incident_id=incident.id,
            channel="system",
            sender="sentinel-agent",
            message=f"Postmortem committed: {postmortem_url or 'generation completed'}",
            intent_parsed="postmortem",
        )
        db.add(postmortem_entry)

    await db.commit()

    # Send in-thread notification
    postmortem_msg = f"\n📄 Postmortem committed to GitHub: {postmortem_url}" if postmortem_url else ""
    background_tasks.add_task(
        send_incident_update_notification,
        incident,
        f"🔧 *Auto-Remediation Applied* (`{req.action}`)\n{res.output}{postmortem_msg}",
    )

    # Broadcast real-time update
    background_tasks.add_task(
        broadcaster.broadcast,
        "incident_remediated",
        {
            "incident_id": str(incident.id),
            "action": req.action,
            "success": res.success,
            "status": incident.status,
            "output": res.output,
            "postmortem_url": postmortem_url,
        },
    )

    return RemediationResponse(
        incident_id=incident.id,
        action=req.action,
        success=res.success,
        output=res.output,
        details=res.details,
        incident_status=incident.status,
        postmortem_url=postmortem_url,
    )
