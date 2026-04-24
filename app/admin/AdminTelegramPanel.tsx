"use client";

import { useState, useEffect } from "react";
import GlassCard from "@/components/ui/GlassCard";

export default function AdminTelegramPanel() {
  const [botToken, setBotToken] = useState("");
  const [adminChatId, setAdminChatId] = useState("");
  const [adminThreadId, setAdminThreadId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [mlScreenerBotToken, setMlScreenerBotToken] = useState("");
  const [mlScreenerChatId, setMlScreenerChatId] = useState("");
  const [watchlistAlertEnabled, setWatchlistAlertEnabled] = useState(false);
  const [watchlistAlertBotToken, setWatchlistAlertBotToken] = useState("");
  const [watchlistAlertChatId, setWatchlistAlertChatId] = useState("");
  const [watchlistAlertThreadId, setWatchlistAlertThreadId] = useState("");
  const [watchlistAlertMinEmaOffset, setWatchlistAlertMinEmaOffset] = useState(1);
  const [watchlistAlertMaxEmaOffset, setWatchlistAlertMaxEmaOffset] = useState(2);
  const [watchlistAlertOpenOffset, setWatchlistAlertOpenOffset] = useState(2);
  const [watchlistAlertEma20Enabled, setWatchlistAlertEma20Enabled] = useState(true);
  const [watchlistAlertEma20Min, setWatchlistAlertEma20Min] = useState(1);
  const [watchlistAlertEma20Max, setWatchlistAlertEma20Max] = useState(2);
  const [watchlistAlertEma50Enabled, setWatchlistAlertEma50Enabled] = useState(false);
  const [watchlistAlertEma50Min, setWatchlistAlertEma50Min] = useState(1);
  const [watchlistAlertEma50Max, setWatchlistAlertEma50Max] = useState(2);
  const [watchlistAlertOpenGapEnabled, setWatchlistAlertOpenGapEnabled] = useState(true);
  const [watchlistAlertOpenGapMin, setWatchlistAlertOpenGapMin] = useState(2);
  const [watchlistAlertUniverse, setWatchlistAlertUniverse] = useState<"watchlist" | "all">("watchlist");
  const [watchlistAlertMinGain, setWatchlistAlertMinGain] = useState(5);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleTestAlert = async () => {
    setTestLoading(true);
    setStatus(null);
    try {
      // Manual trigger for the cron endpoint with test=true to bypass market hours
      const res = await fetch("/api/cron/watchlist-alert?test=true");
      const data = await res.json();
      if (res.ok) {
        setStatus({ 
          type: "success", 
          message: data.alertedCount !== undefined 
            ? `Berhasil! ${data.alertedCount} saham terdeteksi dan dikirim ke Telegram.` 
            : data.message || "Test alert selesai diproses."
        });
      } else {
        setStatus({ type: "error", message: data.error || "Gagal mengirim test alert" });
      }
    } catch (error) {
      console.error("Test alert error:", error);
      setStatus({ type: "error", message: "Terjadi kesalahan koneksi saat testing" });
    } finally {
      setTestLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/telegram/setup");
      const data = await res.json();
      if (data.botToken) setBotToken(data.botToken);
      if (data.adminChatId) setAdminChatId(data.adminChatId);
      if (data.adminThreadId) setAdminThreadId(data.adminThreadId);
      if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
      if (data.mlScreenerBotToken) setMlScreenerBotToken(data.mlScreenerBotToken);
      if (data.mlScreenerChatId) setMlScreenerChatId(data.mlScreenerChatId);
      setWatchlistAlertEnabled(data.watchlistAlertEnabled);
      setWatchlistAlertBotToken(data.watchlistAlertBotToken);
      setWatchlistAlertChatId(data.watchlistAlertChatId);
      setWatchlistAlertThreadId(data.watchlistAlertThreadId);
      setWatchlistAlertMinEmaOffset(data.watchlistAlertMinEmaOffset);
      setWatchlistAlertMaxEmaOffset(data.watchlistAlertMaxEmaOffset);
      setWatchlistAlertOpenOffset(data.watchlistAlertOpenOffset);
      setWatchlistAlertEma20Enabled(data.watchlistAlertEma20Enabled);
      setWatchlistAlertEma20Min(data.watchlistAlertEma20Min);
      setWatchlistAlertEma20Max(data.watchlistAlertEma20Max);
      setWatchlistAlertEma50Enabled(data.watchlistAlertEma50Enabled);
      setWatchlistAlertEma50Min(data.watchlistAlertEma50Min);
      setWatchlistAlertEma50Max(data.watchlistAlertEma50Max);
      setWatchlistAlertOpenGapEnabled(data.watchlistAlertOpenGapEnabled);
      setWatchlistAlertOpenGapMin(data.watchlistAlertOpenGapMin);
      setWatchlistAlertUniverse(data.watchlistAlertUniverse);
      setWatchlistAlertMinGain(data.watchlistAlertMinGain);
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
          botToken, 
          adminChatId, 
          adminThreadId,
          mlScreenerBotToken, 
          mlScreenerChatId,
          watchlistAlertEnabled,
          watchlistAlertBotToken,
          watchlistAlertChatId,
          watchlistAlertThreadId,
          watchlistAlertMinEmaOffset,
          watchlistAlertMaxEmaOffset,
          watchlistAlertOpenOffset,
          watchlistAlertEma20Enabled,
          watchlistAlertEma20Min,
          watchlistAlertEma20Max,
          watchlistAlertEma50Enabled,
          watchlistAlertEma50Min,
          watchlistAlertEma50Max,
          watchlistAlertOpenGapEnabled,
          watchlistAlertOpenGapMin,
          watchlistAlertUniverse,
          watchlistAlertMinGain
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", message: data.message });
        if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
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
    if (!confirm("Apakah Anda yakin ingin menghapus semua konfigurasi Telegram dan mematikan bot?")) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/admin/telegram/setup", { method: "DELETE" });
      if (res.ok) {
        setBotToken("");
        setAdminChatId("");
        setAdminThreadId("");
        setWebhookUrl("");
        setMlScreenerBotToken("");
        setMlScreenerChatId("");
        setWatchlistAlertBotToken("");
        setWatchlistAlertChatId("");
        setWatchlistAlertThreadId("");
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
          
          {(webhookUrl || mlScreenerBotToken) && (
            <button
              onClick={handleReset}
              disabled={loading}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Hapus Semua Koneksi
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-silver-200 border-b border-white/10 pb-2">Bot Utama (Command & Webhook)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-silver-300 mb-1.5">
                  Admin Chat ID (untuk Morning Brief)
                </label>
                <input
                  type="text"
                  value={adminChatId}
                  onChange={(e) => setAdminChatId(e.target.value)}
                  placeholder="Contoh: 123456789"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-silver-100 placeholder:text-silver-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-silver-300 mb-1.5">
                  Admin Thread ID (untuk Telegram Topics)
                </label>
                <input
                  type="text"
                  value={adminThreadId}
                  onChange={(e) => setAdminThreadId(e.target.value)}
                  placeholder="Contoh: 2 (Kosongkan jika bukan topic)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-silver-100 placeholder:text-silver-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
                />
              </div>
            </div>
            
            {webhookUrl && (
              <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
                <p className="text-xs font-semibold text-silver-500 uppercase tracking-wider">Status Webhook Aktif</p>
                <code className="text-xs text-orange-300 break-all">{webhookUrl}</code>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-md font-semibold text-silver-200 border-b border-white/10 pb-2">Bot Auto-Screener ML (Broadcast Only)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-silver-300 mb-1.5">
                  Telegram Bot Token (ML Screener)
                </label>
                <input
                  type="text"
                  value={mlScreenerBotToken}
                  onChange={(e) => setMlScreenerBotToken(e.target.value)}
                  placeholder="Contoh: 987654321:XYZdefGHIjklMNOpqrSTUvwxYZ"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-silver-100 placeholder:text-silver-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-silver-300 mb-1.5">
                  Target Chat/Channel ID (Alert Tujuan)
                </label>
                <input
                  type="text"
                  value={mlScreenerChatId}
                  onChange={(e) => setMlScreenerChatId(e.target.value)}
                  placeholder="Contoh: -100123456789"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-silver-100 placeholder:text-silver-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
                />
              </div>
            </div>
            <p className="text-xs text-silver-400">Bot ini akan mengirimkan sinyal saham dengan potensi NAIK (probabilitas &gt;80%) setiap 30 menit selama jam bursa.</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-md font-semibold text-silver-200">Auto-Screener Watchlist (Real-time Alert)</h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={watchlistAlertEnabled}
                  onChange={(e) => setWatchlistAlertEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                <span className="ml-3 text-sm font-medium text-silver-300">{watchlistAlertEnabled ? "Aktif" : "Nonaktif"}</span>
              </label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-silver-300 mb-1.5">
                  Telegram Bot Token (Watchlist Alert)
                </label>
                <input
                  type="text"
                  value={watchlistAlertBotToken}
                  onChange={(e) => setWatchlistAlertBotToken(e.target.value)}
                  placeholder="Contoh: 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-silver-100 placeholder:text-silver-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-silver-300 mb-1.5">
                  Target Chat/Channel ID
                </label>
                <input
                  type="text"
                  value={watchlistAlertChatId}
                  onChange={(e) => setWatchlistAlertChatId(e.target.value)}
                  placeholder="Contoh: -100123456789"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-silver-100 placeholder:text-silver-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-silver-300 mb-1.5">
                  Target Thread ID (untuk Telegram Topics)
                </label>
                <input
                  type="text"
                  value={watchlistAlertThreadId}
                  onChange={(e) => setWatchlistAlertThreadId(e.target.value)}
                  placeholder="Contoh: 3 (Kosongkan jika bukan topic)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-silver-100 placeholder:text-silver-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
              <div>
                <label className="block text-xs font-semibold text-silver-400 uppercase mb-2">Screener Universe</label>
                <select 
                  value={watchlistAlertUniverse}
                  onChange={(e) => setWatchlistAlertUniverse(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-silver-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="watchlist">Hanya Saham di Watchlist</option>
                  <option value="all">Seluruh Saham IDX (900+)</option>
                </select>
              </div>
              {watchlistAlertUniverse === "all" && (
                <div>
                  <label className="block text-xs font-semibold text-silver-400 uppercase mb-2">Min. Gain Filter (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="1"
                      value={watchlistAlertMinGain}
                      onChange={(e) => setWatchlistAlertMinGain(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-silver-100"
                    />
                    <span className="text-silver-400 text-sm">%</span>
                  </div>
                  <p className="text-[10px] text-orange-400/70 mt-1">* Hanya memproses saham yang naik &gt; {watchlistAlertMinGain}%</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* EMA 20 Section */}
              <div className={`p-4 rounded-xl border transition-all ${watchlistAlertEma20Enabled ? 'bg-orange-500/5 border-orange-500/30' : 'bg-white/5 border-white/5 opacity-60'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-orange-400 uppercase">EMA 20 Rebound</span>
                  <input 
                    type="checkbox" 
                    checked={watchlistAlertEma20Enabled}
                    onChange={(e) => setWatchlistAlertEma20Enabled(e.target.checked)}
                    className="w-4 h-4 accent-orange-500"
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-silver-500 uppercase mb-1">Range Offset (%)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={watchlistAlertEma20Min}
                        onChange={(e) => setWatchlistAlertEma20Min(Number(e.target.value))}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-silver-100"
                      />
                      <span className="text-silver-600">-</span>
                      <input
                        type="number"
                        step="0.1"
                        value={watchlistAlertEma20Max}
                        onChange={(e) => setWatchlistAlertEma20Max(Number(e.target.value))}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-silver-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* EMA 50 Section */}
              <div className={`p-4 rounded-xl border transition-all ${watchlistAlertEma50Enabled ? 'bg-blue-500/5 border-blue-500/30' : 'bg-white/5 border-white/5 opacity-60'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-blue-400 uppercase">EMA 50 Support</span>
                  <input 
                    type="checkbox" 
                    checked={watchlistAlertEma50Enabled}
                    onChange={(e) => setWatchlistAlertEma50Enabled(e.target.checked)}
                    className="w-4 h-4 accent-blue-500"
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-silver-500 uppercase mb-1">Range Offset (%)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={watchlistAlertEma50Min}
                        onChange={(e) => setWatchlistAlertEma50Min(Number(e.target.value))}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-silver-100"
                      />
                      <span className="text-silver-600">-</span>
                      <input
                        type="number"
                        step="0.1"
                        value={watchlistAlertEma50Max}
                        onChange={(e) => setWatchlistAlertEma50Max(Number(e.target.value))}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-silver-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Open Gap Section */}
              <div className={`p-4 rounded-xl border transition-all ${watchlistAlertOpenGapEnabled ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-white/5 border-white/5 opacity-60'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase">High Momentum</span>
                  <input 
                    type="checkbox" 
                    checked={watchlistAlertOpenGapEnabled}
                    onChange={(e) => setWatchlistAlertOpenGapEnabled(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500"
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-silver-500 uppercase mb-1">Min Open Gap (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={watchlistAlertOpenGapMin}
                      onChange={(e) => setWatchlistAlertOpenGapMin(Number(e.target.value))}
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-silver-100"
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-silver-500 italic">
              * Alert dikirim jika harga masuk ke range salah satu indikator yang aktif.
            </p>
          </div>

          {status && (
            <div className={`p-4 rounded-xl text-sm ${
              status.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              {status.message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-8 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Update Konfigurasi & Simpan"
              )}
            </button>

            <button
              type="button"
              onClick={handleTestAlert}
              disabled={testLoading || !watchlistAlertBotToken}
              className="flex-1 px-8 py-3 bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-50 text-sky-400 border border-sky-500/30 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              {testLoading ? (
                <div className="w-5 h-5 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Kirim Test Alert Sekarang
                </>
              )}
            </button>
          </div>
        </form>
      </GlassCard>

      <GlassCard className="!p-6 border-dashed border-white/10">
        <h3 className="text-lg font-bold text-silver-200 mb-3">Cara Setup & Pakai:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-orange-400 uppercase tracking-wider">1. Setup Bot</h4>
            <ol className="list-decimal list-inside space-y-2 text-silver-400 text-sm">
              <li>Buka Telegram dan cari <span className="text-sky-400">@BotFather</span></li>
              <li>Kirim perintah <code className="bg-white/5 px-1.5 py-0.5 rounded text-orange-300">/newbot</code></li>
              <li>Masukkan <span className="italic text-silver-200">HTTP API Token</span> ke form di atas</li>
              <li>Kirim <code className="bg-white/5 px-1.5 py-0.5 rounded text-orange-300">/start</code> ke bot Anda</li>
              <li>Kirim <code className="bg-white/5 px-1.5 py-0.5 rounded text-orange-300">/my_id</code> ke bot untuk mendapatkan **Chat ID** Anda</li>
            </ol>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">2. Cara Pakai Alert</h4>
            <ul className="list-disc list-inside space-y-2 text-silver-400 text-sm">
              <li><span className="text-silver-200 font-semibold">Otomatis:</span> Aktifkan switch "Aktif" di atas. Bot akan scan watchlist setiap 5-10 menit (via cron).</li>
              <li><span className="text-silver-200 font-semibold">Manual:</span> Klik tombol <span className="text-sky-400">"Kirim Test Alert"</span> untuk trigger instan.</li>
              <li><span className="text-silver-200 font-semibold">Interactive:</span> Ketik <code className="bg-white/5 px-1.5 py-0.5 rounded text-orange-300">/watchlist</code> di Telegram untuk cek status saham saat ini.</li>
            </ul>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
