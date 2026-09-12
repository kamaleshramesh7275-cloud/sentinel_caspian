"""
Sentinel AI Incident Commander — Dataset Generator.
Generates dataset_large.jsonl with 50,000+ multi-task instruction pairs:
1. GitHub multi-file AST call-graph traces (~12,500)
2. Unified git-diff auto-fix patches (~12,500)
3. Multi-turn Slack/Telegram intent classification (~12,500)
4. Structured incident postmortem markdown (~12,500)

Output format: JSONL with {"instruction": "...", "input": "...", "output": "..."}
"""

from __future__ import annotations

import json
import os
import random
import sys

OUTPUT_FILE = "dataset_large.jsonl"
TARGET_PER_TASK = 12500

# ==========================================
# Task 1: GitHub Multi-File AST Call Graphs
# ==========================================
SERVICES = [
    "auth-service", "billing-worker", "payment-router", "inventory-api",
    "order-processor", "notification-dispatcher", "user-gateway", "data-pipeline",
    "search-indexer", "cart-service", "audit-ledger", "event-streamer"
]

MODULE_FLOWS = [
    ("api/routes.py", "services/orchestrator.py", "clients/db_pool.py", "ConnectionPoolTimeout", "Unclosed session in context manager causing pool exhaustion"),
    ("controllers/checkout.py", "workers/stripe_client.py", "external/http_transport.py", "ReadTimeout", "Synchronous HTTP call without client timeout wrapper blocks event loop"),
    ("queue/consumer.py", "tasks/process_order.py", "cache/redis_adapter.py", "ConnectionResetError", "Redis connection leak across thread boundaries"),
    ("middleware/auth.py", "security/jwt_validator.py", "crypto/keys.py", "KeyError", "Missing JWKS caching triggers outbound flood and rate limit crash"),
    ("routers/media.py", "services/transcoder.py", "storage/s3_chunked.py", "MemoryError", "Unbounded file buffer loaded in memory instead of async chunk stream"),
    ("ingest/webhook.py", "handlers/event_router.py", "db/transaction.py", "DeadlockDetected", "Inconsistent lock acquisition ordering between order_items and inventory tables"),
    ("scheduler/cron.py", "jobs/reconcile.py", "integrations/erp.py", "ConnectionRefusedError", "Retry storm without exponential backoff overwhelms downstream endpoint"),
    ("graphql/schema.py", "resolvers/nested_user.py", "models/account.py", "RecursionError", "Circular N+1 query dependency on circular foreign key relation"),
]

def generate_ast_sample(idx: int) -> dict:
    service = SERVICES[idx % len(SERVICES)]
    f1, f2, f3, err, flaw = MODULE_FLOWS[idx % len(MODULE_FLOWS)]
    line_f1 = random.randint(15, 120)
    line_f2 = random.randint(30, 200)
    line_f3 = random.randint(40, 250)
    commit_hash = f"{random.randint(0x1000000, 0xfffffff):07x}"
    author = random.choice(["dev_alex", "dev_sarah", "dev_chris", "dev_priya", "dev_marcus", "dev_elena"])

    instruction = (
        "You are Sentinel AI Incident Commander. Analyze the multi-file AST call graph, "
        "trace the execution flow across module boundaries, identify the root cause flaw, "
        "and output a structured AST diagnosis in JSON format."
    )
    user_input = (
        f"SERVICE: {service}\n"
        f"INCIDENT: {err} encountered in production cluster\n"
        f"CALL GRAPH TRACE:\n"
        f"  1. {f1}:{line_f1} -> invoke_handler()\n"
        f"  2. {f2}:{line_f2} -> dispatch_async_job()\n"
        f"  3. {f3}:{line_f3} -> execute_transaction()\n"
        f"TRIGGER COMMIT: {commit_hash} by {author}\n"
        f"AST SCOPE INSPECTION:\n"
        f"  {f1} -> import {f2.replace('/', '.').replace('.py', '')}\n"
        f"  {f2} -> import {f3.replace('/', '.').replace('.py', '')}"
    )
    output = json.dumps({
        "status": "ANALYZED",
        "service": service,
        "call_graph": [
            {"depth": 1, "source": f1, "line": line_f1, "symbol": "invoke_handler"},
            {"depth": 2, "source": f2, "line": line_f2, "symbol": "dispatch_async_job"},
            {"depth": 3, "source": f3, "line": line_f3, "symbol": "execute_transaction"}
        ],
        "root_cause": {
            "error_type": err,
            "faulty_module": f3,
            "faulty_line": line_f3,
            "commit": commit_hash,
            "author": author,
            "flaw_description": flaw
        },
        "severity_level": "SEV-1" if "Deadlock" in err or "ConnectionPool" in err else "SEV-2",
        "action_required": "Patch code at layer 3 and drain affected worker pool."
    }, indent=2)

    return {
        "task_type": "ast_call_graph",
        "instruction": instruction,
        "input": user_input,
        "output": output
    }

