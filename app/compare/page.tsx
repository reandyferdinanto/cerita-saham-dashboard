"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import GlassCard from "@/components/ui/GlassCard";

const LineChart = dynamic(() => import("@/components/charts/LineChart"), { ssr: false });

const COLORS = ["#fb923c","#3b82f6","#10b981","#a855f7","#f59e0b"];

interface StockData {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  marketCap?: number;
  trailingPE?: number;
  priceToBook?: number;
  roe?: number;
  profitMargin?: number;
  revenue?: number;
  history: { time: string; value: number }[]; // normalised to 100
}

export default function ComparePage() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ symbol: string; name: string }[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 1) { setResults([]); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks/search/${encodeURIComponent(q)}`);
        const data = await res.json();
        if (Array.isArray(data)) setResults(data.slice(0, 6));
      } catch { /**/ }
      finally { setSearching(false); }
    }, 400);
  }, []);

  const addStock = useCallback(async (symbol: string, name: string) => {
    if (stocks.length >= 5 || stocks.find(s => s.ticker === symbol)) return;
    setResults([]); setQuery("");
    setLoading(symbol);
    try {
      const [quoteRes, histRes, fundRes] = await Promise.all([
        fetch(`/api/stocks/quote/${encodeURIComponent(symbol)}`).then(r => r.json()),
        fetch(`/api/stocks/history/${encodeURIComponent(symbol)}?range=1y&interval=1d`).then(r => r.json()),
        fetch(`/api/stocks/fundamental/${encodeURIComponent(symbol)}`).then(r => r.json()),
      ]);
      const history: { time: string; close: number }[] = Array.isArray(histRes) ? histRes : [];
      const base = history[0]?.close || 1;
      const normalised = history.map(h => ({ time: h.time as string, value: (h.close / base) * 100 }));
      setStocks(prev => [...prev, {
        ticker: symbol,
        name: name || quoteRes.name || symbol,
        price: quoteRes.price ?? 0,
        changePercent: quoteRes.changePercent ?? 0,
        marketCap: fundRes.valuation?.marketCap ?? undefined,
        trailingPE: fundRes.valuation?.trailingPE ?? undefined,
        priceToBook: fundRes.valuation?.priceToBook ?? undefined,
        roe: fundRes.financials?.roe ?? undefined,
        profitMargin: fundRes.financials?.profitMargin ?? undefined,
        revenue: fundRes.financials?.revenue ?? undefined,
        history: normalised,
      }]);
    } catch { /**/ }
    finally { setLoading(null); }
  }, [stocks]);

  const removeStock = (ticker: string) => setStocks(s => s.filter(x => x.ticker !== ticker));

  // Merge histories for overlay chart
  const chartSeries = stocks.map((s, i) => ({
    label: s.ticker.replace(".JK",""),
    color: COLORS[i],
    data: s.history,
  }));

  const fmtBig = (v?: number) => {
    if (v == null) return "—";
    if (v >= 1e12) return `${(v/1e12).toFixed(1)}T`;
    if (v >= 1e9)  return `${(v/1e9).toFixed(1)}B`;
    return v.toLocaleString();
  };
  const fmtPct = (v?: number) => v == null ? "—" : `${(v*100).toFixed(1)}%`;
  const fmtX   = (v?: number) => v == null ? "—" : `${v.toFixed(1)}x`;

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "#f1f5f9" }}>
          Bandingkan <span style={{ color: "#fb923c" }}>Saham</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "#64748b" }}>Overlay chart & head-to-head fundamental (maks. 5 saham)</p>
      </div>

      {/* Search + selected pills */}
      <GlassCard hover={false}>
        {/* Selected pills */}
        {stocks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {stocks.map((s, i) => (
              <div key={s.ticker} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: `${COLORS[i]}18`, color: COLORS[i], border: `1px solid ${COLORS[i]}40` }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                {s.ticker.replace(".JK","")}
                <button onClick={() => removeStock(s.ticker)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Search input */}
        {stocks.length < 5 && (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              {searching || loading ? (
                <div className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: "rgba(251,146,60,0.2)", borderTopColor: "#fb923c" }} />
              ) : (
                <svg className="w-4 h-4" style={{ color: "#64748b" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
            <input type="text" value={query} onChange={e => search(e.target.value)}
              placeholder="Tambah saham (cth: BBCA, TLKM)..."
              className="glass-input w-full pl-10 pr-4 py-3 text-sm" style={{ color: "#e2e8f0" }} />
          </div>
        )}

        {/* Dropdown results */}
        {results.length > 0 && (
          <div className="mt-2 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(226,232,240,0.08)" }}>
            {results.map(r => (
              <button key={r.symbol} onClick={() => addStock(r.symbol, r.name)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all text-sm"
                style={{ borderBottom: "1px solid rgba(226,232,240,0.04)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(6,78,59,0.3)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <span className="font-bold" style={{ color: "#fb923c" }}>{r.symbol.replace(".JK","")}</span>
                <span className="text-xs truncate" style={{ color: "#64748b" }}>{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Empty state */}
      {stocks.length === 0 && (
        <GlassCard hover={false}>
          <div className="text-center py-10">
            <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "#1e3a2f" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm" style={{ color: "#475569" }}>Tambahkan 2–5 saham untuk membandingkan</p>
            <p className="text-xs mt-1" style={{ color: "#334155" }}>Cth: BBCA vs BBRI vs BMRI</p>
          </div>
        </GlassCard>
      )}

      {/* Overlay Chart */}
      {stocks.length >= 1 && (
        <GlassCard hover={false}>
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4" style={{ color: "#fb923c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4" />
            </svg>
            <h3 className="text-sm font-bold" style={{ color: "#e2e8f0" }}>Performa Relatif (1 Tahun, basis 100)</h3>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4">
            {stocks.map((s, i) => (
              <div key={s.ticker} className="flex items-center gap-1.5 text-xs">
                <span className="w-3 h-1.5 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                <span style={{ color: COLORS[i] }}>{s.ticker.replace(".JK","")}</span>
                <span style={{ color: "#475569" }}>
                  {s.history.length > 1
                    ? ((s.history[s.history.length-1].value - 100)).toFixed(1)
                    : "0"}%
                </span>
              </div>
            ))}
          </div>
          {/* Multi-line chart: render each stock as separate LineChart */}
          <div className="relative" style={{ height: 280 }}>
            {chartSeries.map((series, i) => (
              <div key={series.label} className={i === 0 ? "" : "absolute inset-0"} style={{ opacity: 1 }}>
                <LineChart data={series.data} height={280} lineColor={series.color} areaTopColor={`${series.color}30`} areaBottomColor={`${series.color}00`} />
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Head-to-head table */}
      {stocks.length >= 2 && (
        <GlassCard hover={false} className="!p-0 overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(226,232,240,0.06)" }}>
            <h3 className="text-sm font-bold" style={{ color: "#e2e8f0" }}>Head-to-Head Fundamental</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "rgba(6,20,15,0.5)", borderBottom: "1px solid rgba(226,232,240,0.06)" }}>
                  <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider" style={{ color: "#334155", minWidth: 120 }}>Metrik</th>
                  {stocks.map((s, i) => (
                    <th key={s.ticker} className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider" style={{ color: COLORS[i], minWidth: 90 }}>
                      {s.ticker.replace(".JK","")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Harga", values: stocks.map(s => s.price.toLocaleString("id-ID")) },
                  { label: "% Hari Ini", values: stocks.map(s => `${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(2)}%`), colors: stocks.map(s => s.changePercent >= 0 ? "#10b981" : "#f87171") },
                  { label: "Market Cap", values: stocks.map(s => fmtBig(s.marketCap)) },
                  { label: "Trailing P/E", values: stocks.map(s => fmtX(s.trailingPE)) },
                  { label: "Price to Book", values: stocks.map(s => fmtX(s.priceToBook)) },
                  { label: "ROE", values: stocks.map(s => fmtPct(s.roe)), colors: stocks.map(s => s.roe ? (s.roe > 0.15 ? "#10b981" : s.roe > 0 ? "#f59e0b" : "#f87171") : "#64748b") },
                  { label: "Profit Margin", values: stocks.map(s => fmtPct(s.profitMargin)), colors: stocks.map(s => s.profitMargin ? (s.profitMargin > 0.10 ? "#10b981" : s.profitMargin > 0 ? "#f59e0b" : "#f87171") : "#64748b") },
                  { label: "Revenue", values: stocks.map(s => fmtBig(s.revenue)) },
                ].map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: "1px solid rgba(226,232,240,0.04)", background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "#64748b" }}>{row.label}</td>
                    {row.values.map((val, ci) => (
                      <td key={ci} className="px-4 py-2.5 text-right font-semibold tabular-nums"
                        style={{ color: row.colors?.[ci] ?? "#cbd5e1" }}>
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

