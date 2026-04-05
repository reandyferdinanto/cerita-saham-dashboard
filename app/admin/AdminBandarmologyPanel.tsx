"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SearchResult = {
  symbol: string;
  name: string;
};

type StockMasterStatus = {
  activeCount: number;
  source: string;
  sourceUrl: string;
  lastSyncedAt: string | null;
};

type BacktestResponse = {
  preset: ScreenerPreset;
  priceBucket: "all" | "under200" | "under300" | "200to500" | "above500";
  lookbackDays: number;
  holdingDays: number;
  takeProfitPct: number;
  snapshotCount: number;
  tradeCount: number;
  hitRate: number | null;
  avgMaxGainPct: number | null;
  avgMaxDrawdownPct: number | null;
  samples: Array<{
    snapshotDate: string;
    ticker: string;
    entryPrice: number;
    maxGainPct: number | null;
    maxDrawdownPct: number | null;
    hitTp: boolean;
  }>;
};

type AnalysisResponse = {
  ticker: string;
  name: string;
  quote: {
    price: number;
    changePercent: number;
    volume: number;
  };
  summary: {
    phase: string;
    operatorBias: string;
    conviction: number;
    actionBias: string;
    tone: "bullish" | "neutral" | "bearish" | "warning";
  };
  metrics: {
    priceVsMa20: number | null;
    priceVsMa50: number | null;
    rsi: number | null;
    technicalScore: number;
    volumeRatio5v20: number | null;
    upDownVolumeRatio: number | null;
    obvSlope20: number | null;
    adSlope20: number | null;
    breakoutDistancePct: number | null;
    support: number[];
    resistance: number[];
  };
  sections: {
    overview: string;
    accumulationDistribution: string;
    operatorFootprint: string;
    ryanFilbertLens: string;
    executionPlan: string;
    riskNotes: string;
  };
  chart: {
    points: {
      time: string;
      close: number;
      ma20: number | null;
      ma50: number | null;
    }[];
    annotations: {
      key: string;
      label: string;
      detail: string;
      value: number;
      color: string;
    }[];
  };
  assumptions: string[];
};

function toneStyles(tone: AnalysisResponse["summary"]["tone"]) {
  if (tone === "bullish") return { bg: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "rgba(16,185,129,0.2)" };
  if (tone === "bearish") return { bg: "rgba(239,68,68,0.12)", color: "#fca5a5", border: "rgba(239,68,68,0.2)" };
  if (tone === "warning") return { bg: "rgba(245,158,11,0.12)", color: "#fcd34d", border: "rgba(245,158,11,0.2)" };
  return { bg: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "rgba(59,130,246,0.2)" };
}

function formatMetric(value: number | null, suffix = "", digits = 2) {
  if (value == null) return "-";
  return `${value.toFixed(digits)}${suffix}`;
}

type ScreenerPreset =
  | "support_lock"
  | "sideways_accumulation"
  | "early_markup"
  | "demand_surge"
  | "washout_reclaim"
  | "under300_focus"
  | "markup_scout"
  | "stealth_rotation";

const CORE_PRESETS: Array<{ value: ScreenerPreset; label: string; description: string }> = [
  { value: "under300_focus", label: "Under 300", description: "Radar utama untuk saham murah yang masih punya jejak akumulasi." },
  { value: "support_lock", label: "Support Lock", description: "Support dijaga sambil supply diserap perlahan." },
  { value: "sideways_accumulation", label: "Sideways Senyap", description: "Sideways rapi dengan akumulasi diam-diam." },
  { value: "early_markup", label: "Markup Dini", description: "Mulai siap didorong ke resistance atau breakout pendek." },
  { value: "demand_surge", label: "Demand Surge", description: "Tekanan beli mulai muncul lebih agresif." },
];

const RESEARCH_PRESETS: Array<{ value: ScreenerPreset; label: string; description: string }> = [
  { value: "washout_reclaim", label: "Washout Reclaim", description: "Sempat ditekan, tetapi mulai direbut kembali tanpa distribusi berat." },
  { value: "markup_scout", label: "Scout Markup", description: "Mencari kandidat yang belum meledak, tetapi sudah dekat fase angkat." },
  { value: "stealth_rotation", label: "Rotasi Senyap", description: "Rotasi bandar yang belum ramai dan belum terlalu obvious." },
];

function getPresetMeta(preset: ScreenerPreset) {
  return [...CORE_PRESETS, ...RESEARCH_PRESETS].find((item) => item.value === preset) ?? CORE_PRESETS[0];
}

