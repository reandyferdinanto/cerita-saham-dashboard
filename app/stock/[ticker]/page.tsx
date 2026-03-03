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
  const [chartRange, setChartRange] = useState("3mo");
  const [loading, setLoading] = useState(true);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/stocks/quote/${encodeURIComponent(decodedTicker)}`
      );
      const data = await res.json();
      if (!data.error) setQuote(data);
    } catch {
      console.error("Failed to fetch quote");
    }
  }, [decodedTicker]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/stocks/history/${encodeURIComponent(decodedTicker)}?range=${chartRange}&interval=1d`
      );
      const data = await res.json();
      setHistory(data);
    } catch {
      console.error("Failed to fetch history");
    }
  }, [decodedTicker, chartRange]);

  const fetchEntry = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      const found = data.find(
        (e: WatchlistEntry) =>
          e.ticker.toUpperCase() === decodedTicker.toUpperCase()
      );
      if (found) setEntry(found);
    } catch {
      console.error("Failed to fetch watchlist entry");
    } finally {
      setLoading(false);
    }
  }, [decodedTicker]);

  useEffect(() => {
    fetchQuote();
    fetchEntry();
    const interval = setInterval(fetchQuote, 60_000);
    return () => clearInterval(interval);
  }, [fetchQuote, fetchEntry]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const change = quote?.change || 0;
  const changePercent = quote?.changePercent || 0;
  const isPositive = change >= 0;
  const ranges = ["1mo", "3mo", "6mo", "1y", "5y"];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/" className="text-silver-500 hover:text-orange-400 transition-colors">
          Dashboard
        </Link>
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
            <span
              className={`px-3 py-1 rounded-lg text-sm font-bold ${
                isPositive
                  ? "bg-green-500/20 text-green-500 border border-green-500/20"
                  : "bg-red-500/20 text-red-400 border border-red-500/20"
              }`}
            >
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
          <p
            className={`text-sm font-semibold ${
              isPositive ? "text-green-500" : "text-red-400"
            }`}
          >
            {isPositive ? "+" : ""}
            {change.toFixed(0)} ({isPositive ? "+" : ""}
            {changePercent.toFixed(2)}%)
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Open", value: quote?.open },
          { label: "High", value: quote?.high },
          { label: "Low", value: quote?.low },
          { label: "Prev Close", value: quote?.previousClose },
          {
            label: "Volume",
            value: quote?.volume
              ? `${(quote.volume / 1_000_000).toFixed(1)}M`
              : undefined,
            raw: true,
          },
        ].map((stat) => (
          <GlassCard key={stat.label} className="!p-3">
            <p className="text-[10px] text-silver-500 uppercase tracking-wider">
              {stat.label}
            </p>
            <p className="text-sm font-bold text-silver-200 mt-1">
              {stat.raw
                ? stat.value || "—"
                : stat.value?.toLocaleString("id-ID") || "—"}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* Chart */}
      <GlassCard hover={false}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <h2 className="text-lg font-bold text-silver-200">
            📈 Price Chart
          </h2>
          <div className="flex gap-1">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  chartRange === r
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "text-silver-500 hover:text-silver-300 hover:bg-green-800/30"
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {history.length > 0 ? (
          <CandlestickChart
            data={history}
            tp={entry?.tp}
            sl={entry?.sl}
            height={500}
          />
        ) : (
          <div className="h-[500px] flex items-center justify-center">
            <div className="text-silver-500 text-sm">
              {loading ? "Loading..." : "No chart data available"}
            </div>
          </div>
        )}
        {/* TP/SL Legend */}
        {entry && (entry.tp || entry.sl) && (
          <div className="flex gap-4 mt-4 pt-3 border-t border-white/5">
            {entry.tp && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-green-500 border-dashed"></div>
                <span className="text-xs text-silver-400">
                  TP: {entry.tp.toLocaleString("id-ID")}
                </span>
              </div>
            )}
            {entry.sl && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-red-500 border-dashed"></div>
                <span className="text-xs text-silver-400">
                  SL: {entry.sl.toLocaleString("id-ID")}
                </span>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Bandarmology */}
      {entry?.bandarmology && (
        <GlassCard hover={false}>
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="w-5 h-5 text-orange-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path
                fillRule="evenodd"
                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                clipRule="evenodd"
              />
            </svg>
            <h2 className="text-lg font-bold text-orange-400">
              Bandarmology Analysis
            </h2>
          </div>
          <div className="bg-green-900/20 rounded-xl p-4 border border-green-500/10">
            <p className="text-sm text-silver-300 leading-relaxed whitespace-pre-wrap">
              {entry.bandarmology}
            </p>
          </div>
          <p className="text-[10px] text-silver-500 mt-3">
            Added: {new Date(entry.addedAt).toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </GlassCard>
      )}

      {/* Market Cap */}
      {quote?.marketCap && (
        <GlassCard className="!p-4">
          <p className="text-[10px] text-silver-500 uppercase tracking-wider">
            Market Capitalization
          </p>
          <p className="text-lg font-bold text-silver-200 mt-1">
            Rp {(quote.marketCap / 1_000_000_000_000).toFixed(2)}T
          </p>
        </GlassCard>
      )}
    </div>
  );
}

