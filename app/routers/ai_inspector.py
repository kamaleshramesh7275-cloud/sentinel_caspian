"""
AI Model Inspector Router.

Provides endpoints to inspect live AI status and directly test AI agents
with custom or preset inputs for real-time evaluator demonstration.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.agents.severity_agent import run_severity_agent
from app.agents.intent_parser import parse_intent
from app.agents.postmortem_agent import generate_postmortem
from app.models import Event, Incident, ThreadContext

logger = logging.getLogger("sentinel.ai_inspector")
router = APIRouter(prefix="/ai", tags=["AI Inspector"])


class AiStatusResponse(BaseModel):
    status: str
    model: str
    provider: str
    base_url: Optional[str]
    latency_ms: float
    active_agents: list[str]
    error: Optional[str] = None


class AgentTestRequest(BaseModel):
    agent: str  # "severity" | "intent" | "postmortem"
    payload: dict[str, Any] = {}


class AgentTestResponse(BaseModel):
    agent: str
    model: str
    status: str
    duration_ms: float
    output: Any
    raw_response: Optional[str] = None
    error: Optional[str] = None


@router.get("/status", response_model=AiStatusResponse)
async def get_ai_status():
    """Verify live connectivity and latency to configured AI model (Gemini)."""
    t0 = time.perf_counter()
    status = "online"
    err_msg = None

    client = AsyncOpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url or None,
    )

    try:
        # Fast lightweight connectivity probe
        resp = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=5,
            temperature=0.0,
        )
        _ = resp.choices[0].message.content
    except Exception as e:
        status = "error"
        err_msg = str(e)
        logger.error(f"[AI Inspector] Health probe failed: {e}")

    latency_ms = round((time.perf_counter() - t0) * 1000, 1)

    provider_name = "Google Gemini" if "generativelanguage.googleapis.com" in (settings.openai_base_url or "") else "OpenAI"

    return AiStatusResponse(
        status=status,
        model=settings.openai_model,
        provider=provider_name,
        base_url=settings.openai_base_url,
        latency_ms=latency_ms,
        active_agents=[
            "Severity Classifier",
            "Intent Parser",
            "Postmortem Generator",
            "Remediation Engine",
        ],
        error=err_msg,
    )


@router.post("/test-agent", response_model=AgentTestResponse)
async def test_agent(req: AgentTestRequest, db: AsyncSession = Depends(get_db)):
    """Run an isolated live inference test against any Sentinel agent."""
    t0 = time.perf_counter()
    agent_name = req.agent.lower().strip()

    try:
        if agent_name in ("severity", "severity_classifier", "severity_agent"):
            service = req.payload.get("service", "payment-gateway")
            raw_event = req.payload.get("raw_payload") or {
                "error": req.payload.get("message", "Database connection pool exhausted; queries timing out"),
                "service": service,
                "environment": "production",
                "impact": "Users unable to complete checkout",
            }

            dummy_event = Event(
                source="ai-inspector-test",
                error_signature=req.payload.get("error_signature", "db_pool_exhausted"),
                raw_payload=raw_event,
            )
            db.add(dummy_event)
            await db.flush()

            severity, reasoning, override = await run_severity_agent(
                new_event=dummy_event,
                db=db,
            )
            duration_ms = round((time.perf_counter() - t0) * 1000, 1)
            return AgentTestResponse(
                agent="Severity Classifier",
                model=settings.openai_model,
                status="success",
                duration_ms=duration_ms,
                output={
                    "severity": severity,
                    "reasoning": reasoning,
                    "override_triggered": override,
                },
            )

        elif agent_name in ("intent", "intent_parser"):
            message = req.payload.get("message", "Investigating now, looks like Redis cache memory is maxed out.")
            fake_incident = Incident(
                id=uuid.uuid4(),
                severity="high",
                status="open",
                title=req.payload.get("title", "High memory usage alert on cache-service"),
                agent_reasoning="Memory exceeded 90% threshold on node-04",
                created_at=datetime.now(timezone.utc),
            )

            result = await parse_intent(
                message=message,
                incident=fake_incident,
                sender=req.payload.get("sender", "evaluator-demo"),
                channel="inspector",
            )
            duration_ms = round((time.perf_counter() - t0) * 1000, 1)
            return AgentTestResponse(
                agent="Intent Parser",
                model=settings.openai_model,
                status="success",
                duration_ms=duration_ms,
                output=result,
            )

        elif agent_name in ("postmortem", "postmortem_agent"):
            fake_incident = Incident(
                id=uuid.uuid4(),
                severity="critical",
                status="resolved",
                title=req.payload.get("title", "Authentication token validation failure across all regions"),
                agent_reasoning="Expired JWKS signing key caused all customer logins to fail for 22 minutes.",
                created_at=datetime.now(timezone.utc),
                resolved_at=datetime.now(timezone.utc),
            )
            fake_threads = [
                ThreadContext(
                    incident_id=fake_incident.id,
                    channel="slack",
                    sender="alice_sre",
                    message="Alert fired: 99% auth failures on /oauth/token",
                    intent_parsed="ack",
                    created_at=datetime.now(timezone.utc),
                ),
                ThreadContext(
                    incident_id=fake_incident.id,
                    channel="slack",
                    sender="bob_lead",
                    message="Rolled back key rotation config and refreshed JWKS cache. Logins restored.",
                    intent_parsed="resolved",
                    created_at=datetime.now(timezone.utc),
                ),
            ]

            # In direct test, call postmortem generator and return outcome
            github_url = await generate_postmortem(
                incident=fake_incident,
                thread_context=fake_threads,
            )
            duration_ms = round((time.perf_counter() - t0) * 1000, 1)
            return AgentTestResponse(
                agent="Postmortem Generator",
                model=settings.openai_model,
                status="success",
                duration_ms=duration_ms,
                output={
                    "status": "postmortem_generated",
                    "github_url": github_url or "Committed locally (GitHub token not set for remote push)",
                    "incident_title": fake_incident.title,
                },
            )

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown agent '{req.agent}'. Available: severity, intent, postmortem",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[AI Inspector] Test failed for {req.agent}: {e}")
        duration_ms = round((time.perf_counter() - t0) * 1000, 1)
        return AgentTestResponse(
            agent=req.agent,
            model=settings.openai_model,
            status="error",
            duration_ms=duration_ms,
            output=None,
            error=str(e),
        )
