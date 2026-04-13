"use client";

import { useState, useEffect } from "react";
import GlassCard from "@/components/ui/GlassCard";

export default function AdminTelegramPanel() {
  const [botToken, setBotToken] = useState("");
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
      if (data.botToken) setBotToken(data.botToken);
      if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
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
        body: JSON.stringify({ botToken }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", message: data.message });
        setWebhookUrl(data.webhookUrl);
      } else {
        setStatus({ type: "error", message: data.error || "Gagal mengkonfigurasi bot" });
      }
    } catch (error) {
      setStatus({ type: "error", message: "Terjadi kesalahan koneksi" });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus konfigurasi Telegram dan mematikan bot?")) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/admin/telegram/setup", { method: "DELETE" });
      if (res.ok) {
        setBotToken("");
        setWebhookUrl("");
        setStatus({ type: "success", message: "Bot berhasil diputus koneksinya" });
      } else {
        setStatus({ type: "error", message: "Gagal mereset bot" });
      }
    } catch (error) {
      setStatus({ type: "error", message: "Terjadi kesalahan koneksi" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <GlassCard className="!p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 flex items-center justify-center text-sky-400 border border-sky-500/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9-2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-silver-100">Konfigurasi Bot Telegram</h2>
              <p className="text-sm text-silver-400">Hubungkan bot Telegram Anda untuk fitur cek saham otomatis.</p>
            </div>
          </div>
          
          {webhookUrl && (
            <button
              onClick={handleReset}
              disabled={loading}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Putus Koneksi Bot
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-silver-300 mb-1.5">
              Telegram Bot Token (dari @BotFather)
            </label>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="Contoh: 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-silver-100 placeholder:text-silver-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
              required
            />
          </div>

          {webhookUrl && (
            <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
              <p className="text-xs font-semibold text-silver-500 uppercase tracking-wider">Status Webhook Aktif</p>
              <code className="text-xs text-orange-300 break-all">{webhookUrl}</code>
            </div>
          )}

          {status && (
            <div className={`p-4 rounded-xl text-sm ${
              status.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              {status.message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Update Webhook & Simpan"
            )}
          </button>
        </form>
      </GlassCard>

      <GlassCard className="!p-6 border-dashed border-white/10">
        <h3 className="text-lg font-bold text-silver-200 mb-3">Cara Setup Bot:</h3>
        <ol className="list-decimal list-inside space-y-2 text-silver-400 text-sm">
          <li>Buka Telegram dan cari <span className="text-sky-400">@BotFather</span></li>
          <li>Kirim perintah <code className="bg-white/5 px-1.5 py-0.5 rounded text-orange-300">/newbot</code> dan ikuti instruksinya</li>
          <li>Dapatkan <span className="italic text-silver-200">HTTP API Token</span> yang diberikan</li>
          <li>Masukkan token tersebut ke form di atas lalu klik simpan</li>
          <li>Cari nama bot Anda di Telegram dan kirim <code className="bg-white/5 px-1.5 py-0.5 rounded text-orange-300">/start</code></li>
        </ol>
      </GlassCard>
    </div>
  );
}