# ==========================================
# Task 2: Unified Git-Diff Auto-Fix Patches
# ==========================================
PATCH_TEMPLATES = [
    {
        "alert": "ConnectionPoolTimeout in database layer",
        "file": "app/db/session.py",
        "flaw": "Database connection acquired without context manager, leaking connection handles under load.",
        "before": "    db = engine.connect()\n    res = db.execute(stmt)\n    return res.fetchall()",
        "after": "    with engine.connect() as db:\n        res = db.execute(stmt)\n        return res.fetchall()"
    },
    {
        "alert": "EventLoopBlockedWarning in async router",
        "file": "app/routers/webhook.py",
        "flaw": "Blocking requests.post inside async handler stalls asyncio event loop.",
        "before": "    resp = requests.post(url, json=payload, timeout=30)\n    return resp.json()",
        "after": "    async with httpx.AsyncClient() as client:\n        resp = await client.post(url, json=payload, timeout=30.0)\n        return resp.json()"
    },
    {
        "alert": "OutOfMemoryError (OOMKilled) in metric cache",
        "file": "app/services/cache.py",
        "flaw": "Unbounded Python list used as global cache causes unbounded memory footprint.",
        "before": "GLOBAL_EVENT_CACHE = []\ndef record_event(evt):\n    GLOBAL_EVENT_CACHE.append(evt)",
        "after": "from collections import deque\nGLOBAL_EVENT_CACHE = deque(maxlen=5000)\ndef record_event(evt):\n    GLOBAL_EVENT_CACHE.append(evt)"
    },
    {
        "alert": "ThreadDeadlock in concurrency pool",
        "file": "app/core/locks.py",
        "flaw": "Nested mutex acquisition without order hierarchy triggers bidirectional deadlock.",
        "before": "    lock_a.acquire()\n    lock_b.acquire()\n    do_work()\n    lock_b.release()\n    lock_a.release()",
        "after": "    with lock_a:\n        with lock_b:\n            do_work()"
    },
    {
        "alert": "CascadeFailoverFlood in external client",
        "file": "app/clients/api_gateway.py",
        "flaw": "Zero backoff retry storm collapses downstream payment service.",
        "before": "    for _ in range(5):\n        try: return send(req)\n        except Exception: pass",
        "after": "    for attempt in range(5):\n        try: return send(req)\n        except Exception:\n            time.sleep((2 ** attempt) * 0.5 + random.uniform(0, 0.2))"
    },
    {
        "alert": "RedisConnectionExhaustion in task worker",
        "file": "app/queue/redis_pool.py",
        "flaw": "Redis client initialized per task execution instead of using persistent connection pool.",
        "before": "def get_redis():\n    return redis.Redis(host='redis', port=6379)",
        "after": "REDIS_POOL = redis.ConnectionPool(host='redis', port=6379, max_connections=50)\ndef get_redis():\n    return redis.Redis(connection_pool=REDIS_POOL)"
    },
    {
        "alert": "UncaughtJWTExpiredSignature in auth gateway",
        "file": "app/auth/verifier.py",
        "flaw": "Expired token throws unhandled exception producing 500 server error instead of 401 Unauthorized.",
        "before": "def verify_token(token):\n    payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])\n    return payload",
        "after": "def verify_token(token):\n    try:\n        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])\n    except jwt.ExpiredSignatureError:\n        raise HTTPException(status_code=401, detail='Token has expired')"
    },
    {
        "alert": "SlowQueryNPlusOne in user order serializer",
        "file": "app/serializers/order.py",
        "flaw": "Looping over orders without select_related/joinedload fires N queries for customer profiles.",
        "before": "orders = db.query(Order).filter_by(status='active').all()\nreturn [o.customer.email for o in orders]",
        "after": "orders = db.query(Order).options(joinedload(Order.customer)).filter_by(status='active').all()\nreturn [o.customer.email for o in orders]"
    }
]

