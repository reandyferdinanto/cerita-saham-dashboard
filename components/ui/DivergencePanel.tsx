"use client";

import { DivergenceResult, MACDDivergenceResult } from "@/lib/technicalIndicators";
import { TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react";

interface DivergencePanelProps {
  rsiDivergence: DivergenceResult | null;
  macdDivergence: MACDDivergenceResult | null;
  loading?: boolean;
}

export default function DivergencePanel({ rsiDivergence, macdDivergence, loading }: DivergencePanelProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.58)] p-6 animate-pulse">
        <div className="h-6 w-40 bg-silver-200/10 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-20 bg-silver-200/10 rounded" />
          <div className="h-20 bg-silver-200/10 rounded" />
        </div>
      </div>
    );
  }

  const hasAnyDivergence = rsiDivergence?.type || macdDivergence?.type;

  if (!hasAnyDivergence) {
    return (
      <div className="rounded-2xl border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.58)] p-6">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-silver-400" />
          <div>
            <h3 className="text-sm font-bold text-silver-200">Divergence Analysis</h3>
            <p className="text-xs text-silver-400 mt-1">Tidak ada divergence terdeteksi saat ini</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.58)] p-6 space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <Activity className="h-5 w-5 text-silver-300" />
        <h3 className="text-lg font-bold text-silver-100">Divergence Analysis</h3>
      </div>

      <div className="space-y-3">
        {/* RSI Divergence */}
        {rsiDivergence?.type && (
          <div className="rounded-xl border border-silver-200/10 bg-silver-100/[0.04] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className={`rounded-full p-1.5 ${
                  rsiDivergence.type === "bullish"
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : "bg-red-500/10 border border-red-500/30"
                }`}>
                  {rsiDivergence.type === "bullish" ? (
                    <TrendingUp className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-300" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-silver-100">RSI Divergence</h4>
                  <p className="text-xs text-silver-400 capitalize">{rsiDivergence.type}</p>
                </div>
              </div>
              
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${
                rsiDivergence.type === "bullish"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-red-500/10 text-red-300"
              }`}>
                {rsiDivergence.strength}%
              </div>
            </div>

            {/* Strength Meter */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-silver-400">Kekuatan Divergence</span>
                <span className="text-xs font-bold text-silver-200">{rsiDivergence.strength}%</span>
              </div>
              <div className="h-1.5 bg-silver-200/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    rsiDivergence.type === "bullish" ? "bg-emerald-500" : "bg-red-500"
                  }`}
                  style={{ width: `${rsiDivergence.strength}%` }}
                />
              </div>
            </div>

            {/* Price & RSI Points */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-silver-200/10">
              {rsiDivergence.pricePoints.length >= 2 && (
                <>
                  <div>
                    <p className="text-xs text-silver-400 mb-1">Price Point 1</p>
                    <p className="text-sm font-bold text-silver-100">{rsiDivergence.pricePoints[0].value.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-silver-400 mb-1">Price Point 2</p>
                    <p className="text-sm font-bold text-silver-100">{rsiDivergence.pricePoints[1].value.toLocaleString()}</p>
                  </div>
                </>
              )}
              {rsiDivergence.rsiPoints.length >= 2 && (
                <>
                  <div>
                    <p className="text-xs text-silver-400 mb-1">RSI Point 1</p>
                    <p className="text-sm font-bold text-silver-100">{rsiDivergence.rsiPoints[0].value.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-silver-400 mb-1">RSI Point 2</p>
                    <p className="text-sm font-bold text-silver-100">{rsiDivergence.rsiPoints[1].value.toFixed(2)}</p>
                  </div>
                </>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-silver-300 leading-relaxed pt-2 border-t border-silver-200/10">
              {rsiDivergence.description}
            </p>
          </div>
        )}

        {/* MACD Divergence */}
        {macdDivergence?.type && (
          <div className="rounded-xl border border-silver-200/10 bg-silver-100/[0.04] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className={`rounded-full p-1.5 ${
                  macdDivergence.type === "bullish"
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : "bg-red-500/10 border border-red-500/30"
                }`}>
                  <BarChart3 className={`h-4 w-4 ${
                    macdDivergence.type === "bullish" ? "text-emerald-300" : "text-red-300"
                  }`} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-silver-100">MACD Divergence</h4>
                  <p className="text-xs text-silver-400 capitalize">{macdDivergence.type}</p>
                </div>
              </div>
              
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${
                macdDivergence.type === "bullish"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-red-500/10 text-red-300"
              }`}>
                {macdDivergence.strength}%
              </div>
            </div>

            {/* Strength Meter */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-silver-400">Kekuatan Divergence</span>
                <span className="text-xs font-bold text-silver-200">{macdDivergence.strength}%</span>
              </div>
              <div className="h-1.5 bg-silver-200/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    macdDivergence.type === "bullish" ? "bg-emerald-500" : "bg-red-500"
                  }`}
                  style={{ width: `${macdDivergence.strength}%` }}
                />
              </div>
            </div>

            {/* Price & Histogram Points */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-silver-200/10">
              {macdDivergence.pricePoints.length >= 2 && (
                <>
                  <div>
                    <p className="text-xs text-silver-400 mb-1">Price Point 1</p>
                    <p className="text-sm font-bold text-silver-100">{macdDivergence.pricePoints[0].value.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-silver-400 mb-1">Price Point 2</p>
                    <p className="text-sm font-bold text-silver-100">{macdDivergence.pricePoints[1].value.toLocaleString()}</p>
                  </div>
                </>
              )}
              {macdDivergence.histogramPoints.length >= 2 && (
                <>
                  <div>
                    <p className="text-xs text-silver-400 mb-1">MACD Hist 1</p>
                    <p className="text-sm font-bold text-silver-100">{macdDivergence.histogramPoints[0].value.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-silver-400 mb-1">MACD Hist 2</p>
                    <p className="text-sm font-bold text-silver-100">{macdDivergence.histogramPoints[1].value.toFixed(4)}</p>
                  </div>
                </>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-silver-300 leading-relaxed pt-2 border-t border-silver-200/10">
              {macdDivergence.description}
            </p>
          </div>
        )}
      </div>

      {/* Summary */}
      {rsiDivergence?.type && macdDivergence?.type && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mt-4">
          <p className="text-xs font-semibold text-amber-200 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" />
            <span>Double Divergence Confirmation!</span>
          </p>
          <p className="text-xs text-amber-300/80 mt-1">
            RSI dan MACD menunjukkan divergence {rsiDivergence.type === macdDivergence.type ? "yang sama" : "berbeda"}.
            {rsiDivergence.type === macdDivergence.type && " Sinyal reversal lebih kuat."}
          </p>
        </div>
      )}
    </div>
  );
}

// Made with Bob
