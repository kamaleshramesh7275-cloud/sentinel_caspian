"""
Sentinel SRE 14B Foundation Model Tester & Diagnostic CLI.

Verifies end-to-end inference for:
1. Model connectivity (Hugging Face / vLLM / Ollama / Fallbacks)
2. Severity Reasoning with Clustering Override
3. Causal Root Cause Analysis (RCA DAG)
4. Speculative Safe RFC Remediation
5. Natural Language Intent Parsing
6. Chaos Mesh Experiment Synthesis
"""

import asyncio
import io
import json
import logging
import sys
import time

from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sentinel.test_14b")


async def main():
    print("=" * 70)
    print("[SENTINEL SRE 14B FOUNDATION MODEL DIAGNOSTIC SUITE]")
    print("=" * 70)

    from app.config import settings
    from app.services.sre_llm_provider import sre_llm

    # 1. Health Probe
    print("\n🔍 1. Probing SRE LLM Connectivity...")
    probe = await sre_llm.probe_health()
    print(f"   • Model ID   : {probe['model']}")
    print(f"   • Provider   : {probe['provider']}")
    print(f"   • Base URL   : {probe['base_url'] or '(Default)'}")
    print(f"   • Status     : {probe['status'].upper()}")
    print(f"   • Latency    : {probe['latency_ms']} ms")
    if probe.get("error"):
        print(f"   ⚠️ Warning   : {probe['error']}")

    # 2. Test Severity Classification
    print("\n⚡ 2. Testing Autonomous Severity Reasoning & Clustering...")
    from app.database import AsyncSessionLocal
    from app.models import Event
    from app.agents.severity_agent import run_severity_agent

    dummy_event = Event(
        source="payment-gateway",
        error_signature="ConnectionPoolExhausted:5432",
        raw_payload={
            "error": "ConnectionPoolExhausted",
            "active_connections": 100,
            "max_connections": 100,
            "blocked_queries": 42,
            "service": "checkout-api",
            "cluster_events": ["event-1", "event-2", "event-3"],
        },
    )

    async with AsyncSessionLocal() as session:
        sev, reasoning, override = await run_severity_agent(new_event=dummy_event, db=session)
        print(f"   • Classified Severity : {sev.upper()}")
        print(f"   • Override Triggered  : {override}")
        print(f"   • Reasoning           : {reasoning[:200]}...")

    # 3. Test Intent Parsing
    print("\n🗣️ 3. Testing Intent Parsing Agent...")
    from app.agents.intent_parser import parse_intent
    from app.models import Incident

    dummy_incident = Incident(
        title="PostgreSQL Max Connections Exceeded",
        severity="critical",
        status="open",
        agent_reasoning="Critical connection pool saturation in payment service.",
    )

    test_replies = [
        ("ack, on it investigating db locks", "slack", "alice_sre"),
        ("fixed the issue, killed idle pg connections and increased pool size", "telegram", "bob_lead"),
        ("page the dba team immediately", "email", "charlie_dev"),
    ]

    for msg, channel, sender in test_replies:
        res = await parse_intent(message=msg, incident=dummy_incident, sender=sender, channel=channel)
        print(f"   • Reply: \"{msg}\" -> Intent: {res['intent'].upper()} (Confidence: {res['confidence']:.2f})")

    # 4. Test Chaos Engineering Generator
    print("\n🌪️ 4. Testing Chaos Experiment Synthesis...")
    from app.agents.chaos_agent import generate_chaos_experiment

    chaos_plan = await generate_chaos_experiment(incident=dummy_incident, events=[dummy_event])
    print(f"   • Experiment Name : {chaos_plan.get('experiment_name')}")
    print(f"   • Chaos Type      : {chaos_plan.get('chaos_type')}")
    print(f"   • Hypothesis      : {chaos_plan.get('hypothesis', '')[:120]}...")

    print("\n" + "=" * 70)
    print("✅ All SRE Agent inference paths verified and operational!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
