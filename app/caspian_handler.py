"""
Caspian CommClient handler — unified @on_message handler for ALL channels.

This is the core Caspian SDK integration point. A single handler processes
messages from Slack, Telegram, and Email via one interface.

The handler:
1. Extracts incident_id from message context (thread subject, message body)
2. Routes to intent parsing
3. Updates incident status
4. Replies in the same channel/thread (message.reply() handles routing)
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Optional

logger = logging.getLogger("sentinel.caspian_handler")

# Will be initialized in main.py lifespan
caspian_client = None


def init_caspian_handler(client):
    """
    Initialize the Caspian CommClient and register the unified message handler.
    Called during app startup.
    """
    global caspian_client
    caspian_client = client

    @client.on_message
    async def handle_message(message):
        """
        Single handler for ALL inbound messages across Slack, Telegram, Email.
        Caspian normalizes the message object — message.reply() handles channel routing.
        """
        try:
            text = (message.text or "").strip()
            channel = getattr(message, "channel", "unknown")
            sender = getattr(message, "sender", "unknown")

            logger.info(f"[CaspianHandler] Inbound message | channel={channel} | sender={sender} | text={text[:80]}")

            # Extract incident_id from message (look for UUID pattern or incident context)
            incident_id = _extract_incident_id(text, message)

            if not incident_id:
                logger.debug("[CaspianHandler] No incident_id found in message — ignoring")
                return

            # Import here to avoid circular imports
            from app.database import AsyncSessionLocal
            from app.models import Incident, ThreadContext
            from app.agents.intent_parser import parse_intent
            from sqlalchemy import select

            async with AsyncSessionLocal() as db:
                # Fetch all incidents and match by UUID or prefix
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
                    logger.warning(f"[CaspianHandler] Incident {incident_id} not found")
                    await message.reply(f"⚠️ Incident `{incident_id}` not found.")
                    return

                # Parse intent
                intent_result = await parse_intent(
                    message=text,
                    incident=incident,
                    sender=str(sender),
                    channel=str(channel),
                )
                intent = intent_result["intent"]

                # Log to thread_context
                thread_entry = ThreadContext(
                    incident_id=incident_id,
                    channel=str(channel),
                    sender=str(sender),
                    message=text,
                    intent_parsed=intent,
                )
                db.add(thread_entry)

                # Handle intent actions
                reply_text = await _handle_intent(intent, incident, intent_result, db)

                await db.commit()

            # Reply via Caspian (automatically routes to correct channel/thread)
            await message.reply(reply_text)

        except Exception as e:
            logger.error(f"[CaspianHandler] Error processing message: {e}", exc_info=True)


def _extract_incident_id(text: str, message) -> Optional[str]:
    """
    Extract incident UUID or short ID prefix (8 characters) from message text or metadata.
    """
    # Look for full UUID
    uuid_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    matches = re.findall(uuid_pattern, text.lower())
    if matches:
        return matches[0]

    # Check message metadata (subject line for email, thread metadata for Slack)
    subject = getattr(message, "subject", "") or ""
    matches = re.findall(uuid_pattern, subject.lower())
    if matches:
        return matches[0]

    # Look for short ID (first 8 chars)
    short_id_pattern = r'\b([0-9a-f]{8})\b'
    short_matches = re.findall(short_id_pattern, text.lower())
    if short_matches:
        return short_matches[0]

    return None


async def _handle_intent(intent: str, incident, intent_result: dict, db) -> str:
    """Update incident based on parsed intent and return reply text."""
    from datetime import datetime, timezone
    from app.agents.postmortem_agent import generate_postmortem
    from app.models import ThreadContext
    from sqlalchemy import select

    now = datetime.now(timezone.utc)
    short_id = str(incident.id)[:8]

    if intent == "ack":
        incident.status = "ack"
        db.add(incident)
        return (
            f"✅ Incident `{short_id}` acknowledged.\n"
            f"Sentinel will stop escalating. Update when resolved."
        )

    elif intent == "investigating":
        if incident.status not in ("ack", "resolved"):
            incident.status = "ack"
            db.add(incident)
        return f"🔍 Got it — investigation underway for `{short_id}`. Keep us posted."

    elif intent == "resolved":
        incident.status = "resolved"
        incident.resolved_at = now
        db.add(incident)
        await db.flush()

        # Trigger postmortem generation
        stmt = select(ThreadContext).where(ThreadContext.incident_id == incident.id)
        result = await db.execute(stmt)
        thread_ctx = result.scalars().all()

        github_url = await generate_postmortem(incident=incident, thread_context=list(thread_ctx))

        postmortem_note = f"\n📄 Postmortem committed: {github_url}" if github_url else "\n📄 Postmortem generation initiated."
        return (
            f"🎉 Incident `{short_id}` resolved! Great work.\n"
            f"Postmortem will be generated automatically.{postmortem_note}"
        )

    elif intent == "escalate":
        incident.last_notified_at = incident.created_at  # force escalation on next tick
        db.add(incident)
        return f"⏫ Manual escalation requested for `{short_id}`. Sentinel will escalate on next check."

    else:  # unclear
        follow_up = intent_result.get("follow_up_question", "")
        return (
            f"🤔 I'm not sure how to update incident `{short_id}` from that message.\n"
            + (f"{follow_up}" if follow_up else "Please reply with: `ack`, `investigating`, or `resolved`")
        )
