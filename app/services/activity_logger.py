"""
Live Operations Activity Logger & Aggregator.
Maintains an in-memory chronological activity buffer and broadcasts
real-time events across Slack, Telegram, Email, Gemini LLM, GitHub, and Remediation.
"""

from __future__ import annotations

import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
import logging

from app.services.broadcaster import broadcaster

logger = logging.getLogger("sentinel.activity_logger")

ActivityCategory = Literal[
    "slack", "telegram", "email", "llm", "github", "remediation", "system"
]

MAX_IN_MEMORY_EVENTS = 500


class ActivityEvent:
    def __init__(
        self,
        category: ActivityCategory,
        title: str,
        summary: str,
        details: Optional[str] = None,
        incident_id: Optional[str] = None,
        incident_title: Optional[str] = None,
        severity: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        event_id: Optional[str] = None,
        timestamp: Optional[str] = None,
    ):
        self.id = event_id or str(uuid.uuid4())
        self.timestamp = timestamp or datetime.now(timezone.utc).isoformat()
        self.category = category
        self.title = title
        self.summary = summary
        self.details = details or ""
        self.incident_id = incident_id
        self.incident_title = incident_title
        self.severity = severity
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "category": self.category,
            "title": self.title,
            "summary": self.summary,
            "details": self.details,
            "incident_id": self.incident_id,
            "incident_title": self.incident_title,
            "severity": self.severity,
            "metadata": self.metadata,
        }


class ActivityLogger:
    def __init__(self):
        self._buffer: deque[ActivityEvent] = deque(maxlen=MAX_IN_MEMORY_EVENTS)

    async def log_activity(
        self,
        category: ActivityCategory,
        title: str,
        summary: str,
        details: Optional[str] = None,
        incident_id: Optional[str] = None,
        incident_title: Optional[str] = None,
        severity: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ActivityEvent:
        """Record an activity event and broadcast it live to all WebSocket clients."""
        event = ActivityEvent(
            category=category,
            title=title,
            summary=summary,
            details=details,
            incident_id=incident_id,
            incident_title=incident_title,
            severity=severity,
            metadata=metadata,
        )
        self._buffer.appendleft(event)
        logger.info(f"[ActivityLogger] [{category.upper()}] {title} - {summary}")

        # Broadcast live to connected clients
        try:
            await broadcaster.broadcast("activity_logged", event.to_dict())
        except Exception as e:
            logger.debug(f"[ActivityLogger] Failed to broadcast activity: {e}")

        return event

    def get_recent(
        self,
        category: Optional[str] = None,
        incident_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get filtered list of recent activities from memory."""
        results = []
        for event in self._buffer:
            if category and category != "all" and event.category != category:
                continue
            if incident_id and event.incident_id != incident_id:
                continue
            results.append(event.to_dict())
            if len(results) >= limit:
                break
        return results


# Global singleton instance
activity_logger = ActivityLogger()
