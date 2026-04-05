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

    const bars: OHLCVBar[] = history.map((h) => ({
      time: h.time,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: (h as OHLCData & { volume?: number }).volume ?? 0,
    }));

    return calcTechnicalSignals(bars);
  }, [history]);

  if (!result) return null;

  const {
    label,
    score,
    signals,
    actionBias,
    conclusionTitle,
    conclusionBody,
    rsi,
    ma20,
    ma50,
    ma200,
    srLevels,
  } = result;

  const labelStyle = {
    BUY: { bg: "rgba(16,185,129,0.15)", color: "#10b981", border: "rgba(16,185,129,0.3)", icon: "BUY" },
    SELL: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "rgba(239,68,68,0.3)", icon: "SELL" },
    WAIT: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "rgba(245,158,11,0.3)", icon: "WAIT" },
  }[label];

  const conclusionStyle = {
    entry: { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.22)", color: "#10b981", tag: "Entry Bertahap" },
    "wait-pullback": { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.22)", color: "#f59e0b", tag: "Tunggu Pullback" },
    avoid: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.22)", color: "#f87171", tag: "Defensif" },
    "risk-reward": { bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.18)", color: "#94a3b8", tag: "Pantau Dulu" },
  }[actionBias];

  const signalColor = (signal: "buy" | "sell" | "neutral") =>
    signal === "buy" ? "#10b981" : signal === "sell" ? "#f87171" : "#64748b";

  return (
    <GlassCard hover={false}>
      <button type="button" onClick={() => setExpanded((e) => !e)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: labelStyle.bg, border: `1px solid ${labelStyle.border}` }}
          >
            <svg className="w-4 h-4" style={{ color: labelStyle.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold" style={{ color: "#e2e8f0" }}>
              Sinyal Teknikal <span style={{ color: labelStyle.color }}>{ticker.replace(".JK", "")}</span>
            </h3>
            <p className="text-[10px]" style={{ color: "#475569" }}>Golden Cross · RSI · MACD · S/R</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <span className="text-lg font-bold tabular-nums" style={{ color: labelStyle.color }}>{score}</span>
            <span className="text-[10px] ml-1" style={{ color: "#475569" }}>/100</span>
          </div>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{ background: labelStyle.bg, color: labelStyle.color, border: `1px solid ${labelStyle.border}` }}
          >
            {labelStyle.icon}
          </span>
          <svg
            className="w-4 h-4 transition-transform duration-200"
            style={{ color: "#475569", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div
            className="rounded-2xl p-3.5"
            style={{ background: conclusionStyle.bg, border: `1px solid ${conclusionStyle.border}` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold" style={{ color: "#e2e8f0" }}>{conclusionTitle}</p>
                <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "#94a3b8" }}>{conclusionBody}</p>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap"
                style={{ background: "rgba(15,23,42,0.35)", color: conclusionStyle.color, border: `1px solid ${conclusionStyle.border}` }}
              >
                {conclusionStyle.tag}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "#475569" }}>Strength Score</span>
              <span className="text-xs font-bold tabular-nums" style={{ color: labelStyle.color }}>{score}/100</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${score}%`,
                  background:
                    score >= 60
                      ? "linear-gradient(90deg,#10b981,#34d399)"
                      : score <= 40
                        ? "linear-gradient(90deg,#ef4444,#f87171)"
                        : "linear-gradient(90deg,#f59e0b,#fbbf24)",
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px]" style={{ color: "#f87171" }}>SELL (0-38)</span>
              <span className="text-[9px]" style={{ color: "#f59e0b" }}>WAIT (39-61)</span>
              <span className="text-[9px]" style={{ color: "#10b981" }}>BUY (62-100)</span>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {[
              { label: "RSI", value: rsi?.toFixed(1) ?? "-", color: rsi == null ? "#475569" : rsi < 30 ? "#10b981" : rsi > 70 ? "#f87171" : "#94a3b8" },
              { label: "MA20", value: ma20?.toFixed(0) ?? "-", color: "#94a3b8" },
              { label: "MA50", value: ma50?.toFixed(0) ?? "-", color: "#94a3b8" },
              { label: "MA200", value: ma200?.toFixed(0) ?? "-", color: "#94a3b8" },
            ].map((metric) => (
              <div
                key={metric.label}
                className="p-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}
              >
                <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "#475569" }}>{metric.label}</p>
                <p className="text-xs font-bold tabular-nums" style={{ color: metric.color }}>{metric.value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: "#334155" }}>Breakdown Sinyal</p>
            <div className="space-y-1">
              {signals.map((signal, index) => (
                <div
                  key={`${signal.name}-${index}`}
                  className="flex items-start justify-between gap-2 py-1.5 px-2.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.04)" }}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: signalColor(signal.signal) }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "#cbd5e1" }}>{signal.name}</p>
                      <p className="text-[10px]" style={{ color: "#475569" }}>{signal.value}</p>
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      background:
                        signal.signal === "buy"
                          ? "rgba(16,185,129,0.12)"
                          : signal.signal === "sell"
                            ? "rgba(239,68,68,0.12)"
                            : "rgba(100,116,139,0.12)",
                      color: signalColor(signal.signal),
                    }}
                  >
                    {signal.signal === "buy" ? "Bullish" : signal.signal === "sell" ? "Bearish" : "Netral"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {srLevels.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: "#334155" }}>Support & Resistance</p>
              <div className="flex flex-wrap gap-2">
                {srLevels
                  .sort((a, b) => b.price - a.price)
                  .map((level, index) => (
                    <div
                      key={`${level.type}-${level.price}-${index}`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                      style={{
                        background: level.type === "R" ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                        border: `1px solid ${level.type === "R" ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
                      }}
                    >
                      <span className="text-[10px] font-bold" style={{ color: level.type === "R" ? "#f87171" : "#10b981" }}>
                        {level.type}
                      </span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: "#cbd5e1" }}>
                        {level.price.toLocaleString("id-ID")}
                      </span>
                      <div
                        className="w-6 h-1 rounded-full"
                        style={{
                          background: level.type === "R" ? "#f87171" : "#10b981",
                          opacity: level.strength / 100,
                        }}
                      />
                    </div>
                  ))}
              </div>
              <p className="text-[9px] mt-1.5" style={{ color: "#334155" }}>
                Garis lebih tebal = lebih sering diuji. Berdasarkan swing high/low 60 hari terakhir.
              </p>
            </div>
          )}

          <p className="text-[9px] px-2" style={{ color: "#1e293b" }}>
            Sinyal ini membantu membaca konteks entry, bukan menggantikan analisa support, resistance, dan risk management.
          </p>
        </div>
      )}
    </GlassCard>
  );
}
