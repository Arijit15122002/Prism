import {
  MessageCirclePlus,
  Paperclip,
  UserRound,
  Loader,
  ArrowUp,
  Copy,
  Check,
  ChevronDown,
  Code2,
  Database,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import axios from "axios";
import logo from "../assets/pism.png";

const API = `${import.meta.env.VITE_API_URL}`;

const SUGGESTIONS = [
  "How many tables are in my database?",
  "Show me the 5 most recent orders",
  "Who is my best customer?",
];

/* ------------------------------------------------------------------ */
/* Small helpers (no extra dependencies)                               */
/* ------------------------------------------------------------------ */

// Renders **bold** and `code` inside a line of text
const renderInline = (text) =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded-md bg-black/50 text-green-400 text-[13px] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });

// Paragraphs + simple bullet lists
const RichText = ({ text }) => {
  const lines = (text || "").split("\n").filter((l) => l.trim() !== "");
  const blocks = [];
  let list = [];

  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-1">
          {list.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((line) => {
    const m = line.match(/^\s*[-*•]\s+(.*)/);
    if (m) {
      list.push(m[1]);
    } else {
      flushList();
      blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line)}</p>);
    }
  });
  flushList();

  return <div className="space-y-2">{blocks}</div>;
};

const formatCell = (val) => {
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};

/* ------------------------------------------------------------------ */
/* SQL formatting + light syntax highlighting (muted, on-theme)        */
/* ------------------------------------------------------------------ */

const SQL_KEYWORDS =
  "SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|OFFSET|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|AS|COUNT|SUM|AVG|MIN|MAX|DISTINCT|WITH|HAVING|DESC|ASC|IN|IS|NULL|BETWEEN|LIKE|ILIKE|CASE|WHEN|THEN|ELSE|END|INTERVAL|DATE_TRUNC|CURRENT_DATE|UNION|BY";

const SQL_TOKEN = new RegExp(
  `('(?:[^']|'')*')|\\b(${SQL_KEYWORDS})\\b|\\b(\\d+(?:\\.\\d+)?)\\b`,
  "gi",
);

const prettifySql = (sql) =>
  sql
    .replace(/;\s*$/, "")
    .replace(
      /\s+(FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN)\b/gi,
      "\n$1",
    )
    .trim();

