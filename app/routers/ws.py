"""
WebSocket router for real-time incident event streaming.
"""

from __future__ import annotations

import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.broadcaster import broadcaster

logger = logging.getLogger("sentinel.ws")
router = APIRouter()


@router.websocket("/ws/incidents")
async def websocket_incidents_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time incident and timeline updates.
    Streams incident creation, severity reasoning, escalation ticks, and replies.
    """
    await broadcaster.connect(websocket)
    try:
        # Keep connection open and handle optional client heartbeats / pings
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await broadcaster.disconnect(websocket)
    except Exception as e:
        logger.debug(f"[WebSocket] Error on client connection: {e}")
        await broadcaster.disconnect(websocket)
