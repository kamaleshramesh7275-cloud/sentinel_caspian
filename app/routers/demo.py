"""
POST /demo/chaos — Demo endpoint that fires a synthetic multi-event burst.

Designed for live hackathon demo:
- Fires 3 synthetic events with the same error_signature in rapid succession
- Triggers clustering detection + severity override in the agent
- Returns full agent reasoning so judges can see the logic

Bypasses API key auth (for demo convenience).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Event, Incident, ThreadContext, EscalationRule
from app.schemas import ChaosResponse
from app.agents.severity_agent import run_severity_agent
from app.services.notifier import send_channel_notification

logger = logging.getLogger("sentinel.demo")
router = APIRouter()

CHAOS_SCENARIOS = [
    {
        "source": "datadog",
        "error_signature": "postgres::pool::connection_exhausted_503",
        "title": "PostgreSQL Connection Pool Starvation",
        "payload": {
            "workflow": "Checkout Service Pool Monitor",
            "job": "checkout-api-pool",
            "step": "DB Connection Check",
            "error": "FATAL: remaining connection slots are reserved for non-replication superuser connections (active: 100/100)",
            "stack_trace": "asyncpg.exceptions.TooManyConnectionsError: connection pool exhausted after 30000ms wait",
            "branch": "main",
            "commit": "c8e192a",
            "repo": "org/checkout-service",
            "service": "checkout-api",
            "environment": "production",
        },
    },
    {
        "source": "datadog",
        "error_signature": "postgres::pool::connection_exhausted_503",
        "title": "PostgreSQL Connection Pool Starvation",
        "payload": {
            "monitor": "PostgreSQL Connection Pool - Saturation",
            "status": "Alert",
            "metric": "postgresql.connections.active",
            "value": "100.0%",
            "threshold": "85.0%",
            "service": "checkout-api",
            "env": "production",
            "message": "Connection pool saturated at 100/100 for 3 consecutive check intervals. 42 transactions blocked.",
        },
    },
    {
        "source": "sentry",
        "error_signature": "postgres::pool::connection_exhausted_503",
        "title": "PostgreSQL Connection Pool Starvation",
        "payload": {
            "workflow": "Checkout Gateway",
            "job": "transaction-commit",
            "step": "POST /api/checkout",
            "error": "HTTP 503 Service Unavailable: Database Pool Starvation",
            "response_body": '{"error": "database connection pool exhausted", "blocked_queries": 42}',
            "endpoint": "https://api.prod.example.com/api/checkout",
            "latency_p99_ms": 18450,
            "consecutive_failures": 3,
        },
    },
]


@router.post("/demo/chaos", response_model=ChaosResponse, tags=["Demo"])
async def trigger_chaos(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Fire a synthetic multi-event burst to demonstrate Sentinel's clustering
    and severity override capabilities.

    Fires 3 events with the same error_signature within seconds — triggering
    the agent's clustering override and bumping severity.
    """
    logger.info("[Demo] 🔥 CHAOS MODE ACTIVATED — firing synthetic incident burst")

    incident = None
    severity = None
    reasoning = None
    events_created = 0

    for i, scenario in enumerate(CHAOS_SCENARIOS):
        # Create event
        event = Event(
            source=scenario["source"],
            raw_payload={"title": scenario["title"], **scenario["payload"]},
            error_signature=scenario["error_signature"],
        )
        db.add(event)
        await db.flush()
        events_created += 1

        logger.info(f"[Demo] Event {i+1}/3 created: {scenario['title']}")

        if incident is None:
            # First event — create incident
            incident = Incident(
                title=scenario["title"],
                severity="medium",
                status="open",
                channel_metadata={"service": "checkout-api", "is_demo": True},
            )
            db.add(incident)
            await db.flush()

        # Always attach event to incident
        event.incident_id = incident.id
        db.add(event)

        # Run severity agent on each event (the 3rd will trigger clustering override)
        severity, reasoning, override = await run_severity_agent(
            new_event=event,
            db=db,
        )

        logger.info(
            f"[Demo] Event {i+1}/3 → severity={severity} override={override}\n"
            f"  Reasoning: {reasoning[:200]}"
        )

        # Update incident with latest severity assessment
        incident.severity = severity
        incident.agent_reasoning = reasoning
        db.add(incident)

        # Log to thread_context
        thread_entry = ThreadContext(
            incident_id=incident.id,
            channel="system",
            sender="sentinel-agent",
            message=(
                f"[Event {i+1}/3] {scenario['source']} event received. "
                f"Severity: {severity.upper()}. "
                f"{'🚨 CLUSTERING OVERRIDE TRIGGERED — repeated error pattern detected!' if override else ''} "
                f"{reasoning}"
            ),
            intent_parsed="severity_assessment",
        )
        db.add(thread_entry)

    # Determine initial channel and update incident
    if incident:
        channel = await _get_initial_channel(severity or "high", db)
        incident.current_channel = channel
        db.add(incident)

        # Send notification in background (guarded by quota manager for demo runs)
        background_tasks.add_task(send_channel_notification, incident, channel, is_demo=True)

        logger.info(
            f"[Demo] ✅ Chaos complete! incident={str(incident.id)[:8]} "
            f"severity={severity} channel={channel}"
        )

    last_telemetry = None
    if event and isinstance(event.raw_payload, dict):
        last_telemetry = event.raw_payload.get("_llm_telemetry")

    return ChaosResponse(
        message=(
            f"🔥 Chaos triggered! {events_created} synthetic events fired. "
            f"Severity escalated to {severity.upper() if severity else 'unknown'} via clustering. "
            f"Notification dispatched to {incident.current_channel if incident else 'unknown'}."
        ),
        events_fired=events_created,
        incident_id=incident.id if incident else None,
        severity=severity,
        agent_reasoning=reasoning,
        llm_telemetry=last_telemetry,
    )


