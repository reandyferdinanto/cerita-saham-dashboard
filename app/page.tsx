"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { TitleWithPills, StockQuickModal } from "@/components/ui/TickerPill";
import { StockQuote, IndexData } from "@/lib/types";
import { useAuth } from "@/components/ui/AuthProvider";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  image?: string;
}

interface ArticleItem {
  _id: string;
  title: string;
  content: string;
  imageUrl?: string;
  isPublic: boolean;
  authorId?: { name: string; email: string };
  createdAt: string;
}

const LineChart = dynamic(() => import("@/components/charts/LineChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] flex items-center justify-center">
      <div className="text-silver-500 text-sm">Loading chart...</div>
    </div>
  ),
});

// Global indices to display in the market ticker
const GLOBAL_INDICES = [
  { ticker: "^GSPC",  label: "S&P 500",    flag: "🇺🇸", region: "US"   },
  { ticker: "^DJI",   label: "Dow Jones",   flag: "🇺🇸", region: "US"   },
  { ticker: "^IXIC",  label: "Nasdaq",      flag: "🇺🇸", region: "US"   },
  { ticker: "^VIX",   label: "VIX",         flag: "😱",  region: "US"   },
  { ticker: "^N225",  label: "Nikkei 225",  flag: "🇯🇵", region: "Asia" },
  { ticker: "^HSI",   label: "Hang Seng",   flag: "🇭🇰", region: "Asia" },
  { ticker: "^KS11",  label: "KOSPI",       flag: "🇰🇷", region: "Asia" },
];

