"""Quick test to list available Gemini models with this key."""
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
base_url = os.getenv("OPENAI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")

print(f"Key prefix: {api_key[:10]}...")
print(f"Base URL: {base_url}")
print()

# Try listing models via OpenAI compat endpoint
r = httpx.get(f"{base_url}models", headers={"Authorization": f"Bearer {api_key}"})
print(f"OpenAI-compat /models -> {r.status_code}")
if r.status_code == 200:
    data = r.json()
    for m in data.get("data", [])[:10]:
        print(f"  - {m.get('id')}")
else:
    print(f"  Error: {r.text[:300]}")

print()

# Try native Gemini list models endpoint
r2 = httpx.get(
    "https://generativelanguage.googleapis.com/v1beta/models",
    params={"key": api_key}
)
print(f"Native /models -> {r2.status_code}")
if r2.status_code == 200:
    data2 = r2.json()
    for m in data2.get("models", [])[:10]:
        print(f"  - {m.get('name')} ({m.get('displayName')})")
else:
    print(f"  Error: {r2.text[:300]}")
