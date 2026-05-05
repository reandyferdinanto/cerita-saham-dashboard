"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import { useAuth } from "@/components/ui/AuthProvider";
import AdminBandarmologyPanel from "@/app/admin/AdminBandarmologyPanel";
import AdminSmartMoneyPanel from "@/app/admin/AdminSmartMoneyPanel";
import BacktestHistoryView from "@/components/admin/BacktestHistoryView";

type ResearchPanel = "bandarmology" | "smart-money" | "history";

const PANEL_CONFIG: Array<{
  id: ResearchPanel;
  label: string;
  eyebrow: string;
  description: string;
}> = [
  {
    id: "bandarmology",
    label: "Analisa Bandar",
    eyebrow: "Operator Flow",
    description: "Screener dan bedah ticker untuk membaca fase akumulasi, support defense, dan kesiapan markup.",
  },
  {
    id: "smart-money",
    label: "Smart Money",
    eyebrow: "Behavior Engine",
    description: "Deteksi kebiasaan akumulasi awal, dry dip, supply exhaustion, sampai distribusi aktif.",
  },
  {
    id: "history",
    label: "Riwayat Performa",
    eyebrow: "Signal Audit",
    description: "Pantau win rate, rata-rata profit, drawdown, dan riwayat signal yang sudah selesai.",
  },
];

function resolvePanel(value: string | null): ResearchPanel {
  if (value === "smart-money" || value === "history" || value === "bandarmology") {
    return value;
  }

  return "bandarmology";
}

function PanelIcon({ panel }: { panel: ResearchPanel }) {
  if (panel === "smart-money") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    );
  }

  if (panel === "history") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 8v4l2 2" />
    </svg>
  );
}

export default function ResearchControlCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const activePanel = useMemo(
    () => resolvePanel(searchParams.get("panel") || searchParams.get("tab")),
    [searchParams]
  );

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login?redirect=/research");
      return;
    }

    if (user.role !== "admin" && user.role !== "superadmin") {
      router.replace("/");
    }
  }, [loading, router, user]);

  const handlePanelChange = (panel: ResearchPanel) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("panel", panel);
    next.delete("tab");
    router.replace(`/research?${next.toString()}`);
  };

  if (loading || !user || (user.role !== "admin" && user.role !== "superadmin")) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] p-5 sm:p-7" style={{ background: "linear-gradient(135deg, rgba(6,20,14,0.9), rgba(15,23,42,0.76))", border: "1px solid rgba(251,146,60,0.18)" }}>
        <div className="grid gap-5 lg:grid-cols-[1.1fr,0.9fr] lg:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-300">Private Research Desk</p>
            <h1 className="mt-3 text-3xl font-bold text-silver-100 sm:text-4xl">
              Analisa pasar yang dipisah dari <span className="text-orange-400">Admin Operasional</span>
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-silver-400">
              Halaman ini khusus admin dan superadmin untuk membaca jejak bandar, kebiasaan smart money, dan performa historis signal. Route sengaja tidak ditampilkan di menu admin.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-3xl bg-white/[0.03] p-3 text-center ring-1 ring-white/8">
            <div>
              <p className="text-lg font-black text-orange-300">3</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-silver-500">Panel</p>
            </div>
            <div>
              <p className="text-lg font-black text-emerald-300">Admin</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-silver-500">Access</p>
            </div>
            <div>
              <p className="text-lg font-black text-sky-300">Manual</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-silver-500">Route</p>
            </div>
          </div>
        </div>
      </div>

      <GlassCard hover={false} className="!p-4 sm:!p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {PANEL_CONFIG.map((panel) => {
            const isActive = activePanel === panel.id;

            return (
              <button
                key={panel.id}
                type="button"
                onClick={() => handlePanelChange(panel.id)}
                className="rounded-3xl p-4 text-left transition-all"
                style={{
                  background: isActive ? "rgba(251,146,60,0.12)" : "rgba(255,255,255,0.03)",
                  border: isActive ? "1px solid rgba(251,146,60,0.3)" : "1px solid rgba(226,232,240,0.06)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                      background: isActive ? "rgba(251,146,60,0.16)" : "rgba(255,255,255,0.05)",
                      color: isActive ? "#fdba74" : "#94a3b8",
                      border: "1px solid rgba(226,232,240,0.07)",
                    }}
                  >
                    <PanelIcon panel={panel.id} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-silver-500">{panel.eyebrow}</p>
                    <p className="mt-1 text-sm font-bold" style={{ color: isActive ? "#f8fafc" : "#cbd5e1" }}>{panel.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-silver-500">{panel.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {activePanel === "bandarmology" ? <AdminBandarmologyPanel /> : null}
      {activePanel === "smart-money" ? <AdminSmartMoneyPanel /> : null}
      {activePanel === "history" ? <BacktestHistoryView /> : null}
    </div>
  );
}
