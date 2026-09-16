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


# ── Autonomous Code Patch Endpoints ─────────────────────────────────────────────

class PatchGenerateRequest(BaseModel):
    custom_instructions: Optional[str] = Field(
        default=None,
        description="Optional custom guidance for the Code Patch Agent",
    )


class PatchCommitRequest(BaseModel):
    patch_data: Dict[str, Any] = Field(..., description="Structured patch data generated by Patch Agent")


@router.post("/incidents/{incident_id}/generate-patch")
async def generate_incident_code_patch(
    incident_id: uuid.UUID,
    req: PatchGenerateRequest = PatchGenerateRequest(),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate an autonomous code patch (git diff) using Sentinel's fine-tuned Coder 7B model.
    """
    from app.models import Event
    from app.agents.patch_agent import generate_code_patch

    stmt = select(Incident).where(Incident.id == incident_id)
    res = await db.execute(stmt)
    incident = res.scalar_one_or_none()

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Fetch related events for stack traces
    events_stmt = (
        select(Event)
        .where(Event.error_signature == incident.error_signature)
        .order_by(Event.received_at.desc())
        .limit(5)
    )
    events_res = await db.execute(events_stmt)
    events = events_res.scalars().all()

    patch_result = await generate_code_patch(
        incident=incident,
        events=list(events),
        custom_instructions=req.custom_instructions,
    )

    return {
        "incident_id": str(incident.id),
        "target_file": patch_result.get("target_file"),
        "fault_summary": patch_result.get("fault_summary"),
        "root_cause": patch_result.get("root_cause"),
        "git_diff": patch_result.get("git_diff"),
        "fixed_code_snippet": patch_result.get("fixed_code_snippet"),
        "regression_tests": patch_result.get("regression_tests", []),
        "confidence_score": patch_result.get("confidence_score", 0.9),
    }


@router.post("/incidents/{incident_id}/commit-patch")
async def commit_incident_code_patch(
    incident_id: uuid.UUID,
    req: PatchCommitRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Commit the generated code patch (.diff) directly to GitHub under patches/ directory.
    """
    from app.agents.patch_agent import commit_patch_to_github

    stmt = select(Incident).where(Incident.id == incident_id)
    res = await db.execute(stmt)
    incident = res.scalar_one_or_none()

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    github_url = await commit_patch_to_github(
        incident=incident,
        patch_data=req.patch_data,
    )

    # Log to thread context
    thread_entry = ThreadContext(
        incident_id=incident.id,
        channel="github",
        sender="sentinel-code-patcher",
        message=f"🛠️ [Autonomous Code Patch] Target: `{req.patch_data.get('target_file')}`\nURL: {github_url or 'Committed to repository'}",
        intent_parsed="code_patch_committed",
    )
    db.add(thread_entry)
    await db.commit()

    # Broadcast update to UI
    background_tasks.add_task(
        broadcaster.broadcast,
        "code_patch_committed",
        {
            "incident_id": str(incident.id),
            "target_file": req.patch_data.get("target_file"),
            "github_url": github_url,
        },
    )

    return {
        "incident_id": str(incident.id),
        "success": True,
        "github_url": github_url,
        "target_file": req.patch_data.get("target_file"),
    }

