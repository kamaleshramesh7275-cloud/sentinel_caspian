import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models import Incident


@pytest.mark.asyncio
async def test_ai_status_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/ai/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("online", "error")
        assert "model" in data
        assert "active_agents" in data
        assert len(data["active_agents"]) >= 3


@pytest.mark.asyncio
async def test_simulate_reply_endpoint():
    # Seed an incident
    async with AsyncSessionLocal() as db:
        inc = Incident(title="Test DB Timeout", severity="high", status="open")
        db.add(inc)
        await db.commit()
        await db.refresh(inc)
        inc_id = str(inc.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Simulate ack
        resp = await client.post(
            f"/incidents/{inc_id}/simulate-reply",
            json={"message": "Acknowledged, checking logs", "sender": "test_sre"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] in ("ack", "investigating")
        assert data["action_taken"] in ("incident_acknowledged", "investigating_noted")
