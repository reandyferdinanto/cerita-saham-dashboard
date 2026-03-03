"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { SearchResult, StockQuote, OHLCData } from "@/lib/types";

const CandlestickChart = dynamic(
  () => import("@/components/charts/CandlestickChart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[450px] flex items-center justify-center">
        <div className="text-silver-500 text-sm">Memuat chart...</div>
      </div>
    ),
  }
);

const LineChart = dynamic(() => import("@/components/charts/LineChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[450px] flex items-center justify-center">
      <div className="text-silver-500 text-sm">Memuat chart...</div>
    </div>
  ),
});

type ChartType = "candlestick" | "line";

// Timeframe config: { label, range (for API period), interval (for API) }
const TIMEFRAMES = [
  // Intraday
  { label: "5m",  group: "intraday", range: "1d",  interval: "5m"  },
  { label: "15m", group: "intraday", range: "5d",  interval: "15m" },
  { label: "1h",  group: "intraday", range: "5d",  interval: "1h"  },
  { label: "4h",  group: "intraday", range: "1mo", interval: "4h"  },
  // Daily+
  { label: "1D",  group: "swing",   range: "3mo", interval: "1d"  },
  { label: "1W",  group: "swing",   range: "1y",  interval: "1wk" },
  { label: "1M",  group: "swing",   range: "5y",  interval: "1mo" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [history, setHistory] = useState<OHLCData[]>([]);
  const [activeTimeframe, setActiveTimeframe] = useState(TIMEFRAMES[4]); // default 1D
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [loadingChart, setLoadingChart] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search — auto-add .JK
  const handleSearch = useCallback((searchQuery: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const trimmed = searchQuery.trim();
    if (trimmed.length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/stocks/search/${encodeURIComponent(trimmed)}`
        );
        const data = await res.json();
        if (Array.isArray(data)) setResults(data);
      } catch {
        console.error("Search failed");
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (selectedTicker) {
      setSelectedTicker(null);
      setQuote(null);
      setHistory([]);
    }
    handleSearch(value);
  };

  const fetchChart = useCallback(
    async (ticker: string, tf: typeof TIMEFRAMES[0], livePrice?: number) => {
      setLoadingChart(true);
      try {
        const res = await fetch(
          `/api/stocks/history/${encodeURIComponent(ticker)}?range=${tf.range}&interval=${tf.interval}`
        );
        const raw: OHLCData[] = await res.json();
        if (Array.isArray(raw) && raw.length > 0) {
          // Patch last candle with live quote price
          if (livePrice != null && livePrice > 0) {
            const last = { ...raw[raw.length - 1] };
            last.close = livePrice;
            last.high = Math.max(last.high, livePrice);
            last.low = Math.min(last.low, livePrice);
            raw[raw.length - 1] = last;
          }
          setHistory(raw.filter((d: OHLCData) => d.close != null));
        }
      } catch {
        console.error("Failed to fetch chart");
      } finally {
        setLoadingChart(false);
      }
    },
    []
  );

  const selectStock = useCallback(
    async (ticker: string) => {
      setSelectedTicker(ticker);
      setResults([]);
      setLoadingChart(true);
      setQuote(null);
      setHistory([]);

      let livePrice: number | undefined;
      try {
        const quoteRes = await fetch(`/api/stocks/quote/${encodeURIComponent(ticker)}`);
        const quoteData = await quoteRes.json();
        if (!quoteData.error) {
          setQuote(quoteData);
          livePrice = quoteData.price;
        }
      } catch {
        console.error("Failed to fetch quote");
      }

      await fetchChart(ticker, activeTimeframe, livePrice);
    },
    [activeTimeframe, fetchChart]
  );

  // Re-fetch when timeframe changes — pass current live price
  useEffect(() => {
    if (selectedTicker && quote?.price) {
      fetchChart(selectedTicker, activeTimeframe, quote.price);
    }
  }, [activeTimeframe, selectedTicker, fetchChart]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = quote?.change || 0;
  const changePercent = quote?.changePercent || 0;
  const isPositive = change >= 0;

  const intradayTF = TIMEFRAMES.filter((t) => t.group === "intraday");
  const swingTF = TIMEFRAMES.filter((t) => t.group === "swing");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "#f1f5f9" }}>
          Cari{" "}
          <span style={{ color: "#fb923c" }}>Saham</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "#64748b" }}>
          Cari saham IDX berdasarkan kode atau nama perusahaan
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className="w-5 h-5" style={{ color: "#64748b" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Ketik kode saham IDX (cth: BBCA, TLKM, ANTM) atau nama perusahaan..."
          className="glass-input w-full pl-12 pr-12 py-4 text-base placeholder:text-silver-500"
          style={{ color: "#e2e8f0" }}
          autoFocus
        />
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-2">
          {searching ? (
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(251,146,60,0.3)", borderTopColor: "#fb923c" }} />
          ) : query ? (
            <button
              onClick={() => { setQuery(""); setResults([]); setSelectedTicker(null); setQuote(null); setHistory([]); }}
              className="p-1 rounded-lg hover:bg-green-800/30 transition-all"
              style={{ color: "#64748b" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Search Results */}
      {results.length > 0 && !selectedTicker && (
        <GlassCard hover={false} className="!p-2">
          <div className="max-h-[360px] overflow-y-auto space-y-0.5">
            {results.map((result) => (
              <button
                key={result.symbol}
                onClick={() => {
                  setQuery(result.symbol.replace(".JK", ""));
                  selectStock(result.symbol);
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all group"
                style={{ background: "transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(6,78,59,0.3)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div className="flex items-center gap-3">
                  {/* Ticker badge */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(6,78,59,0.4)", border: "1px solid rgba(16,185,129,0.15)" }}>
                    <span className="text-xs font-bold" style={{ color: "#fb923c" }}>
                      {result.symbol.replace(".JK", "").substring(0, 4)}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold transition-colors group-hover:text-orange-400" style={{ color: "#e2e8f0" }}>
                        {result.symbol.replace(".JK", "")}
                      </p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(6,78,59,0.5)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                        IDX
                      </span>
                    </div>
                    <p className="text-xs truncate max-w-[260px]" style={{ color: "#64748b" }}>
                      {result.name}
                    </p>
                  </div>
                </div>
                <svg className="w-4 h-4 flex-shrink-0 transition-colors group-hover:text-orange-400" style={{ color: "#475569" }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* No results */}
      {query.length >= 2 && results.length === 0 && !searching && !selectedTicker && (
        <GlassCard>
          <div className="text-center py-10">
            <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "#334155" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p style={{ color: "#94a3b8" }}>Tidak ada saham IDX untuk &ldquo;{query}&rdquo;</p>
            <p className="text-xs mt-1" style={{ color: "#475569" }}>Coba kode ticker seperti BBCA, TLKM, atau ASII</p>
          </div>
        </GlassCard>
      )}

      {/* Selected Stock Detail */}
      {selectedTicker && (
        <div className="space-y-5">
          {/* Back button + header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <button
                onClick={() => { setSelectedTicker(null); setQuote(null); setHistory([]); setQuery(""); }}
                className="flex items-center gap-1.5 text-xs mb-2 transition-colors hover:text-orange-400"
                style={{ color: "#64748b" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Kembali ke pencarian
              </button>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold" style={{ color: "#f1f5f9" }}>
                  {selectedTicker.replace(".JK", "")}
                  <span className="text-base font-normal ml-1" style={{ color: "#475569" }}>.JK</span>
                </h2>
                {quote && (
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold`}
                    style={{
                      background: isPositive ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                      color: isPositive ? "#10b981" : "#f87171",
                      border: `1px solid ${isPositive ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                    }}>
                    {isPositive ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    )}
                    {Math.abs(changePercent).toFixed(2)}%
                  </span>
                )}
              </div>
              <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
                {quote?.name || selectedTicker}
              </p>
            </div>
            {quote && (
              <div className="text-right">
                <p className="text-3xl font-bold" style={{ color: "#f1f5f9" }}>
                  {quote.price.toLocaleString("id-ID")}
                </p>
                <p className="text-sm font-semibold" style={{ color: isPositive ? "#10b981" : "#f87171" }}>
                  {isPositive ? "+" : ""}{change.toFixed(0)} ({isPositive ? "+" : ""}{changePercent.toFixed(2)}%)
                </p>
              </div>
            )}
          </div>

          {/* Stats row */}
          {quote && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Open",       value: quote.open.toLocaleString("id-ID"),          icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
                { label: "High",       value: quote.high.toLocaleString("id-ID"),           icon: "M5 10l7-7m0 0l7 7m-7-7v18" },
                { label: "Low",        value: quote.low.toLocaleString("id-ID"),            icon: "M19 14l-7 7m0 0l-7-7m7 7V3" },
                { label: "Prev Close", value: quote.previousClose.toLocaleString("id-ID"),  icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
                { label: "Volume",     value: `${(quote.volume / 1_000_000).toFixed(1)}M`, icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
              ].map((stat) => (
                <GlassCard key={stat.label} className="!p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <svg className="w-3.5 h-3.5" style={{ color: "#fb923c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                    </svg>
                    <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#64748b" }}>{stat.label}</p>
                  </div>
                  <p className="text-sm font-bold" style={{ color: "#e2e8f0" }}>{stat.value}</p>
                </GlassCard>
              ))}
            </div>
          )}

          {/* Chart */}
          <GlassCard hover={false}>
            {/* Chart toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <svg className="w-5 h-5" style={{ color: "#fb923c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  <span className="text-base font-bold" style={{ color: "#e2e8f0" }}>Chart</span>
                </div>
                {/* Chart type toggle */}
                <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: "rgba(6,78,59,0.3)" }}>
                  <button
                    onClick={() => setChartType("candlestick")}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                    style={chartType === "candlestick"
                      ? { background: "rgba(249,115,22,0.18)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }
                      : { color: "#64748b" }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                    </svg>
                    Candle
                  </button>
                  <button
                    onClick={() => setChartType("line")}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                    style={chartType === "line"
                      ? { background: "rgba(249,115,22,0.18)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }
                      : { color: "#64748b" }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4" />
                    </svg>
                    Line
                  </button>
                </div>
              </div>

              {/* Timeframe groups */}
              <div className="flex items-center gap-2">
                {/* Intraday group */}
                <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "rgba(6,78,59,0.25)", border: "1px solid rgba(16,185,129,0.08)" }}>
                  <span className="text-[10px] px-1.5 font-medium" style={{ color: "#334155" }}>Intraday</span>
                  {intradayTF.map((tf) => (
                    <button
                      key={tf.label}
                      onClick={() => setActiveTimeframe(tf)}
                      className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                      style={activeTimeframe.label === tf.label
                        ? { background: "rgba(249,115,22,0.18)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }
                        : { color: "#64748b" }}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
                {/* Daily+ group */}
                <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "rgba(6,78,59,0.25)", border: "1px solid rgba(16,185,129,0.08)" }}>
                  <span className="text-[10px] px-1.5 font-medium" style={{ color: "#334155" }}>Swing</span>
                  {swingTF.map((tf) => (
                    <button
                      key={tf.label}
                      onClick={() => setActiveTimeframe(tf)}
                      className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                      style={activeTimeframe.label === tf.label
                        ? { background: "rgba(249,115,22,0.18)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }
                        : { color: "#64748b" }}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart area */}
            {loadingChart ? (
              <div className="h-[450px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-2 rounded-full animate-spin"
                    style={{ borderColor: "rgba(251,146,60,0.2)", borderTopColor: "#fb923c" }} />
                  <div className="text-center">
                    <p className="text-sm" style={{ color: "#64748b" }}>Memuat data chart...</p>
                    <p className="text-xs mt-0.5" style={{ color: "#334155" }}>
                      {selectedTicker?.replace(".JK", "")} · {activeTimeframe.label}
                    </p>
                  </div>
                </div>
              </div>
            ) : history.length > 0 ? (
              chartType === "candlestick" ? (
                <CandlestickChart data={history} height={450} />
              ) : (
                <LineChart
                  data={history.map((d) => ({ time: d.time, value: d.close }))}
                  height={450}
                />
              )
            ) : (
              <div className="h-[450px] flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "#1e3a2f" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  <p className="text-sm" style={{ color: "#475569" }}>Data chart tidak tersedia untuk timeframe ini</p>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Market Cap */}
          {quote?.marketCap && (
            <GlassCard className="!p-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4" style={{ color: "#fb923c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#64748b" }}>
                  Market Capitalization
                </p>
              </div>
              <p className="text-lg font-bold" style={{ color: "#e2e8f0" }}>
                Rp {(quote.marketCap / 1_000_000_000_000).toFixed(2)}T
              </p>
            </GlassCard>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            <Link
              href={`/stock/${encodeURIComponent(selectedTicker)}`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "rgba(249,115,22,0.15)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.25)" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Lihat Detail Lengkap
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Tambah ke Watchlist
            </Link>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!query && !selectedTicker && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <GlassCard hover={false}>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4" style={{ color: "#fb923c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="text-sm font-bold" style={{ color: "#cbd5e1" }}>Tips Pencarian</h3>
            </div>
            <ul className="space-y-2 text-xs" style={{ color: "#64748b" }}>
              {[
                { tip: "Ketik kode saham IDX", example: "BBCA, TLKM, ASII, GOTO" },
                { tip: "Atau nama perusahaan", example: "Bank Central Asia" },
                { tip: "Tidak perlu tambahkan .JK", example: "cukup ketik BBCA" },
                { tip: "Klik hasil untuk lihat chart", example: "candle & line tersedia" },
              ].map((item) => (
                <li key={item.tip} className="flex items-start gap-2">
                  <svg className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "#fb923c" }} fill="currentColor" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="3" />
                  </svg>
                  <span>
                    {item.tip} —{" "}
                    <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>{item.example}</span>
                  </span>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard hover={false}>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4" style={{ color: "#fb923c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
              <h3 className="text-sm font-bold" style={{ color: "#cbd5e1" }}>Saham Populer IDX</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {["BBCA", "BBRI", "TLKM", "ASII", "BMRI", "UNVR", "GOTO", "BREN", "AMRT", "ADRO"].map(
                (ticker) => (
                  <button
                    key={ticker}
                    onClick={() => {
                      setQuery(ticker);
                      selectStock(ticker + ".JK");
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: "rgba(6,78,59,0.3)",
                      color: "#94a3b8",
                      border: "1px solid rgba(16,185,129,0.1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#fb923c";
                      e.currentTarget.style.borderColor = "rgba(249,115,22,0.25)";
                      e.currentTarget.style.background = "rgba(6,78,59,0.5)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#94a3b8";
                      e.currentTarget.style.borderColor = "rgba(16,185,129,0.1)";
                      e.currentTarget.style.background = "rgba(6,78,59,0.3)";
                    }}
                  >
                    {ticker}
                  </button>
                )
              )}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

