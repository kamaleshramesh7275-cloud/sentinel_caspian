"""
Sentinel Multi-Channel Credential Verification & Diagnostic Probe.

Usage:
  python scripts/verify_channels.py

This script tests all configured credentials in .env:
- LLM connectivity (Gemini/OpenAI)
- Slack Bot Token & Channel Posting
- Telegram Bot Token & Message Delivery
- Resend Email API & Delivery
- GitHub Token & Repository Access
- Caspian SDK Connection
"""

from __future__ import annotations

import asyncio
import os
import sys
import httpx

# Ensure app is in Python path and stdout is UTF-8 on Windows
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from app.config import settings


async def verify_llm():
    print("\n[1/6] 🤖 LLM Reasoning API", flush=True)
    if not settings.openai_api_key:
        print("  ⚠️  OPENAI_API_KEY not set. Using fallback/mock responses.", flush=True)
        return False

    try:
        from openai import AsyncOpenAI
        client_kwargs = {"api_key": settings.openai_api_key, "timeout": 25.0}
        if settings.openai_base_url:
            client_kwargs["base_url"] = settings.openai_base_url

        client = AsyncOpenAI(**client_kwargs)
        resp = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": "Respond with 'OK'"}],
            max_tokens=5,
        )
        content = resp.choices[0].message.content.strip()
        print(f"  ✅ SUCCESS: LLM connected ({settings.openai_model} -> '{content}')", flush=True)
        return True
    except Exception as e:
        print(f"  ❌ FAILED: {e}", flush=True)
        return False


async def verify_slack():
    print("\n[2/6] 💬 Slack Bot & Channel", flush=True)
    if not settings.slack_bot_token or settings.slack_bot_token.startswith("xoxb-YOUR"):
        print("  ⚠️  SLACK_BOT_TOKEN not configured in .env", flush=True)
        return False

    try:
        from slack_sdk.web.async_client import AsyncWebClient
        client = AsyncWebClient(token=settings.slack_bot_token, timeout=10)
        auth_test = await client.auth_test()
        bot_user = auth_test.get("user", "bot")
        print(f"  ✅ Authenticated as bot @{bot_user}", flush=True)

        # Test message
        msg_resp = await client.chat_postMessage(
            channel=settings.slack_incident_channel,
            text="🛡️ *[Sentinel Probe]* Channel connectivity verification test message.",
        )
        print(f"  ✅ SUCCESS: Message posted to {settings.slack_incident_channel} (ts: {msg_resp.get('ts')})", flush=True)
        return True
    except Exception as e:
        print(f"  ❌ FAILED: {e}", flush=True)
        print("     Tip: Ensure bot is invited to channel via '/invite @YourBot' and token has 'chat:write' scope.", flush=True)
        return False


async def verify_telegram():
    print("\n[3/6] ✈️ Telegram Bot & Chat", flush=True)
    if not settings.telegram_bot_token or "YOUR_TELEGRAM" in settings.telegram_bot_token:
        print("  ⚠️  TELEGRAM_BOT_TOKEN not configured in .env", flush=True)
        return False

    if not settings.telegram_chat_id or "YOUR_CHAT" in settings.telegram_chat_id:
        print("  ⚠️  TELEGRAM_CHAT_ID not configured in .env", flush=True)
        return False

    try:
        from telegram import Bot
        bot = Bot(token=settings.telegram_bot_token)
        me = await asyncio.wait_for(bot.get_me(), timeout=10.0)
        print(f"  ✅ Authenticated as bot @{me.username}", flush=True)

        sent_msg = await asyncio.wait_for(
            bot.send_message(
                chat_id=settings.telegram_chat_id,
                text="🛡️ *[Sentinel Probe]* Telegram delivery test message.",
            ),
            timeout=10.0,
        )
        print(f"  ✅ SUCCESS: Message delivered to chat_id {settings.telegram_chat_id} (msg_id: {sent_msg.message_id})", flush=True)
        return True
    except Exception as e:
        print(f"  ❌ FAILED: {e}", flush=True)
        print("     Tip: Ensure you have started the bot in Telegram or added it to the target group.", flush=True)
        return False


