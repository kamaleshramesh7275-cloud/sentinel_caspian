"""
Severity Reasoning Agent — the core differentiator.

Uses an LLM to:
1. Classify event severity (low/medium/high/critical)
2. Detect clustering patterns (e.g., 3rd same error in 20min → bump severity)
3. Produce natural-language justification stored in incidents.agent_reasoning

The override logic is made explicitly visible in all logs and the DB.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from openai import AsyncOpenAI
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Event, EscalationRule

logger = logging.getLogger("sentinel.severity_agent")


SEVERITY_LEVELS = ["low", "medium", "high", "critical"]

SYSTEM_PROMPT = """You are Sentinel's Severity Reasoning Agent — an expert SRE AI that assesses incident severity.

Given a new event and recent related events, classify severity as exactly one of: low, medium, high, critical.

Rules:
- low: isolated, non-user-impacting, informational
- medium: degraded performance, potential user impact, recoverable quickly
- high: significant user impact, service degradation, needs immediate attention
- critical: full outage, data loss risk, cascading failures, payment/auth down

CRITICAL OVERRIDE RULE: If the same error_signature appears 3+ times within 20 minutes in related events,
you MUST bump severity at least one level higher than you would otherwise classify it.
When this override fires, explicitly state "CLUSTERING OVERRIDE TRIGGERED" in your reasoning.

Respond ONLY with valid JSON in this exact format:
{
  "severity": "<low|medium|high|critical>",
  "override_triggered": <true|false>,
  "reasoning": "<2-4 sentences explaining your classification and any override>"
}"""


async def run_severity_agent(
    *,
    new_event: Event,
    db: AsyncSession,
) -> tuple[str, str, bool]:
    """
    Classify severity for an incident event using LLM reasoning.

    Returns:
        (severity, reasoning, override_triggered)
    """
    # 1. Fetch last 5 related events (same source/error_signature, last 30 min)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
    stmt = (
        select(Event)
        .where(
            and_(
                Event.source == new_event.source,
                Event.received_at >= cutoff,
                Event.id != new_event.id,
            )
        )
        .order_by(Event.received_at.desc())
        .limit(5)
    )
    result = await db.execute(stmt)
    recent_events = result.scalars().all()

    # 2. Fetch escalation rules for context
    rules_result = await db.execute(select(EscalationRule))
    escalation_rules = rules_result.scalars().all()

    # 3. Build cluster analysis
    signature_count = sum(
        1 for e in recent_events
        if e.error_signature
        and new_event.error_signature
        and e.error_signature == new_event.error_signature
    )
    cluster_window_count = signature_count + 1  # include current event

    logger.info(
        f"[SeverityAgent] Analyzing event source={new_event.source} "
        f"signature={new_event.error_signature} "
        f"cluster_count={cluster_window_count}"
    )

    # 3b. Query Long-Term Episodic Vector Memory for historical precedents
    from app.services.vector_memory import vector_memory
    historical_matches = vector_memory.search_historical_incidents(
        query=f"{new_event.source} {str(new_event.raw_payload)[:300]}",
        error_signature=new_event.error_signature,
        top_k=2,
    )

    # 4. Build context for LLM
    event_context = {
        "new_event": {
            "source": new_event.source,
            "error_signature": new_event.error_signature,
            "raw_payload": new_event.raw_payload,
            "received_at": new_event.received_at.isoformat() if new_event.received_at else None,
        },
        "recent_related_events": [
            {
                "source": e.source,
                "error_signature": e.error_signature,
                "received_at": e.received_at.isoformat() if e.received_at else None,
                "payload_summary": str(e.raw_payload)[:300],
            }
            for e in recent_events
        ],
        "cluster_analysis": {
            "same_signature_count_in_30min": cluster_window_count,
            "clustering_override_threshold": 3,
            "override_condition_met": cluster_window_count >= 3,
        },
        "historical_incident_precedents": historical_matches,
        "escalation_rules": [
            {
                "severity": r.severity,
                "time_to_ack_minutes": r.time_to_ack_minutes,
                "escalation_path": r.escalation_path,
            }
            for r in escalation_rules
        ],
    }

    user_message = f"""Analyze this incident event and classify its severity:

{json.dumps(event_context, indent=2)}

Remember:
1. If cluster_analysis.override_condition_met is true, you MUST bump severity one level higher and explicitly state "CLUSTERING OVERRIDE TRIGGERED" in reasoning.
2. If historical_incident_precedents are present and relevant, cite the past incident ID or prior resolution in your reasoning.
You must return your response in purely valid JSON format without any markdown wrapper. Example output:
{{"severity": "critical", "reasoning": "...", "override_triggered": true}}
"""

    # 5. Call LLM
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
            temperature=0.2,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content.strip()

        # Robustly extract JSON — Gemini often wraps in markdown code blocks
        import re
        # Try to extract JSON block from ```json ... ``` or ``` ... ```
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', raw)
        if json_match:
            raw = json_match.group(1).strip()
        else:
            # Try to find bare { ... } block
            brace_match = re.search(r'(\{[\s\S]*\})', raw)
            if brace_match:
                raw = brace_match.group(1).strip()

        # Remove trailing commas (common LLM mistake)
        raw = re.sub(r',\s*([}\]])', r'\1', raw)

        # Parse JSON response
        parsed = json.loads(raw)
        severity = parsed.get("severity", "medium")
        reasoning = parsed.get("reasoning", "No reasoning provided.")
        override_triggered = parsed.get("override_triggered", False)

        # Validate severity
        if severity not in SEVERITY_LEVELS:
            severity = "medium"

        # RAG Runbook Suggestion Injection
        from app.services.rag_engine import rag_engine
        search_blob = f"{new_event.source} {new_event.error_signature or ''} {json.dumps(new_event.raw_payload or {})}"
        matched_rb = rag_engine.search_runbook(search_blob)
        if matched_rb:
            steps_preview = " ".join(matched_rb["mitigation_steps"][:2])
            reasoning += f"\nSuggested Runbook: {matched_rb['title']} (Action: {matched_rb['recommended_action']}) | Mitigation: {steps_preview}"

        logger.info(
            f"[SeverityAgent] severity={severity} override={override_triggered}\n"
            f"  Reasoning: {reasoning}"
        )

        return severity, reasoning, override_triggered

    except json.JSONDecodeError as e:
        logger.error(f"[SeverityAgent] Failed to parse LLM JSON: {e}. Raw: {raw}")
        # Fallback: use cluster count to determine severity
        return _fallback_severity(cluster_window_count), "LLM JSON parse error — using cluster-count fallback.", False

    except Exception as e:
        logger.error(f"[SeverityAgent] LLM call failed: {e}")
        return _fallback_severity(cluster_window_count), f"LLM unavailable — fallback: {str(e)}", False


def _fallback_severity(cluster_count: int) -> str:
    """Deterministic fallback when LLM is unavailable."""
    if cluster_count >= 5:
        return "critical"
    if cluster_count >= 3:
        return "high"
    if cluster_count >= 2:
        return "medium"
    return "low"
