"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GlassCard from "@/components/ui/GlassCard";
import { useAuth } from "@/components/ui/AuthProvider";

type Quote = { ticker: string; name: string; price: number; changePercent: number };
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
type AiBriefResponse = { ticker: string; name: string; brief: string; usedAI: boolean; quote: Quote };
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
type InvestorScreenerRow = {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  score: number;
  conviction: number;
  technicalScore: number;
  accumulationBias: number;
  breakoutReadiness: number;
  phase: string;
  operatorBias: string;
  actionBias: string;
  reasons: string[];
  support: number[];
  resistance: number[];
};
type InvestorScreenerResponse = {
  preset: string;
  priceBucket: string;
  rows: InvestorScreenerRow[];
};

const currency = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;
const shortTicker = (ticker: string) => ticker.replace(".JK", "");
const INVESTOR_SCREENER_PRESETS = [
  { value: "ideal", label: "Momentum", note: "Shortlist paling seimbang untuk scan cepat." },
  { value: "pullback", label: "Pullback", note: "Cari retrace sehat yang belum rusak struktur." },
  { value: "breakout", label: "Breakout", note: "Cari kandidat dekat konfirmasi breakout." },
  { value: "accumulation", label: "Akumulasi", note: "Tekan akumulasi dan demand lebih dominan." },
] as const;

