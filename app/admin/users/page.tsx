"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import { useAuth } from "@/components/ui/AuthProvider";

interface MemberUser {
  _id: string;
  email: string;
  name?: string;
  role: "user" | "admin" | "superadmin";
  membershipStatus: "pending" | "active" | "expired" | "rejected" | "suspended";
  membershipDuration?: string;
  membershipStartDate?: string;
  membershipEndDate?: string;
  membershipNote?: string;
  createdAt: string;
}

interface PaymentMethod { name: string; type: string; accountNumber: string; accountName: string }
interface Settings {
  membershipPrices: { "3months": number; "6months": number; "1year": number };
  paymentMethods: PaymentMethod[];
  enabledInvestorTools: string[];
}

const DEFAULT_INVESTOR_TOOLS = [
  "aiBrief",
  "riskCalculator",
  "rightsIssueCalculator",
  "stockSplitCalculator",
];

const INVESTOR_TOOL_OPTIONS = [
  { id: "aiBrief", label: "AI Stock Brief" },
  { id: "riskCalculator", label: "Risk Calculator" },
  { id: "rightsIssueCalculator", label: "Right Issue Calculator" },
  { id: "stockSplitCalculator", label: "Stock Split Calculator" },
] as const;

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Menunggu", color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  active:    { label: "Aktif",    color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  expired:   { label: "Expired",  color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  rejected:  { label: "Ditolak",  color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  suspended: { label: "Suspend",  color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

const DURATION_LABEL: Record<string, string> = {
  "3months": "3 Bulan", "6months": "6 Bulan", "1year": "1 Tahun",
};

const FILTER_TABS = ["all", "pending", "active", "expired", "rejected", "suspended"] as const;
type FilterTab = typeof FILTER_TABS[number];

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<AdminUsersPageFallback />}>
      <AdminUsersPageContent />
    </Suspense>
  );
}

