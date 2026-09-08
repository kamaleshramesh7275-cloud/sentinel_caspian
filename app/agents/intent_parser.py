"""
Intent Parser Agent — understands free-text replies from on-call engineers.

Parses channel replies into structured intents:
  ack / investigating / resolved / escalate / unclear

If intent is unclear, generates a follow-up clarification question.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from openai import AsyncOpenAI

from app.config import settings
from app.models import Incident

logger = logging.getLogger("sentinel.intent_parser")

VALID_INTENTS = {"ack", "investigating", "resolved", "escalate", "unclear"}

SYSTEM_PROMPT = """You are Sentinel's Intent Parser — you analyze on-call engineer replies in incident channels.

Given a reply message and incident context, determine the engineer's intent.

Valid intents:
- "ack": engineer acknowledges the incident ("got it", "on it", "I see it", "acknowledged")
- "investigating": engineer is actively investigating ("looking into it", "checking", "investigating")
- "resolved": engineer has fixed the issue ("fixed", "resolved", "all clear", "rolled back")
- "escalate": engineer wants to escalate further ("need help", "escalate", "page the DB team")
- "unclear": the message is ambiguous or unrelated to the incident

Respond ONLY with valid JSON:
{
  "intent": "<ack|investigating|resolved|escalate|unclear>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation>",
  "follow_up_question": "<question to ask if intent is unclear, otherwise null>"
}"""


async def parse_intent(
    *,
    message: str,
    incident: Incident,
    sender: str,
    channel: str,
) -> dict:
    """
    Parse a free-text reply into a structured intent.

    Returns dict with keys: intent, confidence, reasoning, follow_up_question
    """
    incident_context = {
        "incident_id": str(incident.id),
        "title": incident.title,
        "severity": incident.severity,
        "status": incident.status,
        "current_channel": incident.current_channel,
        "escalation_count": incident.escalation_count,
        "agent_reasoning_summary": (incident.agent_reasoning or "")[:200],
    }

    user_message = f"""Engineer reply in {channel} from {sender}:
"{message}"

Incident context:
{json.dumps(incident_context, indent=2)}

What is the engineer's intent?"""

    try:
        client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url or None,
        )
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.1,
            max_tokens=300,
        )
        raw = response.choices[0].message.content.strip()
        parsed = json.loads(raw)

        intent = parsed.get("intent", "unclear")
        if intent not in VALID_INTENTS:
            intent = "unclear"

        logger.info(
            f"[IntentParser] sender={sender} channel={channel} "
            f"intent={intent} confidence={parsed.get('confidence', 0)}"
        )

        return {
            "intent": intent,
            "confidence": parsed.get("confidence", 0.5),
            "reasoning": parsed.get("reasoning", ""),
            "follow_up_question": parsed.get("follow_up_question"),
        }

    except json.JSONDecodeError as e:
        logger.error(f"[IntentParser] JSON parse failed: {e}")
        return {
            "intent": "unclear",
            "confidence": 0.0,
            "reasoning": "LLM JSON parse error",
            "follow_up_question": "Could you clarify your status on this incident? Reply with: ack / investigating / resolved",
        }

    except Exception as e:
        logger.error(f"[IntentParser] LLM call failed: {e}")
        return {
            "intent": "unclear",
            "confidence": 0.0,
            "reasoning": f"LLM unavailable: {str(e)}",
            "follow_up_question": "Could you clarify your status? Reply with: ack / investigating / resolved",
        }
