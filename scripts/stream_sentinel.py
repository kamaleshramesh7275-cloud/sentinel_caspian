"""
Sentinel Real-Time Streaming Incident Commander Test
Demonstrates live token streaming on realistic incident scenarios.
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

def ask_sentinel(system_prompt: str, user_prompt: str):
    print("=" * 70)
    print(f"PROMPT: {user_prompt[:80]}...")
    print("=" * 70)
    print("SENTINEL: ", end="", flush=True)
    
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "stream": True,
        "options": {
            "temperature": 0.3,
            "num_predict": 256,
            "num_ctx": 4096
        }
    }
    
    t0 = time.time()
    token_count = 0
    try:
        with requests.post(OLLAMA_CHAT_URL, json=payload, stream=True, timeout=180) as response:
            for line in response.iter_lines():
                if line:
                    chunk = json.loads(line)
                    delta = chunk.get("message", {}).get("content", "")
                    print(delta, end="", flush=True)
                    token_count += 1
                    if chunk.get("done", False):
                        break
        elapsed = time.time() - t0
        print(f"\n\n[Done: {token_count} chunks in {elapsed:.2f}s ({token_count/elapsed:.1f} tok/s)]\n")
    except Exception as e:
        print(f"\n[Error: {e}]\n")

if __name__ == "__main__":
    # Test 1: Intent Analysis
    ask_sentinel(
        "You are Sentinel AI Incident Commander.",
        "We have a high severity alert on billing-service: database connection timeout. How should the on-call engineer respond in the first 5 minutes?"
    )