export function AdminUsersPageContent({ embedded = false }: { embedded?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<MemberUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [noteModal, setNoteModal] = useState<{ userId: string; action: string; label: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [recentUsersFromAssistant, setRecentUsersFromAssistant] = useState<MemberUser[]>([]);

  useEffect(() => {
    if (!loading && (!user || (user.role !== "admin" && user.role !== "superadmin"))) router.replace("/");
  }, [user, loading, router]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/membership");
      if (res.ok) { const d = await res.json(); setUsers(d.users); }
    } finally { setFetching(false); }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) return;

      const data = (await res.json()) as Partial<Settings>;
      setSettings({
        membershipPrices: data.membershipPrices ?? { "3months": 300000, "6months": 550000, "1year": 1100000 },
        paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods : [],
        enabledInvestorTools:
          Array.isArray(data.enabledInvestorTools) && data.enabledInvestorTools.length > 0
            ? data.enabledInvestorTools
            : DEFAULT_INVESTOR_TOOLS,
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "superadmin") { fetchUsers(); fetchSettings(); }
  }, [user, fetchUsers, fetchSettings]);

  useEffect(() => {
    if (searchParams.get("view") !== "newest") {
      setRecentUsersFromAssistant([]);
      return;
    }

    const raw = sessionStorage.getItem("admin_assistant_recent_users");

    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as MemberUser[];
      setRecentUsersFromAssistant(parsed);
    } catch {
      setRecentUsersFromAssistant([]);
    }
  }, [searchParams]);

  useEffect(() => {
    const status = searchParams.get("status") as FilterTab | null;

    if (status && FILTER_TABS.includes(status)) {
      setFilter(status);
    }
  }, [searchParams]);

  const act = async (userId: string, action: string, note?: string) => {
    setActing(userId + action);
    try {
      const res = await fetch("/api/admin/membership", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, note }),
      });
      if (res.ok) await fetchUsers();
    } finally { setActing(null); }
  };

  const openNote = (userId: string, action: string, label: string) => {
    setNoteText(""); setNoteModal({ userId, action, label });
  };
  const confirmAction = async () => {
    if (!noteModal) return;
    await act(noteModal.userId, noteModal.action, noteText);
    setNoteModal(null);
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true); setSettingsMsg("");
    try {
      const res = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      setSettingsMsg(res.ok ? "✓ Disimpan" : "Gagal menyimpan");
    } finally { setSavingSettings(false); }
  };

  const filtered = users.filter((u) => {
    const matchFilter = filter === "all" || u.membershipStatus === filter;
    const matchSearch = !search || u.email.includes(search) || (u.name || "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingCount = users.filter((u) => u.membershipStatus === "pending").length;
  const newestUsers = [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);
  const showNewestPanel = searchParams.get("view") === "newest";
  const enabledInvestorTools =
    settings && Array.isArray(settings.enabledInvestorTools) && settings.enabledInvestorTools.length > 0
      ? settings.enabledInvestorTools
      : DEFAULT_INVESTOR_TOOLS;

  if (loading || fetching) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {!embedded ? (
          <div>
            <h1 className="text-2xl font-bold text-silver-100">Manajemen <span className="text-orange-400">Member</span></h1>
            <p className="text-sm text-silver-500 mt-0.5">Kelola membership, aktivasi, dan pengaturan harga</p>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold text-silver-100">Manajemen <span className="text-orange-400">Member</span></h2>
            <p className="text-sm text-silver-500 mt-0.5">Semua kontrol membership, pricing, dan payment method ada di tab ini.</p>
          </div>
        )}
        {(user?.role === "admin" || user?.role === "superadmin") && (
          <button onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: showSettings ? "rgba(251,146,60,0.15)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(251,146,60,0.2)", color: "#fb923c" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Pengaturan
          </button>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && settings && (user?.role === "admin" || user?.role === "superadmin") && (
        <GlassCard hover={false} className="!p-5 space-y-5">
          <h3 className="text-sm font-bold text-silver-200">⚙️ Harga & Metode Pembayaran</h3>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#475569" }}>Harga Membership (Rp)</p>
            <div className="grid grid-cols-3 gap-3">
              {(["3months","6months","1year"] as const).map((k) => (
                <div key={k}>
                  <label className="text-[11px] mb-1 block" style={{ color: "#64748b" }}>{DURATION_LABEL[k]}</label>
                  <input type="number" value={settings.membershipPrices[k]}
                    onChange={(e) => setSettings({ ...settings, membershipPrices: { ...settings.membershipPrices, [k]: Number(e.target.value) } })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "rgba(6,20,14,0.85)", border: "1px solid rgba(16,185,129,0.15)", color: "#e2e8f0" }} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#475569" }}>Tools Investor Yang Ditampilkan</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {INVESTOR_TOOL_OPTIONS.map((tool) => (
                <label
                  key={tool.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)", color: "#e2e8f0" }}
                >
                  <input
                    type="checkbox"
                    checked={enabledInvestorTools.includes(tool.id)}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        enabledInvestorTools: e.target.checked
                          ? [...new Set([...enabledInvestorTools, tool.id])]
                          : enabledInvestorTools.filter((item) => item !== tool.id),
                      })
                    }
                  />
                  <span>{tool.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>Metode Pembayaran</p>
              <button onClick={() => setSettings({ ...settings, paymentMethods: [...settings.paymentMethods, { name: "", type: "bank", accountNumber: "", accountName: "" }] })}
                className="text-[11px] px-2.5 py-1 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>+ Tambah</button>
            </div>
            <div className="space-y-2">
              {settings.paymentMethods.map((pm, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
                  <input placeholder="Nama (BCA/OVO/dll)" value={pm.name}
                    onChange={(e) => { const p=[...settings.paymentMethods]; p[i]={...p[i],name:e.target.value}; setSettings({...settings,paymentMethods:p}); }}
                    className="px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background:"rgba(6,20,14,0.85)", border:"1px solid rgba(16,185,129,0.12)", color:"#e2e8f0" }} />
                  <select value={pm.type}
                    onChange={(e) => { const p=[...settings.paymentMethods]; p[i]={...p[i],type:e.target.value}; setSettings({...settings,paymentMethods:p}); }}
                    className="px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background:"rgba(6,20,14,0.85)", border:"1px solid rgba(16,185,129,0.12)", color:"#e2e8f0" }}>
                    <option value="bank">Bank</option><option value="emoney">E-Money</option>
                  </select>
                  <input placeholder="No. Rekening / HP" value={pm.accountNumber}
                    onChange={(e) => { const p=[...settings.paymentMethods]; p[i]={...p[i],accountNumber:e.target.value}; setSettings({...settings,paymentMethods:p}); }}
                    className="px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background:"rgba(6,20,14,0.85)", border:"1px solid rgba(16,185,129,0.12)", color:"#e2e8f0" }} />
                  <div className="flex gap-1">
                    <input placeholder="Nama pemilik" value={pm.accountName}
                      onChange={(e) => { const p=[...settings.paymentMethods]; p[i]={...p[i],accountName:e.target.value}; setSettings({...settings,paymentMethods:p}); }}
                      className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background:"rgba(6,20,14,0.85)", border:"1px solid rgba(16,185,129,0.12)", color:"#e2e8f0" }} />
                    <button onClick={() => setSettings({...settings, paymentMethods: settings.paymentMethods.filter((_,j)=>j!==i)})}
                      className="px-2 rounded-lg text-xs" style={{ background:"rgba(239,68,68,0.1)", color:"#ef4444" }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveSettings} disabled={savingSettings}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background:"linear-gradient(135deg,#ea580c,#fb923c)", color:"#fff" }}>
              {savingSettings ? "Menyimpan..." : "Simpan"}
            </button>
            {settingsMsg && <span className="text-sm" style={{ color: settingsMsg.startsWith("✓") ? "#10b981" : "#ef4444" }}>{settingsMsg}</span>}
          </div>
        </GlassCard>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(["pending","active","expired","rejected","suspended"] as FilterTab[]).map((s) => {
          const count = users.filter(u => u.membershipStatus === s).length;
          const cfg = STATUS_BADGE[s];
          return (
            <div key={s} className="rounded-xl p-3 text-center cursor-pointer transition-all" onClick={() => setFilter(s)}
              style={{ background: filter===s ? cfg.bg : "rgba(6,20,14,0.6)", border: `1px solid ${filter===s ? cfg.color+"44" : "rgba(226,232,240,0.06)"}` }}>
              <p className="text-2xl font-bold" style={{ color: cfg.color }}>{count}</p>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "#64748b" }}>{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {showNewestPanel && (
        <GlassCard hover={false} className="!p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-bold text-silver-200">User Baru Join</h2>
              <p className="text-xs text-silver-500 mt-1">Daftar user terbaru berdasarkan waktu registrasi.</p>
            </div>
            <button
              type="button"
              onClick={() => router.replace("/admin?tab=members")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid rgba(226,232,240,0.08)" }}
            >
              Tutup
            </button>
          </div>
          <div className="space-y-2">
            {(recentUsersFromAssistant.length > 0 ? recentUsersFromAssistant : newestUsers).map((recentUser) => (
              <div
                key={recentUser._id}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-silver-200 truncate">{recentUser.name || recentUser.email}</p>
                  <p className="text-xs text-silver-500 truncate">{recentUser.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-orange-400">{new Date(recentUser.createdAt).toLocaleDateString("id-ID")}</p>
                  <p className="text-[11px] text-silver-500">{STATUS_BADGE[recentUser.membershipStatus]?.label || recentUser.membershipStatus}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 flex-wrap">
          {FILTER_TABS.map((t) => (
            <button key={t} onClick={() => setFilter(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: filter===t ? "rgba(251,146,60,0.15)" : "rgba(255,255,255,0.04)", color: filter===t ? "#fb923c" : "#64748b", border: filter===t ? "1px solid rgba(251,146,60,0.3)" : "1px solid transparent" }}>
              {t === "all" ? `Semua (${users.length})` : STATUS_BADGE[t].label}
              {t === "pending" && pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background:"#fb923c", color:"#fff" }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari email / nama..."
          className="sm:ml-auto px-3 py-1.5 rounded-lg text-sm outline-none"
          style={{ background:"rgba(6,20,14,0.85)", border:"1px solid rgba(16,185,129,0.12)", color:"#e2e8f0", minWidth:200 }} />
      </div>

      {/* User cards */}
      <div className="space-y-3">
        {filtered.length === 0 && <div className="text-center py-12 text-silver-500 text-sm">Tidak ada user ditemukan</div>}
        {filtered.map((u) => {
          const badge = STATUS_BADGE[u.membershipStatus] || STATUS_BADGE.pending;
          const endDate = u.membershipEndDate ? new Date(u.membershipEndDate) : null;
          const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / 86400000) : null;
          const price = settings?.membershipPrices?.[u.membershipDuration as keyof typeof settings.membershipPrices];
          return (
            <GlassCard key={u._id} hover={false} className="!p-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-silver-200">{u.name || u.email}</p>
                    {u.name && <p className="text-xs" style={{ color:"#475569" }}>{u.email}</p>}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background:badge.bg, color:badge.color }}>{badge.label}</span>
                    {u.role === "admin" && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background:"rgba(251,146,60,0.12)", color:"#fb923c" }}>Admin</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs" style={{ color:"#64748b" }}>
                    {u.membershipDuration && <span>📦 {DURATION_LABEL[u.membershipDuration] || u.membershipDuration}{price && <span style={{ color:"#10b981" }}> · Rp {price.toLocaleString("id-ID")}</span>}</span>}
                    {u.membershipStartDate && <span>▶ {new Date(u.membershipStartDate).toLocaleDateString("id-ID")}</span>}
                    {endDate && <span style={{ color: daysLeft !== null && daysLeft <= 7 ? "#f87171" : "#64748b" }}>⏳ s/d {endDate.toLocaleDateString("id-ID")}{daysLeft !== null && daysLeft > 0 && ` (${daysLeft}h)`}{daysLeft !== null && daysLeft <= 0 && " (kadaluarsa)"}</span>}
                    <span>🗓 {new Date(u.createdAt).toLocaleDateString("id-ID")}</span>
                  </div>
                  {u.membershipNote && <p className="text-xs italic" style={{ color:"#475569" }}>📝 {u.membershipNote}</p>}
                </div>
                <div className="flex flex-wrap gap-2 flex-shrink-0">
                  {u.membershipStatus === "pending" && <>
                    <button onClick={() => openNote(u._id,"activate","Aktifkan")} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background:"rgba(16,185,129,0.15)", border:"1px solid rgba(16,185,129,0.3)", color:"#10b981" }}>✓ Aktifkan</button>
                    <button onClick={() => openNote(u._id,"reject","Tolak")} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"#ef4444" }}>✕ Tolak</button>
                  </>}
                  {u.membershipStatus === "active" && <>
                    <button onClick={() => openNote(u._id,"deactivate","Nonaktifkan")} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background:"rgba(100,116,139,0.12)", border:"1px solid rgba(100,116,139,0.2)", color:"#94a3b8" }}>⏸ Nonaktifkan</button>
                    <button onClick={() => openNote(u._id,"suspend","Suspend")} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"#ef4444" }}>🚫 Suspend</button>
                  </>}
                  {(u.membershipStatus === "expired" || u.membershipStatus === "rejected" || u.membershipStatus === "suspended") && (
                    <button onClick={() => openNote(u._id,"activate","Aktifkan Ulang")} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background:"rgba(16,185,129,0.12)", border:"1px solid rgba(16,185,129,0.25)", color:"#10b981" }}>↺ Aktifkan Ulang</button>
                  )}
                  {user?.role === "superadmin" && u.role !== "superadmin" && (
                    <button onClick={() => act(u._id, u.role === "admin" ? "demote" : "promote")} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background:"rgba(251,146,60,0.08)", border:"1px solid rgba(251,146,60,0.15)", color:"#fb923c" }}>
                      {u.role === "admin" ? "↓ Demote" : "↑ Admin"}
                    </button>
                  )}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Note/confirm modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:"rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background:"rgba(6,20,14,0.98)", border:"1px solid rgba(16,185,129,0.2)" }}>
            <h3 className="text-base font-bold text-silver-200">{noteModal.label} Member</h3>
            <div>
              <label className="block text-xs mb-1" style={{ color:"#94a3b8" }}>Catatan admin (opsional)</label>
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder="Tulis catatan..."
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(16,185,129,0.15)", color:"#e2e8f0" }} />
            </div>
            <div className="flex gap-2">
              <button onClick={confirmAction} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background:"linear-gradient(135deg,#ea580c,#fb923c)", color:"#fff" }}>Konfirmasi</button>
              <button onClick={() => setNoteModal(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background:"rgba(255,255,255,0.05)", color:"#94a3b8", border:"1px solid rgba(226,232,240,0.08)" }}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminUsersPageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

