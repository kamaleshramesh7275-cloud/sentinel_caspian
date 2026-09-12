import asyncio
import os
from dotenv import load_dotenv
from app.database import engine
from sqlalchemy import text

load_dotenv()

async def main():
    db_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./sentinel.db")
    print(f'Testing DB connection to: {db_url[:30]}...')
    try:
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT 1"))
            print('DB connection successful! Result:', res.scalar())
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    asyncio.run(main())
