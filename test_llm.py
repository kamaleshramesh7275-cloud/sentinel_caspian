import asyncio
import os
import json
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

async def test_llm():
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
    model = os.getenv("OPENAI_MODEL", "models/gemini-2.5-flash")
    print(f"Testing model: {model}")
    print(f"Base URL: {base_url}")
    print(f"Key prefix: {api_key[:10] if api_key else 'None'}...")
    
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    try:
        res = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a test agent. Respond in JSON."},
                {"role": "user", "content": "Return a JSON object with keys 'status' ('ok') and 'agent_name' ('Sentinel')."}
            ],
            response_format={"type": "json_object"}
        )
        print("Response received:")
        print(res.choices[0].message.content)
    except Exception as e:
        print("Error during LLM call:", e)

if __name__ == "__main__":
    asyncio.run(test_llm())
