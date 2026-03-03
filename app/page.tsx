"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { StockQuote, IndexData } from "@/lib/types";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  image?: string;
}

const LineChart = dynamic(() => import("@/components/charts/LineChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] flex items-center justify-center">
      <div className="text-silver-500 text-sm">Loading chart...</div>
    </div>
  ),
});

export default function DashboardPage() {
  const [ihsgData, setIhsgData] = useState<IndexData[]>([]);
  const [ihsgQuote, setIhsgQuote] = useState<StockQuote | null>(null);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState({ label: "1D", group: "intraday", range: "1d", interval: "5m" });
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

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
    try {
      const res = await fetch(
        `/api/stocks/history/^JKSE?range=${activeTimeframe.range}&interval=${activeTimeframe.interval}`
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        const lineData: { time: string | number; value: number }[] = data
          .filter((d: any) => d.close != null)
          .map((d: any) => ({
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

        setIhsgData(lineData);
      }
    } catch {
      console.error("Failed to fetch IHSG history");
    }
  }, [activeTimeframe]);

  useEffect(() => {
    // Initial load: fetch quote first, then chart with live price
    fetchData().then((livePrice) => fetchIhsgChart(livePrice));

    const interval = setInterval(async () => {
      const livePrice = await fetchData();
      fetchIhsgChart(livePrice);
    }, 60_000);

    return () => clearInterval(interval);
  }, [fetchData, fetchIhsgChart]);

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="!p-4">
          <p className="text-[10px] text-silver-500 uppercase tracking-wider font-medium">IHSG / Composite</p>
          <p className="text-xl font-bold text-silver-100 mt-1">
            {ihsgQuote ? ihsgQuote.price.toLocaleString("id-ID") : "—"}
          </p>
          <p className={`text-xs mt-1 font-semibold ${isIhsgPositive ? "text-green-500" : "text-red-400"}`}>
            {ihsgQuote ? `${isIhsgPositive ? "▲" : "▼"} ${Math.abs(ihsgChange).toFixed(2)} (${Math.abs(ihsgChangePercent).toFixed(2)}%)` : "—"}
          </p>
        </GlassCard>

        <GlassCard className="!p-4">
          <p className="text-[10px] text-silver-500 uppercase tracking-wider font-medium">Day High</p>
          <p className="text-xl font-bold text-silver-100 mt-1">
            {ihsgQuote ? ihsgQuote.high.toLocaleString("id-ID") : "—"}
          </p>
          <p className="text-xs text-silver-500 mt-1">intraday high</p>
        </GlassCard>

        <GlassCard className="!p-4">
          <p className="text-[10px] text-silver-500 uppercase tracking-wider font-medium">Day Low</p>
          <p className="text-xl font-bold text-silver-100 mt-1">
            {ihsgQuote ? ihsgQuote.low.toLocaleString("id-ID") : "—"}
          </p>
          <p className="text-xs text-silver-500 mt-1">intraday low</p>
        </GlassCard>

        <GlassCard className="!p-4">
          <p className="text-[10px] text-silver-500 uppercase tracking-wider font-medium">Watchlist</p>
          <p className="text-xl font-bold text-orange-400 mt-1">{watchlistCount}</p>
          <Link href="/watchlist" className="text-xs text-silver-500 mt-1 hover:text-orange-400 transition-colors">
            stocks tracked →
          </Link>
        </GlassCard>
      </div>

      {/* IHSG Chart */}
      <GlassCard hover={false}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <div>
              <h2 className="text-lg font-bold text-silver-200">
                IHSG / Jakarta Composite Index
              </h2>
              <p className="text-xs text-silver-500">
                Indeks Harga Saham Gabungan (^JKSE)
              </p>
            </div>
          </div>
          {/* Timeframe groups */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Intraday */}
            <div className="flex items-center gap-0.5 rounded-lg p-0.5"
              style={{ background: "rgba(6,78,59,0.25)", border: "1px solid rgba(16,185,129,0.08)" }}>
              <span className="text-[10px] px-1.5 font-medium" style={{ color: "#334155" }}>Intraday</span>
              {intradayTF.map((tf) => (
                <button
                  key={tf.label}
                  onClick={() => setActiveTimeframe(tf)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
                  style={activeTimeframe.label === tf.label
                    ? { background: "rgba(249,115,22,0.18)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }
                    : { color: "#64748b" }}
                >
                  {tf.label}
                </button>
              ))}
            </div>
            {/* Swing */}
            <div className="flex items-center gap-0.5 rounded-lg p-0.5"
              style={{ background: "rgba(6,78,59,0.25)", border: "1px solid rgba(16,185,129,0.08)" }}>
              <span className="text-[10px] px-1.5 font-medium" style={{ color: "#334155" }}>Swing</span>
              {swingTF.map((tf) => (
                <button
                  key={tf.label}
                  onClick={() => setActiveTimeframe(tf)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
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
        {ihsgData.length > 0 ? (
          <LineChart data={ihsgData} height={400} />
        ) : (
          <div className="h-[400px] flex items-center justify-center">
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
      </div>
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

                    {/* Title */}
                    <h3 className="text-sm font-semibold leading-snug line-clamp-2 transition-colors group-hover:text-orange-400"
                      style={{ color: "#cbd5e1" }}>
                      {item.title}
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
  );
}
