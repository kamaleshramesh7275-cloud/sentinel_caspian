"""
Unit tests for real-time WebSocket broadcaster and in-thread message metadata.
"""

import asyncio
import pytest
from app.models import Incident
from app.services.broadcaster import Broadcaster


@pytest.mark.asyncio
async def test_broadcaster_connection_and_broadcast():
    broadcaster = Broadcaster()

    # Mock WebSocket client
    class MockWebSocket:
        def __init__(self):
            self.accepted = False
            self.messages = []

        async def accept(self):
            self.accepted = True

        async def send_json(self, data):
            self.messages.append(data)

    client1 = MockWebSocket()
    client2 = MockWebSocket()

    await broadcaster.connect(client1)
    await broadcaster.connect(client2)

    assert len(broadcaster.active_connections) == 2
    assert client1.accepted is True

    # Broadcast test event
    await broadcaster.broadcast("incident_created", {"id": "123", "severity": "critical"})

    assert len(client1.messages) == 1
    assert client1.messages[0]["type"] == "incident_created"
    assert client1.messages[0]["data"]["severity"] == "critical"

    assert len(client2.messages) == 1
    assert client2.messages[0]["data"]["id"] == "123"

    # Disconnect client1
    await broadcaster.disconnect(client1)
    assert len(broadcaster.active_connections) == 1


def test_incident_channel_metadata_initialization():
    incident = Incident(
        title="Test Incident",
        severity="high",
        channel_metadata={"slack_ts": "1710000000.12345", "telegram_message_id": 999},
    )

    assert incident.channel_metadata["slack_ts"] == "1710000000.12345"
    assert incident.channel_metadata["telegram_message_id"] == 999