interface GlobalQuote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [ihsgData, setIhsgData] = useState<IndexData[]>([]);
  const [ihsgQuote, setIhsgQuote] = useState<StockQuote | null>(null);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState({ label: "1D", group: "intraday", range: "1d", interval: "5m" });
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [globalQuotes, setGlobalQuotes] = useState<GlobalQuote[]>([]);
  const [modalTicker, setModalTicker] = useState<{ ticker: string; fullTicker: string } | null>(null);

  const fetchGlobalIndices = useCallback(async () => {
    try {
      const results = await Promise.allSettled(
        GLOBAL_INDICES.map((idx) =>
          fetch(`/api/stocks/quote/${encodeURIComponent(idx.ticker)}`).then((r) => r.json())
        )
      );
      const quotes: GlobalQuote[] = results
        .map((r, i) => {
          if (r.status === "fulfilled" && !r.value.error) {
            return {
              ticker: GLOBAL_INDICES[i].ticker,
              price: r.value.price ?? 0,
              change: r.value.change ?? 0,
              changePercent: r.value.changePercent ?? 0,
            } as GlobalQuote;
          }
          return null;
        })
        .filter(Boolean) as GlobalQuote[];
      setGlobalQuotes(quotes);
    } catch {
      console.error("Failed to fetch global indices");
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Fetch IHSG quote
      const ihsgQuoteRes = await fetch(`/api/stocks/quote/^JKSE`);
      const ihsgQ = await ihsgQuoteRes.json();
      if (!ihsgQ.error) setIhsgQuote(ihsgQ);

      // Fetch watchlist count
      const wlRes = await fetch("/api/watchlist");
      const wlData = await wlRes.json();
      setWatchlistCount(Array.isArray(wlData) ? wlData.length : 0);

      setLastUpdated(new Date().toLocaleTimeString("id-ID"));

      // Return live price so chart can patch its last point
      return ihsgQ?.price as number | undefined;
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIhsgChart = useCallback(async (livePrice?: number) => {
    const buildFallbackLineData = () => {
      const currentPrice = livePrice ?? ihsgQuote?.price;
      const previousClose = ihsgQuote?.previousClose;

      if (!currentPrice || !previousClose) {
        return [] as { time: string | number; value: number }[];
      }

      const now = new Date();

      if (activeTimeframe.interval === "5m" || activeTimeframe.interval === "1h") {
        const endTime = Math.floor(now.getTime() / 1000);
        const startTime = endTime - (activeTimeframe.interval === "5m" ? 60 * 60 : 24 * 60 * 60);

        return [
          { time: startTime, value: previousClose },
          { time: endTime, value: currentPrice },
        ];
      }

      const previousDate = new Date(now);
      previousDate.setDate(previousDate.getDate() - 1);

      return [
        { time: previousDate.toISOString().split("T")[0], value: previousClose },
        { time: now.toISOString().split("T")[0], value: currentPrice },
      ];
    };

    try {
      const res = await fetch(
        `/api/stocks/history/^JKSE?range=${activeTimeframe.range}&interval=${activeTimeframe.interval}`
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        const lineData: { time: string | number; value: number }[] = data
          .filter((d: { close: number | null }) => d.close != null)
          .map((d: { time: string | number; close: number }) => ({
            time: d.time,
            value: d.close,
          }));

        // Patch last point with live price so chart tail == card price
        if (lineData.length > 0 && livePrice != null && livePrice > 0) {
          lineData[lineData.length - 1] = {
            ...lineData[lineData.length - 1],
            value: livePrice,
          };
        }

        setIhsgData(lineData.length > 0 ? lineData : buildFallbackLineData());
      }
    } catch {
      console.error("Failed to fetch IHSG history");
      setIhsgData(buildFallbackLineData());
    }
  }, [activeTimeframe, ihsgQuote?.previousClose, ihsgQuote?.price]);

  useEffect(() => {
    // Initial load: fetch quote first, then chart with live price
    fetchData().then((livePrice) => fetchIhsgChart(livePrice));
    fetchGlobalIndices();

    const interval = setInterval(async () => {
      const livePrice = await fetchData();
      fetchIhsgChart(livePrice);
      fetchGlobalIndices();
    }, 60_000);

    return () => clearInterval(interval);
  }, [fetchData, fetchIhsgChart, fetchGlobalIndices]);

  // Re-fetch chart when timeframe changes (use current quote price if available)
  useEffect(() => {
    fetchIhsgChart(ihsgQuote?.price);
  }, [activeTimeframe]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch news on mount, refresh every 5 minutes
  useEffect(() => {
    const fetchNews = async () => {
      try {
        setNewsLoading(true);
        const res = await fetch("/api/news");
        const data = await res.json();
        if (Array.isArray(data)) setNews(data);
      } catch {
        console.error("Failed to fetch news");
      } finally {
        setNewsLoading(false);
      }
    };
    fetchNews();

    const fetchArticles = async () => {
      try {
        setArticlesLoading(true);
        const res = await fetch("/api/articles");
        const data = await res.json();
        if (Array.isArray(data)) setArticles(data);
      } catch {
        console.error("Failed to fetch articles");
      } finally {
        setArticlesLoading(false);
      }
    };
    fetchArticles();

    const interval = setInterval(fetchNews, 5 * 60_000);
    return () => clearInterval(interval);
  }, []);

  const ihsgChange = ihsgQuote?.change || 0;
  const ihsgChangePercent = ihsgQuote?.changePercent || 0;
  const isIhsgPositive = ihsgChange >= 0;

  // Timeframe definitions: label shown, range for API period, interval for API
  const IHSG_TIMEFRAMES = [
    // Intraday group
    { label: "1D",  group: "intraday", range: "1d",  interval: "5m"  },
    { label: "1W",  group: "intraday", range: "5d",  interval: "1h"  },
    // Swing group
    { label: "1M",  group: "swing",    range: "1mo", interval: "1d"  },
    { label: "3M",  group: "swing",    range: "3mo", interval: "1d"  },
    { label: "6M",  group: "swing",    range: "6mo", interval: "1d"  },
    { label: "1Y",  group: "swing",    range: "1y",  interval: "1wk" },
    { label: "5Y",  group: "swing",    range: "5y",  interval: "1mo" },
  ];

  const intradayTF = IHSG_TIMEFRAMES.filter((t) => t.group === "intraday");
  const swingTF = IHSG_TIMEFRAMES.filter((t) => t.group === "swing");

  return (
    <>
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-silver-100">
            Dashboard <span className="text-orange-400">Overview</span>
          </h1>
          <p className="text-silver-500 text-sm mt-1">
            Market composite index at a glance
          </p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-2 text-xs text-silver-500">
            <div className="pulse-dot w-2 h-2 rounded-full bg-green-500"></div>
            Last updated: {lastUpdated}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="glass-card p-3 md:p-4">
          <p className="text-[9px] text-silver-500 uppercase tracking-wider font-medium leading-tight">IHSG / Composite</p>
          <p className="text-base font-bold text-silver-100 mt-1 leading-tight tabular-nums truncate">
            {ihsgQuote ? ihsgQuote.price.toLocaleString("id-ID") : "—"}
          </p>
          <p className={`text-[10px] mt-1 font-semibold leading-tight truncate ${isIhsgPositive ? "text-green-500" : "text-red-400"}`}>
            {ihsgQuote ? `${isIhsgPositive ? "▲" : "▼"} ${Math.abs(ihsgChange).toFixed(2)} (${Math.abs(ihsgChangePercent).toFixed(2)}%)` : "—"}
          </p>
        </div>

        <div className="glass-card p-3 md:p-4">
          <p className="text-[9px] text-silver-500 uppercase tracking-wider font-medium leading-tight">Day High</p>
          <p className="text-base font-bold text-silver-100 mt-1 leading-tight tabular-nums truncate">
            {ihsgQuote ? ihsgQuote.high.toLocaleString("id-ID") : "—"}
          </p>
          <p className="text-[10px] text-silver-500 mt-1">intraday high</p>
        </div>

        <div className="glass-card p-3 md:p-4">
          <p className="text-[9px] text-silver-500 uppercase tracking-wider font-medium leading-tight">Day Low</p>
          <p className="text-base font-bold text-silver-100 mt-1 leading-tight tabular-nums truncate">
            {ihsgQuote ? ihsgQuote.low.toLocaleString("id-ID") : "—"}
          </p>
          <p className="text-[10px] text-silver-500 mt-1">intraday low</p>
        </div>

        <div className="glass-card p-3 md:p-4">
          <p className="text-[9px] text-silver-500 uppercase tracking-wider font-medium leading-tight">Watchlist</p>
          <p className="text-base font-bold text-orange-400 mt-1 leading-tight">{watchlistCount}</p>
          <Link href="/watchlist" className="text-[10px] text-silver-500 mt-1 hover:text-orange-400 transition-colors block">
            stocks tracked →
          </Link>
        </div>
      </div>

      {/* Global Markets Ticker */}
      <GlassCard hover={false} className="!p-3 sm:!p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <svg className="w-3.5 h-3.5" style={{ color: "#fb923c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
            </div>
            <span className="text-xs font-bold text-silver-300">Global Markets</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" />
            <span className="text-[10px] text-green-500 font-medium">Live</span>
          </div>
        </div>

        {/* Two groups: US and Asia */}
        {globalQuotes.length === 0 ? (
          /* Skeleton */
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {GLOBAL_INDICES.map((idx) => (
              <div key={idx.ticker} className="rounded-xl p-2.5 animate-pulse"
                style={{ background: "rgba(6,78,59,0.2)", border: "1px solid rgba(226,232,240,0.06)" }}>
                <div className="h-2.5 rounded w-3/4 mb-2" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="h-4 rounded w-full mb-1.5" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="h-2.5 rounded w-1/2" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {/* US Markets */}
            <div>
              <p className="text-[9px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#334155" }}>🇺🇸 US Markets</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GLOBAL_INDICES.filter((idx) => idx.region === "US").map((idx) => {
                  const q = globalQuotes.find((g) => g.ticker === idx.ticker);
                  const isUp = (q?.changePercent ?? 0) >= 0;
                  const isVix = idx.ticker === "^VIX";
                  // VIX: up = bad (red), down = good (green) — flip colors
                  const positiveColor = isVix ? (isUp ? "#ef4444" : "#10b981") : (isUp ? "#10b981" : "#ef4444");
                  const negativeColor = positiveColor;
                  return (
                    <div key={idx.ticker} className="rounded-xl p-2.5 flex items-center justify-between gap-2"
                      style={{ background: "rgba(6,78,59,0.15)", border: "1px solid rgba(226,232,240,0.06)" }}>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-silver-400 truncate">{idx.label}</p>
                        <p className="text-sm font-bold text-silver-100 tabular-nums leading-tight">
                          {q ? q.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
                        </p>
                      </div>
                      {q && (
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-base leading-none" style={{ color: negativeColor }}>
                            {isUp ? "▲" : "▼"}
                          </span>
                          <span className="text-[10px] font-bold tabular-nums" style={{ color: negativeColor }}>
                            {Math.abs(q.changePercent).toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Asia Markets */}
            <div>
              <p className="text-[9px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#334155" }}>🌏 Asia Markets</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {GLOBAL_INDICES.filter((idx) => idx.region === "Asia").map((idx) => {
                  const q = globalQuotes.find((g) => g.ticker === idx.ticker);
                  const isUp = (q?.changePercent ?? 0) >= 0;
                  const color = isUp ? "#10b981" : "#ef4444";
                  return (
                    <div key={idx.ticker} className="rounded-xl p-2.5 flex items-center justify-between gap-2"
                      style={{ background: "rgba(6,78,59,0.15)", border: "1px solid rgba(226,232,240,0.06)" }}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm leading-none">{idx.flag}</span>
                          <p className="text-[10px] font-semibold text-silver-400 truncate">{idx.label}</p>
                        </div>
                        <p className="text-sm font-bold text-silver-100 tabular-nums leading-tight mt-0.5">
                          {q ? q.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
                        </p>
                      </div>
                      {q && (
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-base leading-none" style={{ color }}>
                            {isUp ? "▲" : "▼"}
                          </span>
                          <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
                            {Math.abs(q.changePercent).toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* IHSG Chart */}
      <GlassCard hover={false}>
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-5 h-5 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-lg font-bold text-silver-200 truncate">
                  IHSG / Jakarta Composite Index
                </h2>
                <p className="text-xs text-silver-500 hidden sm:block">Indeks Harga Saham Gabungan (^JKSE)</p>
              </div>
            </div>
          </div>
          {/* Timeframe buttons — scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <div className="flex items-center gap-0.5 rounded-lg p-0.5 flex-shrink-0"
              style={{ background: "rgba(6,78,59,0.25)", border: "1px solid rgba(16,185,129,0.08)" }}>
              <span className="text-[10px] px-1.5 font-medium flex-shrink-0" style={{ color: "#334155" }}>Intraday</span>
              {intradayTF.map((tf) => (
                <button key={tf.label} onClick={() => setActiveTimeframe(tf)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex-shrink-0"
                  style={activeTimeframe.label === tf.label
                    ? { background: "rgba(249,115,22,0.18)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }
                    : { color: "#64748b" }}>
                  {tf.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 rounded-lg p-0.5 flex-shrink-0"
              style={{ background: "rgba(6,78,59,0.25)", border: "1px solid rgba(16,185,129,0.08)" }}>
              <span className="text-[10px] px-1.5 font-medium flex-shrink-0" style={{ color: "#334155" }}>Swing</span>
              {swingTF.map((tf) => (
                <button key={tf.label} onClick={() => setActiveTimeframe(tf)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex-shrink-0"
                  style={activeTimeframe.label === tf.label
                    ? { background: "rgba(249,115,22,0.18)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }
                    : { color: "#64748b" }}>
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {ihsgData.length > 0 ? (
          <LineChart data={ihsgData} height={280} />
        ) : (
          <div className="h-[280px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              {loading ? (
                <>
                  <div className="w-8 h-8 border-2 rounded-full animate-spin"
                    style={{ borderColor: "rgba(251,146,60,0.2)", borderTopColor: "#fb923c" }} />
                  <span className="text-sm text-silver-500">Loading IHSG data...</span>
                </>
              ) : (
                <>
                  <svg className="w-10 h-10" style={{ color: "#1e3a2f" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  <span className="text-sm text-silver-500">No data available — check your network connection</span>
                </>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Market Summary */}
      {ihsgQuote && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="!p-4">
            <p className="text-[10px] text-silver-500 uppercase tracking-wider font-medium">Open</p>
            <p className="text-lg font-bold text-silver-200 mt-1">
              {ihsgQuote.open.toLocaleString("id-ID")}
            </p>
          </GlassCard>
          <GlassCard className="!p-4">
            <p className="text-[10px] text-silver-500 uppercase tracking-wider font-medium">Prev Close</p>
            <p className="text-lg font-bold text-silver-200 mt-1">
              {ihsgQuote.previousClose.toLocaleString("id-ID")}
            </p>
          </GlassCard>
          <GlassCard className="!p-4">
            <p className="text-[10px] text-silver-500 uppercase tracking-wider font-medium">Volume</p>
            <p className="text-lg font-bold text-silver-200 mt-1">
              {(ihsgQuote.volume / 1_000_000_000).toFixed(2)}B
            </p>
          </GlassCard>
          <GlassCard className="!p-4">
            <p className="text-[10px] text-silver-500 uppercase tracking-wider font-medium">Range</p>
            <p className="text-lg font-bold text-silver-200 mt-1">
              {(ihsgQuote.high - ihsgQuote.low).toFixed(2)}
            </p>
            <p className="text-xs text-silver-500 mt-1">high - low spread</p>
          </GlassCard>
        </div>
      )}

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {user ? (
          <>
            <Link href="/watchlist">
              <GlassCard className="!p-5 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-700 to-green-500 flex items-center justify-center shadow-lg shadow-green-900/40 flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-silver-200">Stock Watchlist</h3>
                    <p className="text-xs text-silver-500 mt-0.5">Pantau saham dengan TP/SL &amp; bandarmology</p>
                  </div>
                  <svg className="w-5 h-5 text-silver-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </GlassCard>
            </Link>
            {(user.role === "admin" || user.role === "superadmin") && (
              <Link href="/admin">
                <GlassCard className="!p-5 cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-600 to-orange-400 flex items-center justify-center shadow-lg shadow-orange-900/40 flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-silver-200">Admin Panel</h3>
                      <p className="text-xs text-silver-500 mt-0.5">Tambah saham, set TP/SL, tulis catatan bandarmology</p>
                    </div>
                    <svg className="w-5 h-5 text-silver-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </GlassCard>
              </Link>
            )}
          </>
        ) : (
          <div className="col-span-full">
            <GlassCard className="!p-6">
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.2)" }}>
                  <svg className="w-7 h-7" style={{ color: "#fb923c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-2zm-7-2a3 3 0 016 0v2h-6V7z" />
                  </svg>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-base font-bold text-silver-200">Fitur Lengkap Tersedia untuk Member</h3>
                  <p className="text-xs text-silver-500 mt-1">Daftar atau masuk untuk mengakses Cari Saham, Watchlist, Sinyal Teknikal, dan analisis mendalam.</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href="/login"
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: "linear-gradient(135deg,#ea580c,#fb923c)", color: "#fff" }}>
                    Masuk
                  </Link>
                  <Link href="/register"
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>
                    Daftar
                  </Link>
                </div>
              </div>
            </GlassCard>
          </div>
        )}
      </div>

      {/* Articles Section */}
      <GlassCard hover={false}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <svg className="w-4 h-4" style={{ color: "#10b981" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-silver-200">Artikel Pilihan</h2>
              <p className="text-[10px] text-silver-500">Analisis dan insight pasar</p>
            </div>
          </div>
        </div>

        {articlesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl p-4 animate-pulse"
                style={{ background: "rgba(6,78,59,0.2)", border: "1px solid rgba(226,232,240,0.06)" }}>
                <div className="h-28 rounded w-full mb-3" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="h-4 rounded w-full mb-2" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="h-4 rounded w-4/5" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-6 text-sm text-silver-500">Tidak ada artikel saat ini.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {articles.map((article) => (
              <Link 
                href={`/articles/${article._id}`} 
                key={article._id}
                className="group flex flex-col rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                style={{ background: "rgba(6,78,59,0.15)", border: "1px solid rgba(226,232,240,0.06)", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}
              >
                {article.imageUrl ? (
                  <div className="w-full h-36 overflow-hidden flex-shrink-0" style={{ background: "rgba(6,78,59,0.3)" }}>
                    <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                  </div>
                ) : (
                  <div className="w-full h-36 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(6,78,59,0.25)" }}>
                    <svg className="w-8 h-8" style={{ color: "#1e3a2f" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                  </div>
                )}
                <div className="p-3.5 flex flex-col flex-1 gap-2">
                  <div className="text-[10px] font-semibold text-silver-500 flex justify-between">
                    <span>{new Date(article.createdAt).toLocaleDateString("id-ID")}</span>
                    {article.isPublic ? null : <span className="text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Privat</span>}
                  </div>
                  <h3 className="text-sm font-semibold leading-snug line-clamp-2 transition-colors group-hover:text-green-400" style={{ color: "#cbd5e1" }}>
                    {article.title}
                  </h3>
                  <p className="text-xs leading-relaxed line-clamp-2 mt-auto" style={{ color: "#475569" }}>
                    {article.content}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Finance News */}
      <GlassCard hover={false}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <svg className="w-4 h-4" style={{ color: "#fb923c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-silver-200">Berita Pasar Terkini</h2>
              <p className="text-[10px] text-silver-500">Sumber: Detik Finance &amp; Detik Bursa</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.12)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" />
            <span className="text-[10px] text-green-500 font-medium">Live</span>
          </div>
        </div>

        {newsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl p-4 animate-pulse"
                style={{ background: "rgba(6,78,59,0.2)", border: "1px solid rgba(226,232,240,0.06)" }}>
                <div className="h-3 rounded w-1/3 mb-3" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="h-4 rounded w-full mb-2" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="h-4 rounded w-4/5" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-10">
            <svg className="w-10 h-10 mx-auto mb-2" style={{ color: "#1e3a2f" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <p className="text-sm text-silver-500">Berita tidak tersedia saat ini</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {news.map((item, i) => {
              const date = item.pubDate ? new Date(item.pubDate) : null;
              const timeAgo = date ? (() => {
                const diff = Date.now() - date.getTime();
                const mins = Math.floor(diff / 60000);
                const hrs = Math.floor(mins / 60);
                const days = Math.floor(hrs / 24);
                if (days > 0) return `${days}h lalu`;
                if (hrs > 0) return `${hrs}j lalu`;
                return `${mins}m lalu`;
              })() : "";

              return (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col rounded-xl overflow-hidden transition-all duration-200"
                  style={{
                    background: "rgba(6,78,59,0.15)",
                    border: "1px solid rgba(226,232,240,0.06)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(6,78,59,0.28)";
                    e.currentTarget.style.borderColor = "rgba(249,115,22,0.22)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(6,78,59,0.15)";
                    e.currentTarget.style.borderColor = "rgba(226,232,240,0.06)";
                  }}
                >
                  {/* Thumbnail */}
                  {item.image ? (
                    <div className="w-full h-36 overflow-hidden flex-shrink-0"
                      style={{ background: "rgba(6,78,59,0.3)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-28 flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(6,78,59,0.25)" }}>
                      <svg className="w-8 h-8" style={{ color: "#1e3a2f" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex flex-col gap-2 p-3.5 flex-1">
                    {/* Source + time */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
                        style={{ background: "rgba(249,115,22,0.12)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.15)" }}>
                        {item.source}
                      </span>
                      {timeAgo && (
                        <span className="text-[10px] flex-shrink-0" style={{ color: "#475569" }}>{timeAgo}</span>
                      )}
                    </div>

                    {/* Title with ticker pills */}
                    <h3 className="text-sm font-semibold leading-snug line-clamp-3 transition-colors group-hover:text-orange-400"
                      style={{ color: "#cbd5e1" }}>
                      <TitleWithPills
                        text={item.title}
                        onOpen={(t, ft) => setModalTicker({ ticker: t, fullTicker: ft })}
                      />
                    </h3>

                    {/* Description */}
                    {item.description && (
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "#475569" }}>
                        {item.description}
                      </p>
                    )}

                    {/* Read more */}
                    <div className="flex items-center gap-1 mt-auto pt-1">
                      <span className="text-[10px] font-medium transition-colors group-hover:text-orange-400" style={{ color: "#334155" }}>
                        Baca selengkapnya
                      </span>
                      <svg className="w-3 h-3 transition-all group-hover:translate-x-0.5 group-hover:text-orange-400" style={{ color: "#334155" }}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>

    {/* Stock Quick Modal — opens when ticker pill clicked */}
    {modalTicker && (
      <StockQuickModal
        ticker={modalTicker.ticker}
        fullTicker={modalTicker.fullTicker}
        onClose={() => setModalTicker(null)}
      />
    )}
    </>
  );
}
