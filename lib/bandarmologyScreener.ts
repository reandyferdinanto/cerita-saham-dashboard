import { analyzeBandarmologyTicker, BandarmologyAnalysisResult } from "@/lib/bandarmologyAnalysis";
import { getIndonesiaStockUniverse } from "@/lib/indonesiaStockMaster";

export type ScreenerPreset =
  | "ideal"
  | "accumulation"
  | "breakout"
  | "demand"
  | "defensive"
  | "research_pullback"
  | "research_breakout"
  | "research_position";

export type PriceBucket = "all" | "under200" | "200to500" | "above500";

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

type CachedAnalysis = {
  expiresAt: number;
  value: BandarmologyAnalysisResult;
};

const ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000;
const analysisCache = new Map<string, CachedAnalysis>();

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
  if (row.summary.phase.toLowerCase().includes("akumulasi")) score += 26;
  if (row.metrics.obvSlope20 && row.metrics.obvSlope20 > 0) score += 18;
  if (row.metrics.adSlope20 && row.metrics.adSlope20 > 0) score += 18;
  if ((row.metrics.upDownVolumeRatio ?? 0) >= 1.05) score += 14;
  if ((row.metrics.priceVsMa20 ?? -99) >= -3) score += 10;
  if ((row.metrics.rsi ?? 0) >= 40 && (row.metrics.rsi ?? 100) <= 62) score += 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildBreakoutReadiness(row: BandarmologyAnalysisResult) {
  let score = 0;
  if ((row.metrics.breakoutDistancePct ?? 999) <= 2.5) score += 34;
  else if ((row.metrics.breakoutDistancePct ?? 999) <= 5) score += 24;
  else if ((row.metrics.breakoutDistancePct ?? 999) <= 8) score += 12;

  if ((row.metrics.volumeRatio5v20 ?? 0) >= 1.15) score += 20;
  else if ((row.metrics.volumeRatio5v20 ?? 0) >= 0.95) score += 12;

  if ((row.metrics.technicalScore ?? 0) >= 60) score += 16;
  if ((row.metrics.priceVsMa20 ?? -99) > 0) score += 12;
  if ((row.metrics.upDownVolumeRatio ?? 0) > 1.05) score += 10;
  if (row.summary.tone === "bullish") score += 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildFitScore(row: BandarmologyAnalysisResult) {
  let score = row.summary.conviction;
  const accumulationBias = buildAccumulationBias(row);
  const breakoutReadiness = buildBreakoutReadiness(row);

  score += Math.round(accumulationBias * 0.16);
  score += Math.round(breakoutReadiness * 0.18);

  if (row.summary.tone === "bullish") score += 12;
  if (row.metrics.technicalScore >= 60) score += 8;
  if ((row.metrics.upDownVolumeRatio ?? 0) > 1.05) score += 6;
  if ((row.metrics.volumeRatio5v20 ?? 0) >= 0.9 && (row.metrics.volumeRatio5v20 ?? 0) <= 1.8) score += 5;
  if ((row.metrics.priceVsMa50 ?? -99) > -2) score += 4;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildResearchFitScore(preset: ScreenerPreset, row: BandarmologyAnalysisResult) {
  let score = buildFitScore(row);
  const isLowPrice = row.quote.price < 200;
  const accumulationBias = buildAccumulationBias(row);
  const breakoutReadiness = buildBreakoutReadiness(row);

  if (preset === "research_pullback") {
    score += Math.round(accumulationBias * 0.12);
    if ((row.metrics.priceVsMa20 ?? -99) >= -3 && (row.metrics.priceVsMa20 ?? 99) <= 2) score += 8;
    if ((row.metrics.rsi ?? 0) >= 38 && (row.metrics.rsi ?? 100) <= 58) score += 8;
    if ((row.metrics.priceVsMa50 ?? -99) > 0) score += 6;
    if (isLowPrice) {
      if ((row.metrics.priceVsMa50 ?? -99) > -6) score += 6;
      if ((row.metrics.volumeRatio5v20 ?? 0) >= 0.75) score += 4;
      if ((row.metrics.upDownVolumeRatio ?? 0) >= 0.95) score += 4;
    }
  }

  if (preset === "research_breakout") {
    score += Math.round(breakoutReadiness * 0.15);
    if ((row.metrics.breakoutDistancePct ?? 999) <= 3.5) score += 10;
    if ((row.metrics.volumeRatio5v20 ?? 0) >= 1.1) score += 8;
    if ((row.metrics.technicalScore ?? 0) >= 58) score += 6;
  }

  if (preset === "research_position") {
    score += Math.round(accumulationBias * 0.1);
    if ((row.metrics.priceVsMa50 ?? -99) > 0) score += 10;
    if ((row.metrics.priceVsMa20 ?? -99) > 0) score += 6;
    if (row.summary.conviction >= 65) score += 6;
    if ((row.metrics.technicalScore ?? 0) >= 60) score += 6;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildResearchMeta(preset: ScreenerPreset, row: BandarmologyAnalysisResult) {
  switch (preset) {
    case "research_pullback":
      return {
        strategyLabel: "Trend Pullback",
        thesis: "Tren masih sehat, harga sedang retrace terukur, lalu menunggu momentum pulih tanpa rusak struktur.",
      };
    case "research_breakout":
      return {
        strategyLabel: "Breakout Volume",
        thesis: "Harga dekat high 20 hari dan butuh volume yang cukup untuk konfirmasi lanjutan 5-10%.",
      };
    case "research_position":
      return {
        strategyLabel: "Trend Position",
        thesis: "Struktur menengah masih sehat sehingga kandidat lebih layak untuk hold lebih panjang.",
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
  const isLowPrice = price < 200;
  const accumulationBias = buildAccumulationBias(row);
  const breakoutReadiness = buildBreakoutReadiness(row);

  switch (preset) {
    case "research_pullback":
      if (isLowPrice) {
        return (
          tone !== "bearish" &&
          tech >= 45 &&
          accumulationBias >= 42 &&
          priceVsMa50 > -6 &&
          priceVsMa20 >= -7 &&
          priceVsMa20 <= 1.5 &&
          (row.metrics.rsi ?? 0) >= 35 &&
          (row.metrics.rsi ?? 100) <= 56 &&
          upDown >= 0.9 &&
          vr >= 0.75 &&
          breakoutDistance >= 2
        );
      }
      return (
        tone !== "bearish" &&
        accumulationBias >= 46 &&
        priceVsMa50 > 0 &&
        priceVsMa20 >= -4.5 &&
        priceVsMa20 <= 0.8 &&
        (row.metrics.rsi ?? 0) >= 38 &&
        (row.metrics.rsi ?? 100) <= 52 &&
        upDown >= 0.95 &&
        breakoutDistance >= 2.5
      );
    case "research_breakout":
      return tone === "bullish" && breakoutReadiness >= 58 && breakoutDistance <= 2.5 && vr >= 1.15 && tech >= 60 && priceVsMa20 > 0.5;
    case "research_position":
      return tone === "bullish" && accumulationBias >= 55 && tech >= 62 && priceVsMa50 > 2 && upDown >= 1.05 && row.summary.conviction >= 65;
    case "accumulation":
      return (tone === "bullish" || row.summary.phase.toLowerCase().includes("akumulasi")) && accumulationBias >= 48 && upDown >= 1 && vr >= 0.8;
    case "breakout":
      return tone !== "bearish" && breakoutReadiness >= 48 && breakoutDistance <= 5 && tech >= 50;
    case "demand":
      return accumulationBias >= 44 && upDown >= 1.15 && vr >= 1 && priceVsMa20 > 0;
    case "defensive":
      return tone !== "bearish" && accumulationBias >= 38 && tech >= 45 && priceVsMa50 > -3;
    case "ideal":
    default:
      return tone !== "bearish" && accumulationBias >= 40 && tech >= 50 && upDown >= 1 && breakoutDistance <= 8 && priceVsMa20 > -2;
  }
}

function buildReasons(row: BandarmologyAnalysisResult) {
  const reasons: string[] = [];
  const accumulationBias = buildAccumulationBias(row);
  const breakoutReadiness = buildBreakoutReadiness(row);

  if (row.summary.phase.toLowerCase().includes("akumulasi")) reasons.push("fase akumulasi mulai terbaca");
  if (accumulationBias >= 55) reasons.push("jejak akumulasi relatif lebih rapi");
  if (row.summary.tone === "bullish") reasons.push("bias operator cenderung konstruktif");
  if ((row.metrics.upDownVolumeRatio ?? 0) > 1.1) reasons.push("volume naik lebih dominan dari volume turun");
  if ((row.metrics.volumeRatio5v20 ?? 0) >= 1) reasons.push("aktivitas volume 5 hari masih sehat");
  if (breakoutReadiness >= 55 || (row.metrics.breakoutDistancePct ?? 999) <= 5) reasons.push("harga cukup dekat ke area breakout");
  if ((row.metrics.priceVsMa20 ?? -99) > 0) reasons.push("harga sudah bertahan di atas MA20");
  if (reasons.length === 0) reasons.push("masuk kandidat observasi berdasarkan struktur harga-volume");
  return reasons.slice(0, 4);
}

function buildResearchReasons(preset: ScreenerPreset, row: BandarmologyAnalysisResult) {
  const reasons: string[] = [];
  const isLowPrice = row.quote.price < 200;
  const accumulationBias = buildAccumulationBias(row);
  const breakoutReadiness = buildBreakoutReadiness(row);

  if (preset === "research_pullback") {
    if (isLowPrice) {
      if ((row.metrics.priceVsMa50 ?? -99) > -6) reasons.push("harga murah masih cukup dekat struktur MA50");
      if ((row.metrics.priceVsMa20 ?? -99) >= -7 && (row.metrics.priceVsMa20 ?? 99) <= 1.5) reasons.push("pullback belum rusak meski volatilitas lebih tinggi");
      if ((row.metrics.rsi ?? 0) >= 35 && (row.metrics.rsi ?? 100) <= 56) reasons.push("RSI masih masuk zona pullback sehat untuk saham murah");
      if ((row.metrics.volumeRatio5v20 ?? 0) >= 0.75) reasons.push("aktivitas volume belum kering total");
    } else {
      if ((row.metrics.priceVsMa50 ?? -99) > 0) reasons.push("tren menengah masih di atas MA50");
      if ((row.metrics.priceVsMa20 ?? -99) >= -3 && (row.metrics.priceVsMa20 ?? 99) <= 2) reasons.push("pullback masih dekat struktur MA20");
      if ((row.metrics.rsi ?? 0) >= 38 && (row.metrics.rsi ?? 100) <= 58) reasons.push("RSI berada di zona pullback sehat");
    }
    if (accumulationBias >= 48) reasons.push("jejak akumulasi belum benar-benar hilang");
    if ((row.metrics.upDownVolumeRatio ?? 0) >= 1) reasons.push("tekanan demand belum kalah dari supply");
  }

  if (preset === "research_breakout") {
    if ((row.metrics.breakoutDistancePct ?? 999) <= 3.5) reasons.push("harga sudah dekat high 20 hari");
    if (breakoutReadiness >= 58) reasons.push("readiness breakout relatif matang");
    if ((row.metrics.volumeRatio5v20 ?? 0) >= 1.1) reasons.push("volume 5 hari cukup aktif untuk modal breakout");
    if ((row.metrics.technicalScore ?? 0) >= 58) reasons.push("skor teknikal mendukung skenario lanjutan");
  }

  if (preset === "research_position") {
    if ((row.metrics.priceVsMa50 ?? -99) > 0) reasons.push("harga menjaga tren di atas MA50");
    if (accumulationBias >= 55) reasons.push("jejak akumulasi menengah masih sehat");
    if (row.summary.conviction >= 65) reasons.push("conviction cukup kuat untuk hold lebih panjang");
    if ((row.metrics.upDownVolumeRatio ?? 0) > 1.05) reasons.push("demand menengah lebih dominan");
  }

  return reasons.length > 0 ? reasons.slice(0, 4) : buildReasons(row);
}

function passesPriceBucket(bucket: PriceBucket, price: number) {
  switch (bucket) {
    case "under200":
      return price < 200;
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
}) {
  const preset = args?.preset || "ideal";
  const priceBucket = args?.priceBucket || "all";
  const limit = Math.min(args?.limit ?? 8, 24);
  const candidateLimit = Math.min(args?.candidateLimit ?? (priceBucket === "under200" ? 180 : 140), 220);
  const universe = await getIndonesiaStockUniverse({ priceBucket, candidateLimit });

  const searchResults = await Promise.all(
    universe.stocks.map(async ({ ticker, name }) => {
      try {
        const analysis = await getAnalysisWithCache(ticker, name);
        const isResearchPreset = preset.startsWith("research_");
        const meta = buildResearchMeta(preset, analysis);
        const accumulationBias = buildAccumulationBias(analysis);
        const breakoutReadiness = buildBreakoutReadiness(analysis);

        return {
          analysis,
          fitScore: isResearchPreset ? buildResearchFitScore(preset, analysis) : buildFitScore(analysis),
          reasons: isResearchPreset ? buildResearchReasons(preset, analysis) : buildReasons(analysis),
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

  const rows: BandarmologyScreenerRow[] = searchResults
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .filter((row) => passesPriceBucket(priceBucket, row.analysis.quote.price))
    .filter((row) => passesPreset(preset, row.analysis))
    .sort((a, b) => {
      const fitDiff = b.fitScore - a.fitScore;
      if (fitDiff !== 0) return fitDiff;
      const convictionDiff = b.analysis.summary.conviction - a.analysis.summary.conviction;
      if (convictionDiff !== 0) return convictionDiff;
      return b.breakoutReadiness - a.breakoutReadiness;
    })
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
      reasons: row.reasons,
      strategyLabel: row.strategyLabel,
      thesis: row.thesis,
      accumulationBias: row.accumulationBias,
      breakoutReadiness: row.breakoutReadiness,
    }));

  return {
    preset,
    priceBucket,
    universeSize: universe.masterUniverseSize,
    bucketUniverseSize: universe.bucketUniverseSize,
    analyzedUniverseSize: universe.analyzedUniverseSize,
    rows,
  };
}
