"""
Sentinel Model Verification Script via Ollama Chat API
Tests the locally hosted fine-tuned Sentinel model on a live production incident scenario.
"""

import json
import time
import requests
from datetime import datetime, timezone

OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "sentinel"

def generate_incident_prompt():
    ts = datetime.now(timezone.utc).isoformat()
    return f"""[ALERT] High Error Rate: 500 Internal Server Error spike on /api/v1/checkout
[TIMESTAMP] {ts}
[LOGS]
Traceback (most recent call last):
  File "/app/services/checkout.py", line 142, in process_order
    with db_pool.acquire(timeout=5.0) as conn:
  File "/app/core/pool.py", line 88, in acquire
    raise PoolTimeoutError("Timeout waiting for connection from pool (max_size=20, active=20, queued=145)")
core.pool.PoolTimeoutError: Timeout waiting for connection from pool (max_size=20, active=20, queued=145)

Recent commits:
- commit 8f9b21a: "Add background loyalty points sync during checkout"
  diff:
  + def sync_points(user_id, conn):
  +     cursor = conn.cursor()
  +     cursor.execute("SELECT points FROM loyalty WHERE user_id = %s", (user_id,))
  +     # Missing cursor.close() and holding parent connection across external HTTP call

Provide:
1. Incident Summary
2. Root Cause Analysis (Call Graph & Resource Leak)
3. Immediate Mitigation
4. Git Diff / Code Patch
5. Preventive Guardrails
"""

def main():
    prompt = generate_incident_prompt()
    print(f"[*] Connecting to Sentinel model via: {OLLAMA_CHAT_URL}")
    print(f"[*] Target Model: {MODEL_NAME}")
    
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "system",
                "content": "You are Sentinel, an autonomous AI Incident Commander and Senior SRE. Analyze incidents thoroughly with root cause, code patch, and mitigation."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "stream": False,
        "options": {
            "temperature": 0.2,
            "seed": int(time.time()),
            "num_predict": 512,
            "num_ctx": 4096
        }
    }
    
    start_time = time.time()
    try:
        response = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=180)
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            message = result.get("message", {})
            content = message.get("content", "")
            eval_count = result.get("eval_count", 0)
            eval_duration_ns = result.get("eval_duration", 1)
            tok_per_sec = (eval_count / (eval_duration_ns / 1e9)) if eval_duration_ns else 0
            
            print(f"\n[+] Status: SUCCESS (HTTP 200)")
            print(f"[+] Total Request Time: {elapsed:.2f}s")
            print(f"[+] Output Generation: {eval_count} tokens @ {tok_per_sec:.1f} tokens/sec")
            print("\n" + "="*80)
            print("SENTINEL INCIDENT COMMANDER DIAGNOSTIC REPORT:")
            print("="*80)
            print(content)
            print("="*80)
            return True
        else:
            print(f"[-] HTTP Error {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print(f"[-] Request failed: {e}")
        return False

if __name__ == "__main__":
    main()
