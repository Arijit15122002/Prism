import asyncio
import json
import logging
import os
import re
from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Optional

from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

# Local imports
from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from database import init_db
from models import ChatMessage, ChatSession, DBConnection, User

logger = logging.getLogger("prism")

# --- CONFIG ---
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
MAX_ROWS = 100  # hard cap on rows returned/stored
ROWS_FOR_ANSWER = 25  # rows sent to the LLM to write the answer
HISTORY_MESSAGES = 6  # recent chat turns given to the LLM as context
STATEMENT_TIMEOUT_MS = 15_000

llm = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
)


# --- FASTAPI SETUP ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()  # Connect to MongoDB on startup
    yield
    for eng in _engine_cache.values():
        eng.dispose()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "https://prism-jade-two.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- REQUEST BODIES ---
class UserCreate(BaseModel):
    username: str
    password: str


class ConnectionCreate(BaseModel):
    name: str
    db_url: str


class ChatRequest(BaseModel):
    connection_id: str
    question: str
    clarification: Optional[str] = None
    session_id: Optional[str] = None


# =====================================================================
# TARGET DATABASE HELPERS
# =====================================================================
_engine_cache: dict[str, Engine] = {}
_schema_cache: dict[str, str] = {}


def get_target_engine(db_url: str) -> Engine:
    """Reuse one engine per URL instead of creating a new pool per request."""
    engine = _engine_cache.get(db_url)
    if engine is None:
        try:
            engine = create_engine(db_url, pool_pre_ping=True, pool_size=3, max_overflow=2)
            with engine.connect():
                pass
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Target DB connection failed: {e}")
        _engine_cache[db_url] = engine
    return engine


def get_dynamic_schema(engine: Engine, cache_key: str) -> str:
    """Tables, columns, primary keys and foreign keys, so the LLM can write joins."""
    if cache_key in _schema_cache:
        return _schema_cache[cache_key]

    inspector = inspect(engine)
    lines = []
    for table in inspector.get_table_names():
        cols = ", ".join(f"{c['name']} {c['type']}" for c in inspector.get_columns(table))
        lines.append(f"Table {table}: {cols}")
        pk = inspector.get_pk_constraint(table).get("constrained_columns")
        if pk:
            lines.append(f"  Primary key: {', '.join(pk)}")
        for fk in inspector.get_foreign_keys(table):
            lines.append(
                f"  Foreign key: {', '.join(fk['constrained_columns'])} -> "
                f"{fk['referred_table']}({', '.join(fk['referred_columns'])})"
            )
    schema = "\n".join(lines) or "(no tables found in the public schema)"
    _schema_cache[cache_key] = schema
    return schema


# =====================================================================
# SQL SAFETY
# =====================================================================
_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|"
    r"execute|merge|vacuum|pg_sleep|set|do)\b",
    re.IGNORECASE,
)


