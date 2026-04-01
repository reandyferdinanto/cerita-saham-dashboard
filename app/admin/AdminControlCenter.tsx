"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import { AdminArticlesPageContent } from "@/app/admin/articles/page";
import { AdminUsersPageContent } from "@/app/admin/users/page";
import AdminWatchlistPanel from "@/app/admin/AdminWatchlistPanel";

type AdminTab = "watchlist" | "articles" | "members";

const TAB_CONFIG: Array<{
  id: AdminTab;
  label: string;
  description: string;
  highlight?: boolean;
}> = [
  {
    id: "watchlist",
    label: "Watchlist",
    description: "Kelola saham pantauan, TP/SL, dan catatan bandarmology.",
  },
  {
    id: "articles",
    label: "Artikel",
    description: "Tulis, edit, dan kembangkan artikel berita dengan AI.",
  },
  {
    id: "members",
    label: "Member",
    description: "Aktivasi member, atur status membership, harga, dan pembayaran.",
    highlight: true,
  },
];

function resolveTab(pathname: string, tabParam: string | null): AdminTab {
  if (pathname === "/admin/articles") return "articles";
  if (pathname === "/admin/users") return "members";
  if (tabParam === "articles" || tabParam === "members" || tabParam === "watchlist") return tabParam;
  return "watchlist";
}

function TabIcon({ tab }: { tab: AdminTab }) {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-silver-100">
          Pengaturan <span className="text-orange-400">Admin</span>
        </h1>
        <p className="text-silver-500 text-sm mt-1">
          Semua kontrol admin kini dipusatkan dalam satu halaman dengan tab untuk watchlist, artikel, dan member.
        </p>
      </div>

      <GlassCard hover={false} className="!p-4 sm:!p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.id;
            const isMembers = tab.id === "members";

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className="text-left rounded-2xl px-4 py-4 transition-all"
                style={{
                  background: isActive
                    ? isMembers
                      ? "linear-gradient(135deg, rgba(251,146,60,0.24) 0%, rgba(16,185,129,0.14) 100%)"
                      : "rgba(251,146,60,0.12)"
                    : isMembers
                      ? "linear-gradient(135deg, rgba(251,146,60,0.1) 0%, rgba(16,185,129,0.06) 100%)"
                      : "rgba(255,255,255,0.03)",
                  border: isActive
                    ? isMembers
                      ? "1px solid rgba(251,146,60,0.45)"
                      : "1px solid rgba(251,146,60,0.28)"
                    : isMembers
                      ? "1px solid rgba(251,146,60,0.22)"
                      : "1px solid rgba(226,232,240,0.06)",
                  boxShadow: isMembers ? "0 10px 30px rgba(251,146,60,0.08)" : "none",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isMembers ? "rgba(251,146,60,0.18)" : "rgba(255,255,255,0.06)",
                        color: isMembers ? "#fdba74" : isActive ? "#fb923c" : "#94a3b8",
                        border: isMembers ? "1px solid rgba(251,146,60,0.25)" : "1px solid rgba(226,232,240,0.06)",
                      }}
                    >
                      <TabIcon tab={tab.id} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold" style={{ color: isMembers ? "#fde68a" : isActive ? "#e2e8f0" : "#cbd5e1" }}>
                          {tab.label}
                        </p>
                        {tab.highlight ? (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                            style={{ background: "rgba(251,146,60,0.16)", color: "#fdba74", border: "1px solid rgba(251,146,60,0.24)" }}
                          >
                            Prioritas
                          </span>
                        ) : null}
                        {isMembers && pendingCount > 0 ? (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: "#fb923c", color: "#fff" }}
                          >
                            {pendingCount} pending
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs mt-1" style={{ color: isMembers ? "#f1f5f9" : "#94a3b8" }}>
                        {tab.description}
                      </p>
                    </div>
                  </div>
                  {isActive ? (
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.08)", color: "#e2e8f0" }}>
                      Aktif
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {activeTab === "watchlist" ? <AdminWatchlistPanel /> : null}
      {activeTab === "articles" ? <AdminArticlesPageContent embedded /> : null}
      {activeTab === "members" ? <AdminUsersPageContent embedded /> : null}
    </div>
  );
}