async def verify_email():
    print("\n[4/6] 📧 Email (Resend)", flush=True)
    if not settings.resend_api_key or "YOUR_RESEND" in settings.resend_api_key:
        print("  ⚠️  RESEND_API_KEY not configured in .env", flush=True)
        return False

    try:
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "from": settings.email_from,
            "to": [settings.email_to_oncall],
            "subject": "🛡️ [Sentinel Probe] Test Incident Email Alert",
            "html": "<p><strong>Sentinel Diagnostic Probe</strong>: Email channel delivery confirmed.</p>",
        }
        async with httpx.AsyncClient(timeout=10.0) as http:
            resp = await http.post(url, headers=headers, json=body)
            data = resp.json()
            if resp.status_code in (200, 201):
                print(f"  ✅ SUCCESS: Email sent to {settings.email_to_oncall} (id: {data.get('id')})", flush=True)
                return True
            else:
                error_msg = data.get("message") or resp.text
                print(f"  ❌ FAILED: {error_msg}", flush=True)
                print("     Tip: For free Resend tiers, you can use from='onboarding@resend.dev' to send to your verified email.", flush=True)
                return False
    except Exception as e:
        print(f"  ❌ FAILED: {e}", flush=True)
        return False


async def verify_github():
    print("\n[5/6] 🐙 GitHub Postmortems Repo", flush=True)
    if not settings.github_token or "YOUR_GITHUB" in settings.github_token:
        print("  ⚠️  GITHUB_TOKEN not configured in .env", flush=True)
        return False

    if not settings.github_postmortem_repo or "your-repo" in settings.github_postmortem_repo:
        print("  ⚠️  GITHUB_POSTMORTEM_REPO not configured in .env", flush=True)
        return False

    try:
        url = f"https://api.github.com/repos/{settings.github_postmortem_repo}"
        headers = {
            "Authorization": f"Bearer {settings.github_token}",
            "Accept": "application/vnd.github.v3+json",
        }
        async with httpx.AsyncClient(timeout=10.0) as http:
            resp = await http.get(url, headers=headers)
            if resp.status_code == 200:
                repo_info = resp.json()
                print(f"  ✅ SUCCESS: Access confirmed to repo '{repo_info.get('full_name')}' (default_branch: {repo_info.get('default_branch')})", flush=True)
                return True
            else:
                print(f"  ❌ FAILED: GitHub returned HTTP {resp.status_code} ({resp.text[:200]})", flush=True)
                return False
    except Exception as e:
        print(f"  ❌ FAILED: {e}", flush=True)
        return False


async def verify_caspian():
    print("\n[6/6] 🌐 Caspian SDK Hub", flush=True)
    if not settings.caspian_api_key or "YOUR_CASPIAN" in settings.caspian_api_key:
        print("  ⚠️  CASPIAN_API_KEY not configured in .env (Direct channel SDKs will be used)", flush=True)
        return False

    try:
        from caspian_sdk import CommClient
        client = CommClient(
            api_key=settings.caspian_api_key,
            base_url=settings.caspian_base_url,
        )
        print("  ✅ SUCCESS: Caspian CommClient initialized", flush=True)
        return True
    except Exception as e:
        print(f"  ❌ FAILED: {e}", flush=True)
        return False


async def main():
    print("=" * 60, flush=True)
    print("🛡️  SENTINEL MULTI-CHANNEL CREDENTIAL DIAGNOSTIC PROBE", flush=True)
    print("=" * 60, flush=True)

    results = {
        "LLM": await verify_llm(),
        "Slack": await verify_slack(),
        "Telegram": await verify_telegram(),
        "Email": await verify_email(),
        "GitHub": await verify_github(),
        "Caspian": await verify_caspian(),
    }

    print("\n" + "=" * 60, flush=True)
    print("📊 DIAGNOSTIC SUMMARY:", flush=True)
    for channel, ok in results.items():
        status = "✅ ACTIVE" if ok else "⚠️ NOT CONFIGURED / FAILED"
        print(f"  • {channel:<12}: {status}", flush=True)
    print("=" * 60, flush=True)
    print("💡 To enable any channel, update the corresponding token in .env and rerun:", flush=True)
    print("   python scripts/verify_channels.py\n", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
