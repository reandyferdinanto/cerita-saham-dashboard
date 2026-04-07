import { analyzeBandarmologyTicker, BandarmologyAnalysisResult } from "@/lib/bandarmologyAnalysis";
import { connectDB } from "@/lib/db";
import { getIndonesiaStockUniverse } from "@/lib/indonesiaStockMaster";
import BandarmologyScreenerSnapshot from "@/lib/models/BandarmologyScreenerSnapshot";

export type ScreenerPreset =
  | "support_lock"
  | "sideways_accumulation"
  | "early_markup"
  | "demand_surge"
  | "washout_reclaim"
  | "under300_focus"
  | "markup_scout"
  | "stealth_rotation";

export type PriceBucket = "all" | "under200" | "under300" | "200to500" | "above500";

export type BandarmologyScreenerRow = {
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
};

type BandarmologyScreenerResult = {
  preset: ScreenerPreset;
  priceBucket: PriceBucket;
  universeSize: number;
  bucketUniverseSize: number;
  analyzedUniverseSize: number;
  rows: BandarmologyScreenerRow[];
  snapshotDate: string;
  snapshotSource: "fresh" | "snapshot";
  usedFallback?: boolean;
};

type CachedAnalysis = {
  expiresAt: number;
  value: BandarmologyAnalysisResult;
};

const ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000;
const SCREENER_SNAPSHOT_VERSION = "v2";
const analysisCache = new Map<string, CachedAnalysis>();

function getSnapshotDate(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function getCachedAnalysis(ticker: string) {
  const key = ticker.toUpperCase();
  const cached = analysisCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    analysisCache.delete(key);
    return null;
  }
  return cached.value;
}

async function getAnalysisWithCache(ticker: string, name?: string) {
  const cached = getCachedAnalysis(ticker);
  if (cached) return cached;

  const fresh = await analyzeBandarmologyTicker(ticker, name);
  analysisCache.set(ticker.toUpperCase(), {
    expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS,
    value: fresh,
  });
  return fresh;
}