def generate_diff_sample(idx: int) -> dict:
    tmpl = PATCH_TEMPLATES[idx % len(PATCH_TEMPLATES)]
    start_line = random.randint(20, 150)
    service = SERVICES[idx % len(SERVICES)]

    diff_patch = (
        f"--- a/{tmpl['file']}\n"
        f"+++ b/{tmpl['file']}\n"
        f"@@ -{start_line},5 +{start_line},5 @@\n"
        f"-{tmpl['before'].replace(chr(10), chr(10)+'-')}\n"
        f"+{tmpl['after'].replace(chr(10), chr(10)+'+')}"
    )

    instruction = (
        "You are Sentinel AI Incident Commander. Given an alert and faulty code snippet, "
        "produce an explanation of the software defect and output a valid unified git-diff auto-fix patch."
    )
    user_input = (
        f"ALERT: {tmpl['alert']} [Service: {service}]\n"
        f"SOURCE FILE: {tmpl['file']}:{start_line}\n"
        f"VULNERABLE CODE:\n{tmpl['before']}"
    )
    output = (
        f"### DEFECT ANALYSIS\n"
        f"{tmpl['flaw']}\n\n"
        f"### REMEDIATION PATCH\n"
        f"```diff\n"
        f"{diff_patch}\n"
        f"```\n\n"
        f"### DEPLOYMENT VERIFICATION\n"
        f"Apply patch with `git apply`, run targeted unit tests for `{tmpl['file']}`, and verify connection/memory metrics normalize."
    )

    return {
        "task_type": "git_diff_patch",
        "instruction": instruction,
        "input": user_input,
        "output": output
    }

# =========================================================
# Task 3: Multi-Turn Slack / Telegram Intent Classification
# =========================================================
INTENTS = ["ack", "investigating", "resolved", "escalate", "unclear"]

CHAT_UTTERANCES = {
    "ack": [
        "on it now", "acknowledged, looking into the alerts", "seen, taking incident commander role",
        "got it, paging team lead", "roger that, jumping into the war room", "taking ownership of this page",
        "heard, on the bridge", "ack SEV-1", "acknowledged, silencing duplicate alerts for 15m"
    ],
    "investigating": [
        "digging into the db latency spike right now", "checking datadog traces for the 504 surge",
        "inspecting logs on worker pod-3", "looks like query timeouts, profiling postgres active queries",
        "reading the stack trace in sentry, might be an unhandled null pointer", "reviewing the recent PR 402 merge",
        "looking at redis memory consumption", "tracing request lifecycle through gateway"
    ],
    "resolved": [
        "yo I fixed the pool leak in PR 402, prod is back up", "rolled back commit c819a, error rates back to 0%",
        "restarted the worker pool, queue draining normally now. all green", "patched the connection leak, latency is normal",
        "incident resolved, traffic shifted back to primary region", "fixed the expired cert, healthchecks are passing",
        "hotfix deployed and verified, closing incident", "flushed the blocked cache, all systems nominal"
    ],
    "escalate": [
        "we need VP on call, database master is unresponsive", "escalating to infra team immediately",
        "cannot restore from replica, page data platform lead ASAP", "this is affecting billing and payments, escalate to SEV-0",
        "need secondary engineer on call, primary triage blocked", "escalating to security team, possible unauthorized token abuse",
        "pagerduty escalation policy 2 triggered, pinging director"
    ],
    "unclear": [
        "hey anyone have lunch yet?", "can somebody review my css PR?", "what is the staging url again?",
        "test message ignore", "did the meeting get moved to 3pm?", "my ide just crashed"
    ]
}

