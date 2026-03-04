"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WatchlistWithQuote } from "@/lib/types";
import { calcTechnicalSignals, OHLCVBar } from "@/lib/technicalSignals";

interface StockCardProps {
  stock: WatchlistWithQuote;
}

export default function StockCard({ stock }: StockCardProps) {
  const quote = stock.quote;
  const price = quote?.price || 0;
  const change = quote?.change || 0;
  const changePercent = quote?.changePercent || 0;
  const isPositive = change >= 0;

  // Calculate distance to TP and SL
  const tpDistance = stock.tp && price ? (((stock.tp - price) / price) * 100) : null;
  const slDistance = stock.sl && price ? (((price - stock.sl) / price) * 100) : null;

  // ── Technical signal badge ─────────────────────────────────────────────────
  const [signal, setSignal] = useState<{ label: "BUY"|"SELL"|"WAIT"; score: number } | null>(null);
  useEffect(() => {
    fetch(`/api/stocks/history/${encodeURIComponent(stock.ticker)}?range=3mo&interval=1d`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || data.length < 20) return;
        const bars: OHLCVBar[] = data.map((h: any) => ({
          time: h.time, open: h.open, high: h.high, low: h.low,
          close: h.close, volume: h.volume ?? 0,
        }));
        const result = calcTechnicalSignals(bars);
        setSignal({ label: result.label, score: result.score });
      })
      .catch(() => {});
  }, [stock.ticker]);

  const sigStyle = signal ? {
    BUY:  { bg: "rgba(16,185,129,0.15)", color: "#10b981", border: "rgba(16,185,129,0.25)", icon: "🟢" },
    SELL: { bg: "rgba(239,68,68,0.15)",  color: "#f87171", border: "rgba(239,68,68,0.25)",  icon: "🔴" },
    WAIT: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "rgba(245,158,11,0.25)", icon: "🟡" },
  }[signal.label] : null;

  return (
    <Link href={`/stock/${encodeURIComponent(stock.ticker)}`}>
      <div className="glass-card p-5 cursor-pointer group">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-silver-200 group-hover:text-orange-400 transition-colors">
              {stock.ticker.replace(".JK", "")}
            </h3>
            <p className="text-xs text-silver-500 truncate max-w-[140px]">
              {stock.name}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`px-2 py-1 rounded-lg text-xs font-bold ${
              isPositive
                ? "bg-green-500/20 text-green-500 border border-green-500/20"
                : "bg-red-500/20 text-red-400 border border-red-500/20"
            }`}>
              {isPositive ? "▲" : "▼"} {Math.abs(changePercent).toFixed(2)}%
            </div>
            {/* Signal badge */}
            {sigStyle && signal && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: sigStyle.bg, color: sigStyle.color, border: `1px solid ${sigStyle.border}` }}>
                {sigStyle.icon} {signal.label} {signal.score}
              </span>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="mb-4">
          <span className="text-2xl font-bold text-silver-100">
            {price.toLocaleString("id-ID")}
          </span>
          <span className={`ml-2 text-sm ${isPositive ? "text-green-500" : "text-red-400"}`}>
            {isPositive ? "+" : ""}{change.toFixed(0)}
          </span>
        </div>

        {/* TP / SL badges */}
        <div className="flex gap-2 mb-3">
          {stock.tp && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/15">
              <span className="text-[10px] text-green-500 font-semibold">TP</span>
              <span className="text-xs text-green-400">{stock.tp.toLocaleString("id-ID")}</span>
              {tpDistance !== null && (
                <span className="text-[10px] text-silver-500">({tpDistance > 0 ? "+" : ""}{tpDistance.toFixed(1)}%)</span>
              )}
            </div>
          )}
          {stock.sl && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/15">
              <span className="text-[10px] text-red-400 font-semibold">SL</span>
              <span className="text-xs text-red-300">{stock.sl.toLocaleString("id-ID")}</span>
              {slDistance !== null && (
                <span className="text-[10px] text-silver-500">({slDistance > 0 ? "-" : ""}{Math.abs(slDistance).toFixed(1)}%)</span>
              )}
            </div>
          )}
        </div>

        {/* Notes preview */}
        {stock.bandarmology && (
          <div className="border-t border-white/5 pt-3 mt-1">
            <div className="flex items-center gap-1 mb-1">
              <svg className="w-3 h-3 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider">Notes</span>
            </div>
            <p className="text-xs text-silver-500 line-clamp-2">
              {stock.bandarmology}
            </p>
          </div>
        )}

        {/* Volume */}
        {quote && (
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5">
            <span className="text-[10px] text-silver-500">Vol</span>
            <span className="text-[10px] text-silver-400 font-mono">
              {(quote.volume / 1_000_000).toFixed(1)}M
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

