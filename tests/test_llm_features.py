"""
Unit and integration tests for Sentinel's LLM-centric systems:
1. Long-Term Episodic Vector Memory (Incident RAG)
2. Autonomous Code Patching & Git Diff Synthesizer
3. Model Arena Comparative Evaluation
"""

import pytest
from app.services.vector_memory import EpisodicIncidentMemory
from app.agents.patch_agent import generate_code_patch
from app.models import Incident, Event
import uuid
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_episodic_vector_memory_indexing_and_search():
    memory = EpisodicIncidentMemory(cache_file=None)
    
    test_id = f"test-inc-{uuid.uuid4().hex[:6]}"
    memory.index_incident(
        incident_id=test_id,
        title="Kafka Partition Consumer Lag Spike",
        service="order-stream-worker",
        error_signature="KafkaRebalanceStorm",
        root_cause="Heartbeat timeout expired during heavy batch deserialization.",
        resolution="Increased max.poll.interval.ms from 30000 to 120000 and scaled consumer replicas.",
        severity="high",
        duration_minutes=14,
    )

    # Search by signature
    results = memory.search_historical_incidents(
        query="Kafka consumer batch delay",
        error_signature="KafkaRebalanceStorm",
        top_k=1,
    )

    assert len(results) > 0
    assert results[0]["incident_id"] == test_id
    assert "scaled consumer replicas" in results[0]["resolution"]
    assert results[0]["similarity_score"] > 0.3


@pytest.mark.asyncio
async def test_patch_agent_fallback_and_structure():
    fake_incident = Incident(
        id=uuid.uuid4(),
        title="Stripe 504 Gateway Timeout in Checkout",
        severity="critical",
        status="open",
        agent_reasoning="Payment gateway timeout triggered multiple customer checkout drops.",
        created_at=datetime.now(timezone.utc),
    )

    fake_event = Event(
        id=uuid.uuid4(),
        incident_id=fake_incident.id,
        source="payment-service",
        error_signature="PaymentGatewayTimeout",
        raw_payload={"exception": {"values": [{"type": "TimeoutError", "value": "Gateway timed out"}]}},
        received_at=datetime.now(timezone.utc),
    )

    patch_result = await generate_code_patch(
        incident=fake_incident,
        events=[fake_event],
    )

    assert "target_file" in patch_result
    assert "git_diff" in patch_result
    assert "--- a/" in patch_result["git_diff"]
    assert "+++ b/" in patch_result["git_diff"]
    assert isinstance(patch_result.get("regression_tests"), list)
