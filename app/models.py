"""
SQLAlchemy ORM models — exact schema from Sentinel brief.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    UUID,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
)

from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=True)
    source = Column(Text, nullable=False)
    raw_payload = Column(JSON, nullable=False)
    error_signature = Column(Text, nullable=True)
    received_at = Column(DateTime(timezone=True), default=utcnow)

    incident = relationship("Incident", back_populates="events")

    def __repr__(self):
        return f"<Event id={self.id} source={self.source}>"


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(Text, nullable=False)
    severity = Column(
        String(20),
        CheckConstraint("severity IN ('low','medium','high','critical')"),
        nullable=True,
    )
    status = Column(
        String(20),
        CheckConstraint("status IN ('open','escalated','ack','resolved')"),
        default="open",
        nullable=False,
    )
    current_channel = Column(Text, nullable=True)
    escalation_count = Column(Integer, default=0)
    agent_reasoning = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    last_notified_at = Column(DateTime(timezone=True), default=utcnow)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    channel_metadata = Column(JSON, default=dict)

    # Relationships
    events = relationship("Event", back_populates="incident")
    thread_context = relationship("ThreadContext", back_populates="incident")

    def __repr__(self):
        return f"<Incident id={self.id} severity={self.severity} status={self.status}>"


class ThreadContext(Base):
    __tablename__ = "thread_context"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    channel = Column(Text, nullable=False)
    sender = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    intent_parsed = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    incident = relationship("Incident", back_populates="thread_context")

    def __repr__(self):
        return f"<ThreadContext incident={self.incident_id} channel={self.channel} sender={self.sender}>"


class EscalationRule(Base):
    __tablename__ = "escalation_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    severity = Column(Text, nullable=False, unique=True)
    time_to_ack_minutes = Column(Integer, nullable=False)
    # e.g. ["slack", "telegram", "email"]
    escalation_path = Column(JSON, nullable=False)

    def __repr__(self):
        return f"<EscalationRule severity={self.severity} path={self.escalation_path}>"
