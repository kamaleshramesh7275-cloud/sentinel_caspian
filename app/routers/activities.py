"""
Activities Router — Provides unified activity feed across Slack, Telegram, Email, Gemini LLM, GitHub, and Remediation.
"""

from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ThreadContext, Incident, Event
from app.services.activity_logger import activity_logger

router = APIRouter(prefix="/activities", tags=["Activities"])


@router.get("", response_model=List[dict])
async def list_activities(
    category: Optional[str] = Query(default="all", description="Filter by category: all, slack, telegram, email, llm, github, remediation"),
    incident_id: Optional[str] = Query(default=None, description="Filter by incident ID"),
    limit: int = Query(default=50, ge=1, le=200, description="Max activities to return"),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve unified activity log across all channels, LLM agents, and integrations.
    Combines live in-memory streaming events with database history.
    """
    # 1. Grab in-memory events
    memory_events = activity_logger.get_recent(category=category, incident_id=incident_id, limit=limit)
    seen_ids = {e["id"] for e in memory_events}

    results = list(memory_events)

    # 2. If we need more historical records or on first startup, reconstruct from DB
    if len(results) < limit:
        remaining = limit - len(results)

        # Query ThreadContext for cross-channel activity & GitHub commits
        query = select(ThreadContext, Incident).outerjoin(
            Incident, ThreadContext.incident_id == Incident.id
        ).order_by(ThreadContext.created_at.desc()).limit(remaining * 2)

        if incident_id:
            query = query.where(ThreadContext.incident_id == incident_id)

        db_res = await db.execute(query)
        rows = db_res.all()

        for thread, inc in rows:
            t_id = str(thread.id)
            if t_id in seen_ids:
                continue

            ch = (thread.channel or "system").lower()
            cat = "system"
            title = f"{ch.capitalize()} Activity"
            summary = thread.message.split("\n")[0] if thread.message else ""

            # Classify category
            if ch in ["slack", "telegram", "email"]:
                cat = ch
                title = f"{ch.capitalize()} Message"
            elif "github" in thread.message.lower() or (thread.intent_parsed and "postmortem" in thread.intent_parsed):
                cat = "github"
                title = "GitHub Postmortem Committed"
            elif thread.intent_parsed == "remediation_executed" or ch == "remediator":
                cat = "remediation"
                title = "Automated Remediation"
            elif ch == "operations-console" or thread.intent_parsed == "manual_declaration":
                cat = "system"
                title = "Incident Declared"

            # Filter if requested
            if category and category != "all" and cat != category:
                continue

            github_url = None
            if "https://github.com" in thread.message:
                for part in thread.message.split():
                    if part.startswith("https://github.com"):
                        github_url = part.rstrip(".,;)\"'")
                        break

            results.append({
                "id": t_id,
                "timestamp": thread.created_at.isoformat() if thread.created_at else "",
                "category": cat,
                "title": title,
                "summary": summary,
                "details": thread.message,
                "incident_id": str(thread.incident_id) if thread.incident_id else None,
                "incident_title": inc.title if inc else "Unknown Incident",
                "severity": inc.severity if inc else None,
                "metadata": {
                    "channel": thread.channel,
                    "sender": thread.sender,
                    "intent": thread.intent_parsed,
                    "github_url": github_url,
                },
            })
            seen_ids.add(t_id)
            if len(results) >= limit:
                break

    # 3. If LLM category requested, also inject incident agent reasoning events
    if (category in ["all", "llm"]) and len(results) < limit:
        inc_query = select(Incident).where(Incident.agent_reasoning.isnot(None)).order_by(Incident.created_at.desc()).limit(20)
        if incident_id:
            inc_query = inc_query.where(Incident.id == incident_id)
        inc_res = await db.execute(inc_query)
        incidents = inc_res.scalars().all()

        for inc in incidents:
            llm_id = f"llm-{inc.id}"
            if llm_id in seen_ids:
                continue

            results.append({
                "id": llm_id,
                "timestamp": inc.created_at.isoformat() if inc.created_at else "",
                "category": "llm",
                "title": f"Gemini Severity Triage [{inc.severity.upper() if inc.severity else 'AUTO'}]",
                "summary": inc.agent_reasoning.split("\n")[0] if inc.agent_reasoning else "AI Reasoning analysis complete",
                "details": inc.agent_reasoning or "",
                "incident_id": str(inc.id),
                "incident_title": inc.title,
                "severity": inc.severity,
                "metadata": {
                    "model": "gemini-2.5-flash",
                    "action": "severity_triage",
                },
            })
            seen_ids.add(llm_id)

    # Sort final combined results descending by timestamp
    results.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return results[:limit]
