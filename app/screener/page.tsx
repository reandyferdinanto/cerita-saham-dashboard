"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import type { ScreenerRow } from "@/app/api/screener/route";

type SortKey = "score" | "changePercent" | "volSpikeRatio" | "rsi" | "pctFrom52High";
type Filter = "all" | "buy" | "sell" | "volSpike" | "breakout52" | "oversold";

const FILTER_LABELS: Record<Filter, string> = {
  all: "Semua",
  buy: "🟢 BUY",
  sell: "🔴 SELL",
  volSpike: "⚡ Vol Spike",
  breakout52: "🚀 52W Breakout",
  oversold: "📉 RSI Oversold",
};

export default function ScreenerPage() {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetch("/api/screener")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRows(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let data = [...rows];
    if (filter === "buy")       data = data.filter(r => r.signalLabel === "BUY");
    if (filter === "sell")      data = data.filter(r => r.signalLabel === "SELL");
    if (filter === "volSpike")  data = data.filter(r => r.volSpikeRatio >= 2);
    if (filter === "breakout52")data = data.filter(r => r.isBreakout52W);
    if (filter === "oversold")  data = data.filter(r => r.rsi != null && r.rsi < 30);
    data.sort((a, b) => {
      const av = (a[sortKey] as number) ?? 0;
      const bv = (b[sortKey] as number) ?? 0;
      return sortAsc ? av - bv : bv - av;
    });
    return data;
  }, [rows, filter, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const signalStyle = (label: string) =>
    label === "BUY"  ? { bg: "rgba(16,185,129,0.15)", color: "#10b981", border: "rgba(16,185,129,0.25)" }
    : label === "SELL" ? { bg: "rgba(239,68,68,0.15)",  color: "#f87171", border: "rgba(239,68,68,0.25)" }
    : { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "rgba(245,158,11,0.25)" };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "#f1f5f9" }}>
          Stock <span style={{ color: "#fb923c" }}>Screener</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "#64748b" }}>
          Filter saham IDX berdasarkan sinyal teknikal, volume spike, dan breakout
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={filter === f
              ? { background: "rgba(249,115,22,0.2)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.35)" }
              : { background: "rgba(6,78,59,0.25)", color: "#64748b", border: "1px solid rgba(226,232,240,0.08)" }}>
            {FILTER_LABELS[f]}
            {f !== "all" && !loading && (
              <span className="ml-1 opacity-60">
                ({f === "buy" ? rows.filter(r => r.signalLabel === "BUY").length
                  : f === "sell" ? rows.filter(r => r.signalLabel === "SELL").length
                  : f === "volSpike" ? rows.filter(r => r.volSpikeRatio >= 2).length
                  : f === "breakout52" ? rows.filter(r => r.isBreakout52W).length
                  : rows.filter(r => r.rsi != null && r.rsi < 30).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <GlassCard hover={false} className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-10 h-10 border-2 rounded-full animate-spin"
              style={{ borderColor: "rgba(251,146,60,0.2)", borderTopColor: "#fb923c" }} />
            <p className="text-sm" style={{ color: "#64748b" }}>Menganalisa {50} saham IDX...</p>
            <p className="text-xs" style={{ color: "#334155" }}>Proses ini memakan waktu ~15–30 detik</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: "#475569" }}>Tidak ada saham yang memenuhi filter ini</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "rgba(6,20,15,0.6)", borderBottom: "1px solid rgba(226,232,240,0.08)" }}>
                    {[
                      { key: null,         label: "Saham" },
                      { key: "score",      label: "Score" },
                      { key: null,         label: "Sinyal" },
                      { key: "changePercent", label: "% Chg" },
                      { key: "volSpikeRatio", label: "Vol Spike" },
                      { key: "rsi",        label: "RSI" },
                      { key: "pctFrom52High", label: "vs 52W High" },
                      { key: null,         label: "" },
                    ].map((col, i) => (
                      <th key={i}
                        className={`px-4 py-3 text-left text-[10px] uppercase tracking-wider font-semibold select-none ${col.key ? "cursor-pointer hover:text-orange-400 transition-colors" : ""}`}
                        style={{ color: col.key && sortKey === col.key ? "#fb923c" : "#334155" }}
                        onClick={() => col.key && handleSort(col.key as SortKey)}>
                        {col.label}
                        {col.key && sortKey === col.key && (
                          <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => {
                    const ss = signalStyle(row.signalLabel);
                    return (
                      <tr key={row.ticker}
                        className="transition-all"
                        style={{ borderBottom: "1px solid rgba(226,232,240,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(6,78,59,0.2)")}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)")}
                      >
                        {/* Ticker */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-sm" style={{ color: "#e2e8f0" }}>{row.ticker.replace(".JK","")}</div>
                          <div className="text-[10px] truncate max-w-[120px]" style={{ color: "#475569" }}>{row.name}</div>
                        </td>
                        {/* Score bar */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div className="h-full rounded-full" style={{
                                width: `${row.score}%`,
                                background: row.score >= 60 ? "#10b981" : row.score <= 40 ? "#ef4444" : "#f59e0b"
                              }} />
                            </div>
                            <span className="text-xs font-bold tabular-nums" style={{ color: row.score >= 60 ? "#10b981" : row.score <= 40 ? "#f87171" : "#f59e0b" }}>{row.score}</span>
                          </div>
                        </td>
                        {/* Signal */}
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-bold px-2 py-1 rounded-lg"
                            style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>
                            {row.signalLabel === "BUY" ? "🟢 BUY" : row.signalLabel === "SELL" ? "🔴 SELL" : "🟡 WAIT"}
                          </span>
                        </td>
                        {/* % Change */}
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold tabular-nums"
                            style={{ color: row.changePercent >= 0 ? "#10b981" : "#f87171" }}>
                            {row.changePercent >= 0 ? "+" : ""}{row.changePercent.toFixed(2)}%
                          </span>
                        </td>
                        {/* Vol spike */}
                        <td className="px-4 py-3">
                          <span className="text-xs tabular-nums"
                            style={{ color: row.volSpikeRatio >= 2 ? "#fb923c" : "#64748b", fontWeight: row.volSpikeRatio >= 2 ? 700 : 400 }}>
                            {row.volSpikeRatio >= 2 ? "⚡ " : ""}{row.volSpikeRatio.toFixed(1)}x
                          </span>
                        </td>
                        {/* RSI */}
                        <td className="px-4 py-3">
                          <span className="text-xs tabular-nums font-semibold"
                            style={{ color: row.rsi == null ? "#334155" : row.rsi < 30 ? "#10b981" : row.rsi > 70 ? "#f87171" : "#64748b" }}>
                            {row.rsi != null ? row.rsi.toFixed(1) : "—"}
                          </span>
                        </td>
                        {/* vs 52W */}
                        <td className="px-4 py-3">
                          <span className="text-xs tabular-nums"
                            style={{ color: row.isBreakout52W ? "#10b981" : row.pctFrom52High < -20 ? "#f87171" : "#64748b" }}>
                            {row.isBreakout52W ? "🚀 " : ""}{row.pctFrom52High.toFixed(1)}%
                          </span>
                        </td>
                        {/* Link */}
                        <td className="px-4 py-3">
                          <Link href={`/search?q=${row.ticker.replace(".JK","")}`}
                            className="text-[10px] px-2 py-1 rounded-lg transition-all"
                            style={{ background: "rgba(249,115,22,0.1)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.2)" }}>
                            Analisa →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y" style={{ borderColor: "rgba(226,232,240,0.06)" }}>
              {filtered.map(row => {
                const ss = signalStyle(row.signalLabel);
                return (
                  <Link key={row.ticker} href={`/search?q=${row.ticker.replace(".JK","")}`}>
                    <div className="flex items-center gap-3 px-4 py-3 active:bg-green-900/20 transition-all">
                      {/* Left: ticker + name */}
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(6,78,59,0.4)", border: "1px solid rgba(16,185,129,0.15)" }}>
                        <span className="text-[10px] font-bold" style={{ color: "#fb923c" }}>
                          {row.ticker.replace(".JK","").slice(0,4)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-sm" style={{ color: "#e2e8f0" }}>{row.ticker.replace(".JK","")}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>
                            {row.signalLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px]" style={{ color: "#475569" }}>
                            RSI {row.rsi?.toFixed(1) ?? "—"}
                          </span>
                          {row.volSpikeRatio >= 2 && (
                            <span className="text-[10px] font-semibold" style={{ color: "#fb923c" }}>
                              ⚡ Vol {row.volSpikeRatio.toFixed(1)}x
                            </span>
                          )}
                          {row.isBreakout52W && (
                            <span className="text-[10px] font-semibold" style={{ color: "#10b981" }}>🚀 Breakout</span>
                          )}
                        </div>
                      </div>
                      {/* Right: score + change */}
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold tabular-nums"
                          style={{ color: row.score >= 60 ? "#10b981" : row.score <= 40 ? "#f87171" : "#f59e0b" }}>
                          {row.score}
                        </div>
                        <div className="text-[10px] tabular-nums"
                          style={{ color: row.changePercent >= 0 ? "#10b981" : "#f87171" }}>
                          {row.changePercent >= 0 ? "+" : ""}{row.changePercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Footer count */}
            <div className="px-4 py-2.5 text-[10px]" style={{ color: "#334155", borderTop: "1px solid rgba(226,232,240,0.06)" }}>
              Menampilkan {filtered.length} dari {rows.length} saham · Data diperbarui setiap 5 menit
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}

