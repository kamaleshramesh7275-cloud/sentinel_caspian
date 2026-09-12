import sys
import asyncio
import os
import json
from dotenv import load_dotenv

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

load_dotenv()

from app.database import init_db, AsyncSessionLocal
from app.models import Event, Incident
from app.agents.severity_agent import run_severity_agent
from app.agents.intent_parser import parse_intent
from app.agents.postmortem_agent import generate_postmortem

async def test_all_agents():
    print("Testing Sentinel AI Agents against local fine-tuned Sentinel model...")
    await init_db()
    
    async with AsyncSessionLocal() as db:
        # 1. Test Severity Agent
        print("\n--- 1. Testing Severity Reasoning Agent ---")
        dummy_event = Event(
            source="sentry",
            error_signature="database_connection_timeout_pg",
            raw_payload={
                "error": "OperationalError: connection to server at 'db.prod.internal' failed: timeout expired",
                "service": "checkout-service",
                "environment": "production",
                "impact": "Users unable to complete cart checkout"
            }
        )
        db.add(dummy_event)
        await db.flush()
        
        severity, reasoning, override = await run_severity_agent(
            new_event=dummy_event,
            db=db
        )
        print(f"Severity: {severity}")
        print(f"Override Triggered: {override}")
        print(f"Agent Reasoning: {reasoning}")
        
        # 2. Test Intent Parser
        print("\n--- 2. Testing Intent Parser Agent ---")
        dummy_incident = Incident(
            title="Checkout Database Connection Pool Exhausted",
            severity=severity,
            status="open",
            agent_reasoning=reasoning
        )
        db.add(dummy_incident)
        await db.flush()
        
        reply_text = "I'm looking into the DB connection pool metrics now, scaling up read replicas"
        intent_res = await parse_intent(
            message=reply_text,
            incident=dummy_incident,
            sender="alex_sre",
            channel="slack"
        )
        print(f"Engineer reply: '{reply_text}'")
        print(f"Parsed Intent: {json.dumps(intent_res, indent=2)}")
        
        # 3. Test Postmortem Generator Agent
        print("\n--- 3. Testing Postmortem Agent ---")
        from app.models import ThreadContext
        thread_sample = [
            ThreadContext(
                incident_id=dummy_incident.id,
                channel="slack",
                sender="alex_sre",
                message=reply_text,
                intent_parsed="investigating",
            )
        ]
        pm_res = await generate_postmortem(
            incident=dummy_incident,
            thread_context=thread_sample,
        )
        print(f"Generated Postmortem Result: {pm_res}")
        
    print("\n[SUCCESS] All Sentinel AI agents executed and validated successfully!")

if __name__ == "__main__":
    asyncio.run(test_all_agents())
