"""
Real-Time Event Broadcaster — manages connected WebSocket clients and streams live incident events.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List
from fastapi import WebSocket

logger = logging.getLogger("sentinel.broadcaster")


class Broadcaster:
    """Manages active WebSocket connections and broadcasts real-time JSON events."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)
        logger.info(f"[Broadcaster] Client connected. Total clients: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        logger.info(f"[Broadcaster] Client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        """
        Broadcast an event to all connected clients.
        Payload format: { "type": event_type, "timestamp": "...", "data": data }
        """
        if not self.active_connections:
            return

        message = {
            "type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }

        dead_connections = []
        async with self._lock:
            for connection in self.active_connections:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.debug(f"[Broadcaster] Failed to send message to client: {e}")
                    dead_connections.append(connection)

            for dead in dead_connections:
                if dead in self.active_connections:
                    self.active_connections.remove(dead)


# Global singleton instance
broadcaster = Broadcaster()
