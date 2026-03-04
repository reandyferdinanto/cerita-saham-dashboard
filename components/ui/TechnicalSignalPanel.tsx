"use client";

import { useMemo, useState } from "react";
import GlassCard from "@/components/ui/GlassCard";
import { calcTechnicalSignals, OHLCVBar, TechnicalResult } from "@/lib/technicalSignals";
import { OHLCData } from "@/lib/types";

interface Props {
  history: OHLCData[];
  ticker: string;
}

export default function TechnicalSignalPanel({ history, ticker }: Props) {
  const [expanded, setExpanded] = useState(true);

  const result: TechnicalResult | null = useMemo(() => {
    if (history.length < 20) return null;
    const bars: OHLCVBar[] = history.map(h => ({
      time: h.time,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: (h as any).volume ?? 0,
    }));
    return calcTechnicalSignals(bars);
  }, [history]);

  if (!result) return null;

  const { label, score, signals, rsi, ma20, ma50, ma200, srLevels } = result;

  const labelStyle = {
    BUY:  { bg: "rgba(16,185,129,0.15)",  color: "#10b981", border: "rgba(16,185,129,0.3)",  icon: "🟢" },
    SELL: { bg: "rgba(239,68,68,0.15)",   color: "#f87171", border: "rgba(239,68,68,0.3)",   icon: "🔴" },
    WAIT: { bg: "rgba(245,158,11,0.15)",  color: "#f59e0b", border: "rgba(245,158,11,0.3)",  icon: "🟡" },
  }[label];

  const signalColor = (s: "buy" | "sell" | "neutral") =>
    s === "buy" ? "#10b981" : s === "sell" ? "#f87171" : "#64748b";

  return (
    <GlassCard hover={false}>
      {/* Header — always visible */}
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: labelStyle.bg, border: `1px solid ${labelStyle.border}` }}>
            <svg className="w-4 h-4" style={{ color: labelStyle.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold" style={{ color: "#e2e8f0" }}>
              Sinyal Teknikal <span style={{ color: labelStyle.color }}>{ticker.replace(".JK","")}</span>
            </h3>
            <p className="text-[10px]" style={{ color: "#475569" }}>Golden Cross · RSI · MACD · S/R</p>
          </div>
        </div>

        {/* Score + label badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <span className="text-lg font-bold tabular-nums" style={{ color: labelStyle.color }}>{score}</span>
            <span className="text-[10px] ml-1" style={{ color: "#475569" }}>/100</span>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{ background: labelStyle.bg, color: labelStyle.color, border: `1px solid ${labelStyle.border}` }}>
            {labelStyle.icon} {label}
          </span>
          <svg className="w-4 h-4 transition-transform duration-200" style={{ color: "#475569", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Score bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "#475569" }}>Strength Score</span>
              <span className="text-xs font-bold tabular-nums" style={{ color: labelStyle.color }}>{score}/100</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${score}%`,
                  background: score >= 60 ? "linear-gradient(90deg,#10b981,#34d399)" : score <= 40 ? "linear-gradient(90deg,#ef4444,#f87171)" : "linear-gradient(90deg,#f59e0b,#fbbf24)"
                }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px]" style={{ color: "#f87171" }}>SELL (0–38)</span>
              <span className="text-[9px]" style={{ color: "#f59e0b" }}>WAIT (39–61)</span>
              <span className="text-[9px]" style={{ color: "#10b981" }}>BUY (62–100)</span>
            </div>
          </div>

          {/* Key metrics grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {[
              { label: "RSI",   value: rsi?.toFixed(1) ?? "—",   color: rsi == null ? "#475569" : rsi < 30 ? "#10b981" : rsi > 70 ? "#f87171" : "#94a3b8" },
              { label: "MA20",  value: ma20?.toFixed(0) ?? "—",  color: "#94a3b8" },
              { label: "MA50",  value: ma50?.toFixed(0) ?? "—",  color: "#94a3b8" },
              { label: "MA200", value: ma200?.toFixed(0) ?? "—", color: "#94a3b8" },
            ].map(m => (
              <div key={m.label} className="p-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
                <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "#475569" }}>{m.label}</p>
                <p className="text-xs font-bold tabular-nums" style={{ color: m.color }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Individual signals */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: "#334155" }}>Breakdown Sinyal</p>
            <div className="space-y-1">
              {signals.map((s, i) => (
                <div key={i} className="flex items-start justify-between gap-2 py-1.5 px-2.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.04)" }}>
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: signalColor(s.signal) }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "#cbd5e1" }}>{s.name}</p>
                      <p className="text-[10px]" style={{ color: "#475569" }}>{s.value}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      background: s.signal === "buy" ? "rgba(16,185,129,0.12)" : s.signal === "sell" ? "rgba(239,68,68,0.12)" : "rgba(100,116,139,0.12)",
                      color: signalColor(s.signal),
                    }}>
                    {s.signal === "buy" ? "▲ Bullish" : s.signal === "sell" ? "▼ Bearish" : "◆ Netral"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* S/R Levels */}
          {srLevels.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: "#334155" }}>Support & Resistance</p>
              <div className="flex flex-wrap gap-2">
                {srLevels.sort((a, b) => b.price - a.price).map((l, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                    style={{
                      background: l.type === "R" ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                      border: `1px solid ${l.type === "R" ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
                    }}>
                    <span className="text-[10px] font-bold" style={{ color: l.type === "R" ? "#f87171" : "#10b981" }}>
                      {l.type === "R" ? "R" : "S"}
                    </span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: "#cbd5e1" }}>
                      {l.price.toLocaleString("id-ID")}
                    </span>
                    <div className="w-6 h-1 rounded-full" style={{
                      background: l.type === "R" ? "#f87171" : "#10b981",
                      opacity: l.strength / 100,
                    }} />
                  </div>
                ))}
              </div>
              <p className="text-[9px] mt-1.5" style={{ color: "#334155" }}>
                Garis lebih tebal = lebih sering diuji · Berdasarkan swing high/low 60 hari terakhir
              </p>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-[9px] px-2" style={{ color: "#1e293b" }}>
            ⚠ Sinyal bersifat informatif, bukan rekomendasi investasi. Selalu lakukan analisa tambahan sebelum mengambil keputusan.
          </p>
        </div>
      )}
    </GlassCard>
  );
}