def validate_sql(sql: str) -> str:
    """Allow a single read-only SELECT/WITH statement and enforce a LIMIT."""
    sql = sql.strip().rstrip(";").strip()
    if ";" in sql:
        raise HTTPException(status_code=400, detail="Only a single SQL statement is allowed.")
    if not re.match(r"^(select|with)\b", sql, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Only SELECT queries are allowed.")
    if _FORBIDDEN.search(sql):
        raise HTTPException(status_code=400, detail="Query contains a forbidden keyword.")
    if not re.search(r"\blimit\s+\d+\s*$", sql, re.IGNORECASE):
        sql += f" LIMIT {MAX_ROWS}"
    return sql


def execute_sql(engine: Engine, sql: str) -> list[dict]:
    """Run inside a read-only transaction with a timeout (Postgres)."""
    with engine.connect() as conn:
        conn.execute(text("SET TRANSACTION READ ONLY"))
        conn.execute(text(f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}"))
        result = conn.execute(text(sql))
        rows = [dict(r._mapping) for r in result]
        conn.rollback()
    # Decimal / datetime / UUID are not JSON- or BSON-safe; convert once here.
    return jsonable_encoder(rows)


# =====================================================================
# LLM HELPERS (sync; always called through asyncio.to_thread)
# =====================================================================
def _chat_json(system_prompt: str, user_prompt: str) -> dict:
    resp = llm.chat.completions.create(
        model=LLM_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return json.loads(resp.choices[0].message.content)


def check_ambiguity(question: str, schema: str, history: str) -> dict:
    system_prompt = """
You are a data analyst assistant. Decide whether the user's question can be turned
into a SQL query as-is, using the database schema provided.

Mark a question ambiguous ONLY if it has several materially different valid
interpretations that would give different answers (e.g. "best customer" could mean
highest revenue, most orders, or most visits).

Do NOT mark it ambiguous when:
- it can be answered from the schema directly (e.g. "how many tables are there",
  "list the tables", "how many customers")
- a reasonable default exists (e.g. "last month" = previous calendar month)
- the conversation history already answers the question.

Respond in JSON only.
If ambiguous: {"is_ambiguous": true, "clarification_question": "...?", "options": ["...", "..."]}
Offer 2-4 short options that map to columns/tables that actually exist in the schema.
If clear: {"is_ambiguous": false}
"""
    user_prompt = f"Schema:\n{schema}\n\nRecent conversation:\n{history or '(none)'}\n\nQuestion: {question}"
    return _chat_json(system_prompt, user_prompt)


def generate_sql(question: str, schema: str, history: str,
                 clarification: Optional[str], previous_error: Optional[str] = None,
                 previous_sql: Optional[str] = None) -> str:
    system_prompt = """
Convert the user's question into ONE read-only PostgreSQL query.
Rules:
- Use only tables/columns from the schema. Schemas other than public are allowed ONLY
  for metadata questions (information_schema).
- To count or list tables in the user's database, use information_schema.tables with
  table_schema = 'public' AND table_type = 'BASE TABLE'.
- Always alias aggregates with readable names (e.g. COUNT(*) AS total_tables).
- Return ONLY JSON: {"sql": "SELECT ..."}
"""
    user_prompt = f"Schema:\n{schema}\n\nRecent conversation:\n{history or '(none)'}\n\nQuestion: {question}"
    if clarification:
        user_prompt += f"\n\nThe user clarified what they mean: '{clarification}'. Follow this."
    if previous_error:
        user_prompt += (
            f"\n\nYour previous query failed.\nQuery: {previous_sql}\nError: {previous_error}\n"
            "Fix it and return a corrected query."
        )
    return _chat_json(system_prompt, user_prompt)["sql"]


def write_answer(question: str, sql: str, rows: list[dict], clarification: Optional[str]) -> str:
    if not rows:
        return "The query ran successfully but returned no results."

    shown = rows[:ROWS_FOR_ANSWER]
    prompt = f"""
The user asked: "{question}"
{f'They clarified: "{clarification}"' if clarification else ''}
The database returned {len(rows)} row(s). {'Showing the first ' + str(len(shown)) + ':' if len(rows) > len(shown) else ''}
{json.dumps(shown, default=str)}

Write a short, direct answer in plain English that answers the question using this data.
- Lead with the answer itself (e.g. "You have 3 tables: ...").
- For lists, use a compact bullet list.
- Do not mention SQL, JSON, or the query. Do not invent data that is not shown.
"""
    resp = llm.chat.completions.create(
        model=LLM_MODEL,
        temperature=0.2,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.choices[0].message.content.strip()


def run_pipeline(engine: Engine, question: str, schema: str, history: str,
                 clarification: Optional[str]) -> dict:
    """Generate SQL -> validate -> run (one self-correcting retry) -> answer."""
    sql, error, last_sql = None, None, None
    for attempt in range(2):
        raw_sql = generate_sql(question, schema, history, clarification, error, last_sql)
        try:
            sql = validate_sql(raw_sql)
            rows = execute_sql(engine, sql)
            break
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("SQL attempt %s failed: %s", attempt + 1, e)
            error, last_sql = str(getattr(e, "orig", e)), raw_sql
            if attempt == 1:
                raise HTTPException(
                    status_code=422,
                    detail=f"I couldn't run a valid query for that question. ({error})",
                )

    answer = write_answer(question, sql, rows, clarification)
    return {"sql": sql, "results": rows, "natural_answer": answer}


def build_history(session: ChatSession) -> str:
    recent = [m for m in session.messages if not m.is_clarification][-HISTORY_MESSAGES:]
    return "\n".join(f"{m.role}: {m.content}" for m in recent)


# =====================================================================
# ROUTES
# =====================================================================
@app.get("/users/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return {"username": current_user.username, "id": str(current_user.id)}


# --- AUTH ---
@app.post("/register")
async def register(user: UserCreate):
    if await User.find_one(User.username == user.username):
        raise HTTPException(status_code=400, detail="Username already registered")

    await User(username=user.username, hashed_password=get_password_hash(user.password)).insert()
    token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"message": "User created successfully", "access_token": token, "token_type": "bearer"}


@app.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await User.find_one(User.username == form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer"}


# --- CONNECTIONS ---
@app.post("/connections")
async def add_connection(conn: ConnectionCreate, current_user: User = Depends(get_current_user)):
    await asyncio.to_thread(get_target_engine, conn.db_url)  # validates the URL
    new_conn = DBConnection(user_id=str(current_user.id), name=conn.name, db_url=conn.db_url)
    await new_conn.insert()
    return {"message": "Connected!", "connection_id": str(new_conn.id)}


@app.get("/connections")
async def list_connections(current_user: User = Depends(get_current_user)):
    conns = await DBConnection.find(DBConnection.user_id == str(current_user.id)).to_list()
    return [{"id": str(c.id), "name": c.name} for c in conns]


# --- CHAT ---
@app.post("/chat")
async def chat(req: ChatRequest, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)

    try:
        conn_oid = ObjectId(req.connection_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid connection ID format")

    conn_record = await DBConnection.find_one(
        DBConnection.id == conn_oid, DBConnection.user_id == user_id
    )
    if not conn_record:
        raise HTTPException(status_code=404, detail="Connection not found or unauthorized.")

    # Get or create session (and verify ownership: previously any user could
    # write into any session if they guessed its id)
    session = None
    if req.session_id:
        try:
            session = await ChatSession.get(req.session_id)
        except Exception:
            session = None
        if session and (session.user_id != user_id or session.connection_id != req.connection_id):
            raise HTTPException(status_code=404, detail="Session not found")

    if not session:
        session = ChatSession(
            connection_id=req.connection_id,
            user_id=user_id,
            title=req.question[:25] + ("..." if len(req.question) > 25 else ""),
        )
        await session.insert()

    engine = await asyncio.to_thread(get_target_engine, conn_record.db_url)
    schema = await asyncio.to_thread(get_dynamic_schema, engine, req.connection_id)
    history = build_history(session)  # built BEFORE adding this turn

    # Save the user's message once. When the frontend resends the same question
    # together with a clarification, don't duplicate it.
    if req.clarification:
        session.messages.append(ChatMessage(role="user", content=f"Clarification: {req.clarification}"))
    else:
        session.messages.append(ChatMessage(role="user", content=req.question))

        # Ambiguity check (only on the first pass, and now it knows the schema)
        try:
            ambiguity = await asyncio.to_thread(check_ambiguity, req.question, schema, history)
        except Exception as e:
            logger.warning("Ambiguity check failed, continuing without it: %s", e)
            ambiguity = {"is_ambiguous": False}

        if ambiguity.get("is_ambiguous") and ambiguity.get("clarification_question"):
            session.messages.append(
                ChatMessage(
                    role="assistant",
                    content=ambiguity["clarification_question"],
                    is_clarification=True,
                )
            )
            await session.save()
            return {
                "status": "needs_clarification",
                "session_id": str(session.id),
                "clarification_question": ambiguity["clarification_question"],
                "options": ambiguity.get("options", []),
            }

    # SQL generation, execution, natural language answer
    try:
        out = await asyncio.to_thread(
            run_pipeline, engine, req.question, schema, history, req.clarification
        )
    except HTTPException as e:
        # Keep the conversation consistent: store the failure as an assistant message
        session.messages.append(ChatMessage(role="assistant", content=str(e.detail)))
        await session.save()
        raise

    session.messages.append(
        ChatMessage(
            role="assistant",
            content=out["natural_answer"],
            generated_sql=out["sql"],
            results=out["results"],
        )
    )
    await session.save()

    return {
        "status": "success",
        "session_id": str(session.id),
        "generated_sql": out["sql"],
        "results": out["results"],
        "natural_answer": out["natural_answer"],
    }


# --- SESSIONS ---
@app.get("/connections/{connection_id}/sessions")
async def list_sessions(connection_id: str, current_user: User = Depends(get_current_user)):
    sessions = (
        await ChatSession.find(
            ChatSession.connection_id == connection_id,
            ChatSession.user_id == str(current_user.id),
        )
        .sort("-created_at")
        .to_list()
    )
    return [{"id": str(s.id), "title": s.title, "created_at": s.created_at} for s in sessions]


@app.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, current_user: User = Depends(get_current_user)):
    try:
        session = await ChatSession.get(session_id)
    except Exception:
        session = None
    if not session or session.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Session not found")
    return session.messages