const highlightSql = (sql) => {
  const out = [];
  let last = 0;
  let m;
  SQL_TOKEN.lastIndex = 0;
  while ((m = SQL_TOKEN.exec(sql)) !== null) {
    if (m.index > last) out.push(sql.slice(last, m.index));
    const cls = m[1]
      ? "text-amber-200/80" // strings
      : m[2]
        ? "text-sky-300/90 font-semibold" // keywords
        : "text-violet-300/80"; // numbers
    out.push(
      <span key={m.index} className={cls}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < sql.length) out.push(sql.slice(last));
  return out;
};

/* ------------------------------------------------------------------ */
/* Results (table / single-value tile) + actions + SQL panel           */
/* ------------------------------------------------------------------ */

const AssistantExtras = ({ rows, sql }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasRows = rows && rows.length > 0;
  const columns = hasRows ? Object.keys(rows[0]) : [];
  const isSingleValue = hasRows && rows.length === 1 && columns.length === 1;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  return (
    <div className="mt-4">
      {/* Single value -> compact stat tile */}
      {isSingleValue && (
        <div className="inline-flex flex-col gap-1 min-w-[140px] sm:min-w-[160px] rounded-2xl border border-white/10 bg-gradient-to-br from-[#1f1f1f] to-[#161616] px-5 sm:px-6 py-4">
          <span className="text-[11px] uppercase tracking-widest text-gray-500">
            {columns[0].replace(/_/g, " ")}
          </span>
          <span className="text-3xl sm:text-4xl font-semibold text-white tabular-nums break-all">
            {formatCell(rows[0][columns[0]])}
          </span>
        </div>
      )}

      {/* Many values -> table */}
      {hasRows && !isSingleValue && (
        <div className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] overflow-hidden">
          <div className="max-h-64 sm:max-h-80 overflow-auto sleek-scroll">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="sticky top-0 bg-[#202020]">
                <tr>
                  {columns.map((key) => (
                    <th
                      key={key}
                      className="px-3 sm:px-5 py-2.5 sm:py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap border-b border-white/10"
                    >
                      {key.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[#d6d6d6]">
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="hover:bg-white/[0.04] duration-150 border-b border-white/5 last:border-b-0"
                  >
                    {columns.map((key) => (
                      <td
                        key={key}
                        className={`px-3 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap ${
                          typeof row[key] === "number"
                            ? "text-right tabular-nums"
                            : ""
                        }`}
                      >
                        {formatCell(row[key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action row: row count · SQL toggle · copy */}
      {(hasRows || sql) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500 select-none">
          {hasRows && (
            <span>
              {rows.length} {rows.length === 1 ? "row" : "rows"}
            </span>
          )}
          {sql && (
            <div
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1.5 hover:text-white cursor-pointer duration-200"
            >
              <Code2 size={14} />
              <span>{open ? "Hide SQL" : "View SQL"}</span>
              <ChevronDown
                size={13}
                className={`duration-200 ${open ? "rotate-180" : ""}`}
              />
            </div>
          )}
          {sql && open && (
            <div
              onClick={copy}
              className="flex items-center gap-1.5 hover:text-white cursor-pointer duration-200"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? "Copied" : "Copy SQL"}</span>
            </div>
          )}
        </div>
      )}

      {/* SQL panel */}
      {sql && open && (
        <pre className="mt-3 w-full rounded-2xl border border-white/10 bg-[#121212] px-4 sm:px-5 py-4 text-[12px] sm:text-[13px] leading-6 text-[#cdcdcd] font-mono overflow-x-auto whitespace-pre-wrap break-words sleek-scroll">
          {highlightSql(prettifySql(sql))}
        </pre>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

const Chat = () => {
  const { user, token } = useSelector((state) => state.auth);
  const { panelOpen } = useSelector((state) => state.ui);
  const { connectionId } = useParams();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  // Holds the original question while the backend waits for a clarification
  const [pendingQuestion, setPendingQuestion] = useState(null);

  // Set when we create a session ourselves, so we don't refetch (and overwrite) messages we already have
  const skipFetchRef = useRef(false);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);

  // Keep the newest message in view by scrolling ONLY the messages box
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  // Auto-grow the textarea (up to a max height)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [question]);

  // 1. Fetch sessions on load
  useEffect(() => {
    const fetchSessions = async () => {
      if (!token || !connectionId) return;
      try {
        const response = await axios.get(
          `${API}/connections/${connectionId}/sessions`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setSessions(response.data);
      } catch (error) {
        console.error("Failed to fetch sessions", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [token, connectionId]);

  // 2. Fetch messages when a session is clicked
  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeSessionId) return;
      if (skipFetchRef.current) {
        skipFetchRef.current = false;
        return;
      }
      try {
        const response = await axios.get(
          `${API}/sessions/${activeSessionId}/messages`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setMessages(response.data);
      } catch (error) {
        console.error("Failed to fetch messages", error);
      }
    };
    fetchMessages();
  }, [activeSessionId, token]);

  // 3. Send a question (optionally with a clarification the user picked)
  const sendToBackend = async (questionText, clarification = null) => {
    setIsSending(true);
    setPendingQuestion(null);

    try {
      const response = await axios.post(
        `${API}/chat`,
        {
          connection_id: connectionId,
          question: questionText,
          clarification: clarification,
          session_id: activeSessionId,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const data = response.data;

      // If it was a new chat, the backend returns a session_id
      if (!activeSessionId && data.session_id) {
        skipFetchRef.current = true; // we already hold these messages locally
        setActiveSessionId(data.session_id);
        // Refresh sessions list so the new chat appears in the sidebar
        const sessionRes = await axios.get(
          `${API}/connections/${connectionId}/sessions`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setSessions(sessionRes.data);
      }

      if (data.status === "needs_clarification") {
        setPendingQuestion(questionText);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.clarification_question,
            is_clarification: true,
            options: data.options || [],
          },
        ]);
      } else {
        // Add bot response: the natural language answer + SQL + data table
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.natural_answer || "Here are your results.",
            generated_sql: data.generated_sql,
            results: data.results,
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to send message", error);
      const detail =
        error.response?.data?.detail ||
        "Something went wrong. Please try again.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: typeof detail === "string" ? detail : JSON.stringify(detail),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // Typed message -> brand new question
  const handleSendMessage = async () => {
    if (!question.trim() || isSending) return;
    const text = question;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setQuestion("");
    await sendToBackend(text);
  };

  // Clicked one of the clarification options
  const handleSelectOption = async (option) => {
    if (!pendingQuestion || isSending) return;
    const original = pendingQuestion;
    // Hide the buttons on the clarification message once answered
    setMessages((prev) =>
      prev.map((m) => (m.options ? { ...m, options: [] } : m)),
    );
    setMessages((prev) => [...prev, { role: "user", content: option }]);
    await sendToBackend(original, option);
  };

  const canSend = question.trim().length > 0 && !isSending;

  return (
    <div className="w-full h-[calc(100dvh-80px)] flex flex-row relative overflow-hidden">
      {/* Sidebar - Slides in from left */}
      <div
        className={`
          w-[85vw] max-w-[340px] sm:w-[300px] lg:w-[400px] h-full bg-[#232323] text-white p-4
          absolute top-0 left-0 z-50
          transition-transform duration-300 ease-in-out
          ${panelOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* New Chat Button */}
        <div
          onClick={() => {
            setActiveSessionId(null);
            setMessages([]);
            setPendingQuestion(null);
          }}
          className="w-full bg-[#cdcdcd] text-black font-bold py-2 rounded-xl mb-6 flex items-center justify-center gap-2 cursor-pointer hover:bg-white transition-colors"
        >
          <MessageCirclePlus size={18} />
          <span className="forum">New Conversation</span>
        </div>

        {/* Past Conversations List */}
        <div className="overflow-y-auto sleek-scroll h-[calc(100%-120px)] flex flex-col gap-2">
          {loading ? (
            <div className="text-center text-gray-500 text-sm mt-4">
              Loading...
            </div>
          ) : sessions.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 relative -mt-10">
              <div className="px-4 py-6 flex flex-col items-center justify-center gap-4 rounded-2xl">
                <div className="text-xs text-[#565656]">
                  No conversations yet
                </div>
              </div>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => {
                  setPendingQuestion(null);
                  setActiveSessionId(session.id);
                }}
                className={`px-3 py-3 rounded-lg text-[#cdcdcd] duration-300 cursor-pointer forum text-sm truncate
                  ${activeSessionId === session.id ? "bg-[#181818] text-white" : "bg-black/10 hover:bg-[#181818]"}
                `}
              >
                {session.title}
              </div>
            ))
          )}
        </div>

        {/* User Profile Badge */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[90%] bg-black/10 text-[#cdcdcd] flex flex-row items-center justify-center gap-2 forum px-4 py-2 rounded-xl shadow-lg">
          <UserRound size={18} strokeWidth={1} />
          <div>{user?.username}</div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div
        className={`
          w-full h-full transition-all duration-300 ease-in-out z-20
          ${panelOpen ? "ml-0 md:ml-[300px] lg:ml-[400px]" : "ml-0"}
        `}
      >
        <div className="max-w-4xl h-full mx-auto relative flex flex-col justify-center items-center">
          {/* IF NO ACTIVE SESSION, SHOW WELCOME. ELSE SHOW MESSAGES */}
          {!activeSessionId && messages.length === 0 ? (
            <div className="w-full flex flex-col items-center text-center forum px-4 pb-40 sm:pb-32">
              <div className="w-14 h-14 rounded-2xl bg-[#181818] border border-white/10 flex items-center justify-center mb-5">
                <Database
                  size={26}
                  className="text-[#cdcdcd]"
                  strokeWidth={1.5}
                />
              </div>
              <h1 className="text-2xl sm:text-3xl mb-2 text-[#cdcdcd]">
                Welcome to Prism
              </h1>
              <p className="text-gray-500 text-sm sm:text-base mb-6 sm:mb-8">
                Ask your database anything in plain English.
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                {SUGGESTIONS.map((s) => (
                  <div
                    key={s}
                    onClick={() => {
                      setQuestion(s);
                      textareaRef.current?.focus();
                    }}
                    className="px-4 py-2 rounded-full border border-white/10 bg-[#181818] text-sm text-[#cdcdcd] hover:bg-[#cdcdcd] hover:text-black cursor-pointer duration-300 max-w-full"
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              ref={messagesContainerRef}
              className="w-full h-full overflow-y-auto invisible-scrollbar px-3 sm:px-4 pb-44 sm:pb-48 pt-6 sm:pt-10"
            >
              <div className="max-w-3xl mx-auto">
                {messages.map((msg, index) =>
                  msg.role === "user" ? (
                    /* ---------- USER MESSAGE ---------- */
                    <div key={index} className="flex justify-end mb-6">
                      <div className="max-w-[88%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-md bg-[#cdcdcd] text-black forum text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    /* ---------- ASSISTANT MESSAGE ---------- */
                    <div
                      key={index}
                      className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-8"
                    >
                      <div className="shrink-0 w-8 h-8 rounded-full bg-[#181818] border border-white/10 flex items-center justify-center mt-0.5">
                        <img src={logo} alt="" className="h-4 w-4" />
                      </div>
                      <div
                        className={`flex-1 min-w-0 forum text-[15px] sm:text-[16px] leading-7 text-[#e2e2e2] break-words ${
                          msg.is_clarification
                            ? "border-l-2 border-blue-500/50 pl-4"
                            : ""
                        }`}
                      >
                        <RichText text={msg.content} />

                        {/* Results + SQL */}
                        {(msg.generated_sql ||
                          (msg.results && msg.results.length > 0)) && (
                          <AssistantExtras
                            rows={msg.results}
                            sql={msg.generated_sql}
                          />
                        )}

                        {/* Clarification options */}
                        {msg.options && msg.options.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {msg.options.map((opt, i) => (
                              <div
                                key={i}
                                onClick={() => handleSelectOption(opt)}
                                className="px-4 py-2 rounded-full border border-white/15 bg-[#1a1a1a] hover:bg-[#cdcdcd] hover:text-black text-sm leading-normal text-left max-w-full cursor-pointer duration-300"
                              >
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                )}

                {/* Typing indicator */}
                {isSending && (
                  <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-[#181818] border border-white/10 flex items-center justify-center">
                      <img src={logo} alt="" className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#cdcdcd] animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 rounded-full bg-[#cdcdcd] animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 rounded-full bg-[#cdcdcd] animate-bounce" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fade so messages don't collide with the composer */}
          <div className="pointer-events-none absolute bottom-0 left-0 w-full h-36 sm:h-44 bg-gradient-to-t from-[#232323] via-[#232323]/90 to-transparent" />

          {/* Composer */}
          <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-6 left-1/2 -translate-x-1/2 w-[94%] sm:w-[92%] max-w-3xl">
            <div className="flex items-end gap-2 bg-[#111111] border border-white/10 focus-within:border-white/25 rounded-3xl pl-2 sm:pl-3 pr-2 py-1.5 sm:py-2 shadow-2xl duration-300">
              <div className="shrink-0 text-blue-500 rounded-full hover:bg-blue-500/20 p-2.5 cursor-pointer duration-300 mb-0.5">
                <Paperclip className="h-4 w-4" />
              </div>

              <textarea
                ref={textareaRef}
                rows={1}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 min-w-0 resize-none bg-transparent px-2 py-3 outline-none text-[#cdcdcd] placeholder:text-gray-500 font-forum text-base sm:text-[15px] leading-6 sleek-scroll"
                placeholder="Ask anything about your data..."
              />

              <div
                onClick={handleSendMessage}
                className={`shrink-0 w-10 h-10 mb-0.5 rounded-full flex items-center justify-center duration-300 ${
                  canSend
                    ? "bg-[#cdcdcd] text-black hover:bg-white cursor-pointer"
                    : "bg-white/5 text-gray-600 cursor-not-allowed"
                }`}
              >
                {isSending ? (
                  <Loader className="animate-spin" size={18} />
                ) : (
                  <ArrowUp size={18} strokeWidth={2.5} />
                )}
              </div>
            </div>
            <div className="text-center text-[10px] sm:text-[11px] text-gray-600 mt-1.5 sm:mt-2 forum">
              <span className="hidden sm:inline">
                Enter to send · Shift + Enter for a new line ·{" "}
              </span>
              Prism can make mistakes, so check important results
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
