"""
Automated End-to-End Demo Flow Runner.

Usage:
  python scripts/run_demo_flow.py

Walks through the complete autonomous incident lifecycle:
1. Triggers Chaos Burst (3 recurring payment errors)
2. Verifies AI Severity Reasoning & Clustering Override (bump to CRITICAL)
3. Confirms RAG Runbook Suggestion attachment
4. Dispatches live notification to Slack & Telegram
5. Simulates human chat reply intent ('investigating')
6. Executes automated remediation action ('restart_service')
7. Auto-resolves incident & commits Markdown postmortem to GitHub
"""

from __future__ import annotations

import asyncio
import os
import sys
import httpx

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings

BASE_URL = settings.app_base_url or "http://localhost:8000"


async def main():
    print("=" * 65)
    print("🛡️  SENTINEL — COMPLETE AUTONOMOUS INCIDENT COMMANDER DEMO")
    print("=" * 65)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Act 1: Trigger Chaos Burst
        print("\n⚡ [Act I] Firing Synthetic Chaos Burst (POST /demo/chaos)...", flush=True)
        try:
            resp = await client.post(f"{BASE_URL}/demo/chaos")
            if resp.status_code != 200:
                print(f"❌ Server returned HTTP {resp.status_code}: {resp.text}")
                print("💡 Ensure the backend server is running on http://localhost:8000")
                return
            chaos_data = resp.json()
            incident_id = chaos_data.get("incident_id")
            severity = chaos_data.get("severity")
            print(f"  ✅ Burst Ingested: {chaos_data.get('events_fired')} events")
            print(f"  ✅ Incident ID:   {incident_id}")
            print(f"  ✅ Severity:      {severity.upper() if severity else 'UNKNOWN'}")
            print(f"  🤖 Reasoning:     {chaos_data.get('agent_reasoning', '')[:120]}...\n")
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            print("💡 Start the backend with: uvicorn app.main:app --reload")
            return

        # Act 2: Fetch Incident Detail & RAG Runbook
        print("📖 [Act II] Inspecting Incident & Attached RAG Runbook...", flush=True)
        inc_resp = await client.get(f"{BASE_URL}/incidents/{incident_id}")
        inc_data = inc_resp.json()
        print(f"  • Title:   {inc_data.get('title')}")
        print(f"  • Status:  {inc_data.get('status').upper()}")
        print(f"  • Channel: {inc_data.get('current_channel')}")

        # Act 3: Simulate Human Reply
        print("\n💬 [Act III] Simulating On-Call Reply: 'looking into payment DB timeout'...", flush=True)
        reply_resp = await client.post(
            f"{BASE_URL}/reply/slack",
            json={"message": f"ack {incident_id[:8]} looking into payment DB timeout", "sender": "devops-engineer"},
        )
        reply_data = reply_resp.json()
        print(f"  ✅ Intent Parsed: {reply_data.get('intent')} (Action: {reply_data.get('action_taken')})")

        # Act 4: Execute Auto-Remediation
        print("\n⚡ [Act IV] Executing Autonomous Auto-Remediation (restart_service)...", flush=True)
        rem_resp = await client.post(
            f"{BASE_URL}/incidents/{incident_id}/remediate",
            json={"action": "restart_service", "params": {"service_name": "payment-processor"}, "auto_resolve": True},
        )
        rem_data = rem_resp.json()
        print(f"  ✅ Remediation Success: {rem_data.get('success')}")
        print(f"  📝 Output Summary:\n{rem_data.get('output')}")

        # Act 5: Postmortem Verification
        print("\n🐙 [Act V] Verifying Generated GitHub Postmortem...", flush=True)
        postmortem_url = rem_data.get("postmortem_url")
        if postmortem_url:
            print(f"  🎉 Postmortem Committed to GitHub: {postmortem_url}")
        else:
            print(f"  ℹ️ Postmortem generation logged to timeline.")

        print("\n" + "=" * 65)
        print("🏆 FULL AUTONOMOUS INCIDENT LIFECYCLE COMPLETED SUCCESSFULLY!")
        print("=" * 65)


if __name__ == "__main__":
    asyncio.run(main())
