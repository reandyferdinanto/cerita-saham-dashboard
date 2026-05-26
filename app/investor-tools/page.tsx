"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import GlassCard from "@/components/ui/GlassCard";
import { useAuth } from "@/components/ui/AuthProvider";
import type { TechnicalResult } from "@/lib/technicalSignals";

type Quote = { ticker: string; name: string; price: number; changePercent: number };
type NewsItem = {
  title: string;
  sentiment: "positive" | "negative" | "neutral";
  sentimentReason: string;
  pubDate: string;
};
type LevelComparison = {
  price: number;
  strength: number;
  differenceFromSL?: number;
  differencePercentFromSL?: number;
  differenceFromTP?: number;
  differencePercentFromTP?: number;
  note: string;
};
type RiskResult = {
  ticker?: string;
  shares: number;
  lots: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  positionValue: number;
  riskPerShare: number;
  rewardPerShare: number;
  maxLoss: number;
  potentialProfit: number;
  riskRewardRatio: number;
  profitPercent: number;
  lossPercent: number;
  supportComparison1h: LevelComparison | null;
  resistanceComparison1h: LevelComparison | null;
  supportComparison: LevelComparison | null;
  resistanceComparison: LevelComparison | null;
};
type AiBriefFundamental = {
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  trailingPE: number | null;
  priceToBook: number | null;
  beta: number | null;
  dividendYield: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  profitMargin: number | null;
  roe: number | null;
  debtToEquity: number | null;
  recommendationMean: number | null;
  numberOfAnalysts: number | null;
  insidersPercentHeld: number | null;
  institutionsPercentHeld: number | null;
  longBusinessSummary: string | null;
};

type AiBriefAccumulation = {
  available: boolean;
  ticker: string;
  daysAnalyzed: number;
  latestTradeDate: string | null;
  totalNetForeign: number;
  positiveForeignDays: number;
  negativeForeignDays: number;
  largestForeignBuyDay: { date: string; netForeign: number } | null;
  largestForeignSellDay: { date: string; netForeign: number } | null;
  averageDailyValue: number;
  averageDailyVolume: number;
  averageBidOfferRatio: number | null;
  closeNearHighDays: number;
  foreignAccumulationLabel: "Akumulasi Kuat" | "Akumulasi Moderat" | "Netral" | "Distribusi Moderat" | "Distribusi Kuat";
  domesticPressureLabel: "Tekanan Beli Kuat" | "Tekanan Beli Moderat" | "Netral" | "Tekanan Jual Moderat" | "Tekanan Jual Kuat";
  summary: string;
};

type AiBriefResponse = {
  ticker: string;
  name: string;
  brief: string;
  usedAI: boolean;
  quote: Quote;
  technical: TechnicalResult;
  news: NewsItem[];
  sectorNews?: NewsItem[];
  fundamental?: AiBriefFundamental | null;
  accumulation?: AiBriefAccumulation | null;
  newsFromCache?: boolean;
};
type Settings = { enabledInvestorTools?: string[] };
type RightsIssueResult = {
  oldShares: number;
  newShares: number;
  totalShares: number;
  oldValue: number;
  rightsCost: number;
  totalCost: number;
  terp: number;
  averagePrice: number;
};
type StockSplitResult = {
  oldShares: number;
  newShares: number;
  oldPrice: number;
  theoreticalPrice: number;
  oldValue: number;
  newValue: number;
  ratioText: string;
};
type RadarWatchlistRow = {
  ticker: string;
  name: string;
  tp: number | null;
  sl: number | null;
  bandarmology: string;
  price: number;
  changePercent: number;
};
type ToolKey =
  | "overview"
  | "aiBrief"
  | "riskCalculator"
  | "investorScreener"
  | "rightsIssueCalculator"
  | "stockSplitCalculator";

const currency = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;
const shortTicker = (ticker: string) => ticker.replace(".JK", "");
const INVESTOR_SCREENER_PRESETS = [
  { value: "under300", label: "Harga Murah", note: "Radar utama untuk saham murah yang masih dijaga." },
] as const;
const PRICE_BUCKET_OPTIONS = [
  { value: "all", label: "Semua" },
] as const;
const TOOL_LABELS: Record<ToolKey, string> = {
  overview: "Overview",
  aiBrief: "AI Brief",
  riskCalculator: "Risk Calculator",
  investorScreener: "Radar Watchlist",
  rightsIssueCalculator: "Right Issue",
  stockSplitCalculator: "Stock Split",
};

