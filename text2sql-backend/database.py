import os

from beanie import init_beanie
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# ChatMessage is NOT listed here: it is an embedded pydantic model inside
# ChatSession, not its own Mongo collection.
from models import ChatSession, DBConnection, User

load_dotenv()

APP_MONGO_URL = os.getenv("APP_MONGO_URL")

_client: AsyncIOMotorClient | None = None


async def init_db():
    global _client
    if not APP_MONGO_URL:
        raise ValueError("APP_MONGO_URL is not set in the .env file")

    _client = AsyncIOMotorClient(APP_MONGO_URL)

    await init_beanie(
        database=_client.text2sql_app,  # database name in your cluster
        document_models=[User, DBConnection, ChatSession],
    )
    print("Connected to MongoDB successfully!")