"use client";

import { useEffect, useState } from "react";
import GlassCard from "@/components/ui/GlassCard";

export default function AdminTelegramPanel() {
  const [botToken, setBotToken] = useState("");
  const [adminChatId, setAdminChatId] = useState("");
  const [adminThreadId, setAdminThreadId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/telegram/setup");
      const data = await res.json();
      setBotToken(data.botToken || "");
      setAdminChatId(data.adminChatId || "");
      setAdminThreadId(data.adminThreadId || "");
      setWebhookUrl(data.webhookUrl || "");
    } catch (error) {
      console.error("Failed to fetch telegram settings", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/admin/telegram/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: botToken.trim(),
          adminChatId: adminChatId.trim(),
          adminThreadId: adminThreadId.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", message: data.message });
        setWebhookUrl(data.webhookUrl || "");
      } else {
        setStatus({ type: "error", message: data.error || "Gagal mengkonfigurasi bot" });
      }
    } catch {
      setStatus({ type: "error", message: "Terjadi kesalahan koneksi" });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Hapus konfigurasi bot utama Telegram?")) return;

    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/telegram/setup", { method: "DELETE" });
      if (res.ok) {
        setBotToken("");
        setAdminChatId("");
        setAdminThreadId("");
        setWebhookUrl("");
        setStatus({ type: "success", message: "Bot utama berhasil diputus koneksinya" });
      } else {
        setStatus({ type: "error", message: "Gagal mereset bot" });
      }
    } catch {
      setStatus({ type: "error", message: "Terjadi kesalahan koneksi" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <GlassCard className="!p-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/20 text-sky-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9-2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-silver-100">Bot Telegram Utama</h2>
              <p className="text-sm text-silver-400">Satu bot untuk cek saham dan screenshot chart dari Telegram.</p>
            </div>
          </div>

          {webhookUrl ? (
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
              </svg>
              Putuskan Bot
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-silver-300">
                Telegram Bot Token
              </label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="Token dari @BotFather"
                autoComplete="off"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-silver-100 placeholder:text-silver-600 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-silver-300">
                Admin Chat ID
              </label>
              <input
                type="text"
                value={adminChatId}
                onChange={(e) => setAdminChatId(e.target.value)}
                placeholder="Opsional, contoh: 123456789"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-silver-100 placeholder:text-silver-600 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-silver-300">
                Admin Thread ID
              </label>
              <input
                type="text"
                value={adminThreadId}
                onChange={(e) => setAdminThreadId(e.target.value)}
                placeholder="Opsional untuk Telegram Topics"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-silver-100 placeholder:text-silver-600 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
          </div>

          {webhookUrl ? (
            <div className="space-y-2 rounded-xl border border-white/5 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-silver-500">Webhook Aktif</p>
              <code className="break-all text-xs text-orange-300">{webhookUrl}</code>
            </div>
          ) : null}

          {status ? (
            <div
              className={`rounded-xl border p-4 text-sm ${
                status.type === "success"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
              aria-live="polite"
            >
              {status.message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-8 py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-800"
          >
            {loading ? (
              <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              "Simpan & Aktifkan Webhook"
            )}
          </button>
        </form>
      </GlassCard>

      <GlassCard className="!p-6 border-dashed border-white/10">
        <h3 className="mb-3 text-lg font-bold text-silver-200">Command Bot Utama</h3>
        <div className="grid grid-cols-1 gap-4 text-sm text-silver-400 md:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
            <p className="mb-2 font-semibold text-silver-200">Setup</p>
            <ol className="list-inside list-decimal space-y-2">
              <li>Buat bot di <span className="text-sky-400">@BotFather</span>.</li>
              <li>Masukkan token lalu simpan.</li>
              <li>Kirim <code className="rounded bg-white/5 px-1.5 py-0.5 text-orange-300">/start</code> ke bot.</li>
              <li>Kirim <code className="rounded bg-white/5 px-1.5 py-0.5 text-orange-300">/my_id</code> untuk melihat Chat ID.</li>
            </ol>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
            <p className="mb-2 font-semibold text-silver-200">Cek Chart</p>
            <ul className="list-inside list-disc space-y-2">
              <li>Ketik ticker langsung, contoh <code className="rounded bg-white/5 px-1.5 py-0.5 text-orange-300">BUMI</code>.</li>
              <li>Pakai timeframe, contoh <code className="rounded bg-white/5 px-1.5 py-0.5 text-orange-300">BUMI 1H</code>.</li>
              <li>Atau pakai command <code className="rounded bg-white/5 px-1.5 py-0.5 text-orange-300">/chart BUMI</code>.</li>
            </ul>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
