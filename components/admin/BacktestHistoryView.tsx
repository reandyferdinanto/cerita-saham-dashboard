"use client";

import { useState, useEffect } from "react";

interface PerformanceRecord {
  ticker: string;
  entryDate: string;
  exitDate: string;
  durationDays: number;
  isSuccess: boolean;
  gainPct: number;
}

interface Stats {
  totalTrades: number;
  winRate: number;
  avgProfit: number;
  sharpe: number;
  maxDrawdown: number;
  equityCurve: number[];
}

function EquityCurveChart({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 1);
  const range = max - min;
  
  const width = 400;
  const height = 100;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="w-full h-24 bg-white/5 rounded-xl border border-white/5 overflow-hidden p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <polyline
          fill="none"
          stroke="#fb923c"
          strokeWidth="2"
          points={points}
        />
      </svg>
    </div>
  );
}

export default function BacktestHistoryView() {
  const [history, setHistory] = useState<PerformanceRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/backtest-history")
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.history || []);
        setStats(data.stats || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4 text-silver-500">Memuat riwayat...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-silver-100">Performance Analytics</h3>
        <button 
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-silver-400 text-xs font-bold rounded-lg border border-white/10 transition-all"
        >
          Refresh Data
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] text-silver-500 uppercase tracking-widest font-bold mb-1">Win Rate</p>
            <p className="text-2xl font-black text-emerald-400">{stats.winRate.toFixed(1)}%</p>
            <p className="text-[10px] text-silver-600 mt-1">{stats.totalTrades} total trades</p>
          </div>
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] text-silver-500 uppercase tracking-widest font-bold mb-1">Avg Profit</p>
            <p className={`text-2xl font-black ${stats.avgProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {stats.avgProfit.toFixed(2)}%
            </p>
            <p className="text-[10px] text-silver-600 mt-1">Per trade average</p>
          </div>
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] text-silver-500 uppercase tracking-widest font-bold mb-1">Sharpe Ratio</p>
            <p className="text-2xl font-black text-orange-400">{stats.sharpe.toFixed(2)}</p>
            <p className="text-[10px] text-silver-600 mt-1">Risk-adjusted return</p>
          </div>
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] text-silver-500 uppercase tracking-widest font-bold mb-1">Max Drawdown</p>
            <p className="text-2xl font-black text-red-400">{stats.maxDrawdown.toFixed(2)}%</p>
            <p className="text-[10px] text-silver-600 mt-1">Peak-to-trough decline</p>
          </div>
        </div>
      )}

      {stats && stats.equityCurve && stats.equityCurve.length > 1 && (
        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-5 space-y-3">
          <p className="text-[10px] text-silver-500 uppercase tracking-widest font-bold">Equity Curve (Cumulative Return)</p>
          <EquityCurveChart data={stats.equityCurve} />
        </div>
      )}

      <div className="space-y-3">
        <p className="text-[10px] text-silver-500 uppercase tracking-widest font-bold px-1">Recent Trades</p>
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/50">
          <table className="w-full text-left text-sm text-silver-300">
            <thead className="bg-white/5 uppercase text-[10px] tracking-widest text-silver-500">
              <tr>
                <th className="p-4">Ticker</th>
                <th className="p-4">Entry</th>
                <th className="p-4">Durasi</th>
                <th className="p-4">Status</th>
                <th className="p-4">Profit</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-silver-600 italic">Belum ada riwayat signal yang selesai.</td>
                </tr>
              )}
              {history.map((h, i) => (
                <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold">{h.ticker.replace(".JK", "")}</td>
                  <td className="p-4">{new Date(h.entryDate).toLocaleDateString("id-ID", { day: '2-digit', month: 'short' })}</td>
                  <td className="p-4">{h.durationDays} hari</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${h.isSuccess ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-red-500/20 text-red-400 border border-red-500/20"}`}>
                      {h.isSuccess ? "SUCCESS" : "FAILED"}
                    </span>
                  </td>
                  <td className={`p-4 font-bold ${h.gainPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {h.gainPct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
