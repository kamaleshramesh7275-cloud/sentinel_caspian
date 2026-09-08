"""
Basic tests for Sentinel severity agent logic.
Run with: pytest tests/ -v
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import uuid
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_fallback_severity_by_cluster_count():
    """Test that fallback severity scales with cluster count."""
    from app.agents.severity_agent import _fallback_severity
    assert _fallback_severity(1) == "low"
    assert _fallback_severity(2) == "medium"
    assert _fallback_severity(3) == "high"
    assert _fallback_severity(5) == "critical"


@pytest.mark.asyncio
async def test_get_next_channel_advances():
    """Test that _get_next_channel properly advances through escalation path."""
    from app.services.escalation import _get_next_channel
    path = ["slack", "telegram", "email"]
    assert _get_next_channel(path, None) == "slack"
    assert _get_next_channel(path, "slack") == "telegram"
    assert _get_next_channel(path, "telegram") == "email"
    assert _get_next_channel(path, "email") == "email"  # stays on last


@pytest.mark.asyncio
async def test_get_next_channel_not_in_path():
    """Test that _get_next_channel defaults to first channel if current not in path."""
    from app.services.escalation import _get_next_channel
    path = ["slack", "telegram"]
    assert _get_next_channel(path, "unknown-channel") == "slack"


def test_format_slack_message():
    """Test Slack message formatting produces valid Block Kit structure."""
    from app.services.notifier import format_slack_message
    from app.models import Incident

    incident = Incident(
        id=uuid.uuid4(),
        title="Test Incident: Payment API Down",
        severity="critical",
        status="open",
        current_channel="slack",
        escalation_count=2,
        agent_reasoning="Critical: payment service is returning 503 errors. Clustering override triggered.",
        created_at=datetime.now(timezone.utc),
        last_notified_at=datetime.now(timezone.utc),
    )

    result = format_slack_message(incident)
    assert "text" in result
    assert "attachments" in result
    assert "CRITICAL" in result["text"]
    assert len(result["attachments"][0]["blocks"]) > 0


def test_format_telegram_message():
    """Test Telegram message is short and contains key info."""
    from app.services.notifier import format_telegram_message
    from app.models import Incident

    incident = Incident(
        id=uuid.uuid4(),
        title="DB Replication Lag",
        severity="high",
        status="escalated",
        current_channel="telegram",
        escalation_count=1,
        created_at=datetime.now(timezone.utc),
        last_notified_at=datetime.now(timezone.utc),
    )

    result = format_telegram_message(incident)
    assert "HIGH" in result
    assert "ack" in result.lower()
    assert len(result) < 500  # Telegram messages should be concise


def test_format_email():
    """Test email formatting produces valid subject + HTML."""
    from app.services.notifier import format_email
    from app.models import Incident

    incident = Incident(
        id=uuid.uuid4(),
        title="Critical: Auth Service Down",
        severity="critical",
        status="escalated",
        current_channel="email",
        escalation_count=3,
        agent_reasoning="Auth service is completely unavailable.",
        created_at=datetime.now(timezone.utc),
        last_notified_at=datetime.now(timezone.utc),
    )

    result = format_email(incident)
    assert "subject" in result
    assert "html_body" in result
    assert "CRITICAL" in result["subject"]
    assert "Auth Service Down" in result["subject"]
    assert "<!DOCTYPE html>" in result["html_body"]
