"""
Feature 1: Time-Travel Predictive Outage Simulator.

Performs autoregressive failure rollout across a 30-minute cascade horizon (T+5m, T+15m, T+30m).
Calculates:
1. Cascading blast-radius risk across microservices
2. Downstream saturation probabilities (DB pool, Cache, Gateway)
3. Mean Time To Total Outage (MTTO)
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.models import Event, Incident
from app.services.sre_llm_provider import sre_llm

logger = logging.getLogger("sentinel.simulator_agent")

SYSTEM_PROMPT = """You are Sentinel's Predictive Time-Travel Outage Simulator — a Principal SRE AI with deep knowledge of distributed systems failures.

Your mission: Given an initial incident alert and error signature, perform an autoregressive simulation of the next 30 minutes of system health if NO mitigation is applied.

Simulate at 3 distinct time horizons:
- T+5m: Immediate downstream propagation (thread starvation, cache misses)
- T+15m: Saturation phase (queue backpressure, 504 gateway timeouts)
- T+30m: Total catastrophic collapse / deadlock state

You MUST respond ONLY with valid JSON in this exact structure:
{
  "simulation_id": "sim-xxxx",
  "incident_title": "<incident title>",
  "mtto_minutes": <estimated minutes until total system outage, e.g. 24>,
  "cascade_risk_score": <float between 0.00 and 1.00, e.g. 0.88>,
  "timeline": [
    {
      "horizon": "T+5m",
      "status": "<DEGRADING | CRITICAL | COLLAPSED>",
      "affected_services": ["service-a", "service-b"],
      "projected_state": "Detailed description of what will break at T+5m",
      "failure_probability": 0.65
    },
    {
      "horizon": "T+15m",
      "status": "CRITICAL",
      "affected_services": ["service-a", "service-b", "api-gateway"],
      "projected_state": "Detailed description of what will break at T+15m",
      "failure_probability": 0.85
    },
    {
      "horizon": "T+30m",
      "status": "COLLAPSED",
      "affected_services": ["all-services", "auth-cluster", "database"],
      "projected_state": "Full cascading deadlock scenario",
      "failure_probability": 0.95
    }
  ],
  "preemptive_circuit_breaker_recommendation": "Exact immediate step to cut the cascade circuit (e.g., enable read-only replica mode, throttle /checkout to 50 req/s)"
}
"""


async def simulate_outage_cascade(
    *,
    incident: Incident,
    events: list[Event],
) -> dict[str, Any]:
    """Simulate a 30-minute failure cascade trajectory using SRE LLM reasoning."""
    event_contexts = []
    for ev in events[:5]:
        event_contexts.append({
            "source": ev.source,
            "error_signature": ev.error_signature,
            "payload_summary": str(ev.raw_payload)[:300],
        })

    user_prompt = f"""Simulate the 30-minute outage cascade for this incident:
Incident Title: {incident.title}
Current Severity: {incident.severity}
Current Status: {incident.status}

Triggering Event Telemetry:
{json.dumps(event_contexts, indent=2)}

Predict how this failure will propagate across dependent upstream and downstream microservices.
"""

    try:
        raw_output = await sre_llm.generate_reasoning(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        return json.loads(raw_output)
    except Exception as e:
        logger.error("Simulation failed: %s", e)
        # Resilient fallback simulation structure
        return {
            "simulation_id": f"sim-fallback-{incident.id}",
            "incident_title": incident.title,
            "mtto_minutes": 20,
            "cascade_risk_score": 0.75,
            "timeline": [
                {
                    "horizon": "T+5m",
                    "status": "DEGRADING",
                    "affected_services": [incident.title.split()[0] if incident.title else "core-service"],
                    "projected_state": "Worker thread pool queue buildup and response latency escalation.",
                    "failure_probability": 0.70
                },
                {
                    "horizon": "T+15m",
                    "status": "CRITICAL",
                    "affected_services": ["api-gateway", "worker-nodes"],
                    "projected_state": "Upstream circuit breakers trigger 504 Gateway Timeout errors.",
                    "failure_probability": 0.85
                },
                {
                    "horizon": "T+30m",
                    "status": "COLLAPSED",
                    "affected_services": ["all-services"],
                    "projected_state": "Complete cascading deadlock across dependent microservices.",
                    "failure_probability": 0.95
                }
            ],
            "preemptive_circuit_breaker_recommendation": "Throttle traffic at API Gateway and restart degraded worker pods."
        }
