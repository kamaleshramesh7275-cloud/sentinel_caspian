import asyncio
import os
from dotenv import load_dotenv
from slack_sdk.web.async_client import AsyncWebClient

load_dotenv()

async def main():
    token = os.getenv("SLACK_BOT_TOKEN")
    channel = os.getenv("SLACK_INCIDENT_CHANNEL", "#incidents")
    print(f"Testing Slack token: {token[:15]}... on channel {channel}")
    
    client = AsyncWebClient(token=token)
    try:
        # First test auth
        auth = await client.auth_test()
        print(f"SUCCESS: Auth successful! Bot user: {auth.get('user')} (ID: {auth.get('user_id')})")
        print(f"   Team: {auth.get('team')}")
        
        # List public channels
        convs = await client.conversations_list(types="public_channel")
        channels_list = convs.get("channels", [])
        print("Available channels in your Slack workspace:")
        for c in channels_list:
            print(f"  - #{c.get('name')} (ID: {c.get('id')})")

        # Try sending message to first available channel or #general / #incidents
        target = channels_list[0].get("id") if channels_list else channel
        print(f"\nAttempting postMessage to target channel ID: {target}")
        res = await client.chat_postMessage(
            channel=target,
            text="SENTINEL INCIDENT COMMANDER ALERT TEST\nSlack integration is officially working!",
        )
        print(f"SUCCESS: Message sent successfully! Timestamp: {res.get('ts')}")
    except Exception as e:
        print(f"ERROR: Slack API Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