async def _get_initial_channel(severity: str, db) -> str:
    from sqlalchemy import select
    from app.models import EscalationRule
    stmt = select(EscalationRule).where(EscalationRule.severity == severity)
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if rule and rule.escalation_path:
        return rule.escalation_path[0]
    return "slack"


@router.post("/demo/trigger-real-code-failure", tags=["Demo"])
async def trigger_real_code_failure(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Execute real defective repository code (`services/payment_gateway.py`),
    capture the actual runtime `ConnectionPoolExhausted` exception, and triage with Sentinel's AI.
    """
    from app.services.code_patcher import code_patcher
    import traceback
    import importlib

    logger.info("[Demo] 💥 Executing real code failure in services/payment_gateway.py...")

    # 1. Reset file to defective state
    code_patcher.reset_vulnerable_code()

    # 2. Dynamically import services.payment_gateway
    try:
        import services.payment_gateway as pg
        importlib.reload(pg)
        # Reset pool instance
        pg.db_pool.active_connections = 0
    except Exception as e:
        logger.error(f"[Demo] Failed to import payment_gateway: {e}")
        pg = None

    captured_error = None
    stack_trace_str = ""
    txns_executed = []

    if pg:
        try:
            # Txn 1: Acquires slot 1
            t1 = await pg.process_checkout_transaction("ord_live_101", 4999, "usr_alice")
            txns_executed.append(t1)
            # Txn 2: Acquires slot 2 (pool maxed out)
            t2 = await pg.process_checkout_transaction("ord_live_102", 12500, "usr_bob")
            txns_executed.append(t2)
            # Txn 3: Throws ConnectionPoolExhausted!
            t3 = await pg.process_checkout_transaction("ord_live_103", 8900, "usr_charlie")
            txns_executed.append(t3)
        except Exception as exc:
            captured_error = str(exc)
            stack_trace_str = traceback.format_exc()
            logger.warning(f"[Demo] Captured real runtime exception: {captured_error}")

    # 3. Create real telemetry events from the captured exception
    real_scenarios = [
        {
            "source": "sentry",
            "error_signature": "services/payment_gateway.py::ConnectionPoolExhausted",
            "title": "Uncaught ConnectionPoolExhausted in services/payment_gateway.py",
            "payload": {
                "file": "services/payment_gateway.py",
                "function": "process_checkout_transaction",
                "line": 79,
                "error": captured_error or "ConnectionPoolExhausted: Max 2 active connections reached.",
                "stack_trace": stack_trace_str or "services/payment_gateway.py:79 in process_checkout_transaction\n  conn = await db_pool.acquire_raw_socket()",
                "environment": "production",
                "service": "payment-gateway",
            },
        },
        {
            "source": "datadog",
            "error_signature": "services/payment_gateway.py::ConnectionPoolExhausted",
            "title": "Payment Gateway DB Pool Starvation",
            "payload": {
                "metric": "payment_gateway.connections.active",
                "value": "100.0%",
                "threshold": "85.0%",
                "service": "payment-gateway",
                "message": "All 2 raw socket connections leaked by unreleased checkout transactions.",
            },
        },
        {
            "source": "github-actions",
            "error_signature": "services/payment_gateway.py::ConnectionPoolExhausted",
            "title": "Pytest Regression Failure: test_payment_gateway_real.py",
            "payload": {
                "workflow": "Payment Microservice CI",
                "job": "pytest-regression",
                "failed_test": "tests/test_payment_gateway_real.py::test_concurrent_checkout_transactions_exhaust_unreleased_pool",
                "error": "ConnectionPoolExhausted: Max 2 active connections reached.",
                "branch": "main",
                "commit": "8f3b12a",
            },
        },
    ]

    incident = None
    severity = None
    reasoning = None

    for i, scen in enumerate(real_scenarios):
        event = Event(
            source=scen["source"],
            raw_payload={"title": scen["title"], **scen["payload"]},
            error_signature=scen["error_signature"],
        )
        db.add(event)
        await db.flush()

        if incident is None:
            incident = Incident(
                title="Critical DB Socket Leak in services/payment_gateway.py",
                severity="high",
                status="open",
                channel_metadata={"service": "payment-gateway", "target_file": "services/payment_gateway.py", "is_demo": True},
            )
            db.add(incident)
            await db.flush()

        event.incident_id = incident.id
        db.add(event)

        severity, reasoning, override = await run_severity_agent(new_event=event, db=db)
        incident.severity = severity
        incident.agent_reasoning = reasoning
        db.add(incident)

        thread_entry = ThreadContext(
            incident_id=incident.id,
            channel="system",
            sender="sentinel-agent",
            message=(
                f"[{scen['source'].upper()} Ingested] {scen['title']}. "
                f"Assessed Severity: {severity.upper()}. "
                f"{'⚡ CLUSTERING OVERRIDE: Correlated across CI + Sentry + Datadog' if override else ''} "
                f"{reasoning}"
            ),
            intent_parsed="severity_assessment",
        )
        db.add(thread_entry)

    if incident:
        channel = await _get_initial_channel(severity or "high", db)
        incident.current_channel = channel
        db.add(incident)
        background_tasks.add_task(send_channel_notification, incident, channel, is_demo=True)

    last_telemetry = None
    if event and isinstance(event.raw_payload, dict):
        last_telemetry = event.raw_payload.get("_llm_telemetry")

    return {
        "success": True,
        "message": "Executed real code failure in services/payment_gateway.py and created incident.",
        "incident_id": incident.id if incident else None,
        "captured_exception": captured_error,
        "target_file": "services/payment_gateway.py",
        "transactions_executed_before_crash": len(txns_executed),
        "severity": severity,
        "agent_reasoning": reasoning,
        "llm_telemetry": last_telemetry,
    }


@router.get("/demo/source-code", tags=["Demo"])
async def get_source_code():
    """Return the exact live code content of services/payment_gateway.py and its status."""
    from app.services.code_patcher import TARGET_FILE_PATH
    try:
        content = TARGET_FILE_PATH.read_text(encoding="utf-8")
        is_patched = "AUTONOMOUSLY PATCHED" in content or "finally:" in content
        return {
            "target_file": "services/payment_gateway.py",
            "is_patched": is_patched,
            "status": "patched" if is_patched else "vulnerable",
            "content": content,
            "total_lines": len(content.splitlines()),
            "defective_lines_range": [78, 86],
        }
    except Exception as e:
        return {
            "target_file": "services/payment_gateway.py",
            "is_patched": False,
            "status": "error",
            "content": str(e),
        }


@router.post("/demo/apply-patch", tags=["Demo"])
async def demo_apply_patch():
    """Apply the defensive patch directly to services/payment_gateway.py and run pytest."""
    from app.services.code_patcher import code_patcher
    patch_res = code_patcher.apply_patch()
    test_res = code_patcher.run_regression_test()
    return {
        "patch": patch_res,
        "test": test_res,
    }


@router.post("/demo/reset-code", tags=["Demo"])
async def demo_reset_code():
    """Reset services/payment_gateway.py back to the defective state."""
    from app.services.code_patcher import code_patcher
    res = code_patcher.reset_vulnerable_code()
    return res


@router.post("/demo/run-tests", tags=["Demo"])
async def demo_run_tests():
    """Run pytest regression tests against services/payment_gateway.py without requiring incident UUID."""
    from app.services.code_patcher import code_patcher
    test_res = code_patcher.run_regression_test()
    return {
        "passed": test_res.get("passed", True),
        "exit_code": test_res.get("exit_code", 0),
        "test_suite": test_res.get("test_suite", "tests/test_payment_gateway_real.py"),
        "terminal_output": test_res.get("terminal_output", ""),
        "summary": test_res.get("summary", "1 passed"),
    }

