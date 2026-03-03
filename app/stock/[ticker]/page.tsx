"use client";

import { useEffect, useState, useCallback, use } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { WatchlistEntry, StockQuote, OHLCData } from "@/lib/types";

const CandlestickChart = dynamic(
  () => import("@/components/charts/CandlestickChart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] flex items-center justify-center">
        <div className="text-silver-500 text-sm">Loading chart...</div>
      </div>
    ),
  }
);

// Timeframe config — same pattern as IHSG / search page
const TIMEFRAMES = [
  { label: "1D",  group: "intraday", range: "1d",  interval: "5m"  },
  { label: "1W",  group: "intraday", range: "5d",  interval: "1h"  },
  { label: "1M",  group: "swing",    range: "1mo", interval: "1d"  },
  { label: "3M",  group: "swing",    range: "3mo", interval: "1d"  },
  { label: "6M",  group: "swing",    range: "6mo", interval: "1d"  },
  { label: "1Y",  group: "swing",    range: "1y",  interval: "1wk" },
  { label: "5Y",  group: "swing",    range: "5y",  interval: "1mo" },
];

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = use(params);
  const decodedTicker = decodeURIComponent(ticker);

  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [history, setHistory] = useState<OHLCData[]>([]);
  const [entry, setEntry] = useState<WatchlistEntry | null>(null);
  const [activeTimeframe, setActiveTimeframe] = useState(TIMEFRAMES[0]); // default 1D
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  // Fetch live quote — returns price for patching chart
  const fetchQuote = useCallback(async (): Promise<number | undefined> => {
    try {
      const res = await fetch(`/api/stocks/quote/${encodeURIComponent(decodedTicker)}`);
      const data = await res.json();
      if (!data.error) {
        setQuote(data);
        return data.price as number;
      }
    } catch {
      console.error("Failed to fetch quote");
    }
  }, [decodedTicker]);

  // Fetch OHLC history, then patch last candle with live price
  const fetchHistory = useCallback(async (livePrice?: number) => {
    setChartLoading(true);
    try {
      const res = await fetch(
        `/api/stocks/history/${encodeURIComponent(decodedTicker)}?range=${activeTimeframe.range}&interval=${activeTimeframe.interval}`
      );
      const data: OHLCData[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Patch last candle's close (and high if needed) with live quote price
        if (livePrice != null && livePrice > 0) {
          const last = { ...data[data.length - 1] };
          last.close = livePrice;
          last.high = Math.max(last.high, livePrice);
          last.low = Math.min(last.low, livePrice);
          data[data.length - 1] = last;
        }
        setHistory(data.filter((d) => d.close != null));
      }
    } catch {
      console.error("Failed to fetch history");
    } finally {
      setChartLoading(false);
    }
  }, [decodedTicker, activeTimeframe]);

  const fetchEntry = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      const found = data.find(
        (e: WatchlistEntry) => e.ticker.toUpperCase() === decodedTicker.toUpperCase()
      );
      if (found) setEntry(found);
    } catch {
      console.error("Failed to fetch watchlist entry");
    } finally {
      setLoading(false);
    }
  }, [decodedTicker]);

  // Initial load — fetch quote first, then chart with live price
  useEffect(() => {
    fetchQuote().then((livePrice) => fetchHistory(livePrice));
    fetchEntry();
    // Refresh quote + patch chart every 60s
    const interval = setInterval(async () => {
      const livePrice = await fetchQuote();
      fetchHistory(livePrice);
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchQuote, fetchEntry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch chart when timeframe changes
  useEffect(() => {
    fetchQuote().then((livePrice) => fetchHistory(livePrice));
  }, [activeTimeframe]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = quote?.change || 0;
  const changePercent = quote?.changePercent || 0;
  const isPositive = change >= 0;

  const intradayTF = TIMEFRAMES.filter((t) => t.group === "intraday");
  const swingTF    = TIMEFRAMES.filter((t) => t.group === "swing");

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/" className="text-silver-500 hover:text-orange-400 transition-colors">Dashboard</Link>
        <span className="text-silver-500">/</span>
        <span className="text-silver-300">{decodedTicker.replace(".JK", "")}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-silver-100">
              {decodedTicker.replace(".JK", "")}
            </h1>
            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
              isPositive
                ? "bg-green-500/20 text-green-500 border border-green-500/20"
                : "bg-red-500/20 text-red-400 border border-red-500/20"
            }`}>
              {isPositive ? "▲" : "▼"} {Math.abs(changePercent).toFixed(2)}%
            </span>
          </div>
          <p className="text-silver-500 text-sm mt-1">
            {quote?.name || entry?.name || decodedTicker}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-silver-100">
            {quote?.price?.toLocaleString("id-ID") || "—"}
          </p>
          <p className={`text-sm font-semibold ${isPositive ? "text-green-500" : "text-red-400"}`}>
            {isPositive ? "+" : ""}{change.toFixed(0)} ({isPositive ? "+" : ""}{changePercent.toFixed(2)}%)
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Open",       value: quote?.open },
          { label: "High",       value: quote?.high },
          { label: "Low",        value: quote?.low },
          { label: "Prev Close", value: quote?.previousClose },
          { label: "Volume",     value: quote?.volume ? `${(quote.volume / 1_000_000).toFixed(1)}M` : undefined, raw: true },
        ].map((stat) => (
          <GlassCard key={stat.label} className="!p-3">
            <p className="text-[10px] text-silver-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-sm font-bold text-silver-200 mt-1">
              {stat.raw ? stat.value || "—" : stat.value?.toLocaleString("id-ID") || "—"}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* Chart */}
      <GlassCard hover={false}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          {/* Title */}
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <h2 className="text-base font-bold text-silver-200">Price Chart</h2>
          </div>

          {/* Timeframe groups */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5 rounded-lg p-0.5"
              style={{ background: "rgba(6,78,59,0.25)", border: "1px solid rgba(16,185,129,0.08)" }}>
              <span className="text-[10px] px-1.5 font-medium" style={{ color: "#334155" }}>Intraday</span>
              {intradayTF.map((tf) => (
                <button key={tf.label} onClick={() => setActiveTimeframe(tf)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
                  style={activeTimeframe.label === tf.label
                    ? { background: "rgba(249,115,22,0.18)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }
                    : { color: "#64748b" }}>
                  {tf.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 rounded-lg p-0.5"
              style={{ background: "rgba(6,78,59,0.25)", border: "1px solid rgba(16,185,129,0.08)" }}>
              <span className="text-[10px] px-1.5 font-medium" style={{ color: "#334155" }}>Swing</span>
              {swingTF.map((tf) => (
                <button key={tf.label} onClick={() => setActiveTimeframe(tf)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
                  style={activeTimeframe.label === tf.label
                    ? { background: "rgba(249,115,22,0.18)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }
                    : { color: "#64748b" }}>
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {chartLoading ? (
          <div className="h-[500px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 rounded-full animate-spin"
                style={{ borderColor: "rgba(251,146,60,0.2)", borderTopColor: "#fb923c" }} />
              <span className="text-sm text-silver-500">Memuat chart...</span>
            </div>
          </div>
        ) : history.length > 0 ? (
          <CandlestickChart data={history} tp={entry?.tp} sl={entry?.sl} height={500} />
        ) : (
          <div className="h-[500px] flex items-center justify-center">
            <span className="text-silver-500 text-sm">
              {loading ? "Loading..." : "No chart data available"}
            </span>
          </div>
        )}

        {/* TP/SL Legend */}
        {entry && (entry.tp || entry.sl) && (
          <div className="flex gap-4 mt-4 pt-3 border-t border-white/5">
            {entry.tp && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-green-500"></div>
                <span className="text-xs text-silver-400">TP: {entry.tp.toLocaleString("id-ID")}</span>
              </div>
            )}
            {entry.sl && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-red-500"></div>
                <span className="text-xs text-silver-400">SL: {entry.sl.toLocaleString("id-ID")}</span>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Notes */}
      {entry?.bandarmology && (
        <GlassCard hover={false}>
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <h2 className="text-lg font-bold text-orange-400">Notes</h2>
          </div>
          <div className="bg-green-900/20 rounded-xl p-4 border border-green-500/10">
            <p className="text-sm text-silver-300 leading-relaxed whitespace-pre-wrap">
              {entry.bandarmology}
            </p>
          </div>
          <p className="text-[10px] text-silver-500 mt-3">
            Added: {new Date(entry.addedAt).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </GlassCard>
      )}

      {/* Market Cap */}
      {quote?.marketCap && (
        <GlassCard className="!p-4">
          <p className="text-[10px] text-silver-500 uppercase tracking-wider">Market Capitalization</p>
          <p className="text-lg font-bold text-silver-200 mt-1">
            Rp {(quote.marketCap / 1_000_000_000_000).toFixed(2)}T
          </p>
        </GlassCard>
      )}
    </div>
  );
}

