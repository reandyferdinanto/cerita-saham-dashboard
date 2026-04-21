"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { StockQuickModal } from "@/components/ui/TickerPill";
import { StockQuote, IndexData, SearchResult } from "@/lib/types";
import { useAuth } from "@/components/ui/AuthProvider";

const LineChart = dynamic(() => import("@/components/charts/LineChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] flex items-center justify-center">
      <div className="text-silver-500 text-sm opacity-50">Harmonizing chart...</div>
    </div>
  ),
});

const US_INDICES = [
  { ticker: "^GSPC", label: "S&P 500", badge: "US" },
  { ticker: "^IXIC", label: "Nasdaq", badge: "US" },
  { ticker: "^DJI", label: "Dow Jones", badge: "US" },
];

const ASIA_INDICES = [
  { ticker: "^N225", label: "Nikkei 225", badge: "JP" },
  { ticker: "^HSI", label: "Hang Seng", badge: "HK" },
  { ticker: "^STI", label: "Straits Times", badge: "SG" },
];

const IDX_SECTORS = [
  { ticker: "^JKFINA", label: "Financials" },
  { ticker: "^JKENG", label: "Energy" },
  { ticker: "^JKBASIC", label: "Basic Materials" },
  { ticker: "^JKINDUS", label: "Industrials" },
  { ticker: "^JKCONS", label: "Cons. Cyclical" },
  { ticker: "^JKNONC", label: "Cons. Non-Cyclical" },
  { ticker: "^JKHLTH", label: "Healthcare" },
  { ticker: "^JKPROP", label: "Property" },
  { ticker: "^JKTECH", label: "Technology" },
  { ticker: "^JKINFRA", label: "Infrastructure" },
  { ticker: "^JKTRANS", label: "Transportation" },
];

interface GlobalQuote {
  ticker: string;
  price: number;
  changePercent: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [ihsgData, setIhsgData] = useState<IndexData[]>([]);
  const [ihsgQuote, setIhsgQuote] = useState<StockQuote | null>(null);
  const [vixQuote, setVixQuote] = useState<GlobalQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState({ label: "1D", range: "1d", interval: "5m" });
  const [usQuotes, setUsQuotes] = useState<GlobalQuote[]>([]);
  const [asiaQuotes, setAsiaQuotes] = useState<GlobalQuote[]>([]);
  const [sectorQuotes, setSectorQuotes] = useState<GlobalQuote[]>([]);
  const [modalTicker, setModalTicker] = useState<{ ticker: string; fullTicker: string } | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchQuote = async (ticker: string) => {
    try {
      const res = await fetch(`/api/stocks/quote/${encodeURIComponent(ticker)}`);
      const data = await res.json();
      if (data.error) return null;
      return {
        ticker,
        price: data.price ?? 0,
        changePercent: data.changePercent ?? 0,
      };
    } catch { return null; }
  };

