import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import { AdminArticlesPageContent } from "@/app/admin/articles/page";
import { AdminUsersPageContent } from "@/app/admin/users/page";
import AdminWatchlistPanel from "@/app/admin/AdminWatchlistPanel";
import AdminStockSummaryPanel from "@/app/admin/AdminStockSummaryPanel";
import AdminBreakdownPanel from "@/app/admin/AdminBreakdownPanel";
import AdminTelegramPanel from "@/app/admin/AdminTelegramPanel";

type AdminTab = "watchlist" | "stock-summary" | "breakdown" | "articles" | "members" | "telegram";

const TAB_CONFIG: Array<{
  id: AdminTab;
  label: string;
  shortLabel: string;
  group: string;
  description: string;
  helper: string;
  highlight?: boolean;
}> = [
  {
    id: "watchlist",
    label: "Watchlist",
    shortLabel: "Watchlist",
    group: "Operasional",
    description: "Kelola saham pantauan, TP/SL, dan catatan bandarmology.",
    helper: "Pantauan saham, level risiko, dan catatan eksekusi.",
  },
  {
    id: "stock-summary",
    label: "Stock Summary",
    shortLabel: "Summary",
    group: "Operasional",
    description: "Upload summary IDX, baca akumulasi lokal dan foreign, lalu bandingkan dengan chart harga.",
    helper: "Upload IDX, screening tanggal, dan data akumulasi.",
  },
  {
    id: "breakdown",
    label: "Breakdown",
    shortLabel: "Breakdown",
    group: "Analisa",
    description: "Bedah candle harian dengan price, MA5, MA10, MA20, dan MA60 lalu simpan high/low pilihan admin.",
    helper: "Klik candle untuk melihat high/low seminggu sebelum dan sesudah.",
  },
  {
    id: "articles",
    label: "Artikel",
    shortLabel: "Artikel",
    group: "Publikasi",
    description: "Tulis, edit, dan kembangkan artikel berita dengan AI.",
    helper: "Kelola insight publik, thumbnail, dan draft artikel.",
  },
  {
    id: "members",
    label: "Member",
    shortLabel: "Member",
    group: "Akses",
    description: "Aktivasi member, atur status membership, harga, dan pembayaran.",
    helper: "Approval akun, status membership, dan metode bayar.",
    highlight: true,
  },
  {
    id: "telegram",
    label: "Telegram Bot",
    shortLabel: "Telegram",
    group: "Publikasi",
    description: "Konfigurasi Bot Telegram untuk cek saham, gainer, dan loser otomatis.",
    helper: "Setup bot dan command market otomatis.",
  },
];

function resolveTab(pathname: string, tabParam: string | null): AdminTab {
  if (pathname === "/admin/articles") return "articles";
  if (pathname === "/admin/users") return "members";
  if (tabParam === "broker-summary") return "stock-summary";
  if (
    tabParam === "articles" || 
    tabParam === "members" || 
    tabParam === "watchlist" || 
    tabParam === "stock-summary" || 
    tabParam === "breakdown" || 
    tabParam === "telegram"
  ) {
    return tabParam as AdminTab;
  }
  return "watchlist";
}

function TabIcon({ tab }: { tab: AdminTab }) {
  if (tab === "telegram") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    );
  }
  if (tab === "watchlist") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  }

  if (tab === "articles") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h1m-1 4h6m-6 4h6m-1-14v5h5" />
      </svg>
    );
  }

  if (tab === "stock-summary") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m3 6V7m3 10v-4m4 6H3a2 2 0 01-2-2V5a2 2 0 012-2h18a2 2 0 012 2v12a2 2 0 01-2 2z" />
      </svg>
    );
  }

  if (tab === "breakdown") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M7 16l3-4 3 2 4-7" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8m4-5v5m4-9v9" />
      </svg>
    );
  }

  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

