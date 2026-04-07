"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
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
  { ticker: "^GSPC", label: "S&P 500", badge: "US", region: "US" },
  { ticker: "^DJI", label: "Dow Jones", badge: "US", region: "US" },
  { ticker: "^IXIC", label: "Nasdaq", badge: "US", region: "US" },
  { ticker: "^VIX", label: "VIX", badge: "US", region: "US" },
  { ticker: "^N225", label: "Nikkei 225", badge: "JP", region: "Asia" },
  { ticker: "^HSI", label: "Hang Seng", badge: "HK", region: "Asia" },
  { ticker: "^KS11", label: "KOSPI", badge: "KR", region: "Asia" },
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
  const [showAllArticles, setShowAllArticles] = useState(false);
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
  const sortedArticles = [...articles].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const featuredArticles = sortedArticles.slice(0, 3);
  const olderArticles = sortedArticles.slice(3);
  const visibleArticles = showAllArticles ? sortedArticles : featuredArticles;

  return (
    <>
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-silver-100">
            anomalisaham <span className="text-orange-400">Radar</span>
          </h1>
          <p className="text-silver-500 text-sm mt-1">
            Membaca pasar luas dulu sebelum mencari anomali akumulasi yang belum ramai
          </p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-2 text-xs text-silver-500">
            <div className="pulse-dot w-2 h-2 rounded-full bg-green-500"></div>
            Last updated: {lastUpdated}
          </div>
        )}
      </div>

      {/* Global Markets Ticker */}
      <GlassCard hover={false} className="!p-3 sm:!p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0"
              style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}
            >
              <svg className="h-3.5 w-3.5" style={{ color: "#fb923c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-silver-300">Global Markets</p>
              <p className="text-[10px] text-silver-500">Overnight pulse before local decisions</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" />
            <span className="text-[10px] font-medium text-green-500">Live</span>
          </div>
        </div>

        {globalQuotes.length === 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {GLOBAL_INDICES.map((idx) => (
              <div
                key={idx.ticker}
                className="rounded-xl p-2.5 animate-pulse"
                style={{ background: "rgba(6,78,59,0.2)", border: "1px solid rgba(226,232,240,0.06)" }}
              >
                <div className="mb-2 h-2.5 w-3/4 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="mb-1.5 h-4 w-full rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="h-2.5 w-1/2 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-silver-500">US Session</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GLOBAL_INDICES.filter((idx) => idx.region === "US").map((idx) => {
                  const q = globalQuotes.find((g) => g.ticker === idx.ticker);
                  const isUp = (q?.changePercent ?? 0) >= 0;
                  const isVix = idx.ticker === "^VIX";
                  const color = isVix ? (isUp ? "#ef4444" : "#10b981") : (isUp ? "#10b981" : "#ef4444");
                  return (
                    <div
                      key={idx.ticker}
                      className="flex items-center justify-between gap-2 rounded-xl p-2.5"
                      style={{ background: "rgba(6,78,59,0.15)", border: "1px solid rgba(226,232,240,0.06)" }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full border border-white/8 px-1.5 py-0.5 text-[9px] font-semibold text-silver-500">{idx.badge}</span>
                          <p className="truncate text-[10px] font-semibold text-silver-400">{idx.label}</p>
                        </div>
                        <p className="text-sm font-bold leading-tight text-silver-100 tabular-nums">
                          {q ? q.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "-"}
                        </p>
                      </div>
                      {q && (
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>
                            {isUp ? "+" : "-"} {Math.abs(q.changePercent).toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-silver-500">Asia Open</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {GLOBAL_INDICES.filter((idx) => idx.region === "Asia").map((idx) => {
                  const q = globalQuotes.find((g) => g.ticker === idx.ticker);
                  const isUp = (q?.changePercent ?? 0) >= 0;
                  const color = isUp ? "#10b981" : "#ef4444";
                  return (
                    <div
                      key={idx.ticker}
                      className="flex items-center justify-between gap-2 rounded-xl p-2.5"
                      style={{ background: "rgba(6,78,59,0.15)", border: "1px solid rgba(226,232,240,0.06)" }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full border border-white/8 px-1.5 py-0.5 text-[9px] font-semibold text-silver-500">{idx.badge}</span>
                          <p className="truncate text-[10px] font-semibold text-silver-400">{idx.label}</p>
                        </div>
                        <p className="mt-0.5 text-sm font-bold leading-tight text-silver-100 tabular-nums">
                          {q ? q.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "-"}
                        </p>
                      </div>
                      {q && (
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>
                            {isUp ? "+" : "-"} {Math.abs(q.changePercent).toFixed(2)}%
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
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <svg className="h-5 w-5 flex-shrink-0 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-silver-200 sm:text-lg">
                  IHSG / Jakarta Composite Index
                </h2>
                <p className="hidden text-xs text-silver-500 sm:block">Indeks Harga Saham Gabungan (^JKSE)</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <div
              className="flex flex-shrink-0 items-center gap-0.5 rounded-lg p-0.5"
              style={{ background: "rgba(6,78,59,0.25)", border: "1px solid rgba(16,185,129,0.08)" }}
            >
              <span className="px-1.5 text-[10px] font-medium text-silver-500">Intraday</span>
              {intradayTF.map((tf) => (
                <button
                  key={tf.label}
                  onClick={() => setActiveTimeframe(tf)}
                  className="flex-shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-all"
                  style={activeTimeframe.label === tf.label
                    ? { background: "rgba(249,115,22,0.18)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }
                    : { color: "#64748b" }}
                >
                  {tf.label}
                </button>
              ))}
            </div>
            <div
              className="flex flex-shrink-0 items-center gap-0.5 rounded-lg p-0.5"
              style={{ background: "rgba(6,78,59,0.25)", border: "1px solid rgba(16,185,129,0.08)" }}
            >
              <span className="px-1.5 text-[10px] font-medium text-silver-500">Swing</span>
              {swingTF.map((tf) => (
                <button
                  key={tf.label}
                  onClick={() => setActiveTimeframe(tf)}
                  className="flex-shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-all"
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_280px] lg:items-start">
          <div className="min-w-0">
            {ihsgData.length > 0 ? (
              <LineChart
                data={ihsgData}
                height={336}
                locale="id-ID"
                timeZone="Asia/Jakarta"
              />
            ) : (
              <div className="flex h-[336px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  {loading ? (
                    <>
                      <div
                        className="h-8 w-8 animate-spin rounded-full border-2"
                        style={{ borderColor: "rgba(251,146,60,0.2)", borderTopColor: "#fb923c" }}
                      />
                      <span className="text-sm text-silver-500">Loading IHSG data...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-10 w-10" style={{ color: "#1e3a2f" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                      <span className="text-sm text-silver-500">No data available - check your network connection</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/8 p-4" style={{ background: "linear-gradient(180deg, rgba(6,78,59,0.18), rgba(6,78,59,0.08))" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-silver-500">IHSG / Composite</p>
                <p className="mt-2 text-2xl font-bold leading-none text-silver-100 tabular-nums md:text-[2rem]">
                  {ihsgQuote ? ihsgQuote.price.toLocaleString("id-ID") : "-"}
                </p>
                <p
                  className={`mt-2 text-sm font-semibold tabular-nums ${
                    isIhsgPositive ? "text-green-500" : "text-red-400"
                  }`}
                >
                  {ihsgQuote
                    ? `${isIhsgPositive ? "+" : "-"} ${Math.abs(ihsgChange).toFixed(2)} (${Math.abs(ihsgChangePercent).toFixed(2)}%)`
                    : "-"}
                </p>
              </div>
              <Link
                href="/watchlist"
                className="inline-flex flex-shrink-0 items-center rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-silver-400 transition-colors hover:border-orange-400/30 hover:text-orange-400"
              >
                Watchlist
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/6 bg-white/2 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-silver-500">Day High</p>
                <p className="mt-1 text-sm font-semibold text-silver-100 tabular-nums">
                  {ihsgQuote ? ihsgQuote.high.toLocaleString("id-ID") : "-"}
                </p>
              </div>
              <div className="rounded-xl border border-white/6 bg-white/2 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-silver-500">Day Low</p>
                <p className="mt-1 text-sm font-semibold text-silver-100 tabular-nums">
                  {ihsgQuote ? ihsgQuote.low.toLocaleString("id-ID") : "-"}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-orange-500/10 bg-orange-500/5 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-silver-500">Watchlist</span>
                <span className="text-sm font-semibold text-orange-400 tabular-nums">{watchlistCount} tracked</span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
      {/* Quick Navigation */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {user ? (
          <>
            <Link href="/watchlist">
              <GlassCard className="group !p-5 cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-silver-500">Monitor</p>
                    <h3 className="mt-2 text-lg font-bold text-silver-200 transition-colors group-hover:text-orange-400">Stock Watchlist</h3>
                    <p className="mt-1 max-w-sm text-sm text-silver-500">Pantau saham yang sudah masuk radar anomali, lengkap dengan TP/SL dan catatan bandarmology.</p>
                  </div>
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-green-500/20 bg-green-500/10 text-green-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </GlassCard>
            </Link>
            {(user.role === "admin" || user.role === "superadmin") && (
              <Link href="/admin">
                <GlassCard className="group !p-5 cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-silver-500">Control</p>
                      <h3 className="mt-2 text-lg font-bold text-silver-200 transition-colors group-hover:text-orange-400">Admin Panel</h3>
                      <p className="mt-1 max-w-sm text-sm text-silver-500">Kelola watchlist, artikel, anggota, dan workflow admin dari control center utama.</p>
                    </div>
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            )}
          </>
        ) : (
          <div className="col-span-full">
            <GlassCard className="!p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-2zm-7-2a3 3 0 016 0v2h-6V7z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-silver-500">Member Access</p>
                    <h3 className="mt-2 text-lg font-bold text-silver-200">Buka fitur riset yang lebih lengkap</h3>
                    <p className="mt-1 max-w-2xl text-sm text-silver-500">Masuk atau daftar untuk mengakses watchlist, sinyal teknikal, dan radar akumulasi saham yang belum terlalu terlihat.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#ea580c,#fb923c)" }}>
                    Masuk
                  </Link>
                  <Link href="/register" className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400">
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
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-silver-500">Editorial</p>
            <h2 className="mt-2 text-lg font-bold text-silver-200">Artikel Pilihan</h2>
            <p className="text-xs text-silver-500">
              Tiga artikel terbaru tampil di depan. Expand untuk membuka arsip artikel lama.
            </p>
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
        ) : sortedArticles.length === 0 ? (
          <div className="text-center py-6 text-sm text-silver-500">Tidak ada artikel saat ini.</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {visibleArticles.map((article) => (
                <Link
                  href={`/articles/${article._id}`}
                  key={article._id}
                  className="group flex flex-col overflow-hidden rounded-[22px] border border-white/8 transition-all duration-300 hover:-translate-y-1"
                  style={{ background: "linear-gradient(180deg, rgba(6,78,59,0.18), rgba(6,78,59,0.1))", boxShadow: "0 10px 30px rgba(0,0,0,0.22)" }}
                >
                  {article.imageUrl ? (
                    <div className="relative h-40 w-full flex-shrink-0 overflow-hidden" style={{ background: "rgba(6,78,59,0.3)" }}>
                      <Image
                        src={article.imageUrl}
                        alt={article.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex h-40 w-full flex-shrink-0 items-center justify-center" style={{ background: "rgba(6,78,59,0.25)" }}>
                      <svg className="w-8 h-8" style={{ color: "#1e3a2f" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-silver-500">
                      <span>{new Date(article.createdAt).toLocaleDateString("id-ID")}</span>
                      {article.isPublic ? (
                        <span className="rounded-full border border-green-500/15 bg-green-500/8 px-2 py-0.5 text-green-400">Publik</span>
                      ) : (
                        <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-orange-400">Privat</span>
                      )}
                    </div>
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug text-silver-200 transition-colors group-hover:text-orange-400">
                      {article.title}
                    </h3>
                    <p className="mt-auto line-clamp-3 text-sm leading-relaxed text-silver-500">
                      {article.content}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[11px] font-medium text-silver-400 transition-colors group-hover:text-orange-400">
                      <span>Baca artikel</span>
                      <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {olderArticles.length > 0 ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                <button
                  type="button"
                  onClick={() => setShowAllArticles((value) => !value)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-silver-200">
                      {showAllArticles ? "Sembunyikan artikel lama" : `Lihat ${olderArticles.length} artikel lama`}
                    </p>
                    <p className="text-xs text-silver-500">
                      {showAllArticles ? "Kembali ke tiga artikel terbaru." : "Expand untuk membuka arsip artikel sebelumnya."}
                    </p>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-silver-400">
                    <svg
                      className={`h-4 w-4 transition-transform ${showAllArticles ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        )}
      </GlassCard>

      {/* Finance News */}
      <GlassCard hover={false}>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-silver-500">News Flow</p>
            <h2 className="mt-2 text-lg font-bold text-silver-200">Berita Pasar Terkini</h2>
            <p className="text-xs text-silver-500">Detik Finance dan Detik Bursa, disusun untuk scan cepat.</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-green-500/15 bg-green-500/8 px-2.5 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" />
            <span className="text-[10px] font-medium text-green-500">Live</span>
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
                  className="group flex flex-col overflow-hidden rounded-[22px] border border-white/8 transition-all duration-300 hover:-translate-y-1 hover:border-orange-400/20"
                  style={{
                    background: "linear-gradient(180deg, rgba(6,78,59,0.18), rgba(6,78,59,0.1))",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                  }}
                >
                  {/* Thumbnail */}
                  {item.image ? (
                    <div className="w-full h-40 overflow-hidden flex-shrink-0"
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
                    <div className="w-full h-40 flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(6,78,59,0.25)" }}>
                      <svg className="w-8 h-8" style={{ color: "#1e3a2f" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    {/* Source + time */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: "rgba(249,115,22,0.12)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.15)" }}>
                        {item.source}
                      </span>
                      {timeAgo && (
                        <span className="flex-shrink-0 text-[10px] text-silver-500">{timeAgo}</span>
                      )}
                    </div>

                    {/* Title with ticker pills */}
                    <h3 className="line-clamp-3 text-base font-semibold leading-snug text-silver-200 transition-colors group-hover:text-orange-400">
                      <TitleWithPills
                        text={item.title}
                        onOpen={(t, ft) => setModalTicker({ ticker: t, fullTicker: ft })}
                      />
                    </h3>

                    {/* Description */}
                    {item.description && (
                      <p className="line-clamp-3 text-sm leading-relaxed text-silver-500">
                        {item.description}
                      </p>
                    )}

                    {/* Read more */}
                    <div className="mt-auto flex items-center gap-1 pt-1">
                      <span className="text-[11px] font-medium text-silver-400 transition-colors group-hover:text-orange-400">
                        Baca selengkapnya
                      </span>
                      <svg className="h-3 w-3 text-silver-400 transition-all group-hover:translate-x-0.5 group-hover:text-orange-400"
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

    {/* Stock Quick Modal - opens when ticker pill clicked */}
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