export default function InvestorToolsPage() {
  const { user, loading } = useAuth();
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTool, setActiveTool] = useState<ToolKey>("overview");
  const [aiBrief, setAiBrief] = useState<AiBriefResponse | null>(null);
  const [aiBriefLoading, setAiBriefLoading] = useState(false);
  const [briefTicker, setBriefTicker] = useState("LABS");
  const [riskForm, setRiskForm] = useState({ ticker: "", lots: "1", entryPrice: "", stopLoss: "", targetPrice: "" });
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [riskQuote, setRiskQuote] = useState<Quote | null>(null);
  const [riskQuoteLoading, setRiskQuoteLoading] = useState(false);
  const [rightsForm, setRightsForm] = useState({ shares: "", avgPrice: "", ratioOld: "5", ratioNew: "1", rightsPrice: "" });
  const [rightsResult, setRightsResult] = useState<RightsIssueResult | null>(null);
  const [splitForm, setSplitForm] = useState({ shares: "", price: "", splitOld: "1", splitNew: "5" });
  const [splitResult, setSplitResult] = useState<StockSplitResult | null>(null);
  const [enabledTools, setEnabledTools] = useState<string[]>([
    "aiBrief",
    "riskCalculator",
    "rightsIssueCalculator",
    "stockSplitCalculator",
    "investorScreener",
  ]);

  const [screenerLoading, setScreenerLoading] = useState(false);
  const [screenerError, setScreenerError] = useState("");
  const [screenerRows, setScreenerRows] = useState<RadarWatchlistRow[]>([]);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data: Settings) => {
        if (Array.isArray(data.enabledInvestorTools) && data.enabledInvestorTools.length > 0) {
          setEnabledTools(data.enabledInvestorTools);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || !enabledTools.includes("investorScreener")) return;

    let cancelled = false;

    async function loadScreener() {
      try {
        setScreenerLoading(true);
        setScreenerError("");
        const wlRes = await fetch("/api/watchlist");
        const wlData = await wlRes.json();
        
        const rows = await Promise.all(
          (Array.isArray(wlData) ? wlData : []).map(async (stock: any) => {
            try {
              const quoteRes = await fetch(`/api/stocks/quote/${encodeURIComponent(stock.ticker)}`);
              const quote = await quoteRes.json();
              return { ...stock, price: quote.price || 0, changePercent: quote.changePercent || 0 };
            } catch {
              return { ...stock, price: 0, changePercent: 0 };
            }
          })
        );
        
        if (!cancelled) setScreenerRows(rows);
      } catch (error) {
        if (!cancelled) {
          setScreenerRows([]);
          setScreenerError(error instanceof Error ? error.message : "Radar watchlist gagal dimuat");
        }
      } finally {
        if (!cancelled) setScreenerLoading(false);
      }
    }

    void loadScreener();
    return () => {
      cancelled = true;
    };
  }, [enabledTools, user]);

  const enabledToolCards = useMemo(() => {
    const cards: Array<{ key: ToolKey; eyebrow: string; title: string; desc: string; accent: string }> = [
      { key: "aiBrief", eyebrow: "Baca cepat", title: "AI Brief anomalisaham", desc: "Ringkasan yang tidak cuma bilang bullish atau bearish, tapi apakah setup-nya masih enak disentuh sekarang.", accent: "#fb923c" },
      { key: "riskCalculator", eyebrow: "Jaga risiko", title: "Risk Calculator", desc: "Masukkan lots, entry, TP, dan SL lalu lihat apakah skenarionya realistis terhadap support-resistance.", accent: "#c084fc" },
      { key: "investorScreener", eyebrow: "Pantau kandidat", title: "Radar Watchlist", desc: "Shortlist dari watchlist aktif Anda, lengkap dengan akses cepat ke AI Brief dan kalkulasi skenario.", accent: "#10b981" },
      { key: "rightsIssueCalculator", eyebrow: "Corporate action", title: "Right Issue", desc: "Hitung saham tambahan, biaya tebus, dan average price baru tanpa ribet hitung manual.", accent: "#86efac" },
      { key: "stockSplitCalculator", eyebrow: "Corporate action", title: "Stock Split", desc: "Lihat dampak split ke jumlah saham dan harga teoritis supaya tidak salah baca value portofolio.", accent: "#93c5fd" },
    ];

    return cards.filter((card) => enabledTools.includes(card.key));
  }, [enabledTools]);


  const handleGenerateBrief = async (event: FormEvent) => {
    event.preventDefault();
    setAiBriefLoading(true);
    setErrorMessage("");
    setActiveTool("aiBrief");

    try {
      const res = await fetch("/api/investor/ai-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: briefTicker }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI brief gagal");
      setAiBrief(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "AI brief gagal");
    } finally {
      setAiBriefLoading(false);
    }
  };

  const handleRiskCalculate = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setActiveTool("riskCalculator");

    if (Number(riskForm.entryPrice) > 0 && Number(riskForm.stopLoss) >= Number(riskForm.entryPrice)) {
      setErrorMessage("Level Stop Loss tidak boleh sama atau lebih tinggi dari harga Entry.");
      return;
    }

    try {
      const res = await fetch("/api/investor/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: riskForm.ticker,
          lots: Number(riskForm.lots),
          entryPrice: Number(riskForm.entryPrice),
          stopLoss: Number(riskForm.stopLoss),
          targetPrice: Number(riskForm.targetPrice),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Risk calculator gagal");
      setRiskResult(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Risk calculator gagal");
    }
  };

  const handleRiskTickerChange = async (value: string) => {
    const nextTicker = value.toUpperCase();
    setRiskForm((current) => ({ ...current, ticker: nextTicker }));
    setRiskQuote(null);

    const trimmed = nextTicker.trim();
    if (!trimmed) return;

    setRiskQuoteLoading(true);
    try {
      const normalizedTicker = trimmed.endsWith(".JK") ? trimmed : `${trimmed}.JK`;
      const res = await fetch(`/api/stocks/quote/${encodeURIComponent(normalizedTicker)}`);
      const data = (await res.json()) as Quote | { error?: string };
      if (!res.ok || !("price" in data)) return;

      setRiskQuote(data);
      setRiskForm((current) => ({
        ...current,
        ticker: trimmed,
        entryPrice: current.entryPrice || String(data.price),
      }));
    } catch {
      return;
    } finally {
      setRiskQuoteLoading(false);
    }
  };

  const applyRiskTemplate = (type: "tight" | "balanced" | "wide") => {
    if (!riskQuote) return;
    const entry = Number(riskForm.entryPrice || riskQuote.price);
    const stopPercent = type === "tight" ? 0.04 : type === "balanced" ? 0.06 : 0.08;
    const targetPercent = type === "tight" ? 0.08 : type === "balanced" ? 0.12 : 0.18;
    setRiskForm((current) => ({
      ...current,
      entryPrice: current.entryPrice || String(entry),
      stopLoss: String(Math.max(1, Math.round(entry * (1 - stopPercent)))),
      targetPrice: String(Math.round(entry * (1 + targetPercent))),
    }));
  };

  const handleRightsCalculate = (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setActiveTool("rightsIssueCalculator");

    const oldShares = Number(rightsForm.shares || 0);
    const avgPrice = Number(rightsForm.avgPrice || 0);
    const ratioOld = Number(rightsForm.ratioOld || 0);
    const ratioNew = Number(rightsForm.ratioNew || 0);
    const rightsPrice = Number(rightsForm.rightsPrice || 0);

    if (oldShares <= 0 || avgPrice <= 0 || ratioOld <= 0 || ratioNew <= 0 || rightsPrice <= 0) {
      setErrorMessage("Input calculator right issue tidak valid");
      return;
    }

    const newShares = Math.floor((oldShares / ratioOld) * ratioNew);
    const totalShares = oldShares + newShares;
    const oldValue = oldShares * avgPrice;
    const rightsCost = newShares * rightsPrice;
    const totalCost = oldValue + rightsCost;
    const terp = totalCost / totalShares;

    setRightsResult({ oldShares, newShares, totalShares, oldValue, rightsCost, totalCost, terp, averagePrice: terp });
  };

  const handleSplitCalculate = (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setActiveTool("stockSplitCalculator");

    const oldShares = Number(splitForm.shares || 0);
    const oldPrice = Number(splitForm.price || 0);
    const splitOld = Number(splitForm.splitOld || 0);
    const splitNew = Number(splitForm.splitNew || 0);

    if (oldShares <= 0 || oldPrice <= 0 || splitOld <= 0 || splitNew <= 0) {
      setErrorMessage("Input calculator stock split tidak valid");
      return;
    }

    const newShares = Math.floor((oldShares / splitOld) * splitNew);
    const theoreticalPrice = (oldPrice * splitOld) / splitNew;
    const oldValue = oldShares * oldPrice;
    const newValue = newShares * theoreticalPrice;

    setSplitResult({ oldShares, newShares, oldPrice, theoreticalPrice, oldValue, newValue, ratioText: `${splitOld}:${splitNew}` });
  };

  if (loading) {
    return <div className="min-h-[40vh] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" /></div>;
  }

  if (!user) {
    return (
      <GlassCard hover={false}>
        <h1 className="text-2xl font-bold text-silver-100">Investor Tools</h1>
        <p className="text-silver-400 mt-2">Masuk dulu untuk membuka workspace investor anomalisaham.</p>
        <Link href="/login" className="inline-block mt-4 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "linear-gradient(135deg,#ea580c,#fb923c)", color: "#fff" }}>
          Masuk Sekarang
        </Link>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[28px] p-6 sm:p-8" style={{ background: "radial-gradient(circle at top left, rgba(249,115,22,0.18), transparent 30%), linear-gradient(145deg, rgba(2,6,23,0.92), rgba(15,23,42,0.88))", border: "1px solid rgba(251,146,60,0.14)" }}>
        <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none" style={{ background: "radial-gradient(circle at center, rgba(16,185,129,0.12), transparent 55%)" }} />
        <div className="relative grid grid-cols-1 xl:grid-cols-[1.25fr_0.9fr] gap-6 items-start">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-orange-400">anomalisaham Investor Workspace</p>
            <h1 className="text-3xl md:text-4xl font-bold text-silver-100 mt-2 leading-tight">Tools yang membantu membaca cerita gerak, bukan cuma menghitung angka.</h1>
            <p className="text-sm text-silver-400 mt-3 max-w-2xl leading-7">Mulai dari radar kandidat, cek AI brief dengan konteks anomalisaham, lalu kunci skenario entry lewat risk calculator. Semua dibuat lebih cepat dibaca dan lebih dekat ke workflow real investor ritel.</p>
            <div className="flex flex-wrap gap-2 mt-5">
              {["Overview", "AI lebih kontekstual", "Risk plan lebih cepat", "Radar watchlist member"].map((item) => (
                <span key={item} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "rgba(255,255,255,0.04)", color: "#cbd5e1", border: "1px solid rgba(226,232,240,0.08)" }}>{item}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <HeroMetric title="Mulai dari" value="Radar Watchlist" helper="Buka shortlist dulu sebelum tenggelam di detail." accent="#10b981" />
            <HeroMetric title="AI Brief" value="Lebih Smart" helper="Baca setup, bukan sekadar sentimen generik." accent="#fb923c" />
            <HeroMetric title="Risk Plan" value="1 Halaman" helper="Entry, TP, SL, dan level pembanding jadi lebih cepat." accent="#c084fc" />
            <HeroMetric title="Filosofi" value="anomalisaham" helper="Fokus ke anomali akumulasi dan kualitas area entry." accent="#93c5fd" />
          </div>
        </div>
      </section>

      {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}
      <section className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.35fr] gap-6">
        <GlassCard hover={false}>
          <SectionTitle title="Pilih Jalur Kerja" subtitle="Tiap tool sekarang punya peran yang lebih jelas, jadi Anda tidak perlu mulai dari nol setiap kali buka halaman ini." />
          <div className="space-y-3">
            {enabledToolCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => setActiveTool(card.key)}
                className="w-full text-left rounded-2xl p-4 transition-all"
                style={{
                  background: activeTool === card.key ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${activeTool === card.key ? `${card.accent}33` : "rgba(226,232,240,0.05)"}`,
                }}
              >
                <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: card.accent }}>{card.eyebrow}</p>
                <p className="text-sm font-semibold text-silver-100 mt-1">{card.title}</p>
                <p className="text-xs text-silver-400 mt-2 leading-6">{card.desc}</p>
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard hover={false}>
          <SectionTitle title="Cara Pakai Cepat" subtitle="Urutan yang paling aman untuk workflow harian investor anomalisaham." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <WorkflowCard step="1" title="Scan kandidat" body="Mulai dari Radar Watchlist untuk merangkum hasil kerja watchlist Anda secara cepat." accent="#10b981" />
            <WorkflowCard step="2" title="Baca konteks" body="Buka AI Brief untuk tahu apakah setup-nya masih enak, terlalu panas, atau justru masih layak pantau." accent="#fb923c" />
            <WorkflowCard step="3" title="Kunci skenario" body="Masuk ke Risk Calculator agar entry, TP, dan SL lebih realistis terhadap level teknikal." accent="#c084fc" />
          </div>
          <div className="mt-4 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.05)" }}>
            <p className="text-sm font-semibold text-silver-100">Tool aktif sekarang: <span style={{ color: "#fb923c" }}>{TOOL_LABELS[activeTool]}</span></p>
            <p className="text-xs text-silver-400 mt-2 leading-6">Gunakan panel di bawah sesuai kebutuhan. Anda bisa lompat antar tool kapan saja tanpa kehilangan konteks utama halaman.</p>
          </div>
        </GlassCard>
      </section>

      {enabledTools.includes("investorScreener") ? (
        <GlassCard hover={false}>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
            <SectionTitle title="Radar Watchlist Member" subtitle="Shortlist otomatis dari watchlist Anda sebelum masuk ke AI brief atau kalkulasi risiko." />
            <button type="button" onClick={() => setActiveTool("investorScreener")} className="px-4 py-2 rounded-xl text-sm font-semibold self-start" style={{ background: "rgba(16,185,129,0.12)", color: "#86efac", border: "1px solid rgba(16,185,129,0.22)" }}>
              Fokus ke Radar
            </button>
          </div>
          <p className="text-xs text-silver-500 mb-4">Radar utama untuk saham-saham pilihan yang sedang Anda pantau.</p>
          {screenerLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-36 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />)}</div>
          ) : screenerError ? (
            <EmptyText text={screenerError} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {screenerRows.map((row) => (
                <div key={row.ticker} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: activeTool === "investorScreener" ? "1px solid rgba(16,185,129,0.18)" : "1px solid rgba(226,232,240,0.06)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-silver-100">{row.ticker}</p>
                      <p className="text-xs text-silver-500 mt-1 line-clamp-2">{row.name}</p>
                    </div>
                    {row.changePercent !== undefined && (
                      <span className="text-[10px] px-2 py-1 rounded-lg font-semibold" style={{ background: row.changePercent >= 0 ? "rgba(16,185,129,0.14)" : "rgba(248,113,113,0.14)", color: row.changePercent >= 0 ? "#86efac" : "#fca5a5" }}>
                        {row.changePercent > 0 ? "+" : ""}{row.changePercent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <MiniStat label="Harga" value={currency(row.price || 0)} />
                    <MiniStat label="Target" value={row.tp ? currency(row.tp) : "-"} accent="#10b981" />
                    <MiniStat label="Stop Loss" value={row.sl ? currency(row.sl) : "-"} accent="#fca5a5" />
                  </div>
                  <p className="text-xs text-silver-400 mt-4 leading-6 line-clamp-2">{row.bandarmology || "Tidak ada catatan khusus."}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button type="button" onClick={() => { setBriefTicker(row.ticker); setActiveTool("aiBrief"); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(249,115,22,0.14)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.2)" }}>Brief-kan</button>
                    <button type="button" onClick={() => { 
                      void handleRiskTickerChange(row.ticker); 
                      setRiskForm(c => ({
                        ...c, 
                        targetPrice: row.tp ? String(row.tp) : "",
                        stopLoss: row.sl ? String(row.sl) : ""
                      }));
                      setActiveTool("riskCalculator"); 
                    }} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(168,85,247,0.14)", color: "#d8b4fe", border: "1px solid rgba(168,85,247,0.2)" }}>Buat Skenario</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      ) : null}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {enabledTools.includes("aiBrief") ? (
          <GlassCard hover={false}>
            <SectionTitle title="AI Stock Brief" subtitle="Brief ini sekarang dibangun dengan konteks teknikal, support-resistance, dan gaya baca anomalisaham." />
            <div className="flex flex-wrap gap-2 mb-4">
              {["LABS", "WIFI", "BRMS", "DOID"].map((ticker) => (
                <button key={ticker} type="button" onClick={() => { setBriefTicker(ticker); setActiveTool("aiBrief"); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: briefTicker === ticker ? "rgba(249,115,22,0.14)" : "rgba(255,255,255,0.03)", color: briefTicker === ticker ? "#fb923c" : "#94a3b8", border: `1px solid ${briefTicker === ticker ? "rgba(249,115,22,0.22)" : "rgba(226,232,240,0.06)"}` }}>
                  {ticker}
                </button>
              ))}
            </div>
            <form className="flex flex-col md:flex-row gap-3 mb-4" onSubmit={handleGenerateBrief}>
              <Input value={briefTicker} onChange={setBriefTicker} placeholder="Contoh: LABS" />
              <button type="submit" disabled={aiBriefLoading} className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60" style={{ background: "linear-gradient(135deg,#ea580c,#fb923c)", color: "#fff" }}>
                {aiBriefLoading ? "Menyusun brief..." : "Buat Brief"}
              </button>
            </form>
            {aiBrief ? (
              <div className="space-y-4">
                <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${activeTool === "aiBrief" ? "rgba(249,115,22,0.16)" : "rgba(226,232,240,0.08)"}` }}>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <p className="text-sm font-bold text-silver-100">{shortTicker(aiBrief.ticker)} - {aiBrief.name}</p>
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: aiBrief.usedAI ? "rgba(16,185,129,0.14)" : "rgba(59,130,246,0.14)", color: aiBrief.usedAI ? "#86efac" : "#93c5fd" }}>
                      {aiBrief.usedAI ? "anomalisaham AI" : "Brief Otomatis"}
                    </span>
                    <span className="text-xs text-silver-400">{currency(aiBrief.quote.price)} · {aiBrief.quote.changePercent.toFixed(2)}%</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <MiniStat label="Sinyal" value={aiBrief.technical.conclusionTitle} accent="#fb923c" />
                    <MiniStat label="Skor" value={`${aiBrief.technical.score}/100`} accent="#10b981" />
                    <MiniStat label="Action" value={aiBrief.technical.actionBias} accent="#93c5fd" />
                  </div>
                  <BriefContent text={aiBrief.brief} />
                </div>

                {/* Fundamental snapshot */}
                {aiBrief.fundamental && (aiBrief.fundamental.trailingPE != null || aiBrief.fundamental.marketCap != null) ? (
                  <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.08)" }}>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="text-sm font-semibold text-silver-100">Fundamental Snapshot</p>
                      {aiBrief.fundamental.sector ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd" }}>
                          {aiBrief.fundamental.sector}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {aiBrief.fundamental.marketCap != null ? (
                        <div>
                          <p className="text-silver-500">Market Cap</p>
                          <p className="font-semibold text-silver-100">
                            {aiBrief.fundamental.marketCap >= 1e12
                              ? `Rp ${(aiBrief.fundamental.marketCap / 1e12).toFixed(2)} T`
                              : `Rp ${(aiBrief.fundamental.marketCap / 1e9).toFixed(2)} M`}
                          </p>
                        </div>
                      ) : null}
                      {aiBrief.fundamental.trailingPE != null ? (
                        <div>
                          <p className="text-silver-500">PE</p>
                          <p className="font-semibold text-silver-100">{aiBrief.fundamental.trailingPE.toFixed(2)}x</p>
                        </div>
                      ) : null}
                      {aiBrief.fundamental.priceToBook != null ? (
                        <div>
                          <p className="text-silver-500">PBV</p>
                          <p className="font-semibold text-silver-100">{aiBrief.fundamental.priceToBook.toFixed(2)}x</p>
                        </div>
                      ) : null}
                      {aiBrief.fundamental.beta != null ? (
                        <div>
                          <p className="text-silver-500">Beta</p>
                          <p className="font-semibold text-silver-100">{aiBrief.fundamental.beta.toFixed(2)}</p>
                        </div>
                      ) : null}
                      {aiBrief.fundamental.dividendYield != null ? (
                        <div>
                          <p className="text-silver-500">Div Yield</p>
                          <p className="font-semibold text-emerald-300">{(aiBrief.fundamental.dividendYield * 100).toFixed(2)}%</p>
                        </div>
                      ) : null}
                      {aiBrief.fundamental.roe != null ? (
                        <div>
                          <p className="text-silver-500">ROE</p>
                          <p className={`font-semibold ${aiBrief.fundamental.roe >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                            {(aiBrief.fundamental.roe * 100).toFixed(2)}%
                          </p>
                        </div>
                      ) : null}
                      {aiBrief.fundamental.revenueGrowth != null ? (
                        <div>
                          <p className="text-silver-500">Revenue Growth</p>
                          <p className={`font-semibold ${aiBrief.fundamental.revenueGrowth >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                            {(aiBrief.fundamental.revenueGrowth * 100).toFixed(2)}%
                          </p>
                        </div>
                      ) : null}
                      {aiBrief.fundamental.debtToEquity != null ? (
                        <div>
                          <p className="text-silver-500">D/E Ratio</p>
                          <p className="font-semibold text-silver-100">{aiBrief.fundamental.debtToEquity.toFixed(2)}</p>
                        </div>
                      ) : null}
                    </div>
                    {aiBrief.fundamental.recommendationMean != null ? (
                      <p className="mt-3 text-xs text-silver-400">
                        Rekomendasi analis: <span className="font-semibold text-silver-200">
                          {aiBrief.fundamental.recommendationMean <= 1.5
                            ? "Strong Buy"
                            : aiBrief.fundamental.recommendationMean <= 2.5
                              ? "Buy"
                              : aiBrief.fundamental.recommendationMean <= 3.5
                                ? "Hold"
                                : aiBrief.fundamental.recommendationMean <= 4.5
                                  ? "Sell"
                                  : "Strong Sell"}
                        </span> ({aiBrief.fundamental.recommendationMean.toFixed(2)}/5)
                        {aiBrief.fundamental.numberOfAnalysts ? `, ${aiBrief.fundamental.numberOfAnalysts} analis` : ""}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* Accumulation snapshot */}
                {aiBrief.accumulation && aiBrief.accumulation.available ? (
                  <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.08)" }}>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="text-sm font-semibold text-silver-100">Akumulasi & Foreign-Domestic Flow</p>
                      <span className="text-[11px] text-silver-500">{aiBrief.accumulation.daysAnalyzed} hari · last {aiBrief.accumulation.latestTradeDate}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      <div className="rounded-xl p-3" style={{
                        background: aiBrief.accumulation.foreignAccumulationLabel.includes("Akumulasi")
                          ? "rgba(16,185,129,0.10)"
                          : aiBrief.accumulation.foreignAccumulationLabel.includes("Distribusi")
                            ? "rgba(239,68,68,0.10)"
                            : "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(226,232,240,0.06)",
                      }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-silver-500">Foreign Flow</p>
                        <p className="text-sm font-bold mt-1" style={{
                          color: aiBrief.accumulation.foreignAccumulationLabel.includes("Akumulasi")
                            ? "#6ee7b7"
                            : aiBrief.accumulation.foreignAccumulationLabel.includes("Distribusi")
                              ? "#fca5a5"
                              : "#cbd5e1",
                        }}>
                          {aiBrief.accumulation.foreignAccumulationLabel}
                        </p>
                        <p className="text-[11px] text-silver-400 mt-1">
                          Net: {aiBrief.accumulation.totalNetForeign >= 0 ? "+" : ""}
                          {aiBrief.accumulation.totalNetForeign.toLocaleString("id-ID")} ·
                          {" "}{aiBrief.accumulation.positiveForeignDays}/{aiBrief.accumulation.daysAnalyzed} hari net buy
                        </p>
                      </div>
                      <div className="rounded-xl p-3" style={{
                        background: aiBrief.accumulation.domesticPressureLabel.includes("Beli")
                          ? "rgba(16,185,129,0.10)"
                          : aiBrief.accumulation.domesticPressureLabel.includes("Jual")
                            ? "rgba(239,68,68,0.10)"
                            : "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(226,232,240,0.06)",
                      }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-silver-500">Domestic Flow</p>
                        <p className="text-sm font-bold mt-1" style={{
                          color: aiBrief.accumulation.domesticPressureLabel.includes("Beli")
                            ? "#6ee7b7"
                            : aiBrief.accumulation.domesticPressureLabel.includes("Jual")
                              ? "#fca5a5"
                              : "#cbd5e1",
                        }}>
                          {aiBrief.accumulation.domesticPressureLabel}
                        </p>
                        <p className="text-[11px] text-silver-400 mt-1">
                          {aiBrief.accumulation.averageBidOfferRatio != null
                            ? `Bid/Offer ${aiBrief.accumulation.averageBidOfferRatio.toFixed(2)}x · `
                            : ""}
                          Close near high {aiBrief.accumulation.closeNearHighDays}/{aiBrief.accumulation.daysAnalyzed} hari
                        </p>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-silver-400">{aiBrief.accumulation.summary}</p>
                  </div>
                ) : null}
                {aiBrief.news.length > 0 ? (
                  <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.08)" }}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-sm font-semibold text-silver-100">📰 Berita Ticker (langsung mention saham)</p>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{
                        background: aiBrief.newsFromCache ? "rgba(99,102,241,0.14)" : "rgba(16,185,129,0.14)",
                        color: aiBrief.newsFromCache ? "#a5b4fc" : "#6ee7b7",
                      }}>
                        {aiBrief.newsFromCache ? "📦 Dari cache 30 hari" : "🔄 Fresh fetch"}
                      </span>
                    </div>
                    <div className="space-y-2 mt-3">
                      {aiBrief.news.slice(0, 5).map((item) => (
                        <div key={`${item.title}-${item.pubDate}`} className="rounded-xl p-3" style={{ background: "rgba(15,23,42,0.45)" }}>
                          <p className="text-xs font-semibold text-silver-100">{item.title}</p>
                          <p className="text-[11px] text-silver-500 mt-1">
                            {new Date(item.pubDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} ·{" "}
                            <span className={
                              item.sentiment === "positive" ? "text-emerald-300" :
                              item.sentiment === "negative" ? "text-red-300" : "text-silver-400"
                            }>
                              {item.sentiment}
                            </span> · {item.sentimentReason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
                    <p className="text-xs text-silver-500">Belum ada berita yang langsung menyebut ticker {shortTicker(aiBrief.ticker)} dalam 30 hari terakhir.</p>
                  </div>
                )}

                {/* Sector-relevant news (fallback when ticker-specific is sparse) */}
                {aiBrief.sectorNews && aiBrief.sectorNews.length > 0 ? (
                  <div className="rounded-2xl p-4" style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.16)" }}>
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                      <p className="text-sm font-semibold text-silver-100">
                        🌐 Konteks Sektor{aiBrief.fundamental?.sector ? ` · ${aiBrief.fundamental.sector}` : ""}
                      </p>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.16)", color: "#a5b4fc" }}>
                        Berita sektor (relevansi tidak langsung)
                      </span>
                    </div>
                    <div className="space-y-2">
                      {aiBrief.sectorNews.slice(0, 5).map((item) => (
                        <div key={`sector-${item.title}-${item.pubDate}`} className="rounded-xl p-3" style={{ background: "rgba(15,23,42,0.45)" }}>
                          <p className="text-xs font-semibold text-silver-100">{item.title}</p>
                          <p className="text-[11px] text-silver-500 mt-1">
                            {new Date(item.pubDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} · {item.sentimentReason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : <EmptyText text="Masukkan ticker lalu biarkan sistem menyusun brief singkat yang menilai apakah setup ini masih enak, sudah terlalu panas, atau masih perlu dipantau dulu." />}
          </GlassCard>
        ) : null}

        {enabledTools.includes("riskCalculator") ? (
          <GlassCard hover={false}>
            <SectionTitle title="Risk Calculator" subtitle="Buat skenario entry lebih cepat, lalu cek apakah TP dan SL Anda masih masuk akal terhadap level teknikal." />
            <form className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4" onSubmit={handleRiskCalculate}>
              <div className="md:col-span-2 space-y-2">
                <Input value={riskForm.ticker} onChange={handleRiskTickerChange} placeholder="Ticker opsional, contoh LABS" />
                <p className="text-xs text-silver-500">
                  {riskQuoteLoading
                    ? "Mengambil harga ticker saat ini..."
                    : riskQuote
                      ? `Harga terakhir ${shortTicker(riskQuote.ticker)} sekitar ${currency(riskQuote.price)} (${riskQuote.changePercent.toFixed(2)}%). Entry otomatis diisi jika masih kosong.`
                      : "Isi ticker jika ingin membandingkan TP/SL dengan support dan resistance 1H serta 4H."}
                </p>
                {riskQuote ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" onClick={() => applyRiskTemplate("tight")} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(255,255,255,0.03)", color: "#cbd5e1", border: "1px solid rgba(226,232,240,0.08)" }}>Template ketat</button>
                    <button type="button" onClick={() => applyRiskTemplate("balanced")} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(168,85,247,0.14)", color: "#d8b4fe", border: "1px solid rgba(168,85,247,0.22)" }}>Template seimbang</button>
                    <button type="button" onClick={() => applyRiskTemplate("wide")} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(249,115,22,0.14)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.22)" }}>Template agresif</button>
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Input type="number" value={riskForm.lots} onChange={(value) => setRiskForm((current) => ({ ...current, lots: value }))} placeholder="Jumlah lots" />
                <p className="text-xs text-silver-500">Di BEI, `1 lot = 100 lembar saham`.</p>
              </div>
              <Input type="number" value={riskForm.entryPrice} onChange={(value) => setRiskForm((current) => ({ ...current, entryPrice: value }))} placeholder="Harga entry" />
              <Input type="number" value={riskForm.targetPrice} onChange={(value) => setRiskForm((current) => ({ ...current, targetPrice: value }))} placeholder="Target TP" />
              <div className="flex flex-col gap-1">
                <Input type="number" value={riskForm.stopLoss} onChange={(value) => setRiskForm((current) => ({ ...current, stopLoss: value }))} placeholder="Level SL" />
                {Number(riskForm.stopLoss) > 0 && Number(riskForm.entryPrice) > 0 && Number(riskForm.stopLoss) >= Number(riskForm.entryPrice) && (
                  <p className="text-[11px] text-red-400 pt-1">Error: Stop loss tidak boleh sama atau lebih tinggi dari entry</p>
                )}
              </div>
              <button 
                type="submit" 
                disabled={Number(riskForm.stopLoss) > 0 && Number(riskForm.entryPrice) > 0 && Number(riskForm.stopLoss) >= Number(riskForm.entryPrice)}
                className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed" 
                style={{ background: "rgba(168,85,247,0.16)", color: "#d8b4fe", border: "1px solid rgba(168,85,247,0.25)" }}
              >
                Hitung Skenario
              </button>
            </form>
            {riskResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="Nilai Posisi" value={currency(riskResult.positionValue)} compact />
                  <MetricCard label="Jumlah Saham" value={`${riskResult.shares.toLocaleString("id-ID")}`} helper={`${riskResult.lots} lots`} compact />
                  <MetricCard label="Profit Jika TP" value={currency(riskResult.potentialProfit)} helper={`${riskResult.profitPercent.toFixed(2)}% dari entry`} accent="#34d399" compact />
                  <MetricCard label="Loss Jika SL" value={currency(riskResult.maxLoss)} helper={`${riskResult.lossPercent.toFixed(2)}% dari entry`} accent="#f87171" compact />
                  <MetricCard label="Reward per Share" value={currency(riskResult.rewardPerShare)} compact />
                  <MetricCard label="Risk per Share" value={currency(riskResult.riskPerShare)} compact />
                </div>
                <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.08)" }}>
                  <p className="text-sm font-semibold text-silver-100">Risk Ratio</p>
                  <p className="text-2xl font-bold text-orange-400 mt-2">1 : {riskResult.riskRewardRatio.toFixed(2)}</p>
                  <p className="text-xs text-silver-500 mt-2">Semakin besar angka di kanan, semakin menarik secara risk/reward, selama targetnya tetap realistis.</p>
                </div>
                {riskResult.ticker ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-silver-100">Pembanding Level untuk {shortTicker(riskResult.ticker)}</p>
                    <div className="grid grid-cols-1 gap-3">
                      <LevelCard title="SL vs Support 1H" levelLabel="Nearest support" comparison={riskResult.supportComparison1h} primaryValue={riskResult.stopLoss} primaryLabel="SL Anda" mode="sl" />
                      <LevelCard title="TP vs Resistance 1H" levelLabel="Nearest resistance" comparison={riskResult.resistanceComparison1h} primaryValue={riskResult.targetPrice} primaryLabel="TP Anda" mode="tp" />
                      <LevelCard title="SL vs Support 4H" levelLabel="Nearest support" comparison={riskResult.supportComparison} primaryValue={riskResult.stopLoss} primaryLabel="SL Anda" mode="sl" />
                      <LevelCard title="TP vs Resistance 4H" levelLabel="Nearest resistance" comparison={riskResult.resistanceComparison} primaryValue={riskResult.targetPrice} primaryLabel="TP Anda" mode="tp" />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : <EmptyText text="Isi lots, entry, TP, dan SL. Kalau ticker diisi, sistem juga membacakan seberapa realistis level Anda terhadap support dan resistance terdekat." />}
          </GlassCard>
        ) : null}
        {enabledTools.includes("rightsIssueCalculator") ? (
          <GlassCard hover={false}>
            <SectionTitle title="Right Issue Calculator" subtitle="Hitung saham tambahan, biaya tebus HMETD, dan average price baru tanpa perlu bongkar Excel." />
            <form className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4" onSubmit={handleRightsCalculate}>
              <Input type="number" value={rightsForm.shares} onChange={(value) => setRightsForm((current) => ({ ...current, shares: value }))} placeholder="Jumlah saham lama" />
              <Input type="number" value={rightsForm.avgPrice} onChange={(value) => setRightsForm((current) => ({ ...current, avgPrice: value }))} placeholder="Average price lama" />
              <Input type="number" value={rightsForm.ratioOld} onChange={(value) => setRightsForm((current) => ({ ...current, ratioOld: value }))} placeholder="Rasio lama" />
              <Input type="number" value={rightsForm.ratioNew} onChange={(value) => setRightsForm((current) => ({ ...current, ratioNew: value }))} placeholder="Rasio baru" />
              <Input type="number" value={rightsForm.rightsPrice} onChange={(value) => setRightsForm((current) => ({ ...current, rightsPrice: value }))} placeholder="Harga tebus rights" />
              <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "rgba(34,197,94,0.14)", color: "#86efac", border: "1px solid rgba(34,197,94,0.25)" }}>Hitung Right Issue</button>
            </form>
            {rightsResult ? (
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Saham Baru" value={rightsResult.newShares.toLocaleString("id-ID")} compact />
                <MetricCard label="Total Saham" value={rightsResult.totalShares.toLocaleString("id-ID")} compact />
                <MetricCard label="Biaya Tebus" value={currency(rightsResult.rightsCost)} compact />
                <MetricCard label="TERP / Avg Baru" value={currency(rightsResult.averagePrice)} compact />
              </div>
            ) : <EmptyText text="Contoh rasio 5:1 berarti setiap 5 saham lama mendapat hak beli 1 saham baru." />}
          </GlassCard>
        ) : null}

        {enabledTools.includes("stockSplitCalculator") ? (
          <GlassCard hover={false}>
            <SectionTitle title="Stock Split Calculator" subtitle="Baca dampak split terhadap jumlah saham dan harga teoritis supaya tidak salah menilai portofolio." />
            <form className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4" onSubmit={handleSplitCalculate}>
              <Input type="number" value={splitForm.shares} onChange={(value) => setSplitForm((current) => ({ ...current, shares: value }))} placeholder="Jumlah saham sebelum split" />
              <Input type="number" value={splitForm.price} onChange={(value) => setSplitForm((current) => ({ ...current, price: value }))} placeholder="Harga sebelum split" />
              <Input type="number" value={splitForm.splitOld} onChange={(value) => setSplitForm((current) => ({ ...current, splitOld: value }))} placeholder="Rasio lama" />
              <Input type="number" value={splitForm.splitNew} onChange={(value) => setSplitForm((current) => ({ ...current, splitNew: value }))} placeholder="Rasio baru" />
              <button type="submit" className="md:col-span-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "rgba(59,130,246,0.14)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.25)" }}>Hitung Stock Split</button>
            </form>
            {splitResult ? (
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Rasio Split" value={splitResult.ratioText} compact />
                <MetricCard label="Saham Setelah Split" value={splitResult.newShares.toLocaleString("id-ID")} compact />
                <MetricCard label="Harga Teoritis Baru" value={currency(splitResult.theoreticalPrice)} compact />
                <MetricCard label="Nilai Portofolio" value={currency(splitResult.newValue)} helper="Secara teori tetap setara" compact />
              </div>
            ) : <EmptyText text="Contoh split 1:5 berarti 1 saham lama berubah menjadi 5 saham baru, dan harga teoritis ikut menyesuaikan." />}
          </GlassCard>
        ) : null}
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-4"><h2 className="text-lg font-bold text-silver-100">{title}</h2><p className="text-xs text-silver-500 mt-1 leading-6">{subtitle}</p></div>;
}

function HeroMetric({ title, value, helper, accent }: { title: string; value: string; helper: string; accent: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${accent}22` }}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-silver-500">{title}</p>
      <p className="text-xl font-bold mt-2" style={{ color: accent }}>{value}</p>
      <p className="text-xs text-silver-500 mt-2 leading-6">{helper}</p>
    </div>
  );
}

function WorkflowCard({ step, title, body, accent }: { step: string; title: string; body: string; accent: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${accent}18` }}>
      <p className="text-[11px] font-bold" style={{ color: accent }}>Langkah {step}</p>
      <p className="text-sm font-semibold text-silver-100 mt-2">{title}</p>
      <p className="text-xs text-silver-500 mt-2 leading-6">{body}</p>
    </div>
  );
}

function MetricCard({ label, value, helper, accent = "#fb923c", compact = false }: { label: string; value: string; helper?: string; accent?: string; compact?: boolean }) {
  return <div className={`rounded-2xl ${compact ? "p-4" : "p-5"}`} style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(226,232,240,0.06)" }}><p className="text-[11px] uppercase tracking-[0.18em] text-silver-500">{label}</p><p className={`${compact ? "text-xl" : "text-2xl"} font-bold mt-2`} style={{ color: accent }}>{value}</p>{helper ? <p className="text-xs text-silver-500 mt-1 leading-6">{helper}</p> : null}</div>;
}

function MiniStat({ label, value, accent = "#cbd5e1" }: { label: string; value: string; accent?: string }) {
  return <div className="rounded-xl p-3" style={{ background: "rgba(15,23,42,0.42)", border: "1px solid rgba(226,232,240,0.05)" }}><p className="text-[10px] uppercase tracking-[0.18em] text-silver-500">{label}</p><p className="text-sm font-semibold mt-2" style={{ color: accent }}>{value}</p></div>;
}

function LevelCard({ title, levelLabel, comparison, primaryValue, primaryLabel, mode }: { title: string; levelLabel: string; comparison: LevelComparison | null; primaryValue: number; primaryLabel: string; mode: "sl" | "tp" }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.08)" }}>
      <p className="text-sm font-semibold text-silver-100">{title}</p>
      {comparison ? (
        <div className="mt-3 space-y-2 text-sm text-silver-300">
          <p>{primaryLabel}: <span className="text-silver-100">{currency(primaryValue)}</span></p>
          <p>{levelLabel}: <span className="text-silver-100">{currency(comparison.price)}</span> · strength {comparison.strength}</p>
          <p>
            {mode === "sl"
              ? `Selisih SL ke support: ${currency(Math.abs(comparison.differenceFromSL || 0))} (${(comparison.differencePercentFromSL || 0).toFixed(2)}%)`
              : `Selisih TP ke resistance: ${currency(Math.abs(comparison.differenceFromTP || 0))} (${(comparison.differencePercentFromTP || 0).toFixed(2)}%)`}
          </p>
          <p className="text-xs text-silver-500 leading-6">{comparison.note}</p>
        </div>
      ) : <p className="text-sm text-silver-500 mt-3">Level timeframe ini belum cukup kuat terbaca untuk ticker ini.</p>}
    </div>
  );
}
function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="glass-input w-full px-3 py-2 text-sm text-silver-200" placeholder={placeholder} />;
}

function BriefContent({ text }: { text: string }) {
  // Normalize text first: insert newlines around common section markers and bullet markers
  // so the AI's single-line output gets parsed into proper sections.
  const normalized = (() => {
    let s = text.trim();
    // Strip markdown bold and italic markers — we'll add our own emphasis
    s = s.replace(/\*\*(.+?)\*\*/g, "$1");
    // Insert newline before numbered section headers: "1. Ringkasan", "2. Yang", etc.
    s = s.replace(/(\s)(\d+\.\s+(?:Ringkasan|Yang\s+\w+|Rencana\s+\w+|Kesimpulan|Catatan))/gi, "\n\n$2");
    // Insert newline before inline bullets (* or -) that follow a colon or another bullet
    s = s.replace(/(\S)\s+\*\s+/g, "$1\n* ");
    s = s.replace(/(\S)\s+-\s{2,}/g, "$1\n- ");
    // Collapse 3+ newlines into 2
    s = s.replace(/\n{3,}/g, "\n\n");
    return s.trim();
  })();

  const blocks = normalized.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);

  // Section header detector: matches "1. Ringkasan singkat:", "2. Yang Menarik:", etc.
  const headerRegex = /^(\d+)\.\s+([^:\n]+?):\s*([\s\S]*)$/;

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        // Try to parse as a section: "N. Title: optional inline content + bullets"
        const headerMatch = block.match(headerRegex);

        if (headerMatch) {
          const [, num, title, body] = headerMatch;
          // Body may contain bullets separated by * or -
          const lines = body.split(/\n/).map((l) => l.trim()).filter(Boolean);
          const intro: string[] = [];
          const bullets: string[] = [];
          for (const line of lines) {
            if (/^[*\-•]\s+/.test(line)) {
              bullets.push(line.replace(/^[*\-•]\s+/, ""));
            } else {
              intro.push(line);
            }
          }

          return (
            <section key={index} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-bold tabular-nums text-amber-300/90">
                  {String(num).padStart(2, "0")}
                </span>
                <h4 className="text-sm font-bold text-silver-100">{title.trim()}</h4>
              </div>
              {intro.length > 0 ? (
                <p className="text-sm leading-relaxed text-silver-300">{intro.join(" ")}</p>
              ) : null}
              {bullets.length > 0 ? (
                <ul className="space-y-1.5 ml-1">
                  {bullets.map((bullet, bi) => (
                    <li key={bi} className="flex items-start gap-2 text-sm leading-relaxed text-silver-300">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-300 shrink-0" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        }

        // Plain bullet block (no section title)
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const isList = lines.length > 1 && lines.every((line) => /^[*\-•]\s+/.test(line) || /^\d+\.\s+/.test(line));
        if (isList) {
          return (
            <ul key={index} className="space-y-1.5">
              {lines.map((line, li) => (
                <li key={li} className="flex items-start gap-2 text-sm leading-relaxed text-silver-300">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-300 shrink-0" />
                  <span>{line.replace(/^[*\-•]\s+/, "").replace(/^\d+\.\s+/, "")}</span>
                </li>
              ))}
            </ul>
          );
        }

        // Plain paragraph
        return (
          <p key={index} className="text-sm leading-relaxed text-silver-300">
            {block}
          </p>
        );
      })}
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-silver-500 leading-7">{text}</p>;
}
