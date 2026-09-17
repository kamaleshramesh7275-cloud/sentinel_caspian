import httpx
import json

base_url = "http://127.0.0.1:8000/incidents/agent-live-telemetry"

for agent in ["rca", "sandbox", "timetravel", "chaos"]:
    resp = httpx.get(f"{base_url}?agent_id={agent}")
    print(f"[{agent.upper()}] GET status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"  Name: {data['name']}")
        print(f"  Tokens: {data['token_count']}")
        print(f"  Latency: {data['latency_ms']}ms")
        print(f"  Output Schema: {data['schema_type']}")
        print(f"  Timestamp: {data['timestamp']}")
    else:
        print(f"  Error: {resp.text}")

print("\n--- Testing Live Execution (execute_live=True) ---")
for agent in ["rca", "sandbox", "timetravel", "chaos"]:
    resp = httpx.post(f"{base_url}?agent_id={agent}&execute_live=true")
    print(f"[{agent.upper()} LIVE RUN] status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"  Live Status: {data['status']}")
        print(f"  Measured Latency: {data['latency_ms']}ms")
    else:
        print(f"  Error: {resp.text}")
