"""
Reply handlers for Slack and Telegram inbound webhooks.

POST /reply/slack   — Slack Events API callback
POST /reply/telegram — Telegram Bot webhook

Both routes:
1. Parse the inbound message
2. Find associated incident (via incident_id in message text)
3. Run intent parser agent
4. Update thread_context and incident status
5. Reply in the originating channel
6. If resolved → trigger postmortem generation
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Incident, ThreadContext
from app.schemas import ReplyResponse, SlackReplyPayload, TelegramReplyPayload
from app.agents.intent_parser import parse_intent
from app.agents.postmortem_agent import generate_postmortem

logger = logging.getLogger("sentinel.reply")
router = APIRouter()

UUID_PATTERN = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.I)


# ── Slack ─────────────────────────────────────────────────────────────────────

@router.post("/reply/slack", response_model=ReplyResponse, tags=["Replies"])
async def slack_reply(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle inbound Slack Events API webhook."""
    body = await request.body()

    # Slack URL verification challenge
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Handle Slack verification
    if data.get("type") == "url_verification":
        return {"challenge": data.get("challenge")}

    # Verify Slack signature
    if settings.slack_signing_secret:
        _verify_slack_signature(request, body)

    event = data.get("event", {})
    if event and event.get("type") in ("message", "app_mention"):
        text = event.get("text", "").strip()
        sender = event.get("user", "unknown")
    else:
        # Fallback to direct JSON for direct API testing
        text = data.get("message", "").strip()
        sender = data.get("sender", "unknown")

    if not text:
        return ReplyResponse(incident_id=None, intent="no_action", action_taken="ignored empty message")

    return await _process_reply(text=text, sender=sender, channel="slack", db=db)


