"""
Channel-specific message formatters for Sentinel notifications.

Each channel has a distinct tone:
- Slack: technical, includes stack trace snippet and incident ID
- Telegram: short, urgent, plain language with emoji
- Email: formal incident report with full timeline
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.models import Incident

logger = logging.getLogger("sentinel.notifier")

SEVERITY_EMOJI = {
    "low": "🟡",
    "medium": "🟠",
    "high": "🔴",
    "critical": "🚨",
}

SEVERITY_COLOR = {
    "low": "#FFDD57",
    "medium": "#FF9900",
    "high": "#FF3860",
    "critical": "#8B0000",
}


def format_slack_message(incident: Incident) -> dict:
    """
    Slack Block Kit message — technical tone with stack trace snippet.
    """
    emoji = SEVERITY_EMOJI.get(incident.severity, "⚠️")
    color = SEVERITY_COLOR.get(incident.severity, "#FF9900")
    short_id = str(incident.id)[:8]

    reasoning_block = (incident.agent_reasoning or "Severity assessed by agent.")[:400]

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{emoji} SENTINEL INCIDENT ALERT",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Title:*\n{incident.title}"},
                {"type": "mrkdwn", "text": f"*Severity:*\n`{(incident.severity or 'unknown').upper()}`"},
                {"type": "mrkdwn", "text": f"*Status:*\n`{incident.status}`"},
                {"type": "mrkdwn", "text": f"*Incident ID:*\n`{short_id}`"},
                {"type": "mrkdwn", "text": f"*Channel:*\n{incident.current_channel or 'slack'}"},
                {
                    "type": "mrkdwn",
                    "text": f"*Escalated:*\n{incident.escalation_count} time(s)",
                },
            ],
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*🤖 Agent Reasoning:*\n```{reasoning_block}```",
            },
        },
        {"type": "divider"},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    "Reply in this thread to update incident status:\n"
                    "• `ack` — acknowledge the incident\n"
                    "• `investigating` — mark as under investigation\n"
                    "• `resolved` — mark as resolved (triggers postmortem)\n"
                    "• `escalate` — request further escalation"
                ),
            },
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Full ID: `{incident.id}` | Sentinel Autonomous Incident Commander",
                }
            ],
        },
    ]

    return {
        "text": f"{emoji} [{incident.severity.upper() if incident.severity else 'UNKNOWN'}] {incident.title} | Incident {short_id}",
        "attachments": [{"color": color, "blocks": blocks}],
    }


def format_telegram_message(incident: Incident) -> str:
    """
    Telegram message — short, urgent, plain language with emoji.
    """
    emoji = SEVERITY_EMOJI.get(incident.severity, "⚠️")
    short_id = str(incident.id)[:8]
    severity = (incident.severity or "unknown").upper()

    created_str = ""
    if incident.created_at:
        now = datetime.now(timezone.utc)
        created_at = incident.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        delta_minutes = int((now - created_at).total_seconds() / 60)
        if delta_minutes > 0:
            created_str = f", unresolved {delta_minutes}min"

    escalation_note = ""
    if incident.escalation_count > 0:
        escalation_note = f"\n⏫ Escalated {incident.escalation_count}x — no response on previous channels"

    return (
        f"{emoji} *SENTINEL ALERT — {severity}*{escalation_note}\n\n"
        f"📌 *{incident.title}*\n"
        f"🆔 `{short_id}`{created_str}\n\n"
        f"Reply to acknowledge:\n"
        f"`ack` · `investigating` · `resolved`"
    )


def format_email(incident: Incident) -> dict:
    """
    Email — formal incident report with full context.
    Returns dict with subject and html_body.
    """
    emoji = SEVERITY_EMOJI.get(incident.severity, "⚠️")
    short_id = str(incident.id)[:8]
    severity = (incident.severity or "unknown").upper()

    created_str = incident.created_at.strftime("%Y-%m-%d %H:%M UTC") if incident.created_at else "Unknown"

    subject = f"[SENTINEL {severity}] Incident Alert: {incident.title} ({short_id})"

    reasoning_html = (incident.agent_reasoning or "Not available").replace("\n", "<br>")

    html_body = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
  <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

    <div style="background: {'#8B0000' if incident.severity == 'critical' else '#FF3860' if incident.severity == 'high' else '#FF9900' if incident.severity == 'medium' else '#FFDD57'}; padding: 20px; color: white;">
      <h1 style="margin: 0; font-size: 22px;">{emoji} Sentinel Incident Alert</h1>
      <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Severity: {severity}</p>
    </div>

    <div style="padding: 24px;">
      <h2 style="margin-top: 0; color: #333;">{incident.title}</h2>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 12px; background: #f8f8f8; font-weight: bold; width: 40%;">Incident ID</td>
          <td style="padding: 8px 12px; font-family: monospace;">{str(incident.id)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8f8f8; font-weight: bold;">Severity</td>
          <td style="padding: 8px 12px;">{severity}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8f8f8; font-weight: bold;">Status</td>
          <td style="padding: 8px 12px;">{incident.status}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8f8f8; font-weight: bold;">Detected At</td>
          <td style="padding: 8px 12px;">{created_str}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8f8f8; font-weight: bold;">Escalation Count</td>
          <td style="padding: 8px 12px;">{incident.escalation_count}</td>
        </tr>
      </table>

      <h3 style="color: #555;">🤖 AI Agent Reasoning</h3>
      <div style="background: #f0f4ff; border-left: 4px solid #4a6cf7; padding: 12px 16px; border-radius: 4px; font-size: 14px;">
        {reasoning_html}
      </div>

      <h3 style="color: #555;">📋 Required Action</h3>
      <p style="color: #333;">This incident requires immediate attention. Please:</p>
      <ol>
        <li>Acknowledge receipt by replying to the Slack/Telegram thread</li>
        <li>Investigate and update status with: <code>ack</code>, <code>investigating</code>, or <code>resolved</code></li>
        <li>Sentinel will continue escalating until acknowledged</li>
      </ol>
    </div>

    <div style="background: #333; color: #aaa; padding: 12px 24px; font-size: 12px;">
      Sentinel Autonomous Incident Commander &bull; Incident {short_id} &bull; {created_str}
    </div>
  </div>
</body>
</html>
"""
    return {"subject": subject, "html_body": html_body}


