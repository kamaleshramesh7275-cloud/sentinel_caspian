"""
Comprehensive Test Suite for Sentinel SRE Innovations:
1. Time-Travel Outage Simulator
2. Speculative Shadow Sandbox Healer
3. Autonomous Chaos Engineering Generator
"""

import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.models import Event, Incident
from app.agents.simulator_agent import simulate_outage_cascade
from app.services.shadow_sandbox import shadow_sandbox
from app.agents.speculative_patch_agent import run_speculative_healing
from app.agents.chaos_agent import generate_chaos_experiment


@pytest.fixture
def mock_incident():
    return Incident(
        id=uuid.uuid4(),
        title="Postgres Connection Pool Saturation on Checkout",
        severity="critical",
        status="open",
        agent_reasoning="Cascading failure triggered by unindexed database lock timeout"
    )


@pytest.fixture
def mock_events(mock_incident):
    return [
        Event(
            id=uuid.uuid4(),
            incident_id=mock_incident.id,
            source="sentry",
            error_signature="Postgres::PoolExhausted::500",
            raw_payload={
                "error": "FATAL: remaining connection slots are reserved for non-replication superuser connections",
                "service": "checkout-api",
                "stacktrace": ["app/db.py:45 in get_connection", "app/routes/orders.py:120 in checkout"]
            },
            received_at=datetime.now(timezone.utc)
        )
    ]


@pytest.mark.asyncio
async def test_time_travel_simulator(mock_incident, mock_events):
    """Verify time-travel cascade simulation output structure and MTTO prediction."""
    res = await simulate_outage_cascade(incident=mock_incident, events=mock_events)

    assert "timeline" in res
    assert len(res["timeline"]) >= 3
    assert "mtto_minutes" in res
    assert res["mtto_minutes"] > 0
    assert "cascade_risk_score" in res
    assert 0.0 <= res["cascade_risk_score"] <= 1.0

    horizons = [t["horizon"] for t in res["timeline"]]
    assert "T+5m" in horizons
    assert "T+15m" in horizons
    assert "T+30m" in horizons


@pytest.mark.asyncio
async def test_shadow_sandbox_execution():
    """Verify shadow sandbox AST parsing, code execution, and safety scoring."""
    valid_code = """
def process_order(payload):
    if not payload:
        return {'status': 'error', 'msg': 'empty'}
    return {'status': 'ok', 'order_id': payload.get('id')}
"""
    result = await shadow_sandbox.execute_verification(
        target_file="app/services/orders.py",
        failing_code_snippet="def process_order(payload): return payload['id']",
        git_diff="--- a/app/services/orders.py\n+++ b/app/services/orders.py",
        fixed_code_snippet=valid_code,
        test_assertions=["assert process_order(None)['status'] == 'error'"]
    )

    assert result.success is True
    assert result.patch_applied_cleanly is True
    assert result.tests_passed is True
    assert result.safety_confidence_score > 0.8


@pytest.mark.asyncio
async def test_speculative_patch_agent(mock_incident, mock_events):
    """Verify full closed-loop self-healing agent."""
    healing_res = await run_speculative_healing(incident=mock_incident, events=mock_events)

    assert "target_file" in healing_res
    assert "sandbox_verification" in healing_res
    assert "safety_confidence_score" in healing_res["sandbox_verification"]
    assert healing_res["deployment_status"] in ["READY_FOR_DEPLOYMENT", "REQUIRES_MANUAL_REVIEW"]


@pytest.mark.asyncio
async def test_chaos_agent(mock_incident, mock_events):
    """Verify autonomous Chaos Engineering experiment generation."""
    chaos_res = await generate_chaos_experiment(incident=mock_incident, events=mock_events)

    assert "experiment_name" in chaos_res
    assert "chaos_crd_yaml" in chaos_res
    assert "verification_assertions" in chaos_res
    assert len(chaos_res["verification_assertions"]) >= 1
