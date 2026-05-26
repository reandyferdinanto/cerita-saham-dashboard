"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
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
    <div className="dashboard-typography mx-auto max-w-7xl space-y-14 px-3 py-6 sm:space-y-20 sm:px-4 sm:py-10">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-[oklch(13%_0.018_150)] sm:rounded-[36px]">
        {/* Subtle radial accent — single warm bloom */}
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 88% 0%, oklch(72% 0.13 70 / 0.14), transparent 60%), radial-gradient(ellipse 40% 50% at 0% 100%, oklch(56% 0.08 154 / 0.10), transparent 60%)",
          }}
        />
        {/* Hairline grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] lg:gap-14 lg:p-14">
          {/* LEFT: Editorial */}
          <div className="flex min-h-0 flex-col justify-between lg:min-h-[420px]">
            <div>
              {/* Eyebrow with hairline + dot */}
              <div className="mb-7 flex items-center gap-3">
                <span className="h-[1px] w-8 bg-amber-300/40" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-200/90">
                  {dashboardMode.eyebrow}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-silver-500">
                  · {dashboardMode.badge}
                </span>
              </div>

              <h1 className="max-w-4xl text-[2.4rem] font-bold leading-[0.96] tracking-[-0.045em] text-silver-100 sm:text-[3.2rem] lg:text-[4.4rem]">
                {dashboardMode.headline}
              </h1>
              <p className="mt-7 max-w-2xl text-[15px] leading-[1.75] text-silver-400 sm:text-base">
                {dashboardMode.body}
              </p>
            </div>

            {/* Refined CTAs */}
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={hasMemberAccess ? "/search" : "/register"}
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-amber-300 px-6 py-3 text-[13px] font-bold text-[#1c1308] transition hover:bg-amber-200"
              >
                {hasMemberAccess ? "Cari saham sekarang" : "Daftar sekarang"}
                <svg className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/insights"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-[13px] font-semibold text-silver-300 transition hover:border-white/20 hover:text-silver-100"
              >
                Baca insight
              </Link>
            </div>
          </div>

          {/* RIGHT: refined sidebar */}
          <div className="flex flex-col">
            <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.32em] text-silver-500">
              {hasMemberAccess ? "Lanjutkan pantauan" : "Yang bisa dicek di sini"}
            </p>
            <div className="space-y-px overflow-hidden rounded-[20px] border border-white/[0.06] bg-white/[0.015]">
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
              ).map((row, idx) => (
                <div key={row.label} className="group relative px-5 py-4 transition hover:bg-white/[0.02]">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-silver-100">{row.label}</p>
                    <span className="text-[10px] font-semibold tabular-nums text-silver-600">{String(idx + 1).padStart(2, "0")}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-silver-500">{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MARKET NEWS TICKER */}
      <section className="overflow-hidden border-y border-white/[0.06] py-3.5">
        <div className="flex items-center gap-5">
          <div className="shrink-0 flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-silver-400">Market wire</span>
          </div>
          <div className="hidden h-3 w-px bg-white/10 sm:block" />
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[oklch(15%_0.022_160)] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[oklch(15%_0.022_160)] to-transparent" />
            <div className="market-news-marquee flex w-max items-center gap-6 pr-6">
              {[...displayedMarketNews, ...displayedMarketNews].map((item, index) => (
                <a
                  key={`${item.link}-${item.title}-${index}`}
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-3 text-[13px] text-silver-400 transition hover:text-silver-100"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-silver-600 group-hover:text-amber-300">{item.source}</span>
                  <span className="h-1 w-1 rounded-full bg-silver-700" />
                  <span className="max-w-[460px] truncate">{item.title}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
       
      {/* MARKET TEMPERATURE */}
      <section>
        <div className="mb-6 flex items-center gap-3">
          <span className="h-[1px] w-8 bg-amber-300/40" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-silver-500">Suhu pasar</span>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[24px] border border-white/[0.06] bg-white/[0.015] lg:grid-cols-4">
          {/* VIX hero metric */}
          <div className="relative overflow-hidden bg-[oklch(13%_0.018_150)] p-6 sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-silver-500">Suhu pasar global</p>
            <div className="mt-6 flex items-baseline gap-3">
              <span className={`text-[3.4rem] font-bold tabular-nums leading-none tracking-[-0.04em] ${vixQuote ? getVixColor(vixQuote.price) : 'text-silver-700'}`}>
                {vixQuote ? vixQuote.price.toFixed(2) : "--.--"}
              </span>
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-silver-600">VIX</span>
            </div>
            <p className={`mt-4 text-xs font-semibold uppercase tracking-[0.18em] ${vixQuote ? getVixColor(vixQuote.price) : 'text-silver-700'}`}>
              {vixQuote ? getVixStatus(vixQuote.price) : "Memuat..."}
            </p>
          </div>

          {/* US Indices */}
          {US_INDICES.map((idx) => {
            const q = usQuotes.find(u => u.ticker === idx.ticker);
            const isUp = (q?.changePercent ?? 0) >= 0;
            return (
              <div key={idx.ticker} className="group relative bg-[oklch(13%_0.018_150)] p-6 transition hover:bg-[oklch(14%_0.018_150)] sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-silver-500">
                    {idx.badge === "US" ? "Bursa Amerika" : `Bursa ${idx.badge}`}
                  </span>
                  <span className={`h-1.5 w-1.5 rounded-full ${isUp ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                </div>
                <p className="mt-2 text-sm font-semibold text-silver-200">{idx.label}</p>
                <p className="mt-6 text-3xl font-bold tabular-nums tracking-[-0.03em] text-silver-100">
                  {q ? q.price.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "---"}
                </p>
                <p className={`mt-2 text-xs font-semibold tabular-nums ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                  {q ? `${isUp ? "+" : ""}${q.changePercent.toFixed(2)}%` : "0.00%"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* SEARCH + IHSG */}
      <section className="space-y-12">
        {/* Editorial search */}
        <div ref={searchRef} className="relative mx-auto max-w-3xl">
          <div className="mb-6 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-300/90">
              {hasMemberAccess ? "Buka grafik di dashboard" : "Coba cari saham"}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-silver-500">
              {hasMemberAccess
                ? "Pilih kode saham, grafik akan muncul di bawah pencarian tanpa modal."
                : "Cari kode saham dulu. Daftar untuk melihat grafik dan detailnya."}
            </p>
          </div>

          <div className="group relative">
            <div className="relative flex items-center gap-4 rounded-[20px] border border-white/[0.08] bg-white/[0.02] px-5 py-4 transition focus-within:border-amber-300/40 focus-within:bg-white/[0.03] sm:px-6 sm:py-5">
              <svg className="h-4 w-4 text-silver-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); handleSearch(e.target.value); }}
                placeholder="Ketik COAL, MPIX, atau kode saham lain"
                className="w-full border-none bg-transparent text-base font-medium tracking-tight text-silver-100 outline-none placeholder-silver-600 focus:ring-0 sm:text-lg"
              />
              {isSearching && <div className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-silver-700 border-t-amber-300" />}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {QUICK_TICKERS.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => openStockFromSearch({ symbol: stock.symbol, name: stock.label })}
                className="rounded-full border border-white/[0.08] px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-silver-400 transition hover:border-amber-300/40 hover:text-amber-200"
              >
                {stock.label}
              </button>
            ))}
          </div>

          {visibleSearchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-[100] mt-3 overflow-hidden rounded-[20px] border border-white/[0.08] bg-[oklch(13%_0.018_150_/_0.97)] shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-px">
                {visibleSearchResults.slice(0, 6).map((res) => (
                  <button key={res.symbol} onClick={() => openStockFromSearch(res)}
                    className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.025]">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-[11px] font-bold tracking-wide text-amber-300 transition group-hover:border-amber-300/30 group-hover:text-amber-200">
                        {res.symbol.replace(".JK", "")}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-silver-100">{res.name}</p>
                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-silver-600">{res.exchange} · {res.quoteType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`hidden text-[10px] font-semibold uppercase tracking-[0.18em] sm:inline ${hasMemberAccess ? "text-emerald-400" : "text-amber-300"}`}>
                        {hasMemberAccess ? "Buka grafik" : "Daftar dulu"}
                      </span>
                      <svg className="h-4 w-4 text-silver-600 transition group-hover:translate-x-0.5 group-hover:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
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

        {/* IHSG flagship card */}
        <section className="relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-[oklch(13%_0.018_150)] sm:rounded-[36px]">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 50% 40% at 50% 0%, rgba(251,191,36,0.06), transparent 60%)" }} />

          <div className="relative grid gap-px lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-0">
            {/* Price column */}
            <div className="relative border-b border-white/[0.06] p-7 sm:p-9 lg:border-b-0 lg:border-r">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-silver-500">IHSG hari ini</p>
              <h2 className="mt-7 text-[3.6rem] font-bold leading-none tracking-[-0.05em] tabular-nums text-silver-100 sm:text-[4.2rem]">
                {ihsgQuote?.price?.toLocaleString("id-ID") || "----.--"}
              </h2>
              <div className="mt-5 flex items-baseline gap-3">
                <span className={`text-base font-bold tabular-nums ${ihsgIsUp ? "text-emerald-400" : "text-rose-400"}`}>
                  {ihsgChangeText}
                </span>
                <span className="text-xs font-medium tabular-nums text-silver-500">
                  {ihsgQuote ? `${ihsgIsUp ? "+" : ""}${ihsgQuote.change.toFixed(2)} pts` : "menunggu data"}
                </span>
              </div>

              <div className="mt-10 space-y-3">
                {[
                  { label: "Timeframe", value: activeTimeframe.label },
                  { label: "Sumber", value: "Yahoo Finance" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between border-t border-white/[0.06] pt-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-silver-600">{item.label}</span>
                    <span className="text-xs font-semibold text-silver-300">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart column */}
            <div className="p-5 sm:p-7">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-300/90">Market pulse</p>
                  <p className="mt-2 text-xs leading-relaxed text-silver-500">Grafik dibuat untuk baca arah, bukan klaim data live.</p>
                </div>
                <div className="flex w-full gap-1 overflow-x-auto rounded-full border border-white/[0.08] p-1 sm:w-auto">
                  {["1D", "1W", "1M", "3M"].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setActiveTimeframe({ label: tf, range: tf === "1D" ? "1d" : tf === "1W" ? "5d" : tf === "1M" ? "1mo" : "3mo", interval: tf === "1D" ? "5m" : tf === "1W" ? "1h" : "1d" })}
                      className={`min-h-9 flex-1 rounded-full px-4 text-[11px] font-bold tracking-wide transition sm:flex-none ${activeTimeframe.label === tf ? "bg-amber-300 text-[#1c1308]" : "text-silver-500 hover:text-silver-200"}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative h-[280px] overflow-hidden rounded-[20px] border border-white/[0.06] bg-white/[0.012] p-2 sm:h-[380px] sm:p-3">
                {ihsgData.length > 0 ? (
                  <LineChart
                    data={ihsgData}
                    height={356}
                    mobileHeight={262}
                    locale="id-ID"
                    timeZone="Asia/Jakarta"
                    lineColor={ihsgIsUp ? "#34d399" : "#fb7185"}
                    areaTopColor={ihsgIsUp ? "rgba(52, 211, 153, 0.18)" : "rgba(251, 113, 133, 0.18)"}
                    areaBottomColor="rgba(10, 20, 16, 0)"
                  />
                ) : (
                  <div className="h-full animate-pulse rounded-2xl bg-white/[0.025]" />
                )}
              </div>
            </div>
          </div>
        </section>
      </section>

      {/* ASIA INDICES */}
      <section>
        <div className="mb-6 flex items-center gap-3">
          <span className="h-[1px] w-8 bg-amber-300/40" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-silver-500">Bursa Asia</span>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[24px] border border-white/[0.06] bg-white/[0.015] sm:grid-cols-3">
          {ASIA_INDICES.map((idx) => {
            const q = asiaQuotes.find(a => a.ticker === idx.ticker);
            const isUp = (q?.changePercent ?? 0) >= 0;
            return (
              <div key={idx.ticker} className="group relative bg-[oklch(13%_0.018_150)] p-7 transition hover:bg-[oklch(14%_0.018_150)] sm:p-8">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] text-[10px] font-bold tracking-wider text-silver-300">
                      {idx.badge}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-silver-100">{idx.label}</p>
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-silver-600">Indeks utama</p>
                    </div>
                  </div>
                  <span className={`h-1.5 w-1.5 rounded-full ${isUp ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                </div>
                <div className="mt-8 flex items-end justify-between">
                  <p className="text-3xl font-bold tabular-nums tracking-[-0.03em] text-silver-100">
                    {q ? q.price.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "---"}
                  </p>
                  <p className={`text-sm font-bold tabular-nums ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                    {q ? `${isUp ? "+" : ""}${q.changePercent.toFixed(2)}%` : "0.00%"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section>
        <Link href={hasMemberAccess ? "/investor-tools" : "/register"}>
          <div className="group relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-[oklch(13%_0.018_150)] p-7 transition hover:border-amber-300/20 sm:rounded-[32px] sm:p-12">
            <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 50% 100% at 100% 50%, rgba(251,191,36,0.05), transparent 70%)" }} />
            <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <div className="space-y-4 max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="h-[1px] w-8 bg-amber-300/40" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-300/90">
                    {hasMemberAccess ? "Langkah berikutnya" : "Gabung anomalisaham"}
                  </span>
                </div>
                <h2 className="text-3xl font-bold leading-[1.05] tracking-[-0.04em] text-silver-100 sm:text-4xl md:text-[2.6rem]">
                  {hasMemberAccess ? "Lanjutkan riset dengan " : "Buka akses penuh untuk "}
                  <span className="text-amber-300">
                    {hasMemberAccess ? "alat bantu riset" : "baca saham lebih dalam"}
                  </span>
                  .
                </h2>
                <p className="max-w-xl text-sm leading-relaxed text-silver-500">
                  {hasMemberAccess
                    ? "Setelah membaca arah pasar, lanjutkan dengan ringkasan saham, rencana risiko, dan daftar pantauan."
                    : "Daftar untuk membuka grafik saham, insight lanjutan, daftar pantauan, dan alat bantu riset."}
                </p>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/[0.08] text-silver-300 transition group-hover:border-amber-300/40 group-hover:bg-amber-300 group-hover:text-[#1c1308] sm:h-16 sm:w-16">
                <svg className="h-5 w-5 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* FAQ */}
      <section className="space-y-10 pb-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className="h-[1px] w-8 bg-amber-300/40" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-300/90">FAQ member baru</span>
            </div>
            <h2 className="max-w-2xl text-3xl font-bold leading-[1.05] tracking-[-0.04em] text-silver-100 sm:text-[2.4rem]">
              Cara baca instruksi biar nggak salah langkah.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-silver-500">
            Ini ringkasan gaya baca sinyalnya. Tetap pakai risk plan sendiri, karena tiap orang punya modal dan toleransi loss yang beda.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-[24px] border border-white/[0.06] bg-white/[0.015] md:grid-cols-2">
          {FAQ_ITEMS.map((item, index) => (
            <div
              key={item.question}
              className="bg-[oklch(13%_0.018_150)] p-7 transition hover:bg-[oklch(14%_0.018_150)] sm:p-9"
            >
              <div className="flex items-baseline gap-4">
                <span className="text-[10px] font-semibold tabular-nums tracking-wider text-amber-300/90">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold leading-snug text-silver-100">{item.question}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-silver-400">{item.answer}</p>
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