async def send_slack_notification(incident: Incident) -> bool:
    """Send Slack notification directly via slack_sdk, preserving thread continuity."""
    if not settings.slack_bot_token:
        logger.warning("[Notifier] Slack token not configured — skipping")
        return False
    try:
        from slack_sdk.web.async_client import AsyncWebClient
        client = AsyncWebClient(token=settings.slack_bot_token)
        message = format_slack_message(incident)
        
        meta = incident.channel_metadata or {}
        thread_ts = meta.get("slack_ts")

        resp = await client.chat_postMessage(
            channel=settings.slack_incident_channel,
            text=message["text"],
            attachments=message["attachments"],
            thread_ts=thread_ts,
        )
        if resp and resp.get("ts") and not thread_ts:
            meta["slack_ts"] = resp["ts"]
            incident.channel_metadata = dict(meta)

        logger.info(f"[Notifier] ✅ Slack notification sent for incident {incident.id} (thread_ts={meta.get('slack_ts')})")
        return True
    except Exception as e:
        logger.error(f"[Notifier] Slack send failed: {e}")
        return False


async def send_telegram_notification(incident: Incident) -> bool:
    """Send Telegram notification directly via python-telegram-bot, preserving reply chains."""
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        logger.warning("[Notifier] Telegram not configured — skipping")
        return False
    try:
        from telegram import Bot
        from telegram.constants import ParseMode
        bot = Bot(token=settings.telegram_bot_token)
        text = format_telegram_message(incident)

        meta = incident.channel_metadata or {}
        reply_to = meta.get("telegram_message_id")

        sent_msg = await bot.send_message(
            chat_id=settings.telegram_chat_id,
            text=text,
            parse_mode=ParseMode.MARKDOWN,
            reply_to_message_id=reply_to,
        )
        if sent_msg and hasattr(sent_msg, "message_id") and not reply_to:
            meta["telegram_message_id"] = sent_msg.message_id
            incident.channel_metadata = dict(meta)

        logger.info(f"[Notifier] ✅ Telegram notification sent for incident {incident.id}")
        return True
    except Exception as e:
        logger.error(f"[Notifier] Telegram send failed: {e}")
        return False


async def send_email_notification(incident: Incident) -> bool:
    """Send email notification via Resend."""
    if not settings.resend_api_key:
        logger.warning("[Notifier] Resend API key not configured — skipping")
        return False
    try:
        import resend
        resend.api_key = settings.resend_api_key
        email_content = format_email(incident)
        resend.Emails.send({
            "from": settings.email_from,
            "to": [settings.email_to_oncall],
            "subject": email_content["subject"],
            "html": email_content["html_body"],
        })
        logger.info(f"[Notifier] ✅ Email notification sent for incident {incident.id}")
        return True
    except Exception as e:
        logger.error(f"[Notifier] Email send failed: {e}")
        return False


async def send_incident_update_notification(incident: Incident, update_text: str) -> None:
    """Post an in-thread status or resolution update across active channels."""
    meta = incident.channel_metadata or {}
    short_id = str(incident.id)[:8]

    # Slack in-thread update
    if settings.slack_bot_token and meta.get("slack_ts"):
        try:
            from slack_sdk.web.async_client import AsyncWebClient
            client = AsyncWebClient(token=settings.slack_bot_token)
            await client.chat_postMessage(
                channel=settings.slack_incident_channel,
                text=f"📢 *Incident `{short_id}` Update:*\n{update_text}",
                thread_ts=meta.get("slack_ts"),
            )
        except Exception as e:
            logger.error(f"[Notifier] In-thread Slack update failed: {e}")

    # Telegram reply update
    if settings.telegram_bot_token and settings.telegram_chat_id and meta.get("telegram_message_id"):
        try:
            from telegram import Bot
            from telegram.constants import ParseMode
            bot = Bot(token=settings.telegram_bot_token)
            await bot.send_message(
                chat_id=settings.telegram_chat_id,
                text=f"📢 *Incident `{short_id}` Update:*\n{update_text}",
                parse_mode=ParseMode.MARKDOWN,
                reply_to_message_id=meta.get("telegram_message_id"),
            )
        except Exception as e:
            logger.error(f"[Notifier] In-thread Telegram update failed: {e}")


async def send_channel_notification(incident: Incident, channel: str) -> bool:
    """Route notification to the correct channel."""
    channel_map = {
        "slack": send_slack_notification,
        "telegram": send_telegram_notification,
        "email": send_email_notification,
    }
    handler = channel_map.get(channel)
    if not handler:
        logger.error(f"[Notifier] Unknown channel: {channel}")
        return False
    return await handler(incident)
