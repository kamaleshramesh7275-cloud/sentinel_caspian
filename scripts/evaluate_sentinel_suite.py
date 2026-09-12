"""
Sentinel AI Incident Commander — Comprehensive Multi-Task Evaluation Suite
Evaluates the local fine-tuned Sentinel model across all 4 core production tasks:
1. AST Multi-File Call Graph Analysis
2. Unified Git-Diff Auto-Fix Patch Generation
3. Slack / Telegram Multi-Turn Intent Classification
4. Structured Incident Postmortem Authoring
"""

import sys
import json
import time
import requests

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "sentinel"

TEST_SUITE = [
    {
        "name": "1. Multi-Turn Intent Classification (Slack / Telegram)",
        "system": "You are Sentinel's Incident Intent Classifier. Parse developer communication from Slack/Telegram and categorize intent, acknowledged status, and extracted incident metadata into JSON format.",
        "user": 'CHANNEL: #incidents-prod\nSENDER: sre_alex\nMESSAGE: "taking over the database pool leak incident #412 now, scaling replica pool size to 50."'
    },
    {
        "name": "2. Unified Git-Diff Auto-Fix Patch Generation",
        "system": "You are Sentinel AI Incident Commander. Given an alert and faulty code snippet, produce an explanation and a unified git diff patch to resolve the issue safely.",
        "user": 'ALERT: ConnectionPoolTimeout in database layer [Service: checkout-service]\nSOURCE FILE: app/db/session.py:31\nVULNERABLE CODE:\n    def get_user_loyalty(user_id):\n        conn = engine.connect()\n        res = conn.execute("SELECT points FROM loyalty WHERE user_id = :u", {"u": user_id})\n        return res.scalar()'
    },
    {
        "name": "3. Structured Incident Postmortem Authoring",
        "system": "You are Sentinel AI Incident Commander. Generate an executive, audit-ready Incident Postmortem markdown report analyzing root cause, timeline, impact, and preventive guardrails.",
        "user": "INCIDENT ID: INC-2026-904\nSERVICE: checkout-api\nSEVERITY: SEV-1\nTRIGGER: Database connection starvation during flash sale traffic surge\nROOT CAUSE: Unclosed database connection in get_user_loyalty helper holding pool workers\nIMPACT: 14,200 failed checkout requests over 18 minutes\nSTATUS: Resolved via hotfix commit 4a8b11c"
    },
    {
        "name": "4. AST Multi-File Call Graph Root Cause Diagnosis",
        "system": "You are Sentinel AI Incident Commander. Analyze the incident and provide root cause diagnosis with remediation steps.",
        "user": "Service 'auth-worker' is failing with RedisConnectionError on line 88 of cache/adapter.py. Provide the root cause analysis and immediate remediation action."
    }
]

def run_suite():
    print("=" * 80)
    print("SENTINEL INCIDENT COMMANDER - LIVE MODEL BENCHMARK SUITE")
    print(f"Model: {MODEL_NAME} | Endpoint: {OLLAMA_CHAT_URL}")
    print("=" * 80)
    
    passed = 0
    for idx, test in enumerate(TEST_SUITE, 1):
        print(f"\n[{idx}/{len(TEST_SUITE)}] Running: {test['name']}...")
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": test["system"]},
                {"role": "user", "content": test["user"]}
            ],
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_ctx": 4096
            }
        }
        
        t0 = time.time()
        try:
            r = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=120)
            elapsed = time.time() - t0
            if r.status_code == 200:
                data = r.json()
                content = data.get("message", {}).get("content", "").strip()
                eval_count = data.get("eval_count", 0)
                eval_dur_ns = data.get("eval_duration", 1)
                tps = (eval_count / (eval_dur_ns / 1e9)) if eval_dur_ns else 0
                
                print(f"    Status: OK (HTTP 200) | Time: {elapsed:.2f}s | Tokens: {eval_count} ({tps:.1f} tok/s)")
                print("    " + "-"*76)
                for line in content.split("\n")[:10]:
                    print("    | " + line)
                if len(content.split("\n")) > 10:
                    print("    | ... [truncated for display]")
                print("    " + "-"*76)
                if len(content) > 0:
                    passed += 1
            else:
                print(f"    Error: HTTP {r.status_code} - {r.text}")
        except Exception as e:
            print(f"    Request failed: {e}")
            
    print("\n" + "=" * 80)
    print(f"BENCHMARK COMPLETE: {passed}/{len(TEST_SUITE)} Tasks Evaluated Successfully")
    print("=" * 80)

if __name__ == "__main__":
    run_suite()
