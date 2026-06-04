"use client";

import { StrategySignal } from "@/lib/technicalIndicators";
import { TrendingUp, TrendingDown, Minus, Target, Shield, AlertCircle } from "lucide-react";

interface StrategySignalCardProps {
  signal: StrategySignal | null;
  loading?: boolean;
}

export default function StrategySignalCard({ signal, loading }: StrategySignalCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.58)] p-6 animate-pulse">
        <div className="h-6 w-32 bg-silver-200/10 rounded mb-4" />
        <div className="h-4 w-full bg-silver-200/10 rounded mb-2" />
        <div className="h-4 w-3/4 bg-silver-200/10 rounded" />
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="rounded-2xl border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.58)] p-6">
        <div className="flex items-center gap-3 text-silver-400">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">Tidak ada sinyal strategi tersedia. Butuh minimal 2 faktor konvergensi.</p>
        </div>
      </div>
    );
  }

  const getSignalColor = () => {
    switch (signal.type) {
      case "LONG":
        return {
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/30",
          text: "text-emerald-300",
          icon: TrendingUp,
        };
      case "SHORT":
        return {
          bg: "bg-red-500/10",
          border: "border-red-500/30",
          text: "text-red-300",
          icon: TrendingDown,
        };
      default:
        return {
          bg: "bg-silver-500/10",
          border: "border-silver-500/30",
          text: "text-silver-300",
          icon: Minus,
        };
    }
  };

  const colors = getSignalColor();
  const SignalIcon = colors.icon;

  const getConfidenceColor = () => {
    if (signal.confidence >= 70) return "bg-emerald-500";
    if (signal.confidence >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="rounded-2xl border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.58)] p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-2 ${colors.bg} ${colors.border} border`}>
            <SignalIcon className={`h-6 w-6 ${colors.text}`} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-silver-100">
              Sinyal {signal.type === "LONG" ? "BULLISH" : signal.type === "SHORT" ? "BEARISH" : "NETRAL"}
            </h3>
            <p className="text-xs text-silver-400 mt-0.5">
              Timeframe: {signal.timeframe === "swing" ? "Swing (3-7 hari)" : "Scalp (Intraday)"}
            </p>
          </div>
        </div>
        
        {/* Strength Badge */}
        <div className="text-right">
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${colors.bg} ${colors.text}`}>
            <span>Kekuatan: {signal.strength}%</span>
          </div>
        </div>
      </div>

      {/* Confidence Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-silver-400">Confidence Score</span>
          <span className="text-sm font-bold text-silver-200">{signal.confidence}%</span>
        </div>
        <div className="h-2 bg-silver-200/10 rounded-full overflow-hidden">
          <div
            className={`h-full ${getConfidenceColor()} transition-all duration-500`}
            style={{ width: `${signal.confidence}%` }}
          />
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-silver-300 leading-relaxed">
        {signal.description}
      </p>

      {/* Convergence Factors */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-silver-400 mb-2">
          Faktor Konvergensi ({signal.convergenceFactors.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {signal.convergenceFactors.map((factor, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1.5 rounded-full border border-silver-200/20 bg-silver-100/[0.08] px-3 py-1 text-xs font-medium text-silver-300"
            >
              {factor}
            </span>
          ))}
        </div>
      </div>

      {/* Entry Zone & Targets */}
      {signal.entryZone && signal.targets && signal.stopLoss && (
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-silver-200/10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-silver-400">
              <Target className="h-3.5 w-3.5" />
              <span>Entry Zone</span>
            </div>
            <div className="text-sm font-bold text-silver-100">
              {signal.entryZone.min.toLocaleString()} - {signal.entryZone.max.toLocaleString()}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-silver-400">
              <Shield className="h-3.5 w-3.5" />
              <span>Stop Loss</span>
            </div>
            <div className="text-sm font-bold text-red-300">
              {signal.stopLoss.toLocaleString()}
            </div>
          </div>

          <div className="col-span-2 space-y-1">
            <p className="text-xs font-semibold text-silver-400">Targets</p>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-silver-300">TP1: <span className="font-bold text-emerald-300">{signal.targets.tp1.toLocaleString()}</span></span>
              <span className="text-silver-300">TP2: <span className="font-bold text-emerald-300">{signal.targets.tp2.toLocaleString()}</span></span>
              <span className="text-silver-300">TP3: <span className="font-bold text-emerald-300">{signal.targets.tp3.toLocaleString()}</span></span>
            </div>
          </div>

          {signal.riskReward && (
            <div className="col-span-2">
              <p className="text-xs text-silver-400">
                Risk/Reward: <span className="font-bold text-silver-200">{signal.riskReward.toFixed(2)}:1</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Made with Bob
