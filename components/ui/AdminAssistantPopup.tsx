"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/ui/AuthProvider";

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

type AssistantResponse = {
  reply: string;
  action?: { type: "navigate"; href: string };
  articleDraft?: {
    title: string;
    content: string;
    brief: string;
    topic: string;
    stockSymbol?: string;
    stockName?: string;
    newsSummary?: string;
  };
  recentUsers?: Array<{
    _id: string;
    email: string;
    name: string;
    membershipStatus: string;
    createdAt: string;
  }>;
};

const STORAGE_KEY = "admin_assistant_article_draft";
const USER_STORAGE_KEY = "admin_assistant_recent_users";
const POSITION_STORAGE_KEY = "admin_copilot_position_v1";
const DRAG_THRESHOLD = 6; // px before treating as drag instead of click
const BUTTON_SIZE = 56; // matches w-14/h-14
const EDGE_PADDING = 12;

type Position = { left: number; top: number };

function clampToViewport(pos: Position): Position {
  if (typeof window === "undefined") return pos;
  const maxX = Math.max(EDGE_PADDING, window.innerWidth - BUTTON_SIZE - EDGE_PADDING);
  const maxY = Math.max(EDGE_PADDING, window.innerHeight - BUTTON_SIZE - EDGE_PADDING);
  return {
    left: Math.min(Math.max(EDGE_PADDING, pos.left), maxX),
    top: Math.min(Math.max(EDGE_PADDING, pos.top), maxY),
  };
}