export default function InvestorToolsPage() {
  const { user, loading } = useAuth();
  const [errorMessage, setErrorMessage] = useState("");
  const [aiBrief, setAiBrief] = useState<AiBriefResponse | null>(null);
  const [aiBriefLoading, setAiBriefLoading] = useState(false);
  const [briefTicker, setBriefTicker] = useState("BBCA");
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
  const [screenerPreset, setScreenerPreset] = useState<(typeof INVESTOR_SCREENER_PRESETS)[number]["value"]>("ideal");
  const [screenerPriceBucket, setScreenerPriceBucket] = useState<"all" | "under200" | "200to500" | "above500">("all");
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [screenerError, setScreenerError] = useState("");
  const [screenerRows, setScreenerRows] = useState<InvestorScreenerRow[]>([]);

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
        const res = await fetch(
          `/api/investor/screener?preset=${encodeURIComponent(screenerPreset)}&priceBucket=${encodeURIComponent(screenerPriceBucket)}&limit=6`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as InvestorScreenerResponse | { error?: string };
        if (!res.ok || !("rows" in data)) {
          throw new Error(("error" in data && data.error) || "Screener investor gagal dimuat");
        }
        if (!cancelled) {
          setScreenerRows(Array.isArray(data.rows) ? data.rows : []);
        }
      } catch (error) {
        if (!cancelled) {
          setScreenerRows([]);
          setScreenerError(error instanceof Error ? error.message : "Screener investor gagal dimuat");
        }
      } finally {
        if (!cancelled) {
          setScreenerLoading(false);
        }
      }
    }

    loadScreener();
    return () => {
      cancelled = true;
    };
  }, [enabledTools, screenerPreset, screenerPriceBucket, user]);

  const handleGenerateBrief = async (event: React.FormEvent) => {
    event.preventDefault();
    setAiBriefLoading(true);
    setErrorMessage("");

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

  const handleRiskCalculate = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

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
    if (!trimmed) {
      return;
    }

    setRiskQuoteLoading(true);
    try {
      const normalizedTicker = trimmed.endsWith(".JK") ? trimmed : `${trimmed}.JK`;
      const res = await fetch(`/api/stocks/quote/${encodeURIComponent(normalizedTicker)}`);
      const data = (await res.json()) as Quote | { error?: string };

      if (!res.ok || !("price" in data)) {
        return;
      }

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

  const handleRightsCalculate = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

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

    setRightsResult({
      oldShares,
      newShares,
      totalShares,
      oldValue,
      rightsCost,
      totalCost,
      terp,
      averagePrice: terp,
    });
  };

  const handleSplitCalculate = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

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

    setSplitResult({
      oldShares,
      newShares,
      oldPrice,
      theoreticalPrice,
      oldValue,
      newValue,
      ratioText: `${splitOld}:${splitNew}`,
    });
  };

  if (loading) {
    return <div className="min-h-[40vh] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" /></div>;
  }

  if (!user) {
    return (
      <GlassCard hover={false}>
        <h1 className="text-2xl font-bold text-silver-100">Investor Tools</h1>
        <p className="text-silver-400 mt-2">Masuk dulu untuk membuka AI Stock Brief dan Risk Calculator.</p>
        <Link href="/login" className="inline-block mt-4 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "linear-gradient(135deg,#ea580c,#fb923c)", color: "#fff" }}>
          Masuk Sekarang
        </Link>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-orange-400">Retail Investor Workspace</p>
        <h1 className="text-3xl font-bold text-silver-100 mt-1">Investor Tools</h1>
        <p className="text-sm text-silver-400 mt-2 max-w-3xl">Halaman ini sekarang fokus ke AI Stock Brief dan Risk Calculator yang lebih jelas untuk skenario TP/SL nyata.</p>
      </div>

      {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {enabledTools.includes("aiBrief") ? <GlassCard hover={false}>
          <SectionTitle title="AI Stock Brief" subtitle="Ringkasan cepat saham dengan harga, teknikal, dan news" />
          <form className="flex flex-col md:flex-row gap-3 mb-4" onSubmit={handleGenerateBrief}>
            <Input value={briefTicker} onChange={setBriefTicker} placeholder="Contoh: BBCA" />
            <button type="submit" disabled={aiBriefLoading} className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60" style={{ background: "linear-gradient(135deg,#ea580c,#fb923c)", color: "#fff" }}>
              {aiBriefLoading ? "Mengecek..." : "Cek Brief"}
            </button>
          </form>
          {aiBrief ? (
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.08)" }}>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <p className="text-sm font-bold text-silver-100">{shortTicker(aiBrief.ticker)} - {aiBrief.name}</p>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: aiBrief.usedAI ? "rgba(16,185,129,0.14)" : "rgba(59,130,246,0.14)", color: aiBrief.usedAI ? "#86efac" : "#93c5fd" }}>
                  {aiBrief.usedAI ? "Cerita Saham AI" : "Brief Otomatis"}
                </span>
                <span className="text-xs text-silver-400">{currency(aiBrief.quote.price)} - {aiBrief.quote.changePercent.toFixed(2)}%</span>
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-7 text-silver-300 font-sans">{aiBrief.brief}</pre>
            </div>
          ) : <EmptyText text="Masukkan ticker lalu biarkan sistem menyusun brief singkat untuk investor ritel." />}
        </GlassCard> : null}

        {enabledTools.includes("riskCalculator") ? <GlassCard hover={false}>
          <SectionTitle title="Risk Calculator" subtitle="Masukkan entry, TP, SL, dan lots untuk melihat profit, loss, risk ratio, serta pembanding support/resistance 1H dan 4H" />
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4" onSubmit={handleRiskCalculate}>
            <div className="md:col-span-2 space-y-2">
              <Input value={riskForm.ticker} onChange={handleRiskTickerChange} placeholder="Ticker opsional, contoh BBCA" />
              <p className="text-xs text-silver-500">
                {riskQuoteLoading
                  ? "Mengambil harga ticker saat ini..."
                  : riskQuote
                    ? `Harga terakhir ${shortTicker(riskQuote.ticker)} saat ini ${currency(riskQuote.price)} (${riskQuote.changePercent.toFixed(2)}%). Entry otomatis diisi jika masih kosong.`
                    : "Isi ticker jika ingin membandingkan TP/SL dengan support dan resistance timeframe 4H."}
              </p>
            </div>
            <div className="space-y-2">
              <Input type="number" value={riskForm.lots} onChange={(value) => setRiskForm((current) => ({ ...current, lots: value }))} placeholder="Jumlah lots, misal 1 = 100 lembar" />
              <p className="text-xs text-silver-500">Di BEI, `1 lot = 100 lembar saham`. Jadi 5 lot berarti 500 lembar.</p>
            </div>
            <Input type="number" value={riskForm.entryPrice} onChange={(value) => setRiskForm((current) => ({ ...current, entryPrice: value }))} placeholder="Harga beli / entry" />
            <Input type="number" value={riskForm.targetPrice} onChange={(value) => setRiskForm((current) => ({ ...current, targetPrice: value }))} placeholder="Target TP" />
            <Input type="number" value={riskForm.stopLoss} onChange={(value) => setRiskForm((current) => ({ ...current, stopLoss: value }))} placeholder="Level SL" />
            <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "rgba(168,85,247,0.16)", color: "#d8b4fe", border: "1px solid rgba(168,85,247,0.25)" }}>
              Hitung Skenario
            </button>
          </form>
          {riskResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Nilai Posisi" value={currency(riskResult.positionValue)} compact />
                <MetricCard label="Jumlah Saham" value={`${riskResult.shares.toLocaleString("id-ID")}`} helper={`${riskResult.lots} lots`} compact />
                <MetricCard label="Profit Jika TP Tercapai" value={currency(riskResult.potentialProfit)} helper={`${riskResult.profitPercent.toFixed(2)}% dari harga entry`} accent="#34d399" compact />
                <MetricCard label="Loss Jika SL Tersentuh" value={currency(riskResult.maxLoss)} helper={`${riskResult.lossPercent.toFixed(2)}% dari harga entry`} accent="#f87171" compact />
                <MetricCard label="Reward per Share" value={currency(riskResult.rewardPerShare)} compact />
                <MetricCard label="Risk per Share" value={currency(riskResult.riskPerShare)} compact />
              </div>

              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.08)" }}>
                <p className="text-sm font-semibold text-silver-100">Risk Ratio</p>
                <p className="text-2xl font-bold text-orange-400 mt-2">1 : {riskResult.riskRewardRatio.toFixed(2)}</p>
                <p className="text-xs text-silver-500 mt-2">Semakin besar angka di kanan, semakin menarik secara risk/reward, selama TP tetap realistis.</p>
              </div>

              {riskResult.ticker ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-silver-100">Pembanding Level 4H - {shortTicker(riskResult.ticker)}</p>
                  <div className="grid grid-cols-1 gap-3">
                    <LevelCard
                      title="SL vs Support 1H"
                      levelLabel="Nearest support"
                      comparison={riskResult.supportComparison1h}
                      primaryValue={riskResult.stopLoss}
                      primaryLabel="SL Anda"
                      mode="sl"
                    />
                    <LevelCard
                      title="TP vs Resistance 1H"
                      levelLabel="Nearest resistance"
                      comparison={riskResult.resistanceComparison1h}
                      primaryValue={riskResult.targetPrice}
                      primaryLabel="TP Anda"
                      mode="tp"
                    />
                    <LevelCard
                      title="SL vs Support 4H"
                      levelLabel="Nearest support"
                      comparison={riskResult.supportComparison}
                      primaryValue={riskResult.stopLoss}
                      primaryLabel="SL Anda"
                      mode="sl"
                    />
                    <LevelCard
                      title="TP vs Resistance 4H"
                      levelLabel="Nearest resistance"
                      comparison={riskResult.resistanceComparison}
                      primaryValue={riskResult.targetPrice}
                      primaryLabel="TP Anda"
                      mode="tp"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : <EmptyText text="Masukkan harga beli, target TP, SL, dan lots. Jika ticker diisi, sistem juga akan membandingkan levelmu dengan support/resistance 1 jam dan 4 jam." />}
        </GlassCard> : null}

        {enabledTools.includes("rightsIssueCalculator") ? <GlassCard hover={false}>
          <SectionTitle title="Right Issue Calculator" subtitle="Hitung tambahan saham, biaya tebus HMETD, dan average price baru setelah right issue" />
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4" onSubmit={handleRightsCalculate}>
            <Input type="number" value={rightsForm.shares} onChange={(value) => setRightsForm((current) => ({ ...current, shares: value }))} placeholder="Jumlah saham lama" />
            <Input type="number" value={rightsForm.avgPrice} onChange={(value) => setRightsForm((current) => ({ ...current, avgPrice: value }))} placeholder="Average price lama" />
            <Input type="number" value={rightsForm.ratioOld} onChange={(value) => setRightsForm((current) => ({ ...current, ratioOld: value }))} placeholder="Rasio lama, misal 5" />
            <Input type="number" value={rightsForm.ratioNew} onChange={(value) => setRightsForm((current) => ({ ...current, ratioNew: value }))} placeholder="Rasio baru, misal 1" />
            <Input type="number" value={rightsForm.rightsPrice} onChange={(value) => setRightsForm((current) => ({ ...current, rightsPrice: value }))} placeholder="Harga tebus right issue" />
            <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "rgba(34,197,94,0.14)", color: "#86efac", border: "1px solid rgba(34,197,94,0.25)" }}>
              Hitung Right Issue
            </button>
          </form>
          {rightsResult ? (
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Saham Baru" value={rightsResult.newShares.toLocaleString("id-ID")} compact />
              <MetricCard label="Total Saham" value={rightsResult.totalShares.toLocaleString("id-ID")} compact />
              <MetricCard label="Biaya Tebus" value={currency(rightsResult.rightsCost)} compact />
              <MetricCard label="TERP / Avg Baru" value={currency(rightsResult.averagePrice)} compact />
            </div>
          ) : <EmptyText text="Contoh rasio 5:1 berarti setiap 5 saham lama mendapat hak beli 1 saham baru." />}
        </GlassCard> : null}

        {enabledTools.includes("stockSplitCalculator") ? <GlassCard hover={false}>
          <SectionTitle title="Stock Split Calculator" subtitle="Lihat dampak stock split terhadap jumlah saham dan harga teoritis" />
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4" onSubmit={handleSplitCalculate}>
            <Input type="number" value={splitForm.shares} onChange={(value) => setSplitForm((current) => ({ ...current, shares: value }))} placeholder="Jumlah saham sebelum split" />
            <Input type="number" value={splitForm.price} onChange={(value) => setSplitForm((current) => ({ ...current, price: value }))} placeholder="Harga sebelum split" />
            <Input type="number" value={splitForm.splitOld} onChange={(value) => setSplitForm((current) => ({ ...current, splitOld: value }))} placeholder="Rasio lama, misal 1" />
            <Input type="number" value={splitForm.splitNew} onChange={(value) => setSplitForm((current) => ({ ...current, splitNew: value }))} placeholder="Rasio baru, misal 5" />
            <button type="submit" className="md:col-span-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "rgba(59,130,246,0.14)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.25)" }}>
              Hitung Stock Split
            </button>
          </form>
          {splitResult ? (
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Rasio Split" value={splitResult.ratioText} compact />
              <MetricCard label="Saham Setelah Split" value={splitResult.newShares.toLocaleString("id-ID")} compact />
              <MetricCard label="Harga Teoritis Baru" value={currency(splitResult.theoreticalPrice)} compact />
              <MetricCard label="Nilai Portofolio" value={currency(splitResult.newValue)} helper="Secara teori tetap setara" compact />
            </div>
          ) : <EmptyText text="Contoh split 1:5 berarti 1 saham lama berubah menjadi 5 saham baru, dan harga teoritis menyesuaikan turun." />}
        </GlassCard> : null}
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-4"><h2 className="text-lg font-bold text-silver-100">{title}</h2><p className="text-xs text-silver-500 mt-1">{subtitle}</p></div>;
}