function buildAccumulationBias(row: BandarmologyAnalysisResult) {
  let score = 0;
  const phase = row.summary.phase.toLowerCase();
  const price = row.quote.price;
  const isCheap = price > 0 && price <= 300;

  if (phase.includes("akumulasi")) score += 24;
  if (row.summary.phase === "Support dikunci bandar") score += 18;
  if (row.summary.phase === "Sideways akumulasi senyap") score += 18;
  if (row.metrics.obvSlope20 && row.metrics.obvSlope20 > 0) score += 16;
  if (row.metrics.adSlope20 && row.metrics.adSlope20 > 0) score += 16;
  if ((row.metrics.upDownVolumeRatio ?? 0) >= 1.02) score += 10;
  if ((row.metrics.upDownVolumeRatio ?? 0) >= 1.12) score += 6;
  if ((row.metrics.priceVsMa20 ?? -99) >= -3.5 && (row.metrics.priceVsMa20 ?? 99) <= 2.2) score += 12;
  if ((row.metrics.volumeRatio5v20 ?? 0) >= 0.75 && (row.metrics.volumeRatio5v20 ?? 0) <= 1.35) score += 10;
  if ((row.metrics.rsi ?? 0) >= 36 && (row.metrics.rsi ?? 100) <= 60) score += 8;
  if (isCheap) score += 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildBreakoutReadiness(row: BandarmologyAnalysisResult) {
  let score = 0;
  const distance = row.metrics.breakoutDistancePct ?? 999;
  const isCheap = row.quote.price > 0 && row.quote.price <= 300;

  if (row.summary.phase === "Markup dini") score += 18;
  if (distance <= 3) score += 26;
  else if (distance <= 6) score += 22;
  else if (distance <= 10) score += 14;
  else if (distance <= 14) score += 8;

  if ((row.metrics.volumeRatio5v20 ?? 0) >= 1.05) score += 12;
  else if ((row.metrics.volumeRatio5v20 ?? 0) >= 0.8) score += 8;

  if ((row.metrics.technicalScore ?? 0) >= 48) score += 10;
  if ((row.metrics.priceVsMa20 ?? -99) >= -1 && (row.metrics.priceVsMa20 ?? 99) <= 3.8) score += 14;
  if ((row.metrics.upDownVolumeRatio ?? 0) > 1.05) score += 14;
  if (row.summary.tone === "bullish") score += 8;
  if (isCheap) score += 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getSupportDistancePct(row: BandarmologyAnalysisResult) {
  const support = row.metrics.support[0];
  if (!support || support <= 0 || row.quote.price <= 0) return null;
  return ((row.quote.price - support) / support) * 100;
}

function buildSupportDefenseScore(row: BandarmologyAnalysisResult) {
  let score = 0;
  const distance = getSupportDistancePct(row);
  const isCheap = row.quote.price > 0 && row.quote.price <= 300;

  if (row.summary.phase === "Support dikunci bandar") score += 24;
  if (row.summary.phase === "Akumulasi di support") score += 18;
  if (distance != null && distance <= 2.5) score += 24;
  else if (distance != null && distance <= 5) score += 18;
  else if (distance != null && distance <= 8) score += 10;
  if ((row.metrics.obvSlope20 ?? 0) > 0) score += 14;
  if ((row.metrics.adSlope20 ?? 0) > 0) score += 14;
  if ((row.metrics.upDownVolumeRatio ?? 0) >= 1) score += 12;
  if ((row.metrics.priceVsMa20 ?? -99) >= -3.5 && (row.metrics.priceVsMa20 ?? 99) <= 1.5) score += 10;
  if (isCheap) score += 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildStealthAccumulationScore(row: BandarmologyAnalysisResult) {
  let score = 0;
  const phase = row.summary.phase;
  const isCheap = row.quote.price > 0 && row.quote.price <= 300;
  const vr = row.metrics.volumeRatio5v20 ?? 0;
  const upDown = row.metrics.upDownVolumeRatio ?? 0;

  if (phase === "Sideways akumulasi senyap") score += 28;
  if (phase === "Support dikunci bandar") score += 18;
  if ((row.metrics.obvSlope20 ?? 0) > 0) score += 14;
  if ((row.metrics.adSlope20 ?? 0) > 0) score += 14;
  if (vr >= 0.7 && vr <= 1.2) score += 12;
  if (upDown >= 0.98 && upDown <= 1.18) score += 10;
  if ((row.metrics.priceVsMa20 ?? -99) >= -4 && (row.metrics.priceVsMa20 ?? 99) <= 2) score += 10;
  if ((row.metrics.rsi ?? 0) >= 35 && (row.metrics.rsi ?? 100) <= 58) score += 8;
  if (isCheap) score += 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildFitScore(row: BandarmologyAnalysisResult) {
  let score = row.summary.conviction;
  const accumulationBias = buildAccumulationBias(row);
  const breakoutReadiness = buildBreakoutReadiness(row);
  const supportDefense = buildSupportDefenseScore(row);
  const stealthAccumulation = buildStealthAccumulationScore(row);
  const price = row.quote.price;

  score += Math.round(accumulationBias * 0.18);
  score += Math.round(breakoutReadiness * 0.16);
  score += Math.round(supportDefense * 0.18);
  score += Math.round(stealthAccumulation * 0.12);

  if (row.summary.tone === "bullish") score += 8;
  if (price > 0 && price <= 300) score += 12;
  else if (price <= 500) score += 4;
  else score -= 10;
  if (row.summary.phase === "Support dikunci bandar") score += 10;
  if (row.summary.phase === "Sideways akumulasi senyap") score += 8;
  if (row.summary.phase === "Markup dini") score += 8;
  if ((row.metrics.upDownVolumeRatio ?? 0) > 1.08) score += 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildPresetFitScore(preset: ScreenerPreset, row: BandarmologyAnalysisResult) {
  let score = buildFitScore(row);
  const accumulationBias = buildAccumulationBias(row);
  const breakoutReadiness = buildBreakoutReadiness(row);
  const supportDefense = buildSupportDefenseScore(row);
  const stealthAccumulation = buildStealthAccumulationScore(row);
  const cheap = row.quote.price > 0 && row.quote.price <= 300;

  switch (preset) {
    case "support_lock":
      score += Math.round(supportDefense * 0.2);
      if (cheap) score += 8;
      break;
    case "sideways_accumulation":
      score += Math.round(stealthAccumulation * 0.24);
      if (cheap) score += 8;
      break;
    case "early_markup":
      score += Math.round(breakoutReadiness * 0.22);
      if (cheap) score += 6;
      break;
    case "demand_surge":
      score += Math.round(accumulationBias * 0.12);
      if ((row.metrics.upDownVolumeRatio ?? 0) >= 1.15) score += 10;
      break;
    case "washout_reclaim":
      score += Math.round(supportDefense * 0.1);
      if ((row.metrics.priceVsMa50 ?? -99) > -8) score += 8;
      break;
    case "under300_focus":
      score += cheap ? 18 : -18;
      score += Math.round(accumulationBias * 0.12);
      break;
    case "markup_scout":
      score += Math.round(breakoutReadiness * 0.18);
      score += Math.round(supportDefense * 0.08);
      break;
    case "stealth_rotation":
      score += Math.round(stealthAccumulation * 0.18);
      score += Math.round(accumulationBias * 0.08);
      break;
    default:
      break;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildPresetMeta(preset: ScreenerPreset, row: BandarmologyAnalysisResult) {
  switch (preset) {
    case "support_lock":
      return {
        strategyLabel: "Support Dijaga",
        thesis: "Fokus ke saham yang support-nya dijaga sambil barang diserap, lalu menunggu dorongan ke resistance terdekat.",
      };
    case "sideways_accumulation":
      return {
        strategyLabel: "Sideways Rapi",
        thesis: "Fokus ke saham yang bergerak tenang dengan volume tidak meledak, tetapi OBV/A-D dan demand masih memberi jejak akumulasi diam-diam.",
      };
    case "early_markup":
      return {
        strategyLabel: "Mulai Naik",
        thesis: "Fokus ke saham yang sudah dipelihara dan mulai siap didorong menuju resistance atau breakout pendek.",
      };
    case "demand_surge":
      return {
        strategyLabel: "Beli Menguat",
        thesis: "Fokus ke kandidat dengan tekanan beli yang mulai terlihat lebih kuat daripada supply, sering jadi tanda bandar mulai menampakkan tangan.",
      };
    case "washout_reclaim":
      return {
        strategyLabel: "Rebut Balik",
        thesis: "Fokus ke saham yang sempat ditekan, tetapi tidak lanjut dibuang dan mulai direbut kembali secara perlahan.",
      };
    case "under300_focus":
      return {
        strategyLabel: "Harga Murah",
        thesis: "Fokus ke saham di bawah 300 yang masih punya jejak akumulasi dan ruang markup jangka dekat.",
      };
    case "markup_scout":
      return {
        strategyLabel: "Siap Naik",
        thesis: "Mencari kandidat yang belum meledak, tetapi sudah punya kombinasi support defense, demand, dan jarak dekat ke area markup.",
      };
    case "stealth_rotation":
      return {
        strategyLabel: "Perpindahan Senyap",
        thesis: "Mencari perpindahan minat bandar yang belum ramai: sideways, volume tidak berisik, tetapi barang tampak belum dilepas.",
      };
    default:
      return {
        strategyLabel: row.summary.phase,
        thesis: row.summary.actionBias,
      };
  }
}

function passesPreset(preset: ScreenerPreset, row: BandarmologyAnalysisResult) {
  const tone = row.summary.tone;
  const vr = row.metrics.volumeRatio5v20 ?? 0;
  const upDown = row.metrics.upDownVolumeRatio ?? 0;
  const breakoutDistance = row.metrics.breakoutDistancePct ?? 999;
  const tech = row.metrics.technicalScore;
  const priceVsMa20 = row.metrics.priceVsMa20 ?? -99;
  const priceVsMa50 = row.metrics.priceVsMa50 ?? -99;
  const price = row.quote.price;
  const accumulationBias = buildAccumulationBias(row);
  const breakoutReadiness = buildBreakoutReadiness(row);
  const supportDefense = buildSupportDefenseScore(row);
  const stealthAccumulation = buildStealthAccumulationScore(row);
  const isCheap = price <= 300;

  switch (preset) {
    case "support_lock":
      return (
        tone !== "bearish" &&
        isCheap &&
        supportDefense >= 55 &&
        accumulationBias >= 48 &&
        upDown >= 1 &&
        vr >= 0.72 &&
        priceVsMa20 >= -3.6 &&
        priceVsMa20 <= 1.5 &&
        breakoutDistance <= 12
      );
    case "sideways_accumulation":
      return (
        tone !== "bearish" &&
        isCheap &&
        stealthAccumulation >= 58 &&
        accumulationBias >= 46 &&
        priceVsMa20 >= -4 &&
        priceVsMa20 <= 2 &&
        (row.metrics.rsi ?? 0) >= 35 &&
        (row.metrics.rsi ?? 100) <= 58 &&
        vr >= 0.68 &&
        vr <= 1.28 &&
        upDown >= 0.96
      );
    case "early_markup":
      return tone !== "bearish" && isCheap && breakoutReadiness >= 56 && breakoutDistance <= 8 && upDown >= 1.03 && tech >= 45;
    case "demand_surge":
      return tone !== "bearish" && isCheap && accumulationBias >= 44 && upDown >= 1.18 && vr >= 0.92 && priceVsMa20 > -1.5;
    case "washout_reclaim":
      return tone !== "bearish" && price <= 500 && supportDefense >= 42 && tech >= 42 && priceVsMa50 > -10 && priceVsMa20 > -2;
    case "under300_focus":
      return tone !== "bearish" && isCheap && accumulationBias >= 46 && supportDefense >= 40 && breakoutDistance <= 14;
    case "markup_scout":
      return tone !== "bearish" && isCheap && breakoutReadiness >= 52 && supportDefense >= 45 && breakoutDistance <= 10;
    case "stealth_rotation":
      return tone !== "bearish" && price <= 500 && stealthAccumulation >= 60 && accumulationBias >= 44 && vr >= 0.7 && vr <= 1.25;
    default:
      return tone !== "bearish" && isCheap && accumulationBias >= 46 && supportDefense >= 40 && breakoutDistance <= 14;
  }
}

function buildReasons(row: BandarmologyAnalysisResult) {
  const reasons: string[] = [];
  const accumulationBias = buildAccumulationBias(row);
  const breakoutReadiness = buildBreakoutReadiness(row);
  const supportDefense = buildSupportDefenseScore(row);
  const stealthAccumulation = buildStealthAccumulationScore(row);
  const supportDistance = getSupportDistancePct(row);

  if (row.quote.price > 0 && row.quote.price <= 300) reasons.push("harga masih masuk radar anomali saham yang belum ramai");
  if (row.summary.phase === "Support dikunci bandar") reasons.push("support utama terlihat sedang dikunci");
  if (row.summary.phase === "Sideways akumulasi senyap") reasons.push("sideways rapi dengan indikasi akumulasi diam-diam");
  if (row.summary.phase === "Markup dini") reasons.push("struktur mulai masuk fase markup dini");
  if (supportDefense >= 58) reasons.push("jarak ke support masih dekat sehingga risk-reward lebih terukur");
  if (stealthAccumulation >= 60) reasons.push("volume belum berisik, tetapi jejak serap barang mulai terlihat");
  if (accumulationBias >= 55) reasons.push("OBV/A-D dan rasio volume mendukung akumulasi");
  if ((row.metrics.upDownVolumeRatio ?? 0) > 1.1) reasons.push("volume naik lebih dominan dari volume turun");
  if (breakoutReadiness >= 55 || (row.metrics.breakoutDistancePct ?? 999) <= 6) reasons.push("resistance cukup dekat untuk skenario markup pendek");
  if (supportDistance != null && supportDistance <= 3.5) reasons.push("harga belum jauh dari support penjaga");
  if (reasons.length === 0) reasons.push("masuk kandidat observasi karena struktur harga-volume mulai berubah");
  return reasons.slice(0, 4);
}

function buildPresetReasons(preset: ScreenerPreset, row: BandarmologyAnalysisResult) {
  const reasons: string[] = [];
  const supportDefense = buildSupportDefenseScore(row);
  const stealthAccumulation = buildStealthAccumulationScore(row);
  const breakoutReadiness = buildBreakoutReadiness(row);
  const accumulationBias = buildAccumulationBias(row);

  switch (preset) {
    case "support_lock":
      if (supportDefense >= 55) reasons.push("support sedang dijaga rapi");
      if ((row.metrics.upDownVolumeRatio ?? 0) >= 1) reasons.push("demand masih menahan supply");
      if ((row.metrics.breakoutDistancePct ?? 999) <= 12) reasons.push("masih ada ruang markup ke resistance terdekat");
      break;
    case "sideways_accumulation":
      if (stealthAccumulation >= 60) reasons.push("sideways belum ramai tetapi akumulasi mulai terbaca");
      if ((row.metrics.volumeRatio5v20 ?? 0) >= 0.7 && (row.metrics.volumeRatio5v20 ?? 0) <= 1.2) reasons.push("volume relatif kalem, cocok untuk pola parkir bandar");
      if ((row.metrics.obvSlope20 ?? 0) > 0 && (row.metrics.adSlope20 ?? 0) > 0) reasons.push("OBV dan A/D tetap naik saat harga mendatar");
      break;
    case "early_markup":
      if (breakoutReadiness >= 56) reasons.push("dorongan markup mulai matang");
      if ((row.metrics.breakoutDistancePct ?? 999) <= 8) reasons.push("resistance cukup dekat untuk diserang");
      if ((row.metrics.upDownVolumeRatio ?? 0) >= 1.03) reasons.push("tenaga beli mulai mengungguli supply");
      break;
    case "demand_surge":
      if ((row.metrics.upDownVolumeRatio ?? 0) >= 1.18) reasons.push("demand surge mulai terlihat jelas");
      if ((row.metrics.volumeRatio5v20 ?? 0) >= 0.92) reasons.push("aktivitas volume cukup hidup");
      break;
    case "washout_reclaim":
      if ((row.metrics.priceVsMa20 ?? -99) > -2) reasons.push("harga mulai direbut kembali setelah tekanan");
      if (supportDefense >= 42) reasons.push("support bawah masih sanggup menahan");
      break;
    case "under300_focus":
      reasons.push("fokus ke saham di bawah 300");
      if (accumulationBias >= 46) reasons.push("masih ada jejak akumulasi yang layak dipantau");
      break;
    case "markup_scout":
      if (breakoutReadiness >= 52) reasons.push("potensi serangan ke area markup mulai dekat");
      if (supportDefense >= 45) reasons.push("risk-reward masih terbantu support");
      break;
    case "stealth_rotation":
      if (stealthAccumulation >= 60) reasons.push("rotasi bandar masih senyap");
      if (accumulationBias >= 44) reasons.push("supply belum tampak dibuang agresif");
      break;
    default:
      break;
  }

  return reasons.length > 0 ? reasons.slice(0, 4) : buildReasons(row);
}

function passesPriceBucket(bucket: PriceBucket, price: number) {
  switch (bucket) {
    case "under200":
      return price < 200;
    case "under300":
      return price < 300;
    case "200to500":
      return price >= 200 && price <= 500;
    case "above500":
      return price > 500;
    case "all":
    default:
      return true;
  }
}

export async function getBandarmologyScreener(args?: {
  preset?: ScreenerPreset;
  priceBucket?: PriceBucket;
  limit?: number;
  candidateLimit?: number;
  preferSnapshot?: boolean;
  persistSnapshot?: boolean;
}) {
  const preset = args?.preset || "under300_focus";
  const priceBucket = args?.priceBucket || "under300";
  const limit = Math.min(args?.limit ?? 8, 24);
  const candidateLimit = Math.min(args?.candidateLimit ?? (priceBucket === "under200" || priceBucket === "under300" ? 200 : 150), 260);
  const snapshotDate = getSnapshotDate();
  const preferSnapshot = args?.preferSnapshot ?? true;
  const persistSnapshot = args?.persistSnapshot ?? true;

  if (preferSnapshot) {
    try {
      await connectDB();
      const snapshot = await BandarmologyScreenerSnapshot.findOne({
        snapshotDate,
        snapshotVersion: SCREENER_SNAPSHOT_VERSION,
        preset,
        priceBucket,
      }).lean();

      if (snapshot && Array.isArray(snapshot.rows) && snapshot.rows.length > 0) {
        return {
          preset,
          priceBucket,
          universeSize: snapshot.universeSize,
          bucketUniverseSize: snapshot.bucketUniverseSize,
          analyzedUniverseSize: snapshot.analyzedUniverseSize,
          rows: snapshot.rows.slice(0, limit),
          snapshotDate,
          snapshotSource: "snapshot" as const,
        };
      }
    } catch {
      // Snapshot persistence is an optimization, so the screener should still work without it.
    }
  }

  const universe = await getIndonesiaStockUniverse({ priceBucket, candidateLimit });

  const searchResults = await Promise.all(
    universe.stocks.map(async ({ ticker, name }) => {
      try {
        const analysis = await getAnalysisWithCache(ticker, name);
        const meta = buildPresetMeta(preset, analysis);
        const accumulationBias = buildAccumulationBias(analysis);
        const breakoutReadiness = buildBreakoutReadiness(analysis);

        return {
          analysis,
          fitScore: buildPresetFitScore(preset, analysis),
          reasons: buildPresetReasons(preset, analysis),
          strategyLabel: meta.strategyLabel,
          thesis: meta.thesis,
          accumulationBias,
          breakoutReadiness,
        };
      } catch {
        return null;
      }
    })
  );

  const rankedRows = searchResults
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .filter((row) => passesPriceBucket(priceBucket, row.analysis.quote.price))
    .sort((a, b) => {
      const fitDiff = b.fitScore - a.fitScore;
      if (fitDiff !== 0) return fitDiff;
      const convictionDiff = b.analysis.summary.conviction - a.analysis.summary.conviction;
      if (convictionDiff !== 0) return convictionDiff;
      return b.breakoutReadiness - a.breakoutReadiness;
    });

  const presetRows = rankedRows.filter((row) => passesPreset(preset, row.analysis));
  const fallbackRows =
    presetRows.length > 0
      ? presetRows
      : rankedRows.filter((row) => row.analysis.summary.tone !== "bearish" && row.analysis.summary.conviction >= 40);
  const usedFallback = presetRows.length === 0 && fallbackRows.length > 0;

  const rows: BandarmologyScreenerRow[] = fallbackRows
    .slice(0, limit)
    .map((row) => ({
      ticker: row.analysis.ticker,
      name: row.analysis.name,
      fitScore: row.fitScore,
      phase: row.analysis.summary.phase,
      operatorBias: row.analysis.summary.operatorBias,
      actionBias: row.analysis.summary.actionBias,
      tone: row.analysis.summary.tone,
      conviction: row.analysis.summary.conviction,
      price: row.analysis.quote.price,
      changePercent: row.analysis.quote.changePercent,
      breakoutDistancePct: row.analysis.metrics.breakoutDistancePct,
      volumeRatio5v20: row.analysis.metrics.volumeRatio5v20,
      upDownVolumeRatio: row.analysis.metrics.upDownVolumeRatio,
      priceVsMa20: row.analysis.metrics.priceVsMa20,
      priceVsMa50: row.analysis.metrics.priceVsMa50,
      rsi: row.analysis.metrics.rsi,
      support: row.analysis.metrics.support,
      resistance: row.analysis.metrics.resistance,
      obvSlope20: row.analysis.metrics.obvSlope20,
      adSlope20: row.analysis.metrics.adSlope20,
      technicalScore: row.analysis.metrics.technicalScore,
      reasons: usedFallback
        ? ["filter preset hari ini terlalu ketat, jadi ini kandidat terdekat yang masih layak dipantau", ...row.reasons].slice(0, 4)
        : row.reasons,
      strategyLabel: row.strategyLabel,
      thesis: row.thesis,
      accumulationBias: row.accumulationBias,
      breakoutReadiness: row.breakoutReadiness,
    }));

  const result: BandarmologyScreenerResult = {
    preset,
    priceBucket,
    universeSize: universe.masterUniverseSize,
    bucketUniverseSize: universe.bucketUniverseSize,
    analyzedUniverseSize: universe.analyzedUniverseSize,
    rows,
    snapshotDate,
    snapshotSource: "fresh",
    usedFallback,
  };

  if (persistSnapshot) {
    try {
      await connectDB();
      await BandarmologyScreenerSnapshot.findOneAndUpdate(
        { snapshotDate, snapshotVersion: SCREENER_SNAPSHOT_VERSION, preset, priceBucket },
        {
          $set: {
            snapshotDate,
            snapshotVersion: SCREENER_SNAPSHOT_VERSION,
            preset,
            priceBucket,
            universeSize: result.universeSize,
            bucketUniverseSize: result.bucketUniverseSize,
            analyzedUniverseSize: result.analyzedUniverseSize,
            rows: result.rows,
            usedFallback: result.usedFallback,
          },
        },
        { upsert: true, new: true }
      );
    } catch {
      // Ignore snapshot write failures so the primary screener flow stays available.
    }
  }

  return result;
}