export default function AdminAssistantPopup() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content:
        "Asisten admin aktif. Saya bisa buka watchlist, siapkan draft artikel, atau tampilkan user terbaru.",
    },
  ]);

  // Drag state
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const [openAnchor, setOpenAnchor] = useState<{ vertical: "up" | "down"; horizontal: "left" | "right" }>({
    vertical: "up",
    horizontal: "left",
  });
  const [isDesktop, setIsDesktop] = useState(false);
  const dragMetaRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const suggestions = useMemo(
    () => ["Buka watchlist", "Buatkan artikel tentang INET", "Tampilkan user yang baru join"],
    []
  );

  // Load saved position once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(POSITION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Position;
        if (typeof parsed.left === "number" && typeof parsed.top === "number") {
          setPosition(clampToViewport(parsed));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Re-clamp on resize
  useEffect(() => {
    const onResize = () => {
      setPosition((prev) => (prev ? clampToViewport(prev) : prev));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Track desktop breakpoint for popup positioning
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, open]);

  if (loading || !user || (user.role !== "admin" && user.role !== "superadmin")) {
    return null;
  }

  const handleSend = async (messageText?: string) => {
    const message = (messageText || input).trim();
    if (!message || sending) return;

    setSending(true);
    setInput("");
    setMessages((current) => [...current, { role: "user", content: message }]);

    try {
      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, pathname }),
      });

      const data = (await res.json()) as AssistantResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Asisten admin gagal");

      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);

      if (data.articleDraft) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data.articleDraft));
      if (data.recentUsers) sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.recentUsers));
      if (data.action?.type === "navigate") router.push(data.action.href);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Terjadi kesalahan pada asisten admin.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    handleSend();
  };

  // ---- Drag handlers ----
  const onPointerDown: React.PointerEventHandler<HTMLButtonElement> = (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const rect = target.getBoundingClientRect();
    dragMetaRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
  };

  const onPointerMove: React.PointerEventHandler<HTMLButtonElement> = (event) => {
    const meta = dragMetaRef.current;
    if (meta.pointerId !== event.pointerId) return;
    const dx = event.clientX - meta.startX;
    const dy = event.clientY - meta.startY;
    if (!meta.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    meta.moved = true;
    setDragging(true);
    setPosition(
      clampToViewport({
        left: meta.originX + dx,
        top: meta.originY + dy,
      })
    );
  };

  const onPointerUp: React.PointerEventHandler<HTMLButtonElement> = (event) => {
    const meta = dragMetaRef.current;
    if (meta.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    if (meta.moved) {
      // Persist position only after a real drag
      if (position) {
        try {
          localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
        } catch {
          // ignore
        }
      }
    } else {
      // Treat as click — compute popup anchor based on button position, then open
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        setOpenAnchor({
          vertical: rect.top + rect.height / 2 < vh / 2 ? "down" : "up",
          horizontal: rect.left + rect.width / 2 < vw / 2 ? "right" : "left",
        });
      }
      setOpen(true);
    }
    dragMetaRef.current.pointerId = null;
    dragMetaRef.current.moved = false;
    setDragging(false);
  };

  const handleResetPosition = () => {
    setPosition(null);
    try {
      localStorage.removeItem(POSITION_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const containerStyle: React.CSSProperties = position
    ? { left: position.left, top: position.top, right: "auto", bottom: "auto", width: BUTTON_SIZE, height: BUTTON_SIZE }
    : { width: BUTTON_SIZE, height: BUTTON_SIZE };

  // Popup position relative to the button container (only used at md+).
  // The button sits inside a 56x56 fixed-size box. The popup absolute-positions
  // itself to expand AWAY from the screen edge the button is closest to.
  const popupDesktopStyle: React.CSSProperties = (() => {
    const style: React.CSSProperties = {};
    if (openAnchor.vertical === "up") {
      style.bottom = BUTTON_SIZE + 12; // 12px above top of button
    } else {
      style.top = BUTTON_SIZE + 12; // 12px below button
    }
    if (openAnchor.horizontal === "left") {
      style.right = 0; // align popup right edge to button right edge → extends LEFT
    } else {
      style.left = 0; // align popup left edge to button left edge → extends RIGHT
    }
    return style;
  })();

  return (
    <>
      {/* Inline keyframes for the icon animation */}
      <style jsx global>{`
        @keyframes copilot-ping {
          0% { transform: scale(0.6); opacity: 0.7; }
          80%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes copilot-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes copilot-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.12); opacity: 0.85; }
        }
        @keyframes copilot-shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      <div
        className={`fixed z-[60] ${position ? "" : "right-3 bottom-20 md:right-5 md:bottom-5"}`}
        style={containerStyle}
      >
        {open ? (
          <>
            <button
              type="button"
              aria-label="Close Admin Copilot"
              onClick={() => setOpen(false)}
              className="fixed inset-0 md:hidden"
              style={{ background: "rgba(0,0,0,0.45)" }}
            />
            <div
              className="fixed left-3 right-3 bottom-20 top-16 md:absolute md:left-auto md:right-auto md:bottom-auto md:top-auto md:w-[360px] max-w-[calc(100vw-24px)] rounded-[28px] md:rounded-3xl border shadow-2xl overflow-hidden animate-[fadeIn_.18s_ease-out] flex flex-col"
              style={{
                background: "rgba(5, 15, 12, 0.96)",
                borderColor: "rgba(251,146,60,0.22)",
                boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
                paddingTop: "max(0px, env(safe-area-inset-top))",
                maxHeight: "calc(100vh - 32px)",
                ...(isDesktop ? popupDesktopStyle : {}),
              }}
            >
              <div className="md:hidden flex justify-center pt-3 pb-1">
                <div
                  className="h-1.5 w-14 rounded-full"
                  style={{ background: "rgba(226,232,240,0.18)" }}
                />
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(226,232,240,0.08)" }}>
                <div>
                  <p className="text-sm font-semibold text-silver-100">Admin Copilot</p>
                  <p className="text-[11px] text-silver-500">Navigasi cepat dan bantuan operasional admin</p>
                </div>
                <div className="flex items-center gap-1">
                  {position ? (
                    <button
                      type="button"
                      onClick={handleResetPosition}
                      className="text-[10px] font-semibold uppercase tracking-wider text-silver-500 hover:text-amber-300 transition px-2 py-1 rounded"
                      title="Reset posisi tombol"
                    >
                      ↺ Reset
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="w-8 h-8 rounded-full text-silver-400 hover:text-orange-400 transition"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="px-4 py-3 flex flex-wrap gap-2 border-b" style={{ borderColor: "rgba(226,232,240,0.06)" }}>
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSend(suggestion)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                    style={{
                      background: "rgba(251,146,60,0.12)",
                      color: "#fdba74",
                      border: "1px solid rgba(251,146,60,0.22)",
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 px-4 py-3 overflow-y-auto space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`rounded-2xl px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${
                      message.role === "assistant" ? "mr-8" : "ml-8"
                    }`}
                    style={
                      message.role === "assistant"
                        ? {
                            background: "rgba(255,255,255,0.05)",
                            color: "#e2e8f0",
                            border: "1px solid rgba(226,232,240,0.06)",
                          }
                        : {
                            background: "rgba(249,115,22,0.16)",
                            color: "#fff7ed",
                            border: "1px solid rgba(249,115,22,0.28)",
                          }
                    }
                  >
                    {message.content}
                  </div>
                ))}
                {sending ? <p className="text-xs text-silver-500">Asisten sedang memproses...</p> : null}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t space-y-3" style={{ borderColor: "rgba(226,232,240,0.08)" }}>
                <textarea
                  rows={2}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="glass-input w-full px-3 py-2 text-sm text-silver-200 resize-none"
                  placeholder="Enter untuk kirim, Shift+Enter untuk baris baru"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-silver-500 truncate">{pathname}</p>
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={sending || !input.trim()}
                    className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#ea580c,#fb923c)", color: "#fff" }}
                  >
                    Kirim
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          // ---- COPILOT BUTTON (closed state) ----
          <button
            ref={buttonRef}
            type="button"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label="Open Admin Copilot — drag to move"
            title="Klik untuk buka · Tahan dan geser untuk pindahkan"
            className="group relative h-14 w-14 select-none rounded-full transition-transform"
            style={{
              cursor: dragging ? "grabbing" : "grab",
              touchAction: "none",
              transform: dragging ? "scale(1.05)" : "scale(1)",
              transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {/* Animated outer halo (only when not dragging) */}
            {!dragging ? (
              <>
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: "1px solid rgba(251,191,36,0.4)",
                    animation: "copilot-ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite",
                  }}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: "1px solid rgba(251,191,36,0.3)",
                    animation: "copilot-ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite",
                    animationDelay: "0.8s",
                  }}
                />
              </>
            ) : null}

            {/* Main button surface */}
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, rgba(251,191,36,0.55), rgba(217,119,6,0.95) 60%, rgba(120,53,15,0.98) 100%)",
                boxShadow:
                  "0 12px 32px rgba(251,191,36,0.22), 0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
                border: "1px solid rgba(251,191,36,0.45)",
              }}
            />

            {/* Glassy highlight overlay */}
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full opacity-60"
              style={{
                background:
                  "linear-gradient(150deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.08) 36%, transparent 68%)",
              }}
            />

            {/* Animated radar/orb icon */}
            <span className="relative flex h-full w-full items-center justify-center">
              <svg
                viewBox="0 0 56 56"
                className="h-7 w-7"
                fill="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="copilot-arc" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fef3c7" />
                    <stop offset="100%" stopColor="#fde68a" />
                  </linearGradient>
                  <radialGradient id="copilot-core" cx="50%" cy="40%" r="60%">
                    <stop offset="0%" stopColor="#fffbeb" />
                    <stop offset="60%" stopColor="#fef3c7" />
                    <stop offset="100%" stopColor="#fbbf24" />
                  </radialGradient>
                </defs>

                {/* Rotating outer arc — radar sweep */}
                <g
                  style={{
                    transformOrigin: "28px 28px",
                    animation: dragging ? "none" : "copilot-rotate 6s linear infinite",
                  }}
                >
                  <circle cx="28" cy="28" r="20" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 4" />
                  <path
                    d="M28 8 A20 20 0 0 1 48 28"
                    stroke="url(#copilot-arc)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    fill="none"
                  />
                </g>

                {/* Middle ring */}
                <circle cx="28" cy="28" r="13" stroke="rgba(255,255,255,0.32)" strokeWidth="1" />

                {/* Center pulsing diamond/orb */}
                <g
                  style={{
                    transformOrigin: "28px 28px",
                    animation: dragging ? "none" : "copilot-breathe 1.8s ease-in-out infinite",
                  }}
                >
                  <circle cx="28" cy="28" r="6" fill="url(#copilot-core)" />
                  <circle cx="28" cy="28" r="6" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
                  {/* tiny glint */}
                  <circle cx="26" cy="26.5" r="1.4" fill="rgba(255,255,255,0.85)" />
                </g>

                {/* 4 cardinal markers */}
                <circle cx="28" cy="6" r="1.2" fill="rgba(255,255,255,0.6)" />
                <circle cx="50" cy="28" r="1.2" fill="rgba(255,255,255,0.4)" />
                <circle cx="28" cy="50" r="1.2" fill="rgba(255,255,255,0.4)" />
                <circle cx="6" cy="28" r="1.2" fill="rgba(255,255,255,0.4)" />
              </svg>
            </span>

            {/* Drag indicator dot (top-right corner) — visible on hover */}
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
              style={{
                background: "rgba(251,191,36,0.95)",
                border: "1.5px solid rgba(20,12,4,0.92)",
                boxShadow: "0 0 8px rgba(251,191,36,0.6)",
              }}
              title="Tahan dan geser tombol untuk memindahkan"
            />
          </button>
        )}
      </div>
    </>
  );
}
