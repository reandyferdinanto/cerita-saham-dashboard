"use client";

import { FibonacciLevels } from "@/lib/technicalIndicators";
import { TrendingUp, TrendingDown, Target, Minus } from "lucide-react";

interface FibonacciLevelsDisplayProps {
  fibLevels: FibonacciLevels | null;
  currentPrice: number;
  loading?: boolean;
}

export default function FibonacciLevelsDisplay({ fibLevels, currentPrice, loading }: FibonacciLevelsDisplayProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.58)] p-6 animate-pulse">
        <div className="h-6 w-48 bg-silver-200/10 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-12 bg-silver-200/10 rounded" />
          <div className="h-12 bg-silver-200/10 rounded" />
          <div className="h-12 bg-silver-200/10 rounded" />
        </div>
      </div>
    );
  }

  if (!fibLevels) {
    return (
      <div className="rounded-2xl border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.58)] p-6">
        <div className="flex items-center gap-3 text-silver-400">
          <Target className="h-5 w-5" />
          <p className="text-sm">Fibonacci levels tidak tersedia. Butuh data historis yang cukup.</p>
        </div>
      </div>
    );
  }

  const getDistanceFromPrice = (level: number) => {
    const diff = level - currentPrice;
    const percent = (diff / currentPrice) * 100;
    return {
      diff,
      percent,
      isAbove: diff > 0,
    };
  };

  const getLevelColor = (level: number) => {
    const distance = getDistanceFromPrice(level);
    const absPercent = Math.abs(distance.percent);
    
    // Current price zone (within 1%)
    if (absPercent < 1) {
      return "bg-blue-500/20 border-blue-500/40 text-blue-200";
    }
    
    // Support levels (below price)
    if (!distance.isAbove) {
      return "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
    }
    
    // Resistance levels (above price)
    return "bg-red-500/10 border-red-500/30 text-red-300";
  };

  return (
    <div className="rounded-2xl border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.58)] p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-silver-300" />
          <div>
            <h3 className="text-lg font-bold text-silver-100">Fibonacci Levels</h3>
            <p className="text-xs text-silver-400 mt-0.5">
              Trend: <span className="capitalize font-semibold">{fibLevels.direction}</span>
            </p>
          </div>
        </div>
        
        <div className={`rounded-full p-2 ${
          fibLevels.direction === "uptrend" 
            ? "bg-emerald-500/10 border border-emerald-500/30" 
            : "bg-red-500/10 border border-red-500/30"
        }`}>
          {fibLevels.direction === "uptrend" ? (
            <TrendingUp className="h-5 w-5 text-emerald-300" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-300" />
          )}
        </div>
      </div>

      {/* Swing Points */}
      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-silver-100/[0.04] border border-silver-200/10">
        <div>
          <p className="text-xs text-silver-400 mb-1">Swing High</p>
          <p className="text-sm font-bold text-silver-100">{fibLevels.swingHigh.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-silver-400 mb-1">Swing Low</p>
          <p className="text-sm font-bold text-silver-100">{fibLevels.swingLow.toLocaleString()}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-silver-400 mb-1">Range</p>
          <p className="text-sm font-bold text-silver-100">{fibLevels.range.toLocaleString()}</p>
        </div>
      </div>

      {/* Retracement Levels */}
      <div>
        <h4 className="text-sm font-bold text-silver-200 mb-3 flex items-center gap-2">
          <Minus className="h-4 w-4" />
          <span>Retracement Levels</span>
        </h4>
        <div className="space-y-2">
          {fibLevels.retracements.map((level, index) => {
            const distance = getDistanceFromPrice(level.price);
            const colorClass = getLevelColor(level.price);
            
            return (
              <div
                key={index}
                className={`rounded-lg border p-3 ${colorClass} transition-all hover:scale-[1.02]`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold">{level.percentage}</span>
                      <span className="text-xs opacity-70">{level.label}</span>
                    </div>
                    <p className="text-lg font-bold">{level.price.toLocaleString()}</p>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${distance.isAbove ? 'text-red-300' : 'text-emerald-300'}`}>
                      {distance.isAbove ? '+' : ''}{distance.percent.toFixed(2)}%
                    </p>
                    <p className="text-xs opacity-70 mt-0.5">
                      {Math.abs(distance.diff).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Extension Levels */}
      <div>
        <h4 className="text-sm font-bold text-silver-200 mb-3 flex items-center gap-2">
          <Target className="h-4 w-4" />
          <span>Extension Targets</span>
        </h4>
        <div className="space-y-2">
          {fibLevels.extensions.map((level, index) => {
            const distance = getDistanceFromPrice(level.price);
            const colorClass = getLevelColor(level.price);
            
            return (
              <div
                key={index}
                className={`rounded-lg border p-3 ${colorClass} transition-all hover:scale-[1.02]`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold">{level.percentage}</span>
                      <span className="text-xs opacity-70">{level.label}</span>
                    </div>
                    <p className="text-lg font-bold">{level.price.toLocaleString()}</p>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${distance.isAbove ? 'text-red-300' : 'text-emerald-300'}`}>
                      {distance.isAbove ? '+' : ''}{distance.percent.toFixed(2)}%
                    </p>
                    <p className="text-xs opacity-70 mt-0.5">
                      {Math.abs(distance.diff).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Price Indicator */}
      <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-200">Current Price</p>
            <p className="text-lg font-bold text-blue-100 mt-0.5">{currentPrice.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-300">
              {fibLevels.direction === "uptrend" ? "Watching for pullback" : "Watching for bounce"}
            </p>
          </div>
        </div>
      </div>

      {/* Trading Notes */}
      <div className="rounded-xl bg-silver-100/[0.04] border border-silver-200/10 p-3">
        <p className="text-xs text-silver-300 leading-relaxed">
          <span className="font-semibold text-silver-200">Trading Note:</span> {
            fibLevels.direction === "uptrend" 
              ? "Dalam uptrend, cari entry di retracement 38.2%-61.8%. Target di extension levels."
              : "Dalam downtrend, cari short entry di retracement 38.2%-61.8%. Target di extension levels ke bawah."
          }
        </p>
      </div>
    </div>
  );
}

// Made with Bob