def generate_chat_intent_sample(idx: int) -> dict:
    intent = INTENTS[idx % len(INTENTS)]
    candidates = CHAT_UTTERANCES[intent]
    raw_msg = candidates[idx % len(candidates)]
    channel = random.choice(["#incident-war-room", "#prod-alerts", "#eng-oncall", "#ops-incident", "@sentinel-bot"])
    user = random.choice(["dev_alex", "dev_sarah", "dev_chris", "dev_priya", "dev_marcus", "dev_elena", "sre_dave"])

    variation_suffix = f" [ref: #{random.randint(100, 999)}]" if random.random() > 0.5 else ""
    full_msg = f"{raw_msg}{variation_suffix}"

    instruction = (
        "You are Sentinel's Incident Intent Classifier. Parse developer communication from Slack/Telegram "
        "and return a JSON object with intent (ack | investigating | resolved | escalate | unclear), "
        "confidence score, concise reasoning, and any recommended automated follow-up."
    )
    user_input = (
        f"CHANNEL: {channel}\n"
        f"SENDER: {user}\n"
        f"MESSAGE: \"{full_msg}\""
    )
    output = json.dumps({
        "intent": intent,
        "confidence": round(random.uniform(0.92, 1.0) if intent != "unclear" else random.uniform(0.85, 0.95), 2),
        "sender": user,
        "channel": channel,
        "reasoning": f"Message indicates '{intent}' state based on keyword semantics and operational context.",
        "recommended_action": {
            "ack": "Assign incident ticket to sender and mark status as Acknowledged.",
            "investigating": "Attach sender to incident bridge and set status to Investigating.",
            "resolved": "Trigger automated canary healthcheck and prompt commander to generate postmortem.",
            "escalate": "Page secondary tier escalation rotation and alert leadership oncall.",
            "unclear": "Ignore or prompt sender if message was intended for active incident channel."
        }[intent]
    }, indent=2)

    return {
        "task_type": "intent_classification",
        "instruction": instruction,
        "input": user_input,
        "output": output
    }

# ==========================================
# Task 4: Structured Incident Postmortem MD
# ==========================================
POSTMORTEM_CAUSES = [
    ("Connection Pool Starvation", "billing-service", "SEV-1", "Unclosed cursor in fetch_balance leaked database sockets during peak marketing campaign."),
    ("Async Event Loop Starvation", "auth-gateway", "SEV-1", "Synchronous HTTP client blocked asyncio reactor thread under 12k req/s traffic spike."),
    ("Unbounded In-Memory Cache OOM", "event-streamer", "SEV-2", "Global array without eviction policy consumed 16GB pod RAM, triggering Kubernetes OOMKilled."),
    ("Distributed Deadlock", "inventory-db", "SEV-1", "Opposite order row-level locking between checkout and stock-reservation microservices."),
    ("Rate Limit Storm Cascade", "notification-dispatcher", "SEV-2", "Downstream vendor outage caused exponential retry wave without jitter, exhausting client sockets."),
    ("Stale JWKS Certificate Cache", "api-gateway", "SEV-1", "Cryptographic key rotation expired without dynamic refresh, rejecting 100% of incoming customer requests.")
]

