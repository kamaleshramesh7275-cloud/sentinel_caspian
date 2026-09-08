import asyncio
import asyncpg
import ssl

async def main():
    print('Connecting...')
    try:
        conn = await asyncpg.connect(
            'postgresql://neondb_owner:npg_NkDAY4d2WCmi@ep-weathered-feather-ayej9z85-pooler.c-5.us-east-2.aws.neon.tech/neondb',
            ssl=ssl.create_default_context()
        )
        print('Connected!')
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    asyncio.run(main())
