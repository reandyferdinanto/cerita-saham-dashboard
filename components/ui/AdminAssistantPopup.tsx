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

  const suggestions = useMemo(
    () => ["Buka watchlist", "Buatkan artikel tentang INET", "Tampilkan user yang baru join"],
    []
  );

  useEffect(() => {
    if (!loading && user && (user.role === "admin" || user.role === "superadmin")) {
      const timer = window.setTimeout(() => setOpen(true), 1200);
      return () => window.clearTimeout(timer);
    }
  }, [loading, user]);

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

    if (!message || sending) {
      return;
    }

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

      if (!res.ok) {
        throw new Error(data.error || "Asisten admin gagal");
      }

      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);

      if (data.articleDraft) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data.articleDraft));
      }

      if (data.recentUsers) {
        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.recentUsers));
      }

      if (data.action?.type === "navigate") {
        router.push(data.action.href);
      }
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
    if (event.key !== "Enter") {
      return;
    }

    if (event.shiftKey) {
      return;
    }

    event.preventDefault();
    handleSend();
  };

  return (
    <div className="fixed right-3 bottom-20 md:right-5 md:bottom-5 z-[60]">
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
            className="fixed left-3 right-3 bottom-20 top-16 md:static md:left-auto md:right-auto md:bottom-auto md:top-auto w-auto md:w-[360px] max-w-[calc(100vw-24px)] rounded-[28px] md:rounded-3xl border shadow-2xl overflow-hidden animate-[fadeIn_.18s_ease-out] flex flex-col"
            style={{
              background: "rgba(5, 15, 12, 0.96)",
              borderColor: "rgba(251,146,60,0.22)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
              paddingTop: "max(0px, env(safe-area-inset-top))",
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
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full text-silver-400 hover:text-orange-400 transition"
              >
                ×
              </button>
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
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-xl"
          style={{
            background: "linear-gradient(135deg,#ea580c,#fb923c)",
            color: "#fff",
          }}
          aria-label="Open Admin Copilot"
        >
          <svg
            className="w-6 h-6 md:w-7 md:h-7"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M12 3.25L14.18 7.66L19 8.36L15.5 11.77L16.33 16.57L12 14.29L7.67 16.57L8.5 11.77L5 8.36L9.82 7.66L12 3.25Z"
              fill="rgba(255,255,255,0.16)"
              stroke="white"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path
              d="M9.25 12.25C10.02 13.48 10.93 14.1 12 14.1C13.07 14.1 13.98 13.48 14.75 12.25"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="9.5" cy="10" r="1" fill="white" />
            <circle cx="14.5" cy="10" r="1" fill="white" />
            <path
              d="M18.75 5.25L19.45 3.75"
              stroke="white"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M20.25 7L21.75 6.25"
              stroke="white"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