  const fetchAllQuotes = useCallback(async () => {
    const [vix, us, asia, sectors] = await Promise.all([
      fetchQuote("^VIX"),
      Promise.all(US_INDICES.map(idx => fetchQuote(idx.ticker))),
      Promise.all(ASIA_INDICES.map(idx => fetchQuote(idx.ticker))),
      Promise.all(IDX_SECTORS.map(idx => fetchQuote(idx.ticker))),
    ]);

    setVixQuote(vix);
    setUsQuotes(us.filter(Boolean) as GlobalQuote[]);
    setAsiaQuotes(asia.filter(Boolean) as GlobalQuote[]);
    setSectorQuotes(sectors.filter(Boolean) as GlobalQuote[]);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const ihsgQuoteRes = await fetch(`/api/stocks/quote/^JKSE`);
      const ihsgQ = await ihsgQuoteRes.json();
      if (!ihsgQ.error) setIhsgQuote(ihsgQ);
      return ihsgQ?.price as number | undefined;
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  const fetchIhsgChart = useCallback(async (livePrice?: number) => {
    try {
      const fetchRange = activeTimeframe.label === "1D" ? "5d" : activeTimeframe.range;
      const res = await fetch(`/api/stocks/history/^JKSE?range=${fetchRange}&interval=${activeTimeframe.interval}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        let lineData = data.filter((d) => d.close != null).map((d) => ({ 
          time: d.time, 
          value: d.close,
          dateStr: typeof d.time === 'number' 
            ? new Date(d.time * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
            : d.time
        }));

        if (activeTimeframe.label === "1D" && lineData.length > 0) {
          const lastDate = lineData[lineData.length - 1].dateStr;
          lineData = lineData.filter(d => d.dateStr === lastDate);
        }

        if (lineData.length > 0 && livePrice != null && livePrice > 0) {
          lineData[lineData.length - 1].value = livePrice;
        }
        
        setIhsgData(lineData.map(d => ({ time: d.time, value: d.value })));
      }
    } catch (e) { console.error(e); }
  }, [activeTimeframe]);

  useEffect(() => {
    fetchData().then((lp) => fetchIhsgChart(lp));
    fetchAllQuotes();
    const interval = setInterval(async () => {
      const lp = await fetchData();
      fetchIhsgChart(lp);
      fetchAllQuotes();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchData, fetchIhsgChart, fetchAllQuotes]);

  const handleSearch = useCallback((q: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks/search/${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (Array.isArray(data)) setSearchResults(data);
      } catch (e) { console.error(e); } finally { setIsSearching(false); }
    }, 300);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getVixColor = (vix: number) => {
    if (vix < 20) return "text-emerald-400"; // Safe
    if (vix < 30) return "text-orange-400"; // Warning
    return "text-red-400"; // Panic
  };

  const getVixStatus = (vix: number) => {
    if (vix < 20) return "Market Calm";
    if (vix < 30) return "Elevated Volatility";
    return "Extreme Panic";
  };

  return (
    <>
    <div className="max-w-6xl mx-auto space-y-12 py-6 px-4">
      
      {/* 1. TOP BAR: FEAR GAUGE & US PULSE */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        <GlassCard className="!p-6 flex flex-col justify-center items-center text-center border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-silver-500 mb-2">Fear Gauge (VIX)</p>
          <div className={`text-5xl font-black tabular-nums tracking-tighter ${vixQuote ? getVixColor(vixQuote.price) : 'text-silver-700'}`}>
            {vixQuote ? vixQuote.price.toFixed(2) : "--.--"}
          </div>
          <p className={`text-[10px] font-bold uppercase mt-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 ${vixQuote ? getVixColor(vixQuote.price) : 'text-silver-700'}`}>
            {vixQuote ? getVixStatus(vixQuote.price) : "Loading..."}
          </p>
        </GlassCard>

        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {US_INDICES.map((idx) => {
            const q = usQuotes.find(u => u.ticker === idx.ticker);
            const isUp = (q?.changePercent ?? 0) >= 0;
            return (
              <GlassCard key={idx.ticker} className="!p-5 border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-silver-500 uppercase tracking-widest">{idx.badge} MARKET</span>
                  <div className={`w-2 h-2 rounded-full ${isUp ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                </div>
                <p className="text-sm font-bold text-silver-200">{idx.label}</p>
                <div className="flex items-end justify-between mt-1">
                  <p className="text-xl font-black text-white tabular-nums">{q ? q.price.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "---"}</p>
                  <p className={`text-xs font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                    {q ? `${isUp ? "+" : ""}${q.changePercent.toFixed(2)}%` : "0.00%"}
                  </p>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* 2. SEARCH & IHSG CENTERPIECE */}
      <section className="space-y-8">
        <div ref={searchRef} className="relative max-w-2xl mx-auto">
          <div className="group relative transition-all duration-500">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 to-emerald-500/20 rounded-[32px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
            <div className="relative flex items-center bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[28px] px-6 py-4 shadow-2xl focus-within:border-orange-500/40 transition-all">
              <svg className="w-5 h-5 text-silver-500 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); handleSearch(e.target.value); }}
                placeholder="Search stocks, sectors, or indices..."
                className="bg-transparent border-none focus:ring-0 text-white placeholder-silver-600 w-full text-lg font-medium outline-none"
              />
              {isSearching && <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />}
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-4 bg-slate-900/95 backdrop-blur-3xl border border-white/10 rounded-[32px] overflow-hidden shadow-2xl z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="p-2 space-y-1">
                {searchResults.slice(0, 6).map((res) => (
                  <button key={res.symbol} onClick={() => { setSearchQuery(""); setSearchResults([]); setModalTicker({ ticker: res.symbol.replace(".JK", ""), fullTicker: res.symbol }); }}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors group text-left">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 font-bold group-hover:bg-orange-500 group-hover:text-white transition-all">{res.symbol.replace(".JK", "")}</div>
                      <div>
                        <p className="text-silver-100 font-bold truncate">{res.name}</p>
                        <p className="text-[10px] text-silver-500 uppercase tracking-widest font-bold">{res.exchange} : {res.quoteType}</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-silver-700 group-hover:text-orange-400 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <GlassCard className="!p-8 border-white/5 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <svg className="w-64 h-64 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M13 21H3.414l3.293-3.293-1.414-1.414L1 20.586V11h2v6.586l4.293-4.293 1.414 1.414L5.414 18H13v3zm9-17h-9.586l3.293 3.293-1.414 1.414L8 5.414V14h2V7.414l4.293 4.293 1.414-1.414L12.414 7H22v3h2V2h-2v2z" /></svg>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-silver-500 uppercase tracking-[0.3em]">Jakarta Composite Index</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white tabular-nums">
                {ihsgQuote?.price?.toLocaleString("id-ID") || "----.--"}
              </h2>
              <p className={`text-lg font-bold mt-1 ${ihsgQuote && ihsgQuote.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {ihsgQuote && (ihsgQuote.changePercent >= 0 ? "+" : "")}{ihsgQuote?.changePercent?.toFixed(2)}% 
                <span className="text-silver-600 text-sm font-medium ml-2">({ihsgQuote?.change?.toFixed(2)} pts)</span>
              </p>
            </div>
            <div className="flex gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/5 self-start md:self-auto">
              {["1D", "1W", "1M", "3M"].map((tf) => (
                <button key={tf} onClick={() => setActiveTimeframe({ label: tf, range: tf==="1D"?"1d":tf==="1W"?"5d":tf==="1M"?"1mo":"3mo", interval: tf==="1D"?"5m":tf==="1W"?"1h":"1d" })}
                  className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${activeTimeframe.label === tf ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-silver-500 hover:text-silver-200"}`}>
                  {tf}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-[350px] relative z-10">
            {ihsgData.length > 0 ? (
              <LineChart data={ihsgData} height={350} locale="id-ID" timeZone="Asia/Jakarta" />
            ) : (
              <div className="h-full flex items-center justify-center bg-white/[0.02] rounded-3xl animate-pulse" />
            )}
          </div>
        </GlassCard>
      </section>

      {/* 3. ASIA PULSE & SECTORAL FLOW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Asia Pulse */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-silver-500 uppercase tracking-[0.3em] px-2">Asia Morning Pulse</h3>
          <div className="space-y-3">
            {ASIA_INDICES.map((idx) => {
              const q = asiaQuotes.find(a => a.ticker === idx.ticker);
              const isUp = (q?.changePercent ?? 0) >= 0;
              return (
                <div key={idx.ticker} className="group flex items-center justify-between p-4 bg-slate-900/40 border border-white/5 rounded-[20px] hover:border-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[10px] font-black text-silver-400 group-hover:text-orange-400 transition-colors">{idx.badge}</div>
                    <div>
                      <p className="text-sm font-bold text-silver-200">{idx.label}</p>
                      <p className="text-[10px] text-silver-600 font-bold uppercase tracking-wider">Major Index</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-silver-100 tabular-nums">{q ? q.price.toLocaleString("en-US") : "---"}</p>
                    <p className={`text-[10px] font-black ${isUp ? "text-emerald-400" : "text-red-400"}`}>{q ? `${isUp ? "+" : ""}${q.changePercent.toFixed(2)}%` : "0.00%"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sectoral Flow Heatmap-style List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-silver-500 uppercase tracking-[0.3em]">IDX Sectoral Flow</h3>
            <span className="text-[10px] font-bold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">Capital Map</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {IDX_SECTORS.map((sec) => {
              const q = sectorQuotes.find(s => s.ticker === sec.ticker);
              const isUp = (q?.changePercent ?? 0) >= 0;
              return (
                <div key={sec.ticker} className="p-4 rounded-2xl border border-white/5 bg-slate-900/30 hover:bg-white/[0.02] transition-all flex flex-col justify-between h-24">
                  <p className="text-[10px] font-bold text-silver-500 uppercase truncate">{sec.label}</p>
                  <div className="flex items-center justify-between gap-2 mt-auto">
                    <p className="text-sm font-black text-silver-100 tabular-nums">{q ? q.price.toLocaleString("id-ID", { maximumFractionDigits: 0 }) : "---"}</p>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                      {q ? `${isUp ? "+" : ""}${q.changePercent.toFixed(2)}%` : "0.00%"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. FOOTER CTA */}
      <section className="pt-8">
        <Link href="/insights">
          <GlassCard className="group !p-10 bg-gradient-to-br from-orange-500/[0.05] to-transparent border-white/5 hover:border-orange-500/20 transition-all duration-1000 overflow-hidden relative rounded-[40px]">
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-orange-500/10 blur-[100px] rounded-full" />
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
              <div className="text-center md:text-left space-y-4">
                <span className="px-4 py-1 rounded-full bg-orange-500 text-white text-[10px] font-black uppercase tracking-[0.2em]">Institutional Grade</span>
                <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">Master the Market with <br/><span className="text-orange-400 text-4xl md:text-5xl">Market Insights</span></h2>
                <p className="text-silver-500 text-base max-w-xl font-medium">Bongkar anomali bandar dan temukan pola akumulasi sebelum market bereaksi. Akses laporan mingguan eksklusif sekarang.</p>
              </div>
              <div className="flex h-20 w-20 items-center justify-center rounded-[32px] bg-orange-500 text-white shadow-[0_20px_50px_rgba(249,115,22,0.4)] group-hover:scale-110 transition-all duration-700">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
            </div>
          </GlassCard>
        </Link>
      </section>

    </div>

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
