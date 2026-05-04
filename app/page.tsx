"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { StockQuickPanel } from "@/components/ui/TickerPill";
import { StockQuote, IndexData, SearchResult } from "@/lib/types";
import { useAuth } from "@/components/ui/AuthProvider";

const LineChart = dynamic(() => import("@/components/charts/LineChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] flex items-center justify-center">
      <div className="text-silver-500 text-sm opacity-50">Menyiapkan grafik...</div>
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

const QUICK_TICKERS = [
  { symbol: "COAL.JK", label: "COAL" },
  { symbol: "CAKK.JK", label: "CAKK" },
  { symbol: "REAL.JK", label: "REAL" },
  { symbol: "MPIX.JK", label: "MPIX" },
  { symbol: "GOTO.JK", label: "GOTO" },
  { symbol: "WIRG.JK", label: "WIRG" },
];

type MarketNewsItem = {
  title: string;
  link: string;
  source: string;
  pubDate?: string;
};

const MARKET_NEWS_FALLBACK: MarketNewsItem[] = [
  {
    title: "Menarik headline market dari Detik dan IPOT...",
    link: "https://finance.detik.com/",
    source: "Market news",
  },
  {
    title: "Jika feed sedang kosong, ticker ini otomatis update saat data masuk.",
    link: "https://www.indopremier.com/ipotnews/",
    source: "IPOT News",
  },
];

const HIDDEN_DASHBOARD_TICKERS = new Set([
  "BBCA", "BBRI", "BMRI", "BBNI", "BRIS", "BTPS", "BBYB", "ARTO", "BNGA", "MEGA", "BDMN",
]);

const FAQ_ITEMS = [
  {
    question: "Arti instruksi 1 sampai 4 itu apa?",
    answer:
      "Anggap saja ini skala conviction. 1 Nandain, 2 Cicil beli, 3 Bisa beli, 4 Hajar kanan. Makin tinggi angkanya, kalau kamu sependapat, lot bisa lebih besar sesuai risk plan masing-masing.",
  },
  {
    question: "Kalau ternyata harga koreksi gimana?",
    answer:
      "Kalau setup masih oke, instruksinya bisa berubah jadi -1 Avg down. Tetap pakai position sizing, jangan asal tambah lot cuma karena harga turun.",
  },
  {
    question: "Ada sektor yang memang dihindari?",
    answer:
      "Iya. Pendekatannya menghindari perbankan, lembaga keuangan seperti asuransi, bisnis hiburan, dan rokok. Jadi radar di sini dibuat lebih fokus ke area yang sesuai gaya itu.",
  },
  {
    question: "Boleh beli dan jual di hari yang sama?",
    answer:
      "Tidak. Prinsipnya bukan intraday. Paling cepat jual di H+2 atau esok lusa, jadi keputusan tetap punya ruang napas dan tidak terlalu impulsif.",
  },
];

interface GlobalQuote {
  ticker: string;
  price: number;
  changePercent: number;
}

type LockedTicker = {
  ticker: string;
  fullTicker: string;
  name?: string;
};

function isDashboardHiddenStock(stock: { symbol?: string; ticker?: string; name?: string }) {
  const code = (stock.symbol ?? stock.ticker ?? "").replace(".JK", "").toUpperCase();
  const name = ` ${(stock.name ?? "").toLowerCase()} `;
  return HIDDEN_DASHBOARD_TICKERS.has(code) || name.includes(" bank ") || name.includes(" banking ");
}

function PublicChartCtaModal({
  ticker,
  isLoggedIn,
  onClose,
}: {
  ticker: LockedTicker;
  isLoggedIn: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 px-4 pb-4 backdrop-blur-md sm:items-center sm:pb-0">
      <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-silver-200/10 bg-[#06120e] shadow-2xl">
        <div
          className="relative p-6 sm:p-7"
          style={{
            background:
              "radial-gradient(circle at 82% 6%, rgba(249,115,22,0.22), transparent 34%), radial-gradient(circle at 0% 100%, rgba(16,185,129,0.14), transparent 36%)",
          }}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-silver-200/10 bg-silver-200/5 text-silver-400 transition hover:text-silver-100"
            aria-label="Tutup modal"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-400 text-lg font-black text-[#1b130c]">
            {ticker.ticker.slice(0, 4)}
          </div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Akses penuh</p>
          <h2 className="mt-3 max-w-md text-3xl font-black leading-tight text-silver-100">
            Mau lihat grafik {ticker.ticker} lebih detail?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-silver-400">
            Daftar dulu untuk membuka grafik saham, membaca pergerakan harga, dan lanjut riset tanpa pindah-pindah halaman.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {["Grafik harga", "Ringkasan saham", "Ruang riset"].map((item) => (
              <div key={item} className="rounded-2xl border border-silver-200/10 bg-silver-200/[0.045] p-3">
                <p className="text-xs font-bold text-silver-200">{item}</p>
                <p className="mt-1 text-[11px] text-silver-500">buka setelah daftar</p>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href={isLoggedIn ? "/pending" : "/register"}
              className="inline-flex flex-1 items-center justify-center rounded-2xl bg-orange-400 px-5 py-3 text-sm font-black text-[#1b130c] transition hover:bg-orange-300"
            >
              {isLoggedIn ? "Aktifkan akses" : "Daftar sekarang"}
            </Link>
            <Link
              href="/login"
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-silver-200/10 bg-silver-200/5 px-5 py-3 text-sm font-bold text-silver-200 transition hover:bg-silver-200/10"
            >
              Saya sudah punya akun
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [ihsgData, setIhsgData] = useState<IndexData[]>([]);
  const [ihsgQuote, setIhsgQuote] = useState<StockQuote | null>(null);
  const [vixQuote, setVixQuote] = useState<GlobalQuote | null>(null);
  const [activeTimeframe, setActiveTimeframe] = useState({ label: "1D", range: "1d", interval: "5m" });
  const [usQuotes, setUsQuotes] = useState<GlobalQuote[]>([]);
  const [asiaQuotes, setAsiaQuotes] = useState<GlobalQuote[]>([]);
  const [marketNews, setMarketNews] = useState<MarketNewsItem[]>([]);
  const [inlineTicker, setInlineTicker] = useState<{ ticker: string; fullTicker: string } | null>(null);
  const [lockedTicker, setLockedTicker] = useState<LockedTicker | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMemberAccess = Boolean(
    user && (user.membershipStatus === "active" || user.role === "admin" || user.role === "superadmin")
  );

  const dashboardMode = useMemo(() => {
    if (hasMemberAccess) {
      return {
        eyebrow: "Radar anomali",
        headline: "Cari jejak akumulasi sebelum pasar mulai ramai.",
        body: "AnomaliSaham membantu membaca saham yang tampak sepi di permukaan, tetapi mulai janggal dari struktur harga, volume, dan support yang dijaga. Mulai dari konteks pasar, buka grafik, lalu susun skenario dengan sadar risiko.",
        badge: "Akses aktif",
      };
    }
    if (user) {
      return {
        eyebrow: "Radar anomali",
        headline: "Belajar melihat peluang sebelum kelihatan jelas.",
        body: "Mulai dari arah IHSG dan headline pasar, lalu pahami cara membaca support lock, sideways senyap, dan jejak akumulasi. Aktifkan akses untuk membuka grafik dan riset saham lebih dalam.",
        badge: "Menunggu aktivasi",
      };
    }
    return {
      eyebrow: "Radar anomali",
      headline: "Baca pasar dari yang belum ramai dibicarakan.",
      body: "Filosofinya sederhana: peluang sering muncul saat harga terlihat biasa saja, tetapi volume, range, dan support mulai memberi petunjuk. Gunakan dashboard ini untuk membaca konteks besar sebelum masuk ke riset saham.",
      badge: authLoading ? "Mengecek akses" : "Bisa dicoba",
    };
  }, [authLoading, hasMemberAccess, user]);

  const visibleSearchResults = useMemo(
    () => searchResults.filter((result) => !isDashboardHiddenStock({ symbol: result.symbol, name: result.name })),
    [searchResults]
  );

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
    const [vix, us, asia] = await Promise.all([
      fetchQuote("^VIX"),
      Promise.all(US_INDICES.map(idx => fetchQuote(idx.ticker))),
      Promise.all(ASIA_INDICES.map(idx => fetchQuote(idx.ticker))),
    ]);

    setVixQuote(vix);
    setUsQuotes(us.filter(Boolean) as GlobalQuote[]);
    setAsiaQuotes(asia.filter(Boolean) as GlobalQuote[]);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const ihsgQuoteRes = await fetch(`/api/stocks/quote/^JKSE`);
      const ihsgQ = await ihsgQuoteRes.json();
      if (!ihsgQ.error) setIhsgQuote(ihsgQ);
      return ihsgQ?.price as number | undefined;
    } catch (e) { console.error(e); }
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

  useEffect(() => {
    let cancelled = false;

    const fetchMarketNews = async () => {
      try {
        const res = await fetch("/api/news/market-ticker");
        const data = (await res.json()) as MarketNewsItem[];
        if (!cancelled && Array.isArray(data)) {
          setMarketNews(data.filter((item) => item.title && item.link).slice(0, 12));
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchMarketNews();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const openStockFromSearch = useCallback(
    (stock: { symbol: string; name?: string }) => {
      const ticker = stock.symbol.replace(".JK", "");
      setSearchQuery("");
      setSearchResults([]);
      if (hasMemberAccess) {
        setInlineTicker({ ticker, fullTicker: stock.symbol });
        return;
      }
      setLockedTicker({ ticker, fullTicker: stock.symbol, name: stock.name });
    },
    [hasMemberAccess]
  );

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
    if (vix < 20) return "Pasar tenang";
    if (vix < 30) return "Mulai waspada";
    return "Risiko tinggi";
  };

  const ihsgIsUp = (ihsgQuote?.changePercent ?? 0) >= 0;
  const ihsgChangeText = ihsgQuote
    ? `${ihsgIsUp ? "+" : ""}${ihsgQuote.changePercent.toFixed(2)}%`
    : "--.--%";
  const displayedMarketNews = marketNews.length > 0 ? marketNews : MARKET_NEWS_FALLBACK;

  return (
    <>
    <div className="dashboard-typography mx-auto max-w-7xl space-y-8 px-3 py-4 sm:space-y-12 sm:px-4 sm:py-6">
      <section className="relative overflow-hidden rounded-[30px] border border-orange-200/10 bg-[oklch(16%_0.024_152_/_0.86)] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.38)] sm:rounded-[44px] sm:p-7 lg:p-10">
        <div
          className="absolute inset-0 opacity-95"
          style={{
            background:
              "radial-gradient(circle at 82% 8%, oklch(66% 0.14 70 / 0.28), transparent 30%), radial-gradient(circle at 12% 88%, oklch(54% 0.09 154 / 0.22), transparent 35%), linear-gradient(135deg, oklch(18% 0.025 152 / 0.92), oklch(12% 0.018 112 / 0.96))",
          }}
        />
        <div className="absolute left-5 top-5 h-20 w-20 rounded-full border border-orange-100/10 sm:left-10 sm:top-10 sm:h-28 sm:w-28" />
        <div className="absolute bottom-6 right-5 h-28 w-28 rounded-full border border-emerald-100/10 sm:bottom-8 sm:right-10 sm:h-36 sm:w-36" />
        <div className="relative grid gap-5 sm:gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="flex min-h-0 flex-col justify-between lg:min-h-[360px]">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6 sm:gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-200/20 bg-orange-100/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-orange-100 sm:text-[11px] sm:tracking-[0.22em]">
                  <span className="h-2 w-2 rounded-full bg-orange-300" />
                  {dashboardMode.eyebrow}
                </span>
                <span className="rounded-full border border-silver-200/10 bg-silver-100/[0.06] px-3 py-1.5 text-xs font-semibold text-silver-300">
                  {dashboardMode.badge}
                </span>
              </div>
              <h1 className="max-w-4xl text-[2.8rem] font-bold leading-[0.92] tracking-[-0.06em] text-[oklch(94%_0.02_96)] sm:text-6xl lg:text-7xl">
                {dashboardMode.headline}
              </h1>
              <p className="mt-4 max-w-2xl text-[0.95rem] leading-7 text-[oklch(78%_0.025_105)] sm:mt-6 sm:text-base sm:leading-8">
                {dashboardMode.body}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
              <Link
                href={hasMemberAccess ? "/search" : "/register"}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[oklch(73%_0.14_68)] px-6 py-3 text-sm font-extrabold text-[oklch(17%_0.025_70)] shadow-[0_16px_42px_oklch(60%_0.15_65_/_0.18)] transition hover:bg-[oklch(78%_0.13_68)]"
              >
                {hasMemberAccess ? "Cari saham sekarang" : "Daftar sekarang"}
              </Link>
              <Link
                href="/insights"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-silver-200/10 bg-silver-100/[0.06] px-6 py-3 text-sm font-bold text-silver-200 transition hover:bg-silver-100/[0.1]"
              >
                Baca insight
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[26px] border border-silver-200/10 bg-[oklch(11%_0.018_145_/_0.64)] p-4 shadow-2xl backdrop-blur-xl sm:rounded-[32px] sm:p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-orange-200">
                {hasMemberAccess ? "Lanjutkan pantauan" : "Yang bisa dicek di sini"}
              </p>
              <div className="mt-5 space-y-3">
                {(hasMemberAccess
                  ? [
                      { label: "Pantau pasar", value: "Lihat IHSG dan bursa global sebelum memilih saham." },
                      { label: "Cari saham", value: "Ketik kode saham, lalu buka grafiknya langsung dari dashboard." },
                      { label: "Susun rencana", value: "Lanjut ke insight dan tools saat butuh keputusan yang lebih rapi." },
                    ]
                  : [
                      { label: "Lihat arah pasar", value: "IHSG dan bursa global memberi gambaran awal hari ini." },
                      { label: "Coba cari saham", value: "Masukkan kode saham yang ingin kamu pantau." },
                      { label: "Buka akses lengkap", value: "Daftar saat ingin membaca grafik dan riset saham lebih dalam." },
                    ]
                ).map((row) => (
                  <div key={row.label} className="rounded-[20px] border border-silver-200/10 bg-silver-100/[0.045] p-3.5 sm:rounded-[24px] sm:p-4">
                    <p className="text-sm font-extrabold text-silver-100">{row.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-silver-500">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-silver-200/10 bg-[oklch(11%_0.018_150_/_0.72)] py-3 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:rounded-[28px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="shrink-0 pl-4 sm:pl-5">
            <span className="rounded-full border border-orange-200/15 bg-orange-100/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-orange-200">
              Market news
            </span>
          </div>
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[oklch(11%_0.018_150)] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[oklch(11%_0.018_150)] to-transparent" />
            <div className="market-news-marquee flex w-max items-center gap-2 pr-3 sm:gap-3">
              {[...displayedMarketNews, ...displayedMarketNews].map((item, index) => (
                <a
                  key={`${item.link}-${item.title}-${index}`}
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-2 rounded-full border border-silver-200/10 bg-silver-100/[0.04] px-3 py-2 text-xs text-silver-300 transition hover:border-orange-200/25 hover:text-silver-100 sm:gap-3 sm:px-4 sm:text-sm"
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-silver-500 group-hover:text-orange-200">{item.source}</span>
                  <span className="max-w-[520px] truncate font-semibold">{item.title}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
       
      {/* 1. TOP BAR: FEAR GAUGE & US PULSE */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-4 lg:gap-6">
        <GlassCard className="flex flex-row items-center justify-between border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent !p-5 text-left sm:!p-6 lg:flex-col lg:justify-center lg:text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-silver-500 mb-2">Suhu pasar global</p>
          <div className={`text-4xl font-black tabular-nums tracking-tighter sm:text-5xl ${vixQuote ? getVixColor(vixQuote.price) : 'text-silver-700'}`}>
            {vixQuote ? vixQuote.price.toFixed(2) : "--.--"}
          </div>
          <p className={`text-[10px] font-bold uppercase mt-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 ${vixQuote ? getVixColor(vixQuote.price) : 'text-silver-700'}`}>
            {vixQuote ? getVixStatus(vixQuote.price) : "Memuat..."}
          </p>
        </GlassCard>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:col-span-3">
          {US_INDICES.map((idx) => {
            const q = usQuotes.find(u => u.ticker === idx.ticker);
            const isUp = (q?.changePercent ?? 0) >= 0;
            return (
              <GlassCard key={idx.ticker} className="border-white/5 !p-4 transition-all hover:border-white/10 sm:!p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-silver-500 uppercase tracking-widest">
                    {idx.badge === "US" ? "Bursa Amerika" : `Bursa ${idx.badge}`}
                  </span>
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
          <div ref={searchRef} className="relative mx-auto max-w-3xl">
            <div className="mb-4 text-center">
            <p className="dashboard-label text-xs font-black uppercase text-orange-300">
              {hasMemberAccess ? "Buka grafik di dashboard" : "Coba cari saham"}
            </p>
            <p className="mt-1 text-sm text-silver-500">
              {hasMemberAccess
                ? "Pilih kode saham, grafik akan muncul di bawah pencarian tanpa modal."
                : "Cari kode saham dulu. Daftar untuk melihat grafik dan detailnya."}
            </p>
          </div>
          <div className="group relative transition-all duration-500">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 to-emerald-500/20 rounded-[32px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
            <div className="relative flex items-center rounded-[24px] border border-white/10 bg-slate-900/80 px-4 py-3.5 shadow-2xl backdrop-blur-2xl transition-all focus-within:border-orange-500/40 sm:rounded-[28px] sm:px-6 sm:py-4">
              <svg className="mr-3 h-5 w-5 text-silver-500 sm:mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); handleSearch(e.target.value); }}
                placeholder="Ketik COAL, MPIX, atau kode saham lain..."
                className="w-full border-none bg-transparent text-base font-medium text-white outline-none placeholder-silver-600 focus:ring-0 sm:text-xl"
              />
              {isSearching && <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {QUICK_TICKERS.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => openStockFromSearch({ symbol: stock.symbol, name: stock.label })}
                className="rounded-full border border-silver-200/10 bg-silver-200/[0.045] px-3 py-1.5 text-xs font-black text-silver-300 transition hover:border-orange-300/35 hover:text-orange-200"
              >
                {stock.label}
              </button>
            ))}
          </div>

          {visibleSearchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-4 bg-slate-900/95 backdrop-blur-3xl border border-white/10 rounded-[32px] overflow-hidden shadow-2xl z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="p-2 space-y-1">
                {visibleSearchResults.slice(0, 6).map((res) => (
                  <button key={res.symbol} onClick={() => openStockFromSearch(res)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors group text-left">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 font-bold group-hover:bg-orange-500 group-hover:text-white transition-all">{res.symbol.replace(".JK", "")}</div>
                      <div>
                        <p className="text-silver-100 font-bold truncate">{res.name}</p>
                        <p className="text-[10px] text-silver-500 uppercase tracking-widest font-bold">{res.exchange} : {res.quoteType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`hidden rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] sm:inline-flex ${hasMemberAccess ? "bg-emerald-400/10 text-emerald-300" : "bg-orange-400/10 text-orange-300"}`}>
                        {hasMemberAccess ? "Buka grafik" : "Daftar dulu"}
                      </span>
                      <svg className="w-5 h-5 text-silver-700 group-hover:text-orange-400 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {inlineTicker && hasMemberAccess ? (
          <div className="mx-auto max-w-6xl animate-in fade-in slide-in-from-top-4 duration-300">
            <StockQuickPanel
              ticker={inlineTicker.ticker}
              fullTicker={inlineTicker.fullTicker}
              onClose={() => setInlineTicker(null)}
            />
          </div>
        ) : null}

        <section className="relative overflow-hidden rounded-[30px] border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.82)] p-3.5 shadow-[0_32px_90px_rgba(0,0,0,0.32)] sm:rounded-[42px] sm:p-6">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-orange-200/35 to-transparent" />
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="relative overflow-hidden rounded-[26px] border border-silver-200/10 bg-[oklch(16%_0.026_150_/_0.92)] p-4 sm:rounded-[32px] sm:p-5">
              <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-orange-300/10 blur-3xl" />
              <div className="relative">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-silver-500">IHSG hari ini</p>
                <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.06em] text-silver-100 tabular-nums sm:text-5xl">
                  {ihsgQuote?.price?.toLocaleString("id-ID") || "----.--"}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1.5 text-sm font-extrabold tabular-nums ${ihsgIsUp ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-300" : "border-red-300/20 bg-red-300/10 text-red-300"}`}>
                    {ihsgChangeText}
                  </span>
                  <span className="text-xs font-semibold text-silver-500">
                    {ihsgQuote ? `${ihsgIsUp ? "+" : ""}${ihsgQuote.change.toFixed(2)} poin` : "menunggu data"}
                  </span>
                </div>

                <div className="mt-8 grid gap-3">
                  {[
                    { label: "Timeframe", value: activeTimeframe.label },
                    { label: "Sumber", value: "Yahoo Finance" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-2xl border border-silver-200/10 bg-silver-100/[0.04] px-4 py-3">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-silver-500">{item.label}</span>
                      <span className="text-sm font-extrabold text-silver-200">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-silver-200/10 bg-[oklch(10%_0.017_150_/_0.72)] p-3.5 sm:rounded-[32px] sm:p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-orange-200">Market pulse</p>
                  <p className="mt-1 text-sm text-silver-500">Grafik dibuat untuk baca arah, bukan klaim data live.</p>
                </div>
                <div className="flex w-full gap-1 overflow-x-auto rounded-full border border-white/5 bg-white/[0.04] p-1.5 sm:w-auto sm:self-auto">
                  {["1D", "1W", "1M", "3M"].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setActiveTimeframe({ label: tf, range: tf === "1D" ? "1d" : tf === "1W" ? "5d" : tf === "1M" ? "1mo" : "3mo", interval: tf === "1D" ? "5m" : tf === "1W" ? "1h" : "1d" })}
                      className={`min-h-10 flex-1 rounded-full px-4 py-2 text-xs font-extrabold transition-all sm:flex-none ${activeTimeframe.label === tf ? "bg-orange-300 text-[oklch(16%_0.02_75)]" : "text-silver-500 hover:text-silver-200"}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative h-[260px] overflow-hidden rounded-[22px] border border-silver-200/10 bg-[radial-gradient(circle_at_50%_0%,rgba(251,146,60,0.09),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))] p-2 sm:h-[360px] sm:rounded-[28px] sm:p-3">
                {ihsgData.length > 0 ? (
                  <LineChart
                    data={ihsgData}
                    height={336}
                    mobileHeight={242}
                    locale="id-ID"
                    timeZone="Asia/Jakarta"
                    lineColor={ihsgIsUp ? "#34d399" : "#f87171"}
                    areaTopColor={ihsgIsUp ? "rgba(52, 211, 153, 0.24)" : "rgba(248, 113, 113, 0.22)"}
                    areaBottomColor="rgba(10, 20, 16, 0)"
                  />
                ) : (
                  <div className="h-full rounded-3xl bg-white/[0.025] animate-pulse" />
                )}
              </div>
            </div>
          </div>
        </section>
      </section>

      {/* 3. ASIA PULSE */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-silver-500 uppercase tracking-[0.3em] px-2 text-center sm:text-left">Bursa Asia</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
          {ASIA_INDICES.map((idx) => {
            const q = asiaQuotes.find(a => a.ticker === idx.ticker);
            const isUp = (q?.changePercent ?? 0) >= 0;
            return (
              <GlassCard key={idx.ticker} className="group border-white/5 !p-4 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.03] sm:!p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center text-xs font-black text-white group-hover:scale-110 transition-transform duration-500 shadow-xl border border-white/5">{idx.badge}</div>
                    <div>
                      <p className="text-sm font-bold text-silver-100">{idx.label}</p>
                      <p className="text-[10px] text-silver-500 font-bold uppercase tracking-widest">Indeks utama</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-end justify-between mt-6">
                  <p className="text-3xl font-black text-white tabular-nums group-hover:text-orange-100 transition-colors">{q ? q.price.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "---"}</p>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${isUp ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse shadow-[0_0_8px_currentColor]`} />
                    <p className="text-sm font-black">{q ? `${isUp ? "+" : ""}${q.changePercent.toFixed(2)}%` : "0.00%"}</p>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* 4. FOOTER CTA */}
      <section className="pt-8">
        <Link href={hasMemberAccess ? "/investor-tools" : "/register"}>
          <GlassCard className="group relative overflow-hidden rounded-[30px] border-white/5 bg-gradient-to-br from-orange-500/[0.05] to-transparent !p-6 transition-all duration-1000 hover:border-orange-500/20 sm:rounded-[40px] sm:!p-10">
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-orange-500/10 blur-[100px] rounded-full" />
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
              <div className="space-y-4 text-left md:text-left">
                <span className="px-4 py-1 rounded-full bg-orange-500 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                  {hasMemberAccess ? "Langkah berikutnya" : "Gabung anomalisaham"}
                </span>
                <h2 className="text-2xl font-black leading-tight text-white sm:text-3xl md:text-4xl">
                  {hasMemberAccess ? "Lanjutkan riset dengan" : "Buka akses penuh untuk"} <br/>
                  <span className="text-3xl text-orange-400 sm:text-4xl md:text-5xl">
                    {hasMemberAccess ? "alat bantu riset" : "baca saham lebih dalam"}
                  </span>
                </h2>
                <p className="text-silver-500 text-base max-w-xl font-medium">
                  {hasMemberAccess
                    ? "Setelah membaca arah pasar, lanjutkan dengan ringkasan saham, rencana risiko, dan daftar pantauan."
                    : "Daftar untuk membuka grafik saham, insight lanjutan, daftar pantauan, dan alat bantu riset."}
                </p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center self-start rounded-[22px] bg-orange-500 text-white shadow-[0_20px_50px_rgba(249,115,22,0.4)] transition-all duration-700 group-hover:scale-110 sm:h-20 sm:w-20 sm:self-auto sm:rounded-[32px]">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
            </div>
          </GlassCard>
        </Link>
      </section>

      <section className="space-y-6 pb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-orange-200">FAQ member baru</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-extrabold leading-tight tracking-[-0.04em] text-silver-100 sm:text-5xl">
              Cara baca instruksi biar nggak salah langkah.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-silver-400">
            Ini ringkasan gaya baca sinyalnya. Tetap pakai risk plan sendiri, karena tiap orang punya modal dan toleransi loss yang beda.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {FAQ_ITEMS.map((item, index) => (
            <div
              key={item.question}
              className="rounded-[24px] border border-silver-200/10 bg-[oklch(14%_0.021_145_/_0.72)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:rounded-[30px] sm:p-5"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-orange-200/15 bg-orange-100/10 text-sm font-extrabold text-orange-200">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <h3 className="text-base font-extrabold leading-snug text-silver-100">{item.question}</h3>
                  <p className="mt-2 text-sm leading-7 text-silver-400">{item.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>

    {lockedTicker && (
      <PublicChartCtaModal
        ticker={lockedTicker}
        isLoggedIn={Boolean(user)}
        onClose={() => setLockedTicker(null)}
      />
    )}
    </>
  );
}
