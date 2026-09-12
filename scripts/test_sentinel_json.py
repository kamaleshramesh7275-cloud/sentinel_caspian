"""
Test Sentinel Fine-Tuned Incident Analysis Output
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

SYSTEM_PROMPT = "You are Sentinel AI Incident Commander. Analyze the multi-file AST call graph, trace the execution flow across module boundaries, identify the root cause flaw, and output a structured AST diagnosis in JSON format."

USER_PROMPT = """SERVICE: payment-service
INCIDENT: ConnectionPoolExhausted in transaction processor
CALL GRAPH TRACE:
  1. api/checkout.py:114 -> process_payment()
  2. services/billing.py:62 -> record_transaction()
  3. db/pool.py:91 -> acquire_connection()
TRIGGER COMMIT: c9a31f2 by dev_alex
AST SCOPE INSPECTION:
  api/checkout.py -> import services.billing
  services/billing.py -> import db.pool"""

def test():
    print("=" * 70)
    print("SENDING INCIDENT PAYLOAD TO SENTINEL...")
    print("=" * 70)
    
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT}
        ],
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 512,
            "num_ctx": 4096
        }
    }
    
    t0 = time.time()
    r = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=180)
    elapsed = time.time() - t0
    
    print(f"Status Code: {r.status_code} ({elapsed:.2f}s)")
    if r.status_code == 200:
        data = r.json()
        content = data.get("message", {}).get("content", "")
        print("\n" + "=" * 70)
        print("SENTINEL STRUCTURED DIAGNOSIS OUTPUT:")
        print("=" * 70)
        print(content)
        print("=" * 70)

if __name__ == "__main__":
    test()
