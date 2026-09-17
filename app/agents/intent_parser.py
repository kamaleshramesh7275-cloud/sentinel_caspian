"""
Intent Parser Agent — understands free-text replies from on-call engineers.

Parses channel replies into structured intents:
  ack / investigating / resolved / escalate / unclear

If intent is unclear, generates a follow-up clarification question.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

from app.config import settings
from app.models import Incident
from app.services.sre_llm_provider import sre_llm

logger = logging.getLogger("sentinel.intent_parser")

VALID_INTENTS = {"ack", "investigating", "resolved", "escalate", "unclear"}

SYSTEM_PROMPT = """You are Sentinel's Intent Parser — you analyze on-call engineer replies in incident channels.

Given a reply message and incident context, determine the engineer's intent.

Valid intents:
- "ack": engineer acknowledges the incident ("got it", "on it", "I see it", "acknowledged", "taking a look")
- "investigating": engineer is actively investigating ("looking into it", "checking logs", "investigating", "debugging")
- "resolved": engineer has fixed the issue ("fixed", "resolved", "all clear", "rolled back", "mitigated")
- "escalate": engineer wants to escalate further ("need help", "escalate", "page the DB team", "call oncall")
- "unclear": the message is ambiguous or unrelated to the incident

Respond ONLY with valid JSON:
{
  "intent": "<ack|investigating|resolved|escalate|unclear>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation>",
  "follow_up_question": "<question to ask if intent is unclear, otherwise null>"
}"""


def _heuristic_intent_fallback(msg: str) -> dict:
    """Fast deterministic intent extraction fallback when LLM is unreachable."""
    lower = msg.lower().strip()

    # Resolution patterns
    if any(k in lower for k in ["resolved", "fixed", "all clear", "closed", "done", "mitigated", "rolled back"]):
        return {
            "intent": "resolved",
            "confidence": 0.85,
            "reasoning": "Heuristic match for resolution keywords.",
            "follow_up_question": None,
        }

    # Investigation patterns
    if any(k in lower for k in ["investigating", "checking logs", "checking", "debugging", "looking into"]):
        return {
            "intent": "investigating",
            "confidence": 0.85,
            "reasoning": "Heuristic match for investigation keywords.",
            "follow_up_question": None,
        }

    # Acknowledgement patterns
    if any(k in lower for k in ["ack", "acknowledged", "got it", "on it", "i see it", "taking it", "seen"]):
        return {
            "intent": "ack",
            "confidence": 0.85,
            "reasoning": "Heuristic match for acknowledgement keywords.",
            "follow_up_question": None,
        }

    # Escalation patterns
    if any(k in lower for k in ["escalate", "page", "need help", "critical help", "call lead"]):
        return {
            "intent": "escalate",
            "confidence": 0.85,
            "reasoning": "Heuristic match for escalation keywords.",
            "follow_up_question": None,
        }

    return {
        "intent": "unclear",
        "confidence": 0.0,
        "reasoning": "Message ambiguous and LLM unreachable.",
        "follow_up_question": "Could you clarify your status? Reply with: ack / investigating / resolved",
    }


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
        parsed = await sre_llm.generate_json(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_message,
            temperature=0.1,
            max_tokens=300,
        )

        intent = parsed.get("intent", "unclear")
        if intent not in VALID_INTENTS:
            intent = "unclear"

        logger.info(
            f"[IntentParser] sender={sender} channel={channel} "
            f"intent={intent} confidence={parsed.get('confidence', 0)}"
        )

        return {
            "intent": intent,
            "confidence": float(parsed.get("confidence", 0.85)),
            "reasoning": parsed.get("reasoning", "Parsed by SRE model."),
            "follow_up_question": parsed.get("follow_up_question"),
        }

    except Exception as e:
        logger.warning(f"[IntentParser] SRE LLM parse failed or offline ({e}). Using heuristic fallback.")
        return _heuristic_intent_fallback(message)
