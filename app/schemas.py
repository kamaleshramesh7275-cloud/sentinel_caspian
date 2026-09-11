"""
Pydantic schemas for request/response validation.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Webhook ────────────────────────────────────────────────────────────────────

class WebhookPayload(BaseModel):
    """Arbitrary JSON from any event source (CI/CD, PagerDuty, custom)."""
    source: str = Field(..., description="Event source identifier, e.g. 'github-actions', 'datadog'")
    error_signature: Optional[str] = Field(None, description="Normalized error key for deduplication")
    title: Optional[str] = Field(None, description="Human-readable event title")
    payload: dict[str, Any] = Field(default_factory=dict, description="Full raw event data")


class WebhookResponse(BaseModel):
    event_id: uuid.UUID
    incident_id: uuid.UUID
    action: str  # "created" | "attached"
    severity: Optional[str]
    agent_reasoning: Optional[str]


# ── Incidents ──────────────────────────────────────────────────────────────────

class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    severity: Optional[str]
    status: str
    current_channel: Optional[str]
    escalation_count: int
    agent_reasoning: Optional[str]
    created_at: datetime
    last_notified_at: datetime
    resolved_at: Optional[datetime]
    channel_metadata: Optional[dict[str, Any]] = Field(default_factory=dict)


class IncidentListResponse(BaseModel):
    total: int
    incidents: list[IncidentOut]


# ── Reply ──────────────────────────────────────────────────────────────────────

class SlackReplyPayload(BaseModel):
    """Normalized Slack event payload."""
    event: dict[str, Any]
    team_id: Optional[str] = None
    api_app_id: Optional[str] = None
    type: Optional[str] = None
    # Slack URL verification challenge
    challenge: Optional[str] = None


class TelegramReplyPayload(BaseModel):
    """Telegram Update object (subset)."""
    update_id: int
    message: Optional[dict[str, Any]] = None


class ReplyResponse(BaseModel):
    incident_id: Optional[uuid.UUID]
    intent: str
    action_taken: str
    confidence: Optional[float] = None
    reasoning: Optional[str] = None
    follow_up_question: Optional[str] = None


class SimulateReplyRequest(BaseModel):
    message: str
    sender: Optional[str] = "On-Call Engineer"
    channel: Optional[str] = "dashboard-simulator"


# ── Thread Context ─────────────────────────────────────────────────────────────

class ThreadContextOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    channel: str
    sender: str
    message: str
    intent_parsed: Optional[str]
    created_at: datetime


# ── Demo ───────────────────────────────────────────────────────────────────────

class ChaosResponse(BaseModel):
    message: str
    events_fired: int
    incident_id: Optional[uuid.UUID]
    severity: Optional[str]
    agent_reasoning: Optional[str]


# ── Health ─────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str
    db: str
    channels_available: list[str]


# ── Trigger Incident ───────────────────────────────────────────────────────────

class TriggerIncidentRequest(BaseModel):
    title: str = Field(..., description="Human-readable incident title")
    severity: str = Field(default="medium", description="Severity: 'low' | 'medium' | 'high' | 'critical' | 'auto'")
    source: str = Field(default="manual-trigger", description="Event source (datadog, sentry, github-actions, etc.)")
    service: str = Field(default="payment-service", description="Affected service or component")
    error_signature: Optional[str] = Field(None, description="Signature for clustering/deduplication")
    details: Optional[str] = Field(None, description="Detailed error log, stack trace or description")
    raw_payload: Optional[dict[str, Any]] = Field(default=None, description="Optional raw payload")
    send_notifications: bool = Field(default=True, description="Whether to dispatch initial channel notifications")
    is_demo: bool = Field(default=True, description="Demo/simulation mode to protect live email quotas")


class TriggerIncidentResponse(BaseModel):
    incident_id: uuid.UUID
    title: str
    severity: str
    status: str
    current_channel: Optional[str] = None
    agent_reasoning: Optional[str] = None
    action: str = "created"
    message: str