def generate_postmortem_sample(idx: int) -> dict:
    cause_title, svc, sev, summary = POSTMORTEM_CAUSES[idx % len(POSTMORTEM_CAUSES)]
    incident_id = f"INC-{random.randint(1000, 9999)}"
    duration_min = random.randint(14, 95)
    impacted_users = random.randint(1200, 85000)

    instruction = (
        "You are Sentinel AI Incident Commander. Generate an executive, audit-ready Incident Postmortem "
        "markdown document adhering to site reliability engineering best practices."
    )
    user_input = (
        f"INCIDENT ID: {incident_id}\n"
        f"SERVICE: {svc}\n"
        f"SEVERITY: {sev}\n"
        f"TRIGGER: {cause_title}\n"
        f"SUMMARY NOTES: {summary}\n"
        f"DURATION: {duration_min} minutes\n"
        f"IMPACT: {impacted_users} requests affected"
    )

    output = f"""# Incident Postmortem: {incident_id} — {cause_title}

**Severity**: `{sev}`  
**Service**: `{svc}`  
**Duration**: `{duration_min} minutes`  
**Impact**: `{impacted_users} user sessions degraded`  
**Incident Commander**: Sentinel Autonomous Agent  

---

## 1. Executive Summary
On production cluster `{svc}`, an incident occurred causing elevated error rates and customer degradation. The primary root cause was determined to be **{cause_title}**. Remediation was executed via automated patch deployment and traffic rebalancing.

## 2. Timeline (UTC)
- **T-00:00** — Automated anomaly detection alerts triggered for `{svc}` error rate > 5%.
- **T-00:04** — Sentinel ingested telemetry, classified alert as `{sev}`, and notified oncall engineering.
- **T-00:08** — Root cause pinpointed to faulty execution path in `{svc}`.
- **T-00:{min(duration_min-5, 25):02d}** — Automated git-diff hotfix generated and verified in staging canary.
- **T-00:{duration_min:02d}** — Hotfix promoted to production; error rate dropped to 0.00%. Incident declared resolved.

## 3. Root Cause Analysis (5 Whys)
1. **Why did the service fail?** Latency spiked and client requests received 500/504 errors.
2. **Why were requests timing out?** The worker process could not acquire necessary runtime resources.
3. **Why were resources exhausted?** {summary}
4. **Why was this not caught in CI?** Synthetic load tests lacked concurrent connection saturation simulation.
5. **Why did the architecture permit unbounded exhaustion?** Missing defensive backpressure and fail-safe bounds.

## 4. Remediation & Preventative Action Items
| Action Item | Type | Owner | Status |
|---|---|---|---|
| Deploy automated code patch | Hotfix | @sentinel | Completed |
| Add circuit breaker & timeout bounds | Preventative | @infra-core | Planned (Sprint 42) |
| Add concurrency regression test to CI | Detection | @qa-eng | In Progress |
"""

    return {
        "task_type": "postmortem_markdown",
        "instruction": instruction,
        "input": user_input,
        "output": output.strip()
    }


def generate_full_dataset():
    print("=" * 60)
    print("Sentinel AI Dataset Generation — 50,000+ Multi-Task Samples")
    print(f"Target per task: {TARGET_PER_TASK} samples")
    print("=" * 60)

    total_samples = 0
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        # Task 1: AST Call Graphs
        print(f"[*] Generating Task 1: GitHub AST Call Graph Traces ({TARGET_PER_TASK})...")
        for i in range(TARGET_PER_TASK):
            sample = generate_ast_sample(i)
            f.write(json.dumps(sample) + "\n")
            total_samples += 1

        # Task 2: Unified Git-Diff Patches
        print(f"[*] Generating Task 2: Unified Git-Diff Auto-Fix Patches ({TARGET_PER_TASK})...")
        for i in range(TARGET_PER_TASK):
            sample = generate_diff_sample(i)
            f.write(json.dumps(sample) + "\n")
            total_samples += 1

        # Task 3: Chat Intent Classification
        print(f"[*] Generating Task 3: Slack/Telegram Intent Classification ({TARGET_PER_TASK})...")
        for i in range(TARGET_PER_TASK):
            sample = generate_chat_intent_sample(i)
            f.write(json.dumps(sample) + "\n")
            total_samples += 1

        # Task 4: Incident Postmortem Markdown
        print(f"[*] Generating Task 4: Structured Incident Postmortem Markdown ({TARGET_PER_TASK})...")
        for i in range(TARGET_PER_TASK):
            sample = generate_postmortem_sample(i)
            f.write(json.dumps(sample) + "\n")
            total_samples += 1

    print("=" * 60)
    print(f"SUCCESS: Generated {total_samples} samples into {OUTPUT_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    generate_full_dataset()
