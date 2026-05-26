"use client";

import { useEffect, useState } from "react";
import GlassCard from "@/components/ui/GlassCard";

type BotKind = "admin" | "member";

export default function AdminTelegramPanel() {
  const [activeTab, setActiveTab] = useState<BotKind>("admin");

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-1.5">
        {(
          [
            { id: "admin" as const, label: "🛡️ Admin Bot", desc: "Untuk admin internal" },
            { id: "member" as const, label: "👥 Member Bot", desc: "Untuk member ritel (NVIDIA AI)" },
          ]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 min-w-[200px] rounded-xl px-4 py-3 text-left transition"
            style={{
              background: activeTab === tab.id ? "rgba(249,115,22,0.16)" : "transparent",
              border: activeTab === tab.id ? "1px solid rgba(249,115,22,0.3)" : "1px solid transparent",
            }}
          >
            <p className={`text-sm font-bold ${activeTab === tab.id ? "text-orange-300" : "text-silver-300"}`}>
              {tab.label}
            </p>
            <p className="text-[11px] text-silver-500 mt-0.5">{tab.desc}</p>
          </button>
        ))}
      </div>

      {activeTab === "admin" ? <AdminBotSection /> : <MemberBotSection />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Admin Bot Section (existing functionality)
// ────────────────────────────────────────────────────────────
function AdminBotSection() {
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
    <>
      <GlassCard className="!p-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/20 text-sky-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9-2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-silver-100">Bot Telegram Admin</h2>
              <p className="text-sm text-silver-400">Bot internal untuk admin: cek saham, screenshot chart, alert ML.</p>
            </div>
          </div>

          {webhookUrl ? (
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Putuskan Bot
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-silver-300">Telegram Bot Token</label>
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
              <label className="mb-1.5 block text-sm font-medium text-silver-300">Admin Chat ID</label>
              <input
                type="text"
                value={adminChatId}
                onChange={(e) => setAdminChatId(e.target.value)}
                placeholder="Opsional, contoh: 123456789"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-silver-100 placeholder:text-silver-600 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-silver-300">Admin Thread ID</label>
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
            >
              {status.message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-8 py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-800"
          >
            {loading ? <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : "Simpan & Aktifkan Webhook"}
          </button>
        </form>
      </GlassCard>

      <GlassCard className="!p-6 border-dashed border-white/10">
        <h3 className="mb-3 text-lg font-bold text-silver-200">Command Bot Admin</h3>
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
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Member Bot Section (NEW: NVIDIA NIM AI Brief + chart)
// ────────────────────────────────────────────────────────────
function MemberBotSection() {
  const [enabled, setEnabled] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  const [rateLimit, setRateLimit] = useState(25);
  const [cacheMinutes, setCacheMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/admin/telegram/member-setup");
      const data = await res.json();
      setEnabled(Boolean(data.memberBotEnabled));
      setBotToken(data.memberBotToken || "");
      setWebhookUrl(data.memberBotWebhookUrl || "");
      setRateLimit(data.memberBotRateLimitPerDay ?? 25);
      setCacheMinutes(data.memberBotCacheMinutes ?? 30);
      // Pre-fill publicBaseUrl from existing webhook (strip trailing path)
      if (data.memberBotWebhookUrl) {
        try {
          const u = new URL(data.memberBotWebhookUrl);
          setPublicBaseUrl(`${u.protocol}//${u.host}`);
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.error("Failed to fetch member bot settings", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/telegram/member-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberBotToken: botToken.trim(),
          memberBotEnabled: enabled,
          memberBotRateLimitPerDay: rateLimit,
          memberBotCacheMinutes: cacheMinutes,
          publicBaseUrl: publicBaseUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", message: data.message });
        if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
      } else {
        setStatus({ type: "error", message: data.error || "Gagal menyimpan member bot" });
      }
    } catch {
      setStatus({ type: "error", message: "Terjadi kesalahan koneksi" });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Hapus konfigurasi member bot? Webhook akan dihapus dari Telegram juga.")) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/telegram/member-setup", { method: "DELETE" });
      if (res.ok) {
        setEnabled(false);
        setBotToken("");
        setWebhookUrl("");
        setStatus({ type: "success", message: "Member bot berhasil diputus" });
      } else {
        setStatus({ type: "error", message: "Gagal reset member bot" });
      }
    } catch {
      setStatus({ type: "error", message: "Terjadi kesalahan koneksi" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <GlassCard className="!p-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/20 text-emerald-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-silver-100">Bot Telegram Member</h2>
              <p className="text-sm text-silver-400">Bot terpisah untuk member: ketik kode saham → chart + AI brief (NVIDIA NIM gpt-oss-20b).</p>
            </div>
          </div>

          {webhookUrl ? (
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Putuskan Member Bot
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="text-sm font-semibold text-silver-100">Aktifkan Member Bot</p>
              <p className="text-xs text-silver-500 mt-1">
                Saat ON, bot akan merespon pesan dari member. Saat OFF, webhook tetap, tapi tidak ada respons.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className="relative h-7 w-12 rounded-full transition"
              style={{ background: enabled ? "rgba(16,185,129,0.7)" : "rgba(255,255,255,0.12)" }}
            >
              <span
                className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
                style={{ left: enabled ? "calc(100% - 24px)" : "4px" }}
              />
            </button>
          </div>

          {/* Bot Token */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-silver-300">
              Member Bot Token <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="Token dari @BotFather (bot terpisah dari admin)"
              autoComplete="off"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-silver-100 placeholder:text-silver-600 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <p className="mt-1 text-[11px] text-silver-500">Buat bot baru di @BotFather, jangan pakai token bot admin.</p>
          </div>

          {/* Public Base URL (HTTPS required by Telegram) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-silver-300">
              Public Base URL (HTTPS)
            </label>
            <input
              type="url"
              value={publicBaseUrl}
              onChange={(e) => setPublicBaseUrl(e.target.value)}
              placeholder="https://your-domain.com atau https://abc123.ngrok.io"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-silver-100 placeholder:text-silver-600 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono text-sm"
            />
            <p className="mt-1 text-[11px] text-silver-500">
              Telegram wajib HTTPS untuk webhook. Untuk dev di localhost: jalankan ngrok (<code className="text-emerald-300">ngrok http 3000</code>) lalu paste HTTPS URL-nya di sini. Untuk production: pakai domain HTTPS Anda. Kosongkan kalau pakai env <code className="text-emerald-300">TELEGRAM_PUBLIC_URL</code>.
            </p>
          </div>

          {/* Rate limit + cache */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-silver-300">Rate Limit per Member / Hari</label>
              <input
                type="number"
                min={1}
                max={500}
                value={rateLimit}
                onChange={(e) => setRateLimit(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-silver-100 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <p className="mt-1 text-[11px] text-silver-500">Max brief per chat per hari (reset jam 00:00 WIB). Default 25.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-silver-300">Cache Brief (menit)</label>
              <input
                type="number"
                min={1}
                max={720}
                value={cacheMinutes}
                onChange={(e) => setCacheMinutes(Math.max(1, Math.min(720, Number(e.target.value) || 1)))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-silver-100 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <p className="mt-1 text-[11px] text-silver-500">Brief untuk ticker yang sama di-cache untuk hemat token AI. Default 30.</p>
            </div>
          </div>

          {webhookUrl ? (
            <div className="space-y-2 rounded-xl border border-white/5 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-silver-500">Webhook Member Aktif</p>
              <code className="break-all text-xs text-emerald-300">{webhookUrl}</code>
            </div>
          ) : null}

          {status ? (
            <div
              className={`rounded-xl border p-4 text-sm ${
                status.type === "success"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
            >
              {status.message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-8 py-3 font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-800"
          >
            {loading ? <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : "Simpan & Aktifkan Member Bot"}
          </button>
        </form>
      </GlassCard>

      <GlassCard className="!p-6 border-dashed border-white/10">
        <h3 className="mb-3 text-lg font-bold text-silver-200">Cara Pakai Member Bot</h3>
        <div className="grid grid-cols-1 gap-4 text-sm text-silver-400 md:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
            <p className="mb-2 font-semibold text-silver-200">Setup (sekali)</p>
            <ol className="list-inside list-decimal space-y-2">
              <li>Buat bot baru di <span className="text-sky-400">@BotFather</span> (terpisah dari bot admin).</li>
              <li>Copy token, paste ke field di atas, aktifkan toggle, lalu Simpan.</li>
              <li>Sebar link bot ke member (contoh: <code className="rounded bg-white/5 px-1.5 py-0.5 text-emerald-300">t.me/anomali_member_bot</code>).</li>
              <li>Member kirim <code className="rounded bg-white/5 px-1.5 py-0.5 text-emerald-300">/start</code> di bot untuk melihat panduan.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
            <p className="mb-2 font-semibold text-silver-200">Cara Member Pakai</p>
            <ul className="list-inside list-disc space-y-2">
              <li>Ketik kode saham, contoh: <code className="rounded bg-white/5 px-1.5 py-0.5 text-emerald-300">BBCA</code>, <code className="rounded bg-white/5 px-1.5 py-0.5 text-emerald-300">GOTO</code>.</li>
              <li>Bot kirim chart + AI brief (NVIDIA NIM gpt-oss-20b, gratis).</li>
              <li>Brief sama di-cache supaya tidak boros API: ketikan ticker yang sama dalam {cacheMinutes} menit pakai brief cache.</li>
              <li>Limit per member: {rateLimit} brief/hari (reset 00:00 WIB).</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-2">Estimasi Biaya</p>
          <p className="text-xs text-silver-300 leading-relaxed">
            10 member × 50 request/hari = 500 request/hari. Dengan cache {cacheMinutes} menit aktif, hanya ~100-200 unique brief/hari ke NVIDIA NIM. NVIDIA NIM saat ini <strong className="text-emerald-300">gratis</strong> dengan rate limit reasonable. Tidak ada biaya tambahan untuk chart screenshot (rendering lokal).
          </p>
        </div>
      </GlassCard>
    </>
  );
}