function buildWatchlistDraftFromAnalysis(analysis: AnalysisResponse) {
  const support = analysis.metrics.support[0] ?? null;
  const resistance = analysis.metrics.resistance[0] ?? null;
  const note = [
    `${analysis.summary.phase} | Conviction ${analysis.summary.conviction}/100`,
    analysis.summary.operatorBias,
    analysis.summary.actionBias,
    resistance ? `TP area ${resistance.toLocaleString("id-ID")}` : "",
    support ? `Jaga support ${support.toLocaleString("id-ID")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    ticker: analysis.ticker,
    name: analysis.name,
    tp: resistance,
    sl: support,
    note,
  };
}

export default function AdminBandarmologyPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"screener" | "analysis">("screener");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [screenerPreset, setScreenerPreset] = useState<ScreenerPreset>("under300_focus");
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [screenerUniverseSize, setScreenerUniverseSize] = useState<number | null>(null);
  const [screenerBucketUniverseSize, setScreenerBucketUniverseSize] = useState<number | null>(null);
  const [screenerAnalyzedUniverseSize, setScreenerAnalyzedUniverseSize] = useState<number | null>(null);
  const [priceBucket, setPriceBucket] = useState<"all" | "under200" | "under300" | "200to500" | "above500">("under300");
  const [stockMasterStatus, setStockMasterStatus] = useState<StockMasterStatus | null>(null);
  const [stockMasterLoading, setStockMasterLoading] = useState(false);
  const [stockMasterSyncing, setStockMasterSyncing] = useState(false);
  const [stockMasterError, setStockMasterError] = useState("");
  const [screenerRows, setScreenerRows] = useState<Array<{
    ticker: string;
    name: string;
    fitScore: number;
    phase: string;
    operatorBias: string;
    actionBias: string;
    tone: "bullish" | "neutral" | "bearish" | "warning";
    conviction: number;
    price: number;
    changePercent: number;
    breakoutDistancePct: number | null;
    volumeRatio5v20: number | null;
    upDownVolumeRatio: number | null;
    priceVsMa20: number | null;
    priceVsMa50: number | null;
    rsi: number | null;
    support: number[];
    resistance: number[];
    obvSlope20: number | null;
    adSlope20: number | null;
    technicalScore: number;
    reasons: string[];
    strategyLabel: string;
    thesis: string;
    accumulationBias: number;
    breakoutReadiness: number;
  }>>([]);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [snapshotSource, setSnapshotSource] = useState<"fresh" | "snapshot" | null>(null);
  const [screenerError, setScreenerError] = useState("");
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState("");
  const requestedTicker = useMemo(() => searchParams.get("ticker") || "", [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadStockMasterStatus() {
      try {
        setStockMasterLoading(true);
        setStockMasterError("");
        const res = await fetch("/api/admin/stocks/master", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal memuat status stock master");
        }
        if (!cancelled) {
          setStockMasterStatus(data);
        }
      } catch (err) {
        if (!cancelled) {
          setStockMasterError(err instanceof Error ? err.message : "Gagal memuat status stock master");
          setStockMasterStatus(null);
        }
      } finally {
        if (!cancelled) {
          setStockMasterLoading(false);
        }
      }
    }

    loadStockMasterStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSuggestions([]);
      return;
    }

    const handle = setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        const res = await fetch(`/api/stocks/search/${encodeURIComponent(normalized)}`, { cache: "no-store" });
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data.slice(0, 6) : []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!requestedTicker) return;
    setMode("analysis");
    setQuery(requestedTicker.replace(".JK", ""));
    void runAnalysis(requestedTicker);
    // We only want to react when the external query ticker changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTicker]);

  useEffect(() => {
    let cancelled = false;

    async function loadScreener() {
      try {
        setScreenerLoading(true);
        setScreenerError("");
        const res = await fetch(`/api/watchlist/bandarmology/screener?preset=${encodeURIComponent(screenerPreset)}&priceBucket=${encodeURIComponent(priceBucket)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal memuat screener");
        }
        if (!cancelled) {
          setScreenerUniverseSize(typeof data.universeSize === "number" ? data.universeSize : null);
          setScreenerBucketUniverseSize(typeof data.bucketUniverseSize === "number" ? data.bucketUniverseSize : null);
          setScreenerAnalyzedUniverseSize(typeof data.analyzedUniverseSize === "number" ? data.analyzedUniverseSize : null);
          setScreenerRows(Array.isArray(data.rows) ? data.rows : []);
          setSnapshotDate(typeof data.snapshotDate === "string" ? data.snapshotDate : null);
          setSnapshotSource(data.snapshotSource === "snapshot" || data.snapshotSource === "fresh" ? data.snapshotSource : null);
        }
      } catch (err) {
        if (!cancelled) {
          setScreenerError(err instanceof Error ? err.message : "Gagal memuat screener");
          setScreenerUniverseSize(null);
          setScreenerBucketUniverseSize(null);
          setScreenerAnalyzedUniverseSize(null);
          setScreenerRows([]);
          setSnapshotDate(null);
          setSnapshotSource(null);
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
  }, [screenerPreset, priceBucket]);

  useEffect(() => {
    let cancelled = false;

    async function loadBacktest() {
      try {
        setBacktestLoading(true);
        setBacktestError("");
        const res = await fetch(
          `/api/watchlist/bandarmology/backtest?preset=${encodeURIComponent(screenerPreset)}&priceBucket=${encodeURIComponent(priceBucket)}&lookbackDays=20&holdingDays=5&takeProfitPct=5`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal memuat backtest");
        }
        if (!cancelled) {
          setBacktest(data);
        }
      } catch (err) {
        if (!cancelled) {
          setBacktest(null);
          setBacktestError(err instanceof Error ? err.message : "Gagal memuat backtest");
        }
      } finally {
        if (!cancelled) {
          setBacktestLoading(false);
        }
      }
    }

    loadBacktest();
    return () => {
      cancelled = true;
    };
  }, [screenerPreset, priceBucket]);

  const runAnalysis = async (tickerInput?: string) => {
    const ticker = (tickerInput || query).trim();
    if (!ticker) return;

    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/watchlist/bandarmology?ticker=${encodeURIComponent(ticker)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menganalisa saham");
      }
      setAnalysis(data);
      setQuery(data.ticker.replace(".JK", ""));
      setSuggestions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menganalisa saham");
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const openAnalysisFromScreener = async (ticker: string) => {
    setMode("analysis");
    await runAnalysis(ticker);
  };

  const openWatchlistDraft = (draft: { ticker: string; name: string; tp: number | null; sl: number | null; note: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "watchlist");
    params.set("prefillTicker", draft.ticker.replace(".JK", ""));
    params.set("prefillName", draft.name);
    if (draft.tp != null) params.set("prefillTp", String(Math.round(draft.tp)));
    else params.delete("prefillTp");
    if (draft.sl != null) params.set("prefillSl", String(Math.round(draft.sl)));
    else params.delete("prefillSl");
    params.set("prefillNote", draft.note);
    router.replace(`/admin?${params.toString()}`);
  };

  const openStockSummaryFlow = (ticker: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "stock-summary");
    params.set("ticker", ticker.replace(".JK", ""));
    router.replace(`/admin?${params.toString()}`);
  };

  const syncStockMaster = async () => {
    try {
      setStockMasterSyncing(true);
      setStockMasterError("");
      const res = await fetch("/api/admin/stocks/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal sync stock master");
      }
      setStockMasterStatus({
        activeCount: data.activeCount,
        source: data.source,
        sourceUrl: data.sourceUrl,
        lastSyncedAt: new Date().toISOString(),
      });
      setScreenerUniverseSize(typeof data.activeCount === "number" ? data.activeCount : null);
      setScreenerError("");
      const screenerRes = await fetch(`/api/watchlist/bandarmology/screener?preset=${encodeURIComponent(screenerPreset)}&priceBucket=${encodeURIComponent(priceBucket)}`, {
        cache: "no-store",
      });
      const screenerData = await screenerRes.json();
      if (screenerRes.ok) {
        setScreenerUniverseSize(typeof screenerData.universeSize === "number" ? screenerData.universeSize : null);
        setScreenerBucketUniverseSize(typeof screenerData.bucketUniverseSize === "number" ? screenerData.bucketUniverseSize : null);
        setScreenerAnalyzedUniverseSize(typeof screenerData.analyzedUniverseSize === "number" ? screenerData.analyzedUniverseSize : null);
        setScreenerRows(Array.isArray(screenerData.rows) ? screenerData.rows : []);
        setSnapshotDate(typeof screenerData.snapshotDate === "string" ? screenerData.snapshotDate : null);
        setSnapshotSource(screenerData.snapshotSource === "snapshot" || screenerData.snapshotSource === "fresh" ? screenerData.snapshotSource : null);
      }
    } catch (err) {
      setStockMasterError(err instanceof Error ? err.message : "Gagal sync stock master");
    } finally {
      setStockMasterSyncing(false);
    }
  };

  const tone = analysis ? toneStyles(analysis.summary.tone) : null;
  const activePreset = getPresetMeta(screenerPreset);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("screener")}
            className="text-left rounded-2xl px-4 py-4 transition-all"
            style={{
              background: mode === "screener" ? "rgba(59,130,246,0.14)" : "rgba(255,255,255,0.03)",
              border: mode === "screener" ? "1px solid rgba(59,130,246,0.28)" : "1px solid rgba(226,232,240,0.06)",
            }}
          >
            <p className="text-sm font-bold" style={{ color: mode === "screener" ? "#93c5fd" : "#e2e8f0" }}>Screener</p>
            <p className="text-xs mt-1 text-silver-500">Shortlist saham murah yang sedang dijaga, diakumulasi, atau siap markup dini.</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("analysis")}
            className="text-left rounded-2xl px-4 py-4 transition-all"
            style={{
              background: mode === "analysis" ? "rgba(251,146,60,0.14)" : "rgba(255,255,255,0.03)",
              border: mode === "analysis" ? "1px solid rgba(251,146,60,0.28)" : "1px solid rgba(226,232,240,0.06)",
            }}
          >
            <p className="text-sm font-bold" style={{ color: mode === "analysis" ? "#fdba74" : "#e2e8f0" }}>Analisa Bandarmology</p>
            <p className="text-xs mt-1 text-silver-500">Bedah detail satu ticker dengan fase, jejak operator, dan rencana eksekusi.</p>
          </button>
        </div>
      </div>

      {mode === "analysis" ? (
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
        <div className="flex flex-col xl:flex-row gap-4 xl:items-start justify-between">
          <div className="max-w-3xl">
            <h2 className="text-lg font-bold text-silver-100">Analisa Bandarmology</h2>
            <p className="text-sm text-silver-400 mt-2 leading-relaxed">
              Tab ini membaca saham dengan filosofi Cerita Saham: fokus ke saham under 300 atau rotational yang sedang
              dijaga di support, sideways sambil akumulasi, atau mulai masuk markup dini. Analisa ini memakai data publik
              yang tersedia di aplikasi, jadi fungsinya sebagai kerangka baca detail untuk admin, bukan broker summary proprietary.
            </p>
          </div>
          <div className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: "rgba(251,146,60,0.12)", color: "#fdba74", border: "1px solid rgba(251,146,60,0.18)" }}>
            Cocok untuk review cepat sebelum menulis bandarmology note
          </div>
        </div>

        <div className="mt-5 relative">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ketik ticker atau nama emiten, misalnya BBCA"
              className="glass-input flex-1 px-4 py-3 text-sm text-silver-200"
            />
            <button
              type="button"
              onClick={() => runAnalysis()}
              disabled={loading}
              className="px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#ea580c,#fb923c)", color: "#fff" }}
            >
              {loading ? "Menganalisa..." : "Analisa Sekarang"}
            </button>
          </div>

          {(loadingSuggestions || suggestions.length > 0) && (
            <div className="absolute z-20 mt-2 w-full rounded-2xl overflow-hidden" style={{ background: "rgba(6,20,14,0.98)", border: "1px solid rgba(16,185,129,0.12)" }}>
              {loadingSuggestions ? (
                <div className="px-4 py-3 text-sm text-silver-500">Mencari saham...</div>
              ) : (
                suggestions.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => runAnalysis(item.symbol)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-all"
                  >
                    <p className="text-sm font-semibold text-silver-200">{item.symbol.replace(".JK", "")}</p>
                    <p className="text-xs text-silver-500 mt-1">{item.name}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {error ? <p className="text-sm text-red-400 mt-4">{error}</p> : null}
      </div>
      ) : null}

      {mode === "screener" ? (
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-silver-100">Screener Saham Ideal</h3>
            <p className="text-sm text-silver-400 mt-2 leading-relaxed">
              Screener ini sengaja dibelokkan ke filosofi Cerita Saham: bukan mencari saham paling aman atau paling
              blue-chip, tetapi mencari saham murah yang sedang ditahan, diakumulasi diam-diam, atau siap masuk markup.
            </p>
          </div>
          <div className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.2)" }}>
            {screenerUniverseSize ? `Master IDX ${screenerUniverseSize} saham` : "Menyiapkan master list saham IDX"}
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
          <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] font-bold text-silver-400">Stock Master Indonesia</p>
              <h4 className="text-base font-bold text-silver-100 mt-2">
                {stockMasterLoading ? "Memuat status..." : `${stockMasterStatus?.activeCount?.toLocaleString("id-ID") ?? 0} saham aktif di database`}
              </h4>
              <p className="text-sm text-silver-400 mt-2 leading-relaxed">
                Screener sekarang mengambil universe dari database stock master Indonesia, lalu memilih kandidat terbaik untuk analisa bandarmology.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-3 py-2 rounded-xl text-[11px] font-semibold" style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.18)" }}>
                  Source: {stockMasterStatus?.source ?? "stockanalysis"}
                </span>
                <span className="px-3 py-2 rounded-xl text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.04)", color: "#cbd5e1", border: "1px solid rgba(226,232,240,0.06)" }}>
                  Last sync: {formatDateTime(stockMasterStatus?.lastSyncedAt)}
                </span>
              </div>
              {stockMasterError ? <p className="text-sm text-red-400 mt-3">{stockMasterError}</p> : null}
            </div>

            <div className="flex flex-col gap-2 min-w-[220px]">
              <button
                type="button"
                onClick={() => syncStockMaster()}
                disabled={stockMasterSyncing}
                className="px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)", color: "#fff" }}
              >
                {stockMasterSyncing ? "Sync sedang jalan..." : "Sync Ulang Stock Master"}
              </button>
              {stockMasterStatus?.sourceUrl ? (
                <a
                  href={stockMasterStatus.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-3 rounded-xl text-sm font-semibold text-center"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#e2e8f0", border: "1px solid rgba(226,232,240,0.08)" }}
                >
                  Buka Source List
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr,1fr] gap-4">
          <PresetGroup
            title="Preset Inti"
            subtitle="Preset utama untuk mencari saham murah yang sedang ditahan, parkir, atau mulai diangkat."
            badge="Cerita Saham Core"
            badgeTone="blue"
            presets={CORE_PRESETS}
            activePreset={screenerPreset}
            onSelect={setScreenerPreset}
          />
          <PresetGroup
            title="Preset Lanjutan"
            subtitle="Preset lanjutan untuk pola washout reclaim, scout markup, dan rotasi bandar yang lebih senyap."
            badge="Cerita Saham Advanced"
            badgeTone="orange"
            presets={RESEARCH_PRESETS}
            activePreset={screenerPreset}
            onSelect={setScreenerPreset}
          />
        </div>

        <div className="rounded-2xl p-4 flex flex-col md:flex-row md:items-start justify-between gap-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] font-bold text-silver-400">Preset Aktif</p>
            <h4 className="text-base font-bold text-silver-100 mt-2">{activePreset.label}</h4>
            <p className="text-sm text-silver-400 mt-2 leading-relaxed">{activePreset.description}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                ["all", "Semua Harga"],
                ["under200", "< 200"],
                ["under300", "< 300"],
                ["200to500", "200 - 500"],
                ["above500", "> 500"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriceBucket(value as typeof priceBucket)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: priceBucket === value ? "rgba(16,185,129,0.16)" : "rgba(255,255,255,0.04)",
                    color: priceBucket === value ? "#6ee7b7" : "#cbd5e1",
                    border: priceBucket === value ? "1px solid rgba(16,185,129,0.24)" : "1px solid rgba(226,232,240,0.06)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 self-start">
            <div className="px-3 py-2 rounded-xl text-[11px] font-semibold" style={{ background: "rgba(251,146,60,0.10)", color: "#fdba74", border: "1px solid rgba(251,146,60,0.16)" }}>
              Klik Analisa untuk buka breakdown lengkap + mini chart
            </div>
            <div className="px-3 py-2 rounded-xl text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.04)", color: "#cbd5e1", border: "1px solid rgba(226,232,240,0.06)" }}>
              {screenerUniverseSize
                ? `Master ${screenerUniverseSize} saham, bucket ${screenerBucketUniverseSize ?? "-"} saham, dianalisa ${screenerAnalyzedUniverseSize ?? "-"} kandidat.`
                : "Screener akan memakai master list saham Indonesia dari database."}
            </div>
            <div className="px-3 py-2 rounded-xl text-[11px] font-semibold" style={{ background: snapshotSource === "snapshot" ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.12)", color: snapshotSource === "snapshot" ? "#6ee7b7" : "#93c5fd", border: snapshotSource === "snapshot" ? "1px solid rgba(16,185,129,0.18)" : "1px solid rgba(59,130,246,0.18)" }}>
              {snapshotDate
                ? `Snapshot ${snapshotDate} · ${snapshotSource === "snapshot" ? "dibaca dari cache harian" : "baru dihitung dan disimpan"}`
                : "Snapshot harian akan dibuat otomatis setelah scan berhasil."}
            </div>
          </div>
        </div>

        {screenerError ? <p className="text-sm text-red-400">{screenerError}</p> : null}

        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] font-bold text-silver-400">Backtest Ringan</p>
              <h4 className="text-base font-bold text-silver-100 mt-2">Akurasi preset 20 hari terakhir</h4>
              <p className="text-sm text-silver-400 mt-2 leading-relaxed">
                Snapshot harian dibandingkan dengan performa 5 hari berikutnya untuk melihat berapa kandidat yang sempat mencapai target 5%.
              </p>
            </div>
            <div className="px-3 py-2 rounded-xl text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.04)", color: "#cbd5e1", border: "1px solid rgba(226,232,240,0.06)" }}>
              Horizon 5 hari · TP 5%
            </div>
          </div>

          {backtestError ? <p className="text-sm text-red-400 mt-4">{backtestError}</p> : null}

          {backtestLoading ? (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-20 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
              ))}
            </div>
          ) : backtest ? (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
                <ScreenerMetric label="Snapshot" value={`${backtest.snapshotCount}`} />
                <ScreenerMetric label="Trade Sampel" value={`${backtest.tradeCount}`} />
                <ScreenerMetric label="Hit Rate" value={backtest.hitRate == null ? "-" : `${backtest.hitRate.toFixed(1)}%`} />
                <ScreenerMetric label="Avg Max Gain" value={backtest.avgMaxGainPct == null ? "-" : `${backtest.avgMaxGainPct.toFixed(2)}%`} />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-[1fr,320px] gap-4 mt-4">
                <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
                  <p className="text-sm font-semibold text-silver-100">Sampel terbaru</p>
                  <div className="space-y-2 mt-3">
                    {backtest.samples.length > 0 ? backtest.samples.slice(0, 6).map((sample) => (
                      <div key={`${sample.snapshotDate}-${sample.ticker}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.05)" }}>
                        <div>
                          <p className="text-xs font-bold text-silver-100">{sample.ticker.replace(".JK", "")}</p>
                          <p className="text-[11px] text-silver-500 mt-1">{sample.snapshotDate} · Entry {sample.entryPrice.toLocaleString("id-ID")}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold" style={{ color: sample.hitTp ? "#6ee7b7" : "#fca5a5" }}>
                            {sample.hitTp ? "TP tersentuh" : "Belum sentuh TP"}
                          </p>
                          <p className="text-[11px] text-silver-400 mt-1">
                            Up {sample.maxGainPct == null ? "-" : `${sample.maxGainPct.toFixed(2)}%`} · Down {sample.maxDrawdownPct == null ? "-" : `${Math.abs(sample.maxDrawdownPct).toFixed(2)}%`}
                          </p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-silver-500">Belum ada sampel snapshot yang cukup untuk dihitung.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl p-4" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.14)" }}>
                  <p className="text-xs uppercase tracking-[0.18em] font-bold text-blue-200">Cara baca cepat</p>
                  <div className="space-y-2 mt-3">
                    <p className="text-xs text-silver-300">Hit rate menunjukkan berapa persen kandidat sempat memberi ruang profit 5% dalam 5 hari setelah masuk shortlist.</p>
                    <p className="text-xs text-silver-300">Avg max gain membantu membandingkan preset mana yang paling layak untuk momentum scan.</p>
                    <p className="text-xs text-silver-300">Avg max drawdown membantu melihat preset mana yang relatif lebih “tenang” untuk dipantau.</p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {screenerLoading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-32 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {screenerRows.map((row) => {
              const style = toneStyles(row.tone);
              return (
                <div key={row.ticker} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-silver-100">{row.ticker.replace(".JK", "")}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                          Fit {row.fitScore}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.05)", color: "#f8fafc", border: "1px solid rgba(226,232,240,0.08)" }}>
                          {row.strategyLabel}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-silver-300 border border-white/5">
                          Conviction {row.conviction}
                        </span>
                      </div>
                      <p className="text-xs text-silver-500 mt-1">{row.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAnalysisFromScreener(row.ticker)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(251,146,60,0.12)", color: "#fdba74", border: "1px solid rgba(251,146,60,0.18)" }}
                    >
                      Analisa
                    </button>
                  </div>

                  <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(226,232,240,0.06)" }}>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-silver-500">Thesis</p>
                    <p className="text-xs text-silver-300 mt-2 leading-relaxed">{row.thesis}</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                    <ScreenerMetric label="Harga" value={`Rp ${row.price.toLocaleString("id-ID")}`} />
                    <ScreenerMetric label="Change" value={`${row.changePercent >= 0 ? "+" : ""}${row.changePercent.toFixed(2)}%`} />
                    <ScreenerMetric label="Tech" value={`${row.technicalScore}/100`} />
                    <ScreenerMetric label="Jarak Resist" value={row.breakoutDistancePct == null ? "-" : `${row.breakoutDistancePct.toFixed(2)}%`} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <ScreenerMetric label="Akumulasi Bias" value={`${row.accumulationBias}/100`} />
                    <ScreenerMetric label="Markup Ready" value={`${row.breakoutReadiness}/100`} />
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold text-silver-300">Kenapa masuk screener</p>
                    <div className="mt-2 space-y-1.5">
                      {row.reasons.map((reason) => (
                        <div key={reason} className="flex items-start gap-2">
                          <span className="text-orange-400 mt-0.5">•</span>
                          <p className="text-xs text-silver-400">{reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5">
                    <p className="text-xs text-silver-300 font-semibold">{row.phase}</p>
                    <p className="text-xs text-silver-500 mt-1">{row.operatorBias}</p>
                    <p className="text-xs text-silver-400 mt-2">{row.actionBias}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openWatchlistDraft({
                        ticker: row.ticker,
                        name: row.name,
                        tp: row.resistance[0] ?? null,
                        sl: row.support[0] ?? null,
                        note: `${row.phase} | ${row.operatorBias} | ${row.actionBias}`,
                      })}
                      className="px-3 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.18)" }}
                    >
                      Kirim ke Watchlist
                    </button>
                    <button
                      type="button"
                      onClick={() => openStockSummaryFlow(row.ticker)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.18)" }}
                    >
                      Cek Flow Stock Summary
                    </button>
                  </div>

                  <details className="mt-4 group rounded-xl border border-white/5 bg-white/5">
                    <summary className="list-none cursor-pointer px-3 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-silver-200">Analisis teknikal</p>
                        <p className="text-[11px] text-silver-500 mt-1">Buka detail MA, RSI, volume, OBV, A/D, support, dan resistance.</p>
                      </div>
                      <span className="text-xs text-orange-300 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="px-3 pb-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <ScreenerMetric label="Harga vs MA20" value={row.priceVsMa20 == null ? "-" : `${row.priceVsMa20.toFixed(2)}%`} />
                        <ScreenerMetric label="Harga vs MA50" value={row.priceVsMa50 == null ? "-" : `${row.priceVsMa50.toFixed(2)}%`} />
                        <ScreenerMetric label="RSI" value={row.rsi == null ? "-" : row.rsi.toFixed(2)} />
                        <ScreenerMetric label="Vol 5/20" value={row.volumeRatio5v20 == null ? "-" : `${row.volumeRatio5v20.toFixed(2)}x`} />
                        <ScreenerMetric label="Up/Down Vol" value={row.upDownVolumeRatio == null ? "-" : `${row.upDownVolumeRatio.toFixed(2)}x`} />
                        <ScreenerMetric label="OBV 20h" value={row.obvSlope20 == null ? "-" : row.obvSlope20.toFixed(0)} />
                        <ScreenerMetric label="A/D 20h" value={row.adSlope20 == null ? "-" : row.adSlope20.toFixed(0)} />
                        <ScreenerMetric label="Jarak Resist" value={row.breakoutDistancePct == null ? "-" : `${row.breakoutDistancePct.toFixed(2)}%`} />
                        <ScreenerMetric label="Technical Score" value={`${row.technicalScore}/100`} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <MiniLevels title="Support" values={row.support} color="#6ee7b7" />
                        <MiniLevels title="Resistance" values={row.resistance} color="#fca5a5" />
                      </div>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>
      ) : null}

      {mode === "analysis" && analysis ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard label="Phase" value={analysis.summary.phase} hint={analysis.summary.operatorBias} />
            <StatCard label="Conviction" value={`${analysis.summary.conviction}/100`} hint={analysis.summary.actionBias} tone={analysis.summary.tone} />
            <StatCard label="Harga" value={`Rp ${analysis.quote.price.toLocaleString("id-ID")}`} hint={`${analysis.quote.changePercent >= 0 ? "+" : ""}${analysis.quote.changePercent.toFixed(2)}%`} />
            <StatCard label="Technical Score" value={`${analysis.metrics.technicalScore}/100`} hint={`RSI ${formatMetric(analysis.metrics.rsi)}`} tone={analysis.summary.tone} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => openWatchlistDraft(buildWatchlistDraftFromAnalysis(analysis))}
              className="rounded-2xl px-4 py-3 text-sm font-semibold text-left"
              style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.18)" }}
            >
              Buat Draft Watchlist
            </button>
            <button
              type="button"
              onClick={() => openStockSummaryFlow(analysis.ticker)}
              className="rounded-2xl px-4 py-3 text-sm font-semibold text-left"
              style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.18)" }}
            >
              Buka Stock Summary Ticker Ini
            </button>
            <button
              type="button"
              onClick={() => setMode("screener")}
              className="rounded-2xl px-4 py-3 text-sm font-semibold text-left"
              style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0", border: "1px solid rgba(226,232,240,0.08)" }}
            >
              Kembali ke Screener
            </button>
          </div>

          <div className="rounded-2xl p-5" style={{ background: tone?.bg, border: `1px solid ${tone?.border}` }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] font-bold" style={{ color: tone?.color }}>Lensa Cerita Saham</p>
                <h3 className="text-xl font-bold text-silver-100 mt-2">{analysis.ticker.replace(".JK", "")} · {analysis.name}</h3>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "#f8fafc" }}>
                {analysis.summary.operatorBias}
              </span>
            </div>
            <p className="text-sm text-silver-200 mt-4 leading-relaxed">{analysis.sections.ryanFilbertLens}</p>
          </div>

          <BandarmologyMiniChart analysis={analysis} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <NarrativeCard title="Overview" content={analysis.sections.overview} />
            <NarrativeCard title="Akumulasi vs Distribusi" content={analysis.sections.accumulationDistribution} />
            <NarrativeCard title="Jejak Operator" content={analysis.sections.operatorFootprint} />
            <NarrativeCard title="Rencana Eksekusi" content={analysis.sections.executionPlan} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
              <h3 className="text-base font-bold text-silver-100">Metrik Inti</h3>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <MetricCell label="Harga vs MA20" value={formatMetric(analysis.metrics.priceVsMa20, "%")} />
                <MetricCell label="Harga vs MA50" value={formatMetric(analysis.metrics.priceVsMa50, "%")} />
                <MetricCell label="Volume 5h / 20h" value={formatMetric(analysis.metrics.volumeRatio5v20, "x")} />
                <MetricCell label="Up / Down Volume" value={formatMetric(analysis.metrics.upDownVolumeRatio, "x")} />
                <MetricCell label="OBV Slope 20h" value={formatMetric(analysis.metrics.obvSlope20, "", 0)} />
                <MetricCell label="A/D Slope 20h" value={formatMetric(analysis.metrics.adSlope20, "", 0)} />
                <MetricCell label="Jarak ke Resist 20h" value={formatMetric(analysis.metrics.breakoutDistancePct, "%")} />
                <MetricCell label="Volume" value={`${(analysis.quote.volume / 1_000_000).toFixed(2)}M`} />
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
              <h3 className="text-base font-bold text-silver-100">Level Penting</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <LevelBox title="Support" values={analysis.metrics.support} color="#6ee7b7" />
                <LevelBox title="Resistance" values={analysis.metrics.resistance} color="#fca5a5" />
              </div>
              <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.12)" }}>
                <p className="text-xs text-silver-400 leading-relaxed">{analysis.sections.riskNotes}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
            <h3 className="text-base font-bold text-silver-100">Asumsi dan Batasan</h3>
            <div className="mt-3 space-y-2">
              {analysis.assumptions.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <span className="text-orange-400 mt-0.5">•</span>
                  <p className="text-sm text-silver-400">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: "bullish" | "neutral" | "bearish" | "warning" }) {
  const toneStyle = toneStyles(tone);
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
      <p className="text-[10px] uppercase tracking-wider text-silver-500">{label}</p>
      <p className="text-xl font-bold text-silver-100 mt-2">{value}</p>
      {hint ? <p className="text-xs mt-2" style={{ color: tone === "neutral" ? "#94a3b8" : toneStyle.color }}>{hint}</p> : null}
    </div>
  );
}

function NarrativeCard({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
      <h3 className="text-base font-bold text-silver-100">{title}</h3>
      <p className="text-sm text-silver-400 leading-relaxed mt-3">{content}</p>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
      <p className="text-[10px] uppercase tracking-wider text-silver-500">{label}</p>
      <p className="text-sm font-semibold text-silver-100 mt-1">{value}</p>
    </div>
  );
}

function LevelBox({ title, values, color }: { title: string; values: number[]; color: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color }}>{title}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {values.length > 0 ? values.map((value) => (
          <span key={value} className="px-2 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0" }}>
            {value.toLocaleString("id-ID")}
          </span>
        )) : <span className="text-sm text-silver-500">Belum cukup data</span>}
      </div>
    </div>
  );
}

function ScreenerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(226,232,240,0.06)" }}>
      <p className="text-[10px] uppercase tracking-wider text-silver-500">{label}</p>
      <p className="text-xs font-semibold text-silver-100 mt-1">{value}</p>
    </div>
  );
}

function PresetGroup({
  title,
  subtitle,
  badge,
  badgeTone,
  presets,
  activePreset,
  onSelect,
}: {
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: "blue" | "orange";
  presets: Array<{ value: ScreenerPreset; label: string; description: string }>;
  activePreset: ScreenerPreset;
  onSelect: (preset: ScreenerPreset) => void;
}) {
  const isOrange = badgeTone === "orange";
  return (
    <div className="rounded-2xl p-4" style={{ background: isOrange ? "rgba(251,146,60,0.06)" : "rgba(59,130,246,0.06)", border: isOrange ? "1px solid rgba(251,146,60,0.12)" : "1px solid rgba(59,130,246,0.12)" }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-bold" style={{ color: isOrange ? "#fdba74" : "#93c5fd" }}>{title}</p>
          <p className="text-sm text-silver-400 mt-2 leading-relaxed">{subtitle}</p>
        </div>
        <div className="px-3 py-2 rounded-xl text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.05)", color: isOrange ? "#fdba74" : "#93c5fd", border: isOrange ? "1px solid rgba(251,146,60,0.14)" : "1px solid rgba(59,130,246,0.14)" }}>
          {badge}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
        {presets.map((preset) => {
          const isActive = activePreset === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onSelect(preset.value)}
              className="text-left rounded-xl px-3 py-3 transition-all"
              style={{
                background: isActive ? (isOrange ? "rgba(251,146,60,0.16)" : "rgba(59,130,246,0.16)") : "rgba(255,255,255,0.04)",
                border: isActive
                  ? (isOrange ? "1px solid rgba(251,146,60,0.28)" : "1px solid rgba(59,130,246,0.28)")
                  : "1px solid rgba(226,232,240,0.06)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold" style={{ color: isActive ? (isOrange ? "#fdba74" : "#93c5fd") : "#e2e8f0" }}>{preset.label}</p>
                {isActive ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: isOrange ? "rgba(251,146,60,0.18)" : "rgba(59,130,246,0.18)", color: isOrange ? "#fdba74" : "#93c5fd" }}>
                    Aktif
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-silver-500 mt-2 leading-relaxed">{preset.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniLevels({ title, values, color }: { title: string; values: number[]; color: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(226,232,240,0.06)" }}>
      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color }}>{title}</p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {values.length > 0 ? values.map((value) => (
          <span key={value} className="px-2 py-1 rounded-full text-[10px] font-semibold bg-white/5 text-silver-200">
            {value.toLocaleString("id-ID")}
          </span>
        )) : <span className="text-xs text-silver-500">Belum cukup data</span>}
      </div>
    </div>
  );
}

function BandarmologyMiniChart({ analysis }: { analysis: AnalysisResponse }) {
  const points = analysis.chart.points;
  if (points.length < 2) return null;

  const width = 760;
  const height = 284;
  const padX = 18;
  const padTop = 22;
  const padBottom = 26;
  const contentHeight = height - padTop - padBottom;
  const values = [
    ...points.map((point) => point.close),
    ...points.map((point) => point.ma20).filter((value): value is number => value != null),
    ...points.map((point) => point.ma50).filter((value): value is number => value != null),
    ...analysis.chart.annotations.map((item) => item.value),
  ];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = Math.max(maxValue - minValue, maxValue * 0.04, 1);

  const xForIndex = (index: number) => padX + (index / Math.max(points.length - 1, 1)) * (width - padX * 2);
  const yForValue = (value: number) => padTop + ((maxValue - value) / valueRange) * contentHeight;
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xForIndex(index).toFixed(2)} ${yForValue(point.close).toFixed(2)}`)
    .join(" ");

  const makeMovingAveragePath = (key: "ma20" | "ma50") => {
    let started = false;
    return points.reduce((path, point, index) => {
      const value = point[key];
      if (value == null) return path;
      const command = started ? "L" : "M";
      started = true;
      return `${path}${path ? " " : ""}${command} ${xForIndex(index).toFixed(2)} ${yForValue(value).toFixed(2)}`;
    }, "");
  };

  const ma20Path = makeMovingAveragePath("ma20");
  const ma50Path = makeMovingAveragePath("ma50");
  const lastIndex = points.length - 1;
  const lastPoint = points[lastIndex];
  const lastX = xForIndex(lastIndex);
  const lastY = yForValue(lastPoint.close);
  const prioritizedAnnotations = analysis.chart.annotations
    .slice()
    .sort((left, right) => {
      const priority = ["breakout", "price", "resistance", "support"];
      const leftIndex = priority.indexOf(left.key);
      const rightIndex = priority.indexOf(right.key);
      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
      }
      return right.value - left.value;
    });
  const quickGuide = prioritizedAnnotations.slice(0, 3);

  return (
    <div className="rounded-[28px] p-5 md:p-6" style={{ background: "linear-gradient(180deg, rgba(8,14,28,0.88) 0%, rgba(7,17,29,0.74) 100%)", border: "1px solid rgba(148,163,184,0.12)", boxShadow: "0 24px 80px rgba(2,6,23,0.28)" }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">
            Mini Chart Bandarmology
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-silver-300">
            Fokus utama chart ini adalah posisi harga terhadap level penting. Harga aktif, support, resistance, dan area markup sekarang tampil sebagai ringkasan cepat, jadi admin bisa scan struktur tanpa membaca terlalu banyak label.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <LegendPill label="Harga" color="#fb923c" />
          <LegendPill label="MA20" color="#38bdf8" />
          <LegendPill label="MA50" color="#a78bfa" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {prioritizedAnnotations.map((item) => (
          <div
            key={item.key}
            className="rounded-2xl p-3.5"
            style={{ background: "rgba(255,255,255,0.035)", border: `1px solid ${item.color}28` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: item.color }}>
                  {item.label}
                </p>
                <p className="mt-2 text-xl font-semibold text-silver-100">
                  {item.value.toLocaleString("id-ID")}
                </p>
              </div>
              <span className="mt-0.5 h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-silver-400">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="overflow-x-auto rounded-[24px] border border-white/8 bg-slate-950/40 p-3 md:p-4">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[620px]">
            <defs>
              <linearGradient id="bandar-price-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(251,146,60,0.24)" />
                <stop offset="100%" stopColor="rgba(251,146,60,0.01)" />
              </linearGradient>
            </defs>

            <rect x="0" y="0" width={width} height={height} rx="20" fill="rgba(15,23,42,0.52)" />

            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const value = maxValue - valueRange * ratio;
              const y = padTop + contentHeight * ratio;
              return (
                <g key={ratio}>
                  <line
                    x1={padX}
                    x2={width - padX}
                    y1={y}
                    y2={y}
                    stroke="rgba(148,163,184,0.12)"
                    strokeDasharray={ratio === 0 || ratio === 1 ? "0" : "4 6"}
                  />
                  <text x={width - padX - 6} y={y - 4} fill="#64748b" fontSize="10" textAnchor="end">
                    {Math.round(value).toLocaleString("id-ID")}
                  </text>
                </g>
              );
            })}

            {analysis.chart.annotations.map((item) => {
              const y = yForValue(item.value);
              return (
                <line
                  key={item.key}
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  stroke={item.color}
                  strokeDasharray={item.key === "price" ? "0" : "6 6"}
                  strokeOpacity={item.key === "price" ? 0.9 : 0.5}
                />
              );
            })}

            <path d={`${linePath} L ${lastX.toFixed(2)} ${height - padBottom} L ${padX} ${height - padBottom} Z`} fill="url(#bandar-price-fill)" />
            <path d={linePath} fill="none" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {ma20Path ? <path d={ma20Path} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="5 5" /> : null}
            {ma50Path ? <path d={ma50Path} fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="7 5" /> : null}
            <circle cx={lastX} cy={lastY} r="5.5" fill="#fb923c" stroke="#fff" strokeWidth="2" />

            <text x={padX} y={height - 6} fill="#64748b" fontSize="10">{formatChartDate(points[0]?.time)}</text>
            <text x={width - padX - 8} y={height - 6} fill="#64748b" fontSize="10" textAnchor="end">{formatChartDate(points[lastIndex]?.time)}</text>
          </svg>
        </div>

        <div className="grid grid-cols-1 gap-3 self-start">
          {prioritizedAnnotations.map((item) => (
            <div
              key={`${item.key}-side`}
              className="rounded-2xl border border-white/8 bg-slate-950/35 p-3.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: item.color }}>
                    {item.label}
                  </p>
                </div>
                <span className="text-sm font-semibold text-silver-100">
                  {item.value.toLocaleString("id-ID")}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-silver-400">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-silver-400">Cara Baca Cepat</p>
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
          {quickGuide.map((item) => (
            <div key={`${item.key}-guide`} className="rounded-2xl border border-white/8 bg-slate-950/30 p-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                <p className="text-sm font-semibold text-silver-100">{item.label}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-silver-400">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LegendPill({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full font-semibold text-silver-200 border border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function formatChartDate(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Belum pernah";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum pernah";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
