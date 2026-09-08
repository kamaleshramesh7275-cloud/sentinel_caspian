"""
Unit tests for RAG Runbook Suggester and Autonomous Auto-Remediation Engine.
"""

import pytest
from app.services.rag_engine import rag_engine
from app.services.remediator import remediator


def test_rag_engine_db_pool_matching():
    search_text = "OperationalError: connection pool exhausted timeout while acquiring connection"
    match = rag_engine.search_runbook(search_text)

    assert match is not None
    assert match["id"] == "rb-db-pool-exhaustion"
    assert "Database Connection Pool Exhaustion" in match["title"]
    assert match["recommended_action"] == "drain_db_connections"
    assert len(match["mitigation_steps"]) >= 3


def test_rag_engine_redis_oom_matching():
    search_text = "Redis command failed: OOM command not allowed when used memory > 'maxmemory'"
    match = rag_engine.search_runbook(search_text)

    assert match is not None
    assert match["id"] == "rb-redis-oom"
    assert match["recommended_action"] == "flush_cache"


def test_rag_engine_payment_gateway_timeout():
    search_text = "HTTP 504 Gateway Timeout while contacting Stripe payment processor"
    match = rag_engine.search_runbook(search_text)

    assert match is not None
    assert match["id"] == "rb-payment-gateway-timeout"
    assert match["recommended_action"] == "restart_service"


@pytest.mark.asyncio
async def test_remediator_list_actions():
    actions = remediator.list_actions()
    action_names = [a["action"] for a in actions]

    assert "drain_db_connections" in action_names
    assert "flush_cache" in action_names
    assert "restart_service" in action_names
    assert "rollback_deployment" in action_names
    assert "scale_replicas" in action_names


@pytest.mark.asyncio
async def test_remediator_execution():
    res = await remediator.execute("drain_db_connections", {"db_name": "checkout_db"})
    assert res.success is True
    assert "drain on database 'checkout_db'" in res.output
    assert res.details.get("drained_count") == 24


@pytest.mark.asyncio
async def test_remediator_unknown_action():
    res = await remediator.execute("invalid_action_xyz")
    assert res.success is False
    assert "Unknown remediation action" in res.output