function MetricCard({ label, value, helper, accent = "#fb923c", compact = false }: { label: string; value: string; helper?: string; accent?: string; compact?: boolean }) {
  return <div className={`rounded-2xl ${compact ? "p-4" : "p-5"}`} style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(226,232,240,0.06)" }}><p className="text-[11px] uppercase tracking-[0.18em] text-silver-500">{label}</p><p className={`${compact ? "text-xl" : "text-2xl"} font-bold mt-2`} style={{ color: accent }}>{value}</p>{helper ? <p className="text-xs text-silver-500 mt-1">{helper}</p> : null}</div>;
}

function LevelCard({ title, levelLabel, comparison, primaryValue, primaryLabel, mode }: { title: string; levelLabel: string; comparison: LevelComparison | null; primaryValue: number; primaryLabel: string; mode: "sl" | "tp" }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.08)" }}>
      <p className="text-sm font-semibold text-silver-100">{title}</p>
      {comparison ? (
        <div className="mt-3 space-y-2 text-sm text-silver-300">
          <p>{primaryLabel}: <span className="text-silver-100">{currency(primaryValue)}</span></p>
          <p>{levelLabel}: <span className="text-silver-100">{currency(comparison.price)}</span> - strength {comparison.strength}</p>
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

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-silver-500">{text}</p>;
}


