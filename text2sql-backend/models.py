from datetime import datetime
from typing import Any, Dict, List, Optional

from beanie import Document
from pydantic import BaseModel, Field


class User(Document):
    username: str
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"


class DBConnection(Document):
    user_id: str  # Links this connection to the user
    name: str  # e.g. "Production DB"
    db_url: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "db_connections"


# NOTE: ChatMessage is EMBEDDED inside ChatSession, so it must be a plain
# pydantic BaseModel, not a beanie Document. Documents are meant to be their
# own collection; embedding them causes serialization/save problems.
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    generated_sql: Optional[str] = None
    results: Optional[List[Dict[str, Any]]] = None
    is_clarification: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChatSession(Document):
    connection_id: str  # Links this conversation to a specific DB
    user_id: str  # Extra security so users can't guess session IDs
    title: str = "New Chat"
    messages: List[ChatMessage] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "chat_sessions"