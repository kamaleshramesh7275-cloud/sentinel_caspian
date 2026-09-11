"""
Multi-Task Fine-Tuning Dataset Generator for Qwen2.5-Coder-14B-Instruct.

Focuses heavily on Deep Code Analysis, Stack Trace Debugging, Root Cause Pinpointing,
Auto-Fix Patch Generation, and Natural Language Intent Parsing.
"""

from __future__ import annotations

import json
import os

OUTPUT_FILE = "dataset.jsonl"

CODE_ANALYSIS_DATASET = [
    # 1. DB Connection Leak Analysis
    {
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are Sentinel AI Incident Commander. Analyze alerts, stack traces, and git diffs. "
                    "Pinpoint exact root causes down to file name and line number, explain the code flaw, "
                    "propose a code fix patch, and format response in valid JSON."
                ),
            },
            {
                "role": "user",
                "content": (
                    "ALERT: ConnectionPoolTimeout in payment-service.\n"
                    "STACK TRACE:\n"
                    "  File \"app/db/session.py\", line 142, in acquire_connection\n"
                    "    raise ConnectionPoolTimeout('Pool exhausted after 30s timeout')\n"
                    "RECENT GIT COMMIT DIFF (15 mins ago by dev_alex in PR #402):\n"
                    "--- a/app/services/billing.py\n"
                    "+++ b/app/services/billing.py\n"
                    "@@ -45,6 +45,9 @@ def fetch_user_balance(user_id: str):\n"
                    "+    db = engine.connect()\n"
                    "+    res = db.execute('SELECT balance FROM users WHERE id = %s', (user_id,))\n"
                    "+    return res.fetchone()[0]\n"
                ),
            },
            {
                "role": "assistant",
                "content": json.dumps({
                    "severity": "CRITICAL",
                    "override_triggered": True,
                    "root_cause": {
                        "file": "app/services/billing.py",
                        "line": 46,
                        "commit": "a8f3b2c",
                        "author": "dev_alex",
                        "flaw_explanation": "Raw `engine.connect()` is opened without a context manager (`with`) or `db.close()`. Under high request volume, database connection handles leak until pool limit (20 handles) is reached, starving all subsequent requests.",
                    },
                    "remediation": {
                        "action": "drain_db_connections",
                        "patch": (
                            "--- a/app/services/billing.py\n"
                            "+++ b/app/services/billing.py\n"
                            "@@ -45,6 +45,9 @@ def fetch_user_balance(user_id: str):\n"
                            "-    db = engine.connect()\n"
                            "-    res = db.execute('SELECT balance FROM users WHERE id = %s', (user_id,))\n"
                            "-    return res.fetchone()[0]\n"
                            "+    with engine.connect() as db:\n"
                            "+        res = db.execute('SELECT balance FROM users WHERE id = %s', (user_id,))\n"
                            "+        return res.fetchone()[0]\n"
                        ),
                    },
                }, indent=2),
            },
        ]
    },

    # 2. AsyncIO Event Loop Deadlock / Blocking I/O
    {
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are Sentinel AI Incident Commander. Analyze alerts, stack traces, and git diffs. "
                    "Pinpoint exact root causes down to file name and line number, explain the code flaw, "
                    "propose a code fix patch, and format response in valid JSON."
                ),
            },
            {
                "role": "user",
                "content": (
                    "ALERT: EventLoopBlockedWarning in notification-router.\n"
                    "STACK TRACE:\n"
                    "  File \"app/routers/notify.py\", line 88, in send_email_alert\n"
                    "    response = requests.post('https://api.resend.com/emails', json=payload, timeout=30)\n"
                    "RECENT GIT COMMIT DIFF (1 hour ago by dev_sarah):\n"
                    "--- a/app/routers/notify.py\n"
                    "+++ b/app/routers/notify.py\n"
                    "@@ -85,3 +85,3 @@ async def trigger_notification(request: Request):\n"
                    "-    async with httpx.AsyncClient() as client:\n"
                    "-        res = await client.post(...)\n"
                    "+    res = requests.post('https://api.resend.com/emails', json=payload, timeout=30)\n"
                ),
            },
            {
                "role": "assistant",
                "content": json.dumps({
                    "severity": "HIGH",
                    "override_triggered": False,
                    "root_cause": {
                        "file": "app/routers/notify.py",
                        "line": 88,
                        "commit": "b91f04e",
                        "author": "dev_sarah",
                        "flaw_explanation": "Synchronous `requests.post()` invoked directly inside async route handler blocks the main asyncio event loop thread for up to 30 seconds per request, causing cascading HTTP 504 gateway timeouts.",
                    },
                    "remediation": {
                        "action": "restart_service",
                        "patch": (
                            "--- a/app/routers/notify.py\n"
                            "+++ b/app/routers/notify.py\n"
                            "@@ -88,1 +88,2 @@\n"
                            "-    res = requests.post('https://api.resend.com/emails', json=payload, timeout=30)\n"
                            "+    async with httpx.AsyncClient() as client:\n"
                            "+        res = await client.post('https://api.resend.com/emails', json=payload, timeout=30.0)\n"
                        ),
                    },
                }, indent=2),
            },
        ]
    },

    # 3. Memory Leak / Unbounded Global Array Accumulation
    {
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are Sentinel AI Incident Commander. Analyze alerts, stack traces, and git diffs. "
                    "Pinpoint exact root causes down to file name and line number, explain the code flaw, "
                    "propose a code fix patch, and format response in valid JSON."
                ),
            },
            {
                "role": "user",
                "content": (
                    "ALERT: OutOfMemoryError (OOMKilled) in activity-logger pod.\n"
                    "STACK TRACE:\n"
                    "  File \"app/services/activity_logger.py\", line 34, in append_log\n"
                    "    GLOBAL_LOG_CACHE.append(event_payload)\n"
                    "RECENT GIT COMMIT DIFF:\n"
                    "--- a/app/services/activity_logger.py\n"
                    "+++ b/app/services/activity_logger.py\n"
                    "@@ -10,2 +10,4 @@\n"
                    "+GLOBAL_LOG_CACHE = []\n"
                    "+def append_log(event_payload):\n"
                    "+    GLOBAL_LOG_CACHE.append(event_payload)\n"
                ),
            },
            {
                "role": "assistant",
                "content": json.dumps({
                    "severity": "CRITICAL",
                    "override_triggered": True,
                    "root_cause": {
                        "file": "app/services/activity_logger.py",
                        "line": 34,
                        "commit": "f472e11",
                        "author": "dev_chris",
                        "flaw_explanation": "`GLOBAL_LOG_CACHE` list grows unbounded in process memory without periodic eviction, deque maxlen constraint, or flush to disk, eventually triggering Linux OOM killer.",
                    },
                    "remediation": {
                        "action": "flush_cache",
                        "patch": (
                            "--- a/app/services/activity_logger.py\n"
                            "+++ b/app/services/activity_logger.py\n"
                            "@@ -10,2 +10,2 @@\n"
                            "-GLOBAL_LOG_CACHE = []\n"
                            "+from collections import deque\n"
                            "+GLOBAL_LOG_CACHE = deque(maxlen=1000)\n"
                        ),
                    },
                }, indent=2),
            },
        ]
    },

    # 4. Natural Intent Parsing - Slang & Shorthand
    {
        "messages": [
            {
                "role": "system",
                "content": "You are Sentinel's Intent Parser. Analyze free-text developer messages and return valid JSON with intent (ack|investigating|resolved|escalate|unclear)."
            },
            {
                "role": "user",
                "content": "Channel Reply: 'yo I fixed the pool leak in PR 402, prod is back up'"
            },
            {
                "role": "assistant",
                "content": json.dumps({
                    "intent": "resolved",
                    "confidence": 1.0,
                    "reasoning": "Engineer states PR 402 merged fix and production health is restored.",
                    "follow_up_question": None
                }, indent=2)
            }
        ]
    }
]


def generate_dataset():
    out_dir = os.path.dirname(OUTPUT_FILE)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for item in CODE_ANALYSIS_DATASET:
            f.write(json.dumps(item) + "\n")
    print(f"Generated {len(CODE_ANALYSIS_DATASET)} deep code analysis dataset samples in {OUTPUT_FILE}")


if __name__ == "__main__":
    generate_dataset()