def _verify_slack_signature(request: Request, body: bytes):
    """Verify Slack request signature."""
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    sig_header = request.headers.get("X-Slack-Signature", "")
    sig_base = f"v0:{timestamp}:{body.decode()}"
    computed = "v0=" + hmac.new(
        settings.slack_signing_secret.encode(),
        sig_base.encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(computed, sig_header):
        raise HTTPException(status_code=403, detail="Invalid Slack signature")


# ── Telegram ──────────────────────────────────────────────────────────────────

@router.post("/reply/telegram", response_model=ReplyResponse, tags=["Replies"])
async def telegram_reply(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle inbound Telegram Bot webhook update."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    message = data.get("message", {})
    if not message:
        return ReplyResponse(incident_id=None, intent="no_action", action_taken="no message in update")

    text = message.get("text", "").strip()
    sender = str(message.get("from", {}).get("username") or message.get("from", {}).get("id", "unknown"))

    return await _process_reply(text=text, sender=sender, channel="telegram", db=db)


# ── Shared processing ─────────────────────────────────────────────────────────

async def _process_reply(text: str, sender: str, channel: str, db: AsyncSession) -> ReplyResponse:
    """Shared logic for both Slack and Telegram reply processing."""
    # Extract incident ID from message
    incident_id = _extract_incident_id(text)

    if not incident_id:
        # Try to find the most recent non-resolved incident for this channel
        stmt = (
            select(Incident)
            .where(Incident.status.in_(["open", "escalated", "ack"]))
            .where(Incident.current_channel == channel)
            .order_by(Incident.last_notified_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        incident = result.scalar_one_or_none()
        if not incident:
            logger.info(f"[Reply] No active incident found for {channel} reply from {sender}")
            return ReplyResponse(incident_id=None, intent="unclear", action_taken="no_incident_found")
    else:
        # Match full UUID or short ID prefix
        stmt = select(Incident)
        result = await db.execute(stmt)
        incidents = result.scalars().all()
        
        incident = None
        clean_ident = incident_id.replace("-", "").lower()
        for inc in incidents:
            clean_inc_id = str(inc.id).replace("-", "").lower()
            if clean_inc_id.startswith(clean_ident):
                incident = inc
                break

        if not incident:
            return ReplyResponse(incident_id=None, intent="unclear", action_taken="incident_not_found")

    # Parse intent
    intent_result = await parse_intent(
        message=text,
        incident=incident,
        sender=sender,
        channel=channel,
    )
    intent = intent_result["intent"]

    # Log to thread_context
    thread_entry = ThreadContext(
        incident_id=incident.id,
        channel=channel,
        sender=sender,
        message=text,
        intent_parsed=intent,
    )
    db.add(thread_entry)

    # Apply intent actions
    action_taken = await _apply_intent(intent, incident, intent_result, db, channel)

    logger.info(
        f"[Reply] incident={str(incident.id)[:8]} intent={intent} "
        f"action={action_taken} sender={sender} channel={channel}"
    )

    return ReplyResponse(
        incident_id=incident.id,
        intent=intent,
        action_taken=action_taken,
    )


async def _apply_intent(
    intent: str,
    incident: Incident,
    intent_result: dict,
    db: AsyncSession,
    channel: str,
) -> str:
    """Apply the parsed intent to the incident and return action description."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    action_desc = ""
    if intent == "ack":
        incident.status = "ack"
        db.add(incident)
        action_desc = "incident_acknowledged"
        from app.services.notifier import send_incident_update_notification
        await send_incident_update_notification(incident, f"✅ Incident acknowledged by {sender}.")

    elif intent == "investigating":
        if incident.status not in ("ack", "resolved"):
            incident.status = "ack"
            db.add(incident)
        action_desc = "investigating_noted"
        from app.services.notifier import send_incident_update_notification
        await send_incident_update_notification(incident, f"🔍 {sender} is currently investigating.")

    elif intent == "resolved":
        incident.status = "resolved"
        incident.resolved_at = now
        db.add(incident)
        await db.flush()

        # Generate postmortem
        stmt = select(ThreadContext).where(ThreadContext.incident_id == incident.id)
        result = await db.execute(stmt)
        thread_ctx = result.scalars().all()

        github_url = await generate_postmortem(incident=incident, thread_context=list(thread_ctx))

        # Log postmortem commit to thread
        postmortem_entry = ThreadContext(
            incident_id=incident.id,
            channel="system",
            sender="sentinel-agent",
            message=f"Postmortem generated and committed: {github_url or 'generation failed'}",
            intent_parsed="postmortem",
        )
        db.add(postmortem_entry)

        from app.services.notifier import send_incident_update_notification
        postmortem_note = f"\n📄 *Postmortem:* {github_url}" if github_url else ""
        await send_incident_update_notification(
            incident,
            f"🎉 *Incident Resolved* by {sender}.{postmortem_note}"
        )
        action_desc = f"resolved_postmortem_url={github_url}"

    elif intent == "escalate":
        incident.last_notified_at = incident.created_at  # force escalation
        db.add(incident)
        action_desc = "manual_escalation_triggered"

    else:  # unclear
        # Log the follow-up question as a system message
        follow_up = intent_result.get("follow_up_question", "")
        if follow_up:
            fup_entry = ThreadContext(
                incident_id=incident.id,
                channel=channel,
                sender="sentinel-agent",
                message=follow_up,
                intent_parsed="clarification",
            )
            db.add(fup_entry)
        action_desc = "unclear_follow_up_sent"

    # Broadcast real-time update
    from app.services.broadcaster import broadcaster
    await broadcaster.broadcast(
        "incident_status_changed",
        {
            "incident_id": str(incident.id),
            "status": incident.status,
            "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
            "intent": intent,
            "sender": sender,
        },
    )

    return action_desc


def _extract_incident_id(text: str) -> Optional[str]:
    """Extract full UUID or short ID prefix from message text."""
    matches = UUID_PATTERN.findall(text)
    if matches:
        return matches[0]

    short_id_pattern = r'\b([0-9a-f]{8})\b'
    short_matches = re.findall(short_id_pattern, text.lower())
    if short_matches:
        return short_matches[0]

    return None