export default function AdminControlCenter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = useMemo(() => resolveTab(pathname, searchParams.get("tab")), [pathname, searchParams]);
  const activeTabConfig = TAB_CONFIG.find((tab) => tab.id === activeTab) ?? TAB_CONFIG[0];
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchPendingCount() {
      try {
        const res = await fetch("/api/admin/membership", { cache: "no-store" });
        if (!res.ok) return;

        const data = await res.json();
        const count = Array.isArray(data.users)
          ? data.users.filter((user: { membershipStatus?: string }) => user.membershipStatus === "pending").length
          : 0;

        if (!cancelled) {
          setPendingCount(count);
        }
      } catch {}
    }

    fetchPendingCount();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const handleTabChange = (tab: AdminTab) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    router.replace(`/admin?${next.toString()}`);
  };

  return (
    <div className="dashboard-typography space-y-6 pb-6">
      <section className="relative overflow-hidden rounded-[30px] border border-silver-200/10 bg-[oklch(13%_0.021_150_/_0.82)] sm:rounded-[38px]">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(circle at 88% 10%, oklch(68% 0.13 68 / 0.16), transparent 28%), radial-gradient(circle at 10% 88%, oklch(48% 0.08 154 / 0.14), transparent 30%)",
          }}
        />
        <div className="relative grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <p className="dashboard-label text-[11px] font-extrabold uppercase text-orange-300">Admin Center</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-[0.96] tracking-[-0.04em] text-[oklch(94%_0.02_96)] sm:text-5xl">
              Kontrol operasional yang rapi dan cepat dipakai.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[oklch(76%_0.022_105)]">
              Kelola watchlist, stock summary, breakdown candle, artikel, member, dan Telegram dari satu ruang kerja yang lebih tenang. Panel riset tetap dipisah dari admin operasional.
            </p>
          </div>

          <div className="rounded-[26px] border border-silver-200/10 bg-silver-100/[0.045] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-silver-500">Panel Aktif</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-200/20 bg-orange-100/10 text-orange-300">
                <TabIcon tab={activeTabConfig.id} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-silver-100">{activeTabConfig.label}</p>
                <p className="mt-0.5 text-xs text-silver-500">{activeTabConfig.group}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-silver-400">{activeTabConfig.helper}</p>
            {pendingCount > 0 ? (
              <div className="mt-4 rounded-2xl border border-orange-200/15 bg-orange-100/10 px-3 py-2 text-xs font-bold text-orange-200">
                {pendingCount} member menunggu review
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <GlassCard hover={false} className="!rounded-[28px] !border-silver-200/10 !bg-[oklch(12%_0.018_150_/_0.62)] !p-3 sm:!p-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-silver-500">Navigasi Admin</p>
            <p className="mt-1 text-xs text-silver-500">Pilih area kerja, tanpa membuka halaman baru.</p>
          </div>
          <span className="hidden rounded-full border border-silver-200/10 bg-silver-100/[0.04] px-3 py-1 text-xs font-semibold text-silver-400 sm:inline-flex">
            {TAB_CONFIG.length} panel
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.id;
            const isMembers = tab.id === "members";

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className="min-w-[180px] rounded-2xl px-3.5 py-3 text-left transition-all sm:min-w-[190px]"
                style={{
                  background: isActive ? "rgba(251,146,60,0.12)" : "rgba(255,255,255,0.025)",
                  border: isActive ? "1px solid rgba(251,146,60,0.26)" : "1px solid rgba(226,232,240,0.06)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: isActive ? "rgba(251,146,60,0.14)" : "rgba(255,255,255,0.045)",
                      color: isActive ? "#fdba74" : "#94a3b8",
                      border: "1px solid rgba(226,232,240,0.07)",
                    }}
                  >
                    <TabIcon tab={tab.id} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-extrabold" style={{ color: isActive ? "#f8fafc" : "#cbd5e1" }}>
                        {tab.shortLabel}
                      </p>
                      {isActive ? <span className="h-1.5 w-1.5 rounded-full bg-orange-300" /> : null}
                    </div>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-silver-600">{tab.group}</p>
                  </div>
                </div>

                <div className="mt-3 flex min-h-5 items-center gap-2">
                  {tab.highlight ? (
                    <span className="rounded-full border border-orange-200/15 bg-orange-100/10 px-2 py-0.5 text-[10px] font-bold text-orange-200">
                      Prioritas
                    </span>
                  ) : null}
                  {isMembers && pendingCount > 0 ? (
                    <span className="rounded-full bg-orange-400 px-2 py-0.5 text-[10px] font-black text-[oklch(16%_0.03_70)]">
                      {pendingCount} pending
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </GlassCard>

      <section className="rounded-[28px] border border-silver-200/10 bg-[oklch(11.5%_0.016_150_/_0.42)] p-3 sm:p-4">
        <div className="mb-4 flex flex-col gap-2 border-b border-silver-200/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300">{activeTabConfig.group}</p>
            <h2 className="mt-1 text-xl font-extrabold text-silver-100 sm:text-2xl">{activeTabConfig.label}</h2>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-silver-500">{activeTabConfig.description}</p>
        </div>

        {activeTab === "watchlist" ? <AdminWatchlistPanel /> : null}
        {activeTab === "stock-summary" ? <AdminStockSummaryPanel /> : null}
        {activeTab === "breakdown" ? <AdminBreakdownPanel /> : null}
        {activeTab === "telegram" ? <AdminTelegramPanel /> : null}
        {activeTab === "articles" ? <AdminArticlesPageContent embedded /> : null}
        {activeTab === "members" ? <AdminUsersPageContent embedded /> : null}
      </section>
    </div>
  );
}
