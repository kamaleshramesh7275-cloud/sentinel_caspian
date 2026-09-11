"""
Test Script: Resend Email Optimization, Dry-run & Circuit Breaker Verification.
"""

import sys
import asyncio
import uuid
from datetime import datetime, timezone

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from app.config import settings
from app.models import Incident
from app.services.quota_manager import quota_manager, EmailQuotaManager
from app.services.notifier import send_email_notification


async def run_tests():
    print("=" * 60)
    print("[TEST] SENTINEL RESEND OPTIMIZATION VERIFICATION SUITE")
    print("=" * 60)

    # Test 1: Demo / Chaos Burst Guard
    print("\n[Test 1] Synthetic Chaos Burst Guard:")
    test_mgr = EmailQuotaManager()
    incident_id = str(uuid.uuid4())
    allow, reason = test_mgr.can_send_email(incident_id=incident_id, severity="critical", is_demo=True)
    print(f"  Chaos Burst (demo=True) -> Allowed: {allow} | Reason: {reason}")
    assert not allow and "demo_synthetic_guard" in reason, "Demo guard failed!"
    print("  [PASS] Synthetic chaos burst blocked from wasting Resend quota.")

    # Test 2: Incident Cooldown Protection
    print("\n[Test 2] Incident Cooldown Protection:")
    # Simulate first live send
    test_mgr.record_email_dispatched(incident_id=incident_id, real_api_call=True)
    # Immediately attempt second send for same incident
    allow_repeat, reason_repeat = test_mgr.can_send_email(incident_id=incident_id, severity="critical", is_demo=False)
    print(f"  Immediate repeat send -> Allowed: {allow_repeat} | Reason: {reason_repeat}")
    assert not allow_repeat and "cooldown" in reason_repeat, "Cooldown guard failed!"
    print("  [PASS] Duplicate email prevented by cooldown window.")

    # Test 3: Daily Quota & Circuit Breaker Trip
    print("\n[Test 3] Daily Quota Limit & Circuit Breaker:")
    test_mgr_quota = EmailQuotaManager()
    settings.email_daily_quota = 3
    # Send 3 emails
    for i in range(3):
        test_mgr_quota.record_email_dispatched(incident_id=f"inc-{i}", real_api_call=True)

    allow_4th, reason_4th = test_mgr_quota.can_send_email(incident_id="inc-4", severity="critical", is_demo=False)
    print(f"  4th email attempt (Quota=3) -> Allowed: {allow_4th} | Reason: {reason_4th}")
    assert not allow_4th, "Daily quota cutoff failed!"
    assert test_mgr_quota._circuit_breaker_tripped, "Circuit breaker should be tripped!"
    print("  [PASS] Circuit breaker tripped automatically upon quota budget exhaustion.")

    # Test 4: Circuit Breaker Reset
    print("\n[Test 4] Circuit Breaker Manual Reset:")
    test_mgr_quota.reset_circuit_breaker()
    status = test_mgr_quota.get_status()
    assert not status["circuit_breaker"]["tripped"], "Reset failed!"
    print(f"  Circuit breaker state after reset: tripped={status['circuit_breaker']['tripped']}")
    print("  [PASS] Circuit breaker manual reset succeeded.")

    # Test 5: End-to-End Notifier Dry Run Simulation
    print("\n[Test 5] End-to-End Notifier with Simulated Incident:")
    dummy_incident = Incident(
        id=uuid.uuid4(),
        title="Checkout Service Payment Gateway Cascade",
        severity="critical",
        status="open",
        current_channel="email",
        created_at=datetime.now(timezone.utc),
        agent_reasoning="Payment gateway 500 error cascade detected. SRE on-call paged.",
    )
    # Global quota_manager in demo guard mode
    result = await send_email_notification(dummy_incident, is_demo=True)
    print(f"  Notifier execution result: {result}")
    assert result is True, "Simulated send should return True gracefully!"
    print("  [PASS] Notifier cleanly executed simulated email without throwing or failing.")

    print("\n" + "=" * 60)
    print("[SUCCESS] ALL RESEND OPTIMIZATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_tests())
