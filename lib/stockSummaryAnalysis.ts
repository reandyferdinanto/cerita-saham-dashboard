import { connectDB } from "@/lib/db";
import StockSummaryRow, { IStockSummaryRow } from "@/lib/models/StockSummaryRow";
import { analyzeBandarmologyTicker, BandarmologyAnalysisResult } from "@/lib/bandarmologyAnalysis";
import { buildTechnicalSnapshot, OHLCVRow, SetupTag, TradePlan } from "@/lib/technicalIndicators";

export type StockAccumulationCandidate = {
  stockCode: string;
  companyName: string | null;
  close: number | null;
  change: number | null;
  volume: number | null;
  value: number | null;
  foreignBuy: number | null;
  foreignSell: number | null;
  bidVolume: number | null;
  offerVolume: number | null;
  accumulationScore: number;
  readinessScore: number;
  netForeign: number;
  closeToHighPercent: number | null;
  bidOfferRatio: number | null;
  convictionScore: number;
  convictionLabel: "Sangat Kuat" | "Kuat" | "Menarik" | "Awal";
  phase: "Akumulasi Kuat" | "Akumulasi Siap Jalan" | "Pantau";
  reasons: string[];
  summary: string;
  recentPositiveForeignDays: number;
  recentStrongCloseDays: number;
  recentLocalPressureDays: number;
  windowDays: number;
  bandarmologyPhase: string | null;
  bandarmologyTone: "bullish" | "neutral" | "bearish" | "warning" | null;
  bandarmologyAlignment: "selaras" | "campuran" | "bertabrakan" | "tidak_tersedia";
  bandarmologyNote: string | null;
  // --- Technical analysis additions ---
  atr14: number | null;
  rvol: number | null;
  mfi14: number | null;
  rsi14: number | null;
  macdHistogram: number | null;
  macdRising: boolean;
  bbSqueeze: boolean;
  bbWidthPercent: number | null;
  setups: SetupTag[];
  tradePlan: TradePlan | null;
  technicalScore: number; // 0-50 bonus from technical setups
  // --- Risk warnings ---
  changePercent: number | null; // Daily move on screening date
  pumpExhaustion: boolean; // Daily move >12% — likely late-stage pump
  riskWarnings: string[]; // Human-readable cautions
};

export type StockAccumulationSeriesPoint = {
  time: string;
  localAccumulation: number;
  foreignAccumulation: number;
  close: number | null;
  netForeign: number;
  localPressure: number;
};

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function ratio(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

function percentDistance(top: number, bottom: number) {
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || top <= 0) return null;
  return ((top - bottom) / top) * 100;
}

function round(value: number | null, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildLocalPressure(row: IStockSummaryRow) {
  const close = safeNumber(row.close);
  const high = safeNumber(row.high);
  const low = safeNumber(row.low);
  const openPrice = safeNumber(row.openPrice);
  const value = safeNumber(row.value);
  const bidVolume = safeNumber(row.bidVolume);
  const offerVolume = safeNumber(row.offerVolume);

  const closeStrength = high > low ? (close - low) / (high - low) : 0.5;
  const bidOfferEdge = offerVolume > 0 ? Math.min(bidVolume / offerVolume, 3) : bidVolume > 0 ? 2 : 1;
  const intradayPush = openPrice > 0 ? ((close - openPrice) / openPrice) * 100 : 0;
  const liquidityBoost = value >= 15_000_000_000 ? 1.18 : value >= 5_000_000_000 ? 1 : value >= 1_500_000_000 ? 0.9 : 0.78;

  return ((closeStrength * 50) + ((bidOfferEdge - 1) * 30) + Math.max(intradayPush, -2) * 6) * liquidityBoost;
}

function describePhasePlain(phase: string): string {
  // Short, plain-Indonesian explanation of what the bandarmology phase actually means for traders.
  const map: Record<string, string> = {
    "Support dikunci bandar": "Bandar terlihat menjaga area support — tiap turun langsung diserap, jadi harga sulit jatuh.",
    "Akumulasi di support": "Smart money pelan-pelan mengumpulkan barang di area support sambil menahan harga.",
    "Sideways akumulasi senyap": "Harga gerak datar tapi barang justru diserap diam-diam — fase build-up sebelum naik.",
    "Markup dini": "Bandar baru mulai menggerakkan harga naik. Masih dekat area kumpul, jadi belum terlambat.",
    "Akumulasi menuju markup": "Volume mulai naik dan harga mendekati breakout — bandar sedang siap-siap dorong.",
    "Markup sehat": "Tren naik berjalan sehat: harga di atas MA20 dan MA50, volume bullish dominan.",
    "Trend pullback sehat": "Lagi koreksi sehat ke MA20. Demand masih jaga struktur — pullback wajar sebelum lanjut naik.",
    "Reclaim awal": "Harga baru saja merebut MA20 dari bawah. Sinyal awal pemulihan, butuh follow-through.",
    "Base building": "Lagi bikin dasar — range sempit + volume serap. Belum jalan, tapi pondasi terlihat solid.",
    "Akumulasi dalam range": "Ada jejak akumulasi (OBV+, A/D+) walau belum jelas bias arahnya.",
    "False breakout risk": "Harga dekat breakout tapi volume belum mendukung — risiko gagal breakout cukup tinggi.",
    "Distribusi dalam range": "Lebih banyak supply dilepas daripada demand. Belum drop tajam, tapi tekanan jual ada.",
    "Markdown / distribusi lanjut": "Trend turun + bandar lepas barang. Hindari buy, struktur masih lemah.",
    "Netral / transisi": "Belum ada jejak bandar yang dominan — saham lagi di fase transisi tanpa arah jelas.",
  };
  return map[phase] || `Fase "${phase}" — belum cukup jelas arahnya berdasarkan jejak bandar.`;
}

function buildEvidenceFromMetrics(metrics: BandarmologyAnalysisResult["metrics"]): string {
  const evidence: string[] = [];

  if (metrics.priceVsMa20 != null) {
    const sign = metrics.priceVsMa20 >= 0 ? "+" : "";
    evidence.push(`harga ${sign}${metrics.priceVsMa20.toFixed(1)}% vs MA20`);
  }
  if (metrics.volumeRatio5v20 != null) {
    if (metrics.volumeRatio5v20 >= 1.3) {
      evidence.push(`volume 5H ${metrics.volumeRatio5v20.toFixed(2)}x vs 20H (aktif)`);
    } else if (metrics.volumeRatio5v20 <= 0.8) {
      evidence.push(`volume 5H ${metrics.volumeRatio5v20.toFixed(2)}x vs 20H (sepi)`);
    }
  }
  if (metrics.upDownVolumeRatio != null) {
    if (metrics.upDownVolumeRatio >= 1.2) {
      evidence.push(`up/down vol ${metrics.upDownVolumeRatio.toFixed(2)}x (demand dominan)`);
    } else if (metrics.upDownVolumeRatio <= 0.8) {
      evidence.push(`up/down vol ${metrics.upDownVolumeRatio.toFixed(2)}x (supply dominan)`);
    }
  }
  if (metrics.obvSlope20 != null && metrics.adSlope20 != null) {
    if (metrics.obvSlope20 > 0 && metrics.adSlope20 > 0) {
      evidence.push("OBV & A/D naik (akumulasi)");
    } else if (metrics.obvSlope20 < 0 && metrics.adSlope20 < 0) {
      evidence.push("OBV & A/D turun (distribusi)");
    }
  }
  if (metrics.breakoutDistancePct != null && metrics.breakoutDistancePct <= 5) {
    evidence.push(`${metrics.breakoutDistancePct.toFixed(1)}% dari breakout 20H`);
  }
  if (metrics.rsi != null) {
    if (metrics.rsi >= 70) evidence.push(`RSI ${metrics.rsi.toFixed(0)} (overbought)`);
    else if (metrics.rsi <= 35) evidence.push(`RSI ${metrics.rsi.toFixed(0)} (oversold)`);
  }

  return evidence.slice(0, 4).join(" · ");
}

function buildBandarmologyAlignment(analysis: BandarmologyAnalysisResult) {
  const phase = analysis.summary.phase;
  const tone = analysis.summary.tone;
  const conviction = analysis.summary.conviction;
  const operatorBias = analysis.summary.operatorBias;
  const phasePlain = describePhasePlain(phase);
  const evidence = buildEvidenceFromMetrics(analysis.metrics);
  const evidenceTail = evidence ? ` Bukti: ${evidence}.` : "";
  const convictionTail = conviction > 0 ? ` Conviction bandar ${conviction}/100.` : "";

  // BEARISH / DISTRIBUTION
  if (tone === "bearish" || phase === "Markdown / distribusi lanjut") {
    return {
      score: -36,
      alignment: "bertabrakan" as const,
      note: `${phasePlain}${evidenceTail} Operator bias: ${operatorBias}. Lebih aman tunggu konfirmasi reversal.`,
    };
  }

  // WARNING / FALSE BREAKOUT / DISTRIBUSI RANGE
  if (phase === "False breakout risk") {
    return {
      score: -16,
      alignment: "bertabrakan" as const,
      note: `${phasePlain}${evidenceTail} Aman jika tunggu close di atas resistance dengan volume jelas dulu.`,
    };
  }
  if (phase === "Distribusi dalam range" || tone === "warning") {
    return {
      score: -12,
      alignment: "bertabrakan" as const,
      note: `${phasePlain}${evidenceTail} Risk/reward kurang menarik selama supply masih lebih berat.`,
    };
  }

  // BULLISH ALIGNMENT (akumulasi/markup)
  if (
    phase === "Support dikunci bandar" ||
    phase === "Akumulasi di support" ||
    phase === "Sideways akumulasi senyap" ||
    phase === "Markup dini" ||
    phase === "Akumulasi menuju markup"
  ) {
    return {
      score: 18,
      alignment: "selaras" as const,
      note: `${phasePlain}${evidenceTail}${convictionTail} Flow harian + struktur harga sama-sama mendukung.`,
    };
  }

  // STRONG TREND ALREADY RUNNING — usually "Markup sehat"
  if (phase === "Markup sehat") {
    const distancePct = analysis.metrics.priceVsMa20 ?? 0;
    if (distancePct >= 6) {
      return {
        score: 6,
        alignment: "campuran" as const,
        note: `${phasePlain}${evidenceTail} Tapi harga sudah ${distancePct.toFixed(1)}% di atas MA20 — masuk di sini risiko kena pullback. Ideal tunggu retest MA20 atau breakout baru.`,
      };
    }
    return {
      score: 12,
      alignment: "selaras" as const,
      note: `${phasePlain}${evidenceTail} Tren naik sudah jalan dengan momentum sehat — entry valid selama harga belum jauh dari MA20.${convictionTail}`,
    };
  }

  // MIXED / EARLY SIGNS
  if (phase === "Trend pullback sehat") {
    return {
      score: 10,
      alignment: "campuran" as const,
      note: `${phasePlain}${evidenceTail} Posisi pullback ke MA20 sering jadi entry point bagus kalau didukung volume serap.`,
    };
  }
  if (phase === "Base building") {
    return {
      score: 8,
      alignment: "campuran" as const,
      note: `${phasePlain}${evidenceTail} Belum trigger gerak, tapi siap meledak kalau breakout dengan volume.`,
    };
  }
  if (phase === "Reclaim awal") {
    return {
      score: 8,
      alignment: "campuran" as const,
      note: `${phasePlain}${evidenceTail} Butuh konfirmasi 1-2 candle close di atas MA20 lagi sebelum yakin pemulihan.`,
    };
  }
  if (phase === "Akumulasi dalam range") {
    return {
      score: 6,
      alignment: "campuran" as const,
      note: `${phasePlain}${evidenceTail} Cocok untuk pantau, belum waktunya entry agresif.`,
    };
  }

  // NEUTRAL / FALLBACK
  if (tone === "bullish" || tone === "neutral") {
    return {
      score: 4,
      alignment: "campuran" as const,
      note: `${phasePlain}${evidenceTail} Operator bias: ${operatorBias}.`,
    };
  }

  return {
    score: 0,
    alignment: "tidak_tersedia" as const,
    note: `${phasePlain} Data bandarmology belum cukup jelas untuk konfirmasi.`,
  };
}

function buildCandidate(currentRow: IStockSummaryRow, recentRows: IStockSummaryRow[]): StockAccumulationCandidate | null {
  const close = currentRow.close ?? null;
  const high = currentRow.high ?? null;
  const low = currentRow.low ?? null;
  const previous = currentRow.previous ?? null;
  const openPrice = currentRow.openPrice ?? null;
  const value = currentRow.value ?? null;
  const volume = currentRow.volume ?? null;
  const frequency = currentRow.frequency ?? null;
  const foreignBuy = currentRow.foreignBuy ?? null;
  const foreignSell = currentRow.foreignSell ?? null;
  const bidVolume = currentRow.bidVolume ?? null;
  const offerVolume = currentRow.offerVolume ?? null;

  if (!close || !high || !low || !value || value <= 0) {
    return null;
  }

  const netForeign = safeNumber(foreignBuy) - safeNumber(foreignSell);
  const closeToHighPercent = percentDistance(high, close);
  const bidOfferRatio = ratio(safeNumber(bidVolume), safeNumber(offerVolume));
  const changePercent = previous && previous > 0 ? ((close - previous) / previous) * 100 : null;
  const intradayRecovery = openPrice && openPrice > 0 ? ((close - openPrice) / openPrice) * 100 : null;
  const netForeignRatio = safeNumber(value) > 0 ? (netForeign / safeNumber(value)) * 100 : 0;
  const liquidityMultiple = safeNumber(value) >= 15_000_000_000 ? 1 : safeNumber(value) >= 5_000_000_000 ? 0.75 : safeNumber(value) >= 1_500_000_000 ? 0.52 : 0.3;
  const pricePreferenceScore = close <= 200 ? 14 : close <= 500 ? 10 : close <= 900 ? 3 : -8;

  let accumulationScore = 0;
  let readinessScore = 0;
  const reasons: string[] = [];

  if (netForeign > 0) {
    accumulationScore += netForeign > 5_000_000 ? 16 : 10;
    reasons.push(`Foreign net buy ${netForeign.toLocaleString("id-ID")}`);
  }
  if (netForeignRatio > 0) {
    accumulationScore += netForeignRatio >= 8 ? 18 : netForeignRatio >= 4 ? 12 : 6;
    reasons.push(`Foreign flow ${round(netForeignRatio)}% dari value`);
  }
  if (bidOfferRatio != null && bidOfferRatio >= 1.2) {
    accumulationScore += bidOfferRatio >= 1.8 ? 18 : 12;
    reasons.push(`Bid/offer ratio ${round(bidOfferRatio)}x`);
  }
  if (closeToHighPercent != null && closeToHighPercent <= 1.5) {
    readinessScore += closeToHighPercent <= 0.7 ? 24 : 16;
    reasons.push(`Close menempel high (${round(closeToHighPercent)}%)`);
  }
  if (changePercent != null && changePercent >= 0) {
    readinessScore += changePercent >= 2 ? 20 : 12;
    reasons.push(`Perubahan harian ${round(changePercent)}%`);
  }
  if (intradayRecovery != null && intradayRecovery >= 0.5) {
    accumulationScore += 10;
    reasons.push(`Ditutup di atas open (${round(intradayRecovery)}%)`);
  }
  if (safeNumber(value) >= 15_000_000_000) {
    accumulationScore += 8;
    readinessScore += 8;
    reasons.push(`Likuiditas aktif Rp${Math.round(safeNumber(value) / 1_000_000_000)}B`);
  } else if (safeNumber(value) >= 5_000_000_000) {
    accumulationScore += 6;
    readinessScore += 6;
  } else if (safeNumber(value) >= 1_500_000_000) {
    accumulationScore += 4;
    readinessScore += 4;
  }
  if (safeNumber(frequency) >= 2_000) {
    accumulationScore += 8;
  } else if (safeNumber(frequency) >= 800) {
    accumulationScore += 4;
  }
  if (safeNumber(volume) >= 10_000_000) {
    readinessScore += 8;
  } else if (safeNumber(volume) >= 3_000_000) {
    readinessScore += 4;
  }

  const historyWindow = recentRows.slice(0, 5);
  const positiveForeignDays = historyWindow.filter((row) => safeNumber(row.foreignBuy) - safeNumber(row.foreignSell) > 0).length;
  const strongCloseDays = historyWindow.filter((row) => {
    const rowClose = safeNumber(row.close);
    const rowHigh = safeNumber(row.high);
    return rowClose > 0 && rowHigh > 0 && percentDistance(rowHigh, rowClose) !== null && (percentDistance(rowHigh, rowClose) ?? 99) <= 2;
  }).length;
  const localPressureDays = historyWindow.filter((row) => buildLocalPressure(row) >= 18).length;
  const cumulativeForeign = historyWindow.reduce((sum, row) => sum + (safeNumber(row.foreignBuy) - safeNumber(row.foreignSell)), 0);
  const cumulativeValue = historyWindow.reduce((sum, row) => sum + safeNumber(row.value), 0);
  const cumulativeForeignRatio = cumulativeValue > 0 ? (cumulativeForeign / cumulativeValue) * 100 : 0;

  // ---- Technical snapshot (uses full recentRows for ATR, BB, MACD, RVOL, etc.) ----
  const technicalRows: OHLCVRow[] = recentRows.map((row) => ({
    high: row.high ?? null,
    low: row.low ?? null,
    close: row.close ?? null,
    openPrice: row.openPrice ?? null,
    volume: row.volume ?? null,
    previous: row.previous ?? null,
  }));
  const tech = buildTechnicalSnapshot(technicalRows);

  // Technical bonus score (0-50): rewards confluence of momentum confirmations.
  let technicalScore = 0;
  if (tech.rvol != null) {
    if (tech.rvol >= 3) technicalScore += 14;
    else if (tech.rvol >= 2) technicalScore += 10;
    else if (tech.rvol >= 1.5) technicalScore += 6;
  }
  if (tech.pocketPivot) technicalScore += 12;
  if (tech.bbSqueeze) technicalScore += 8;
  if (tech.nr7) technicalScore += 5;
  if (tech.insideBar) technicalScore += 4;
  if (tech.highBreak6M) technicalScore += 10;
  if (tech.macd && tech.macd.histogram > 0 && tech.macd.histogramRising) technicalScore += 6;
  if (tech.mfi14 != null && tech.mfi14 >= 60) technicalScore += 4;
  if (tech.mfi14 != null && tech.mfi14 >= 80) technicalScore -= 4; // overbought caution
  technicalScore = clamp(technicalScore, 0, 50);

  // Add setup-driven reasons.
  if (tech.rvol != null && tech.rvol >= 1.5) {
    reasons.push(`RVOL ${tech.rvol.toFixed(2)}x avg 20D`);
  }
  if (tech.pocketPivot) reasons.push("Pocket Pivot terdeteksi");
  if (tech.bbSqueeze) reasons.push(`BB Squeeze (width ${tech.bbWidthPercent?.toFixed(2) ?? "?"}%)`);
  if (tech.nr7) reasons.push("NR7: range tersempit 7 hari");
  if (tech.insideBar) reasons.push("Inside Bar: kompresi");
  if (tech.highBreak6M) reasons.push("Breakout 6 bulan tertinggi");
  if (tech.macd?.histogramRising && tech.macd.histogram > 0) reasons.push("MACD histogram rising > 0");
  if (tech.mfi14 != null) {
    if (tech.mfi14 >= 80) reasons.push(`MFI ${tech.mfi14.toFixed(0)} (overbought)`);
    else if (tech.mfi14 >= 60) reasons.push(`MFI ${tech.mfi14.toFixed(0)} kuat`);
  }

  if (positiveForeignDays >= 3) {
    accumulationScore += 16;
    reasons.push(`Foreign konsisten ${positiveForeignDays}/${historyWindow.length} hari`);
  } else if (positiveForeignDays >= 2) {
    accumulationScore += 10;
    reasons.push(`Foreign mulai konsisten ${positiveForeignDays}/${historyWindow.length} hari`);
  }

  if (strongCloseDays >= 3) {
    readinessScore += 12;
    reasons.push(`Close kuat ${strongCloseDays}/${historyWindow.length} hari`);
  } else if (strongCloseDays >= 2) {
    readinessScore += 7;
  }

  if (localPressureDays >= 3) {
    accumulationScore += 10;
    readinessScore += 6;
    reasons.push(`Tekanan lokal aktif ${localPressureDays}/${historyWindow.length} hari`);
  } else if (localPressureDays >= 2) {
    accumulationScore += 6;
  }

  if (cumulativeForeign > 0) {
    accumulationScore += cumulativeForeign > 10_000_000 ? 4 : 2;
  }
  if (cumulativeForeignRatio > 0) {
    accumulationScore += cumulativeForeignRatio >= 6 ? 8 : cumulativeForeignRatio >= 3 ? 5 : 2;
  }

  const totalScore = accumulationScore + readinessScore;
  if (totalScore < 40) {
    return null;
  }

  let convictionScore = 0;
  convictionScore += Math.min(accumulationScore, 58);
  convictionScore += Math.min(readinessScore, 42);
  convictionScore += pricePreferenceScore;
  if (netForeign > 0) convictionScore += 4;
  if (netForeignRatio >= 4) convictionScore += 4;
  if ((bidOfferRatio ?? 0) >= 1.5) convictionScore += 4;
  if (positiveForeignDays >= 3) convictionScore += 6;
  if (strongCloseDays >= 3) convictionScore += 4;
  convictionScore += Math.round(liquidityMultiple * 4);
  convictionScore += technicalScore; // Add technical confluence bonus

  // ---- Pump Exhaustion Detection ----
  // If today's daily move is large (≥ 12%), the stock has likely already moved significantly.
  // Entering after a vertical pump exposes trader to distribution risk on the next day.
  const riskWarnings: string[] = [];
  let pumpExhaustion = false;
  if (changePercent != null && changePercent >= 12) {
    pumpExhaustion = true;
    if (changePercent >= 20) {
      convictionScore -= 30;
      riskWarnings.push(
        `Sudah pump +${round(changePercent)}% hari ini. Risiko distribusi pasca-pump tinggi — jangan kejar di sini.`
      );
    } else if (changePercent >= 15) {
      convictionScore -= 22;
      riskWarnings.push(
        `Pump kuat +${round(changePercent)}% hari ini. Lebih aman tunggu retest atau konsolidasi 1-2 hari sebelum entry.`
      );
    } else {
      convictionScore -= 12;
      riskWarnings.push(
        `Sudah naik +${round(changePercent)}% hari ini. Entry di sini berisiko karena ATR-based SL akan terlalu lebar.`
      );
    }
  }

  // Inflated ATR warning: if ATR is large relative to price (>5%), SL distance will hurt
  if (tech.atr14 != null && close > 0 && (tech.atr14 / close) * 100 >= 5) {
    riskWarnings.push(
      `ATR ${tech.atr14.toFixed(2)} (${((tech.atr14 / close) * 100).toFixed(1)}% dari harga) — volatilitas tinggi, SL akan jauh.`
    );
  }

  // Boost setup-driven phase upgrade if strong technical signal even with moderate accumulation
  let phaseBoostFromTech = false;
  if (
    !pumpExhaustion &&
    technicalScore >= 24 &&
    (tech.pocketPivot || tech.bbSqueeze || tech.highBreak6M) &&
    tech.rvol != null &&
    tech.rvol >= 1.5
  ) {
    phaseBoostFromTech = true;
  }

  let convictionLabel: StockAccumulationCandidate["convictionLabel"] = "Awal";
  if (convictionScore >= 92) {
    convictionLabel = "Sangat Kuat";
  } else if (convictionScore >= 80) {
    convictionLabel = "Kuat";
  } else if (convictionScore >= 66) {
    convictionLabel = "Menarik";
  }

  let phase: StockAccumulationCandidate["phase"] = "Pantau";
  if (accumulationScore >= 42 && readinessScore >= 34) {
    phase = "Akumulasi Siap Jalan";
  } else if (accumulationScore >= 48 || positiveForeignDays >= 3) {
    phase = "Akumulasi Kuat";
  }
  if (phaseBoostFromTech && phase === "Akumulasi Kuat") {
    phase = "Akumulasi Siap Jalan";
  } else if (phaseBoostFromTech && phase === "Pantau" && accumulationScore >= 30) {
    phase = "Akumulasi Kuat";
  }
  // Pump-exhausted candidates can never be "Siap Jalan" — too risky to chase
  if (pumpExhaustion && phase === "Akumulasi Siap Jalan") {
    phase = "Akumulasi Kuat";
  }

  const summary =
    pumpExhaustion
      ? `Sudah pump kuat hari ini (+${changePercent != null ? round(changePercent) : "?"}%). Setup masih ada, tapi entry di sini berisiko karena ATR terlalu lebar — tunggu retest atau konsolidasi 1-2 hari sebelum putuskan.`
      : phase === "Akumulasi Siap Jalan"
        ? `Hari aktif terlihat kuat dan didukung konsistensi ${Math.min(historyWindow.length, 5)} hari terakhir, sehingga peluang dorongan lanjutan lebih sehat.`
      : phase === "Akumulasi Kuat"
        ? `Ada jejak serap yang cukup jelas dalam beberapa hari terakhir, tetapi trigger gerak lanjut tetap perlu dipantau.`
        : `Mulai menarik untuk dipantau. Kualitas hari ini ada, tetapi konsistensi 3-5 hari masih perlu diperkuat.`;

  return {
    stockCode: currentRow.stockCode,
    companyName: currentRow.companyName || null,
    close,
    change: currentRow.change ?? null,
    volume,
    value,
    foreignBuy,
    foreignSell,
    bidVolume,
    offerVolume,
    accumulationScore,
    readinessScore,
    netForeign,
    closeToHighPercent: round(closeToHighPercent),
    bidOfferRatio: round(bidOfferRatio),
    convictionScore,
    convictionLabel,
    phase,
    reasons: reasons.slice(0, 6),
    summary,
    recentPositiveForeignDays: positiveForeignDays,
    recentStrongCloseDays: strongCloseDays,
    recentLocalPressureDays: localPressureDays,
    windowDays: historyWindow.length,
    bandarmologyPhase: null,
    bandarmologyTone: null,
    bandarmologyAlignment: "tidak_tersedia",
    bandarmologyNote: null,
    atr14: tech.atr14,
    rvol: tech.rvol,
    mfi14: tech.mfi14,
    rsi14: tech.rsi14,
    macdHistogram: tech.macd?.histogram ?? null,
    macdRising: tech.macd?.histogramRising ?? false,
    bbSqueeze: tech.bbSqueeze,
    bbWidthPercent: tech.bbWidthPercent,
    setups: tech.setups,
    tradePlan: tech.tradePlan,
    technicalScore,
    changePercent: changePercent != null ? round(changePercent) : null,
    pumpExhaustion,
    riskWarnings,
  };
}

export async function getAccumulationAnalysis(args: { tradeDate: string; limit?: number; minRiskReward?: number }) {
  await connectDB();
  const tradeDate = new Date(`${args.tradeDate}T00:00:00.000Z`);
  const limit = Math.min(args.limit ?? 12, 30);

  const rawDates = await StockSummaryRow.distinct("tradeDate", { tradeDate: { $lte: tradeDate } });
  const recentDates = rawDates
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())
    .slice(0, 60);

  if (recentDates.length === 0) {
    return {
      date: args.tradeDate,
      count: 0,
      data: [],
    };
  }

  const currentDate = recentDates.find((value) => value.getTime() === tradeDate.getTime()) || tradeDate;
  const rows = await StockSummaryRow.find({ tradeDate: { $in: recentDates } })
    .sort({ tradeDate: -1, value: -1, frequency: -1 })
    .lean<IStockSummaryRow[]>();

  const historyByStock = new Map<string, IStockSummaryRow[]>();
  for (const row of rows) {
    const list = historyByStock.get(row.stockCode) || [];
    list.push(row);
    historyByStock.set(row.stockCode, list);
  }

  const currentRows = rows.filter((row) => row.tradeDate.getTime() === currentDate.getTime()).slice(0, 400);
  const candidates = currentRows
    .map((row) => buildCandidate(row, historyByStock.get(row.stockCode) || [row]))
    .filter((row): row is StockAccumulationCandidate => Boolean(row))
    .sort((a, b) => {
      const leftPriceBand = (a.close ?? Number.MAX_SAFE_INTEGER) <= 500 ? 0 : (a.close ?? Number.MAX_SAFE_INTEGER) <= 900 ? 1 : 2;
      const rightPriceBand = (b.close ?? Number.MAX_SAFE_INTEGER) <= 500 ? 0 : (b.close ?? Number.MAX_SAFE_INTEGER) <= 900 ? 1 : 2;
      if (leftPriceBand !== rightPriceBand) return leftPriceBand - rightPriceBand;
      const scoreDiff = b.convictionScore - a.convictionScore;
      if (scoreDiff !== 0) return scoreDiff;
      const persistenceDiff = b.recentPositiveForeignDays - a.recentPositiveForeignDays;
      if (persistenceDiff !== 0) return persistenceDiff;
      return (b.netForeign || 0) - (a.netForeign || 0);
    })
    .slice(0, Math.max(limit * 2, 18));

  const alignedCandidates = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const analysis = await analyzeBandarmologyTicker(`${candidate.stockCode}.JK`, candidate.companyName || undefined);
        const alignment = buildBandarmologyAlignment(analysis);
        const mergedReasons = [candidate.reasons[0], `Bandarmology ${analysis.summary.phase}`, ...candidate.reasons.slice(1)]
          .filter((reason, index, list): reason is string => Boolean(reason) && list.indexOf(reason) === index)
          .slice(0, 6);

        const nextConviction = clamp(candidate.convictionScore + alignment.score, 0, 140);
        const nextPhase =
          alignment.alignment === "selaras" && candidate.phase === "Akumulasi Kuat"
            ? "Akumulasi Siap Jalan"
            : alignment.alignment === "bertabrakan"
              ? "Pantau"
              : candidate.phase;
        const nextSummary =
          alignment.alignment === "selaras"
            ? `${candidate.summary} ${alignment.note}`
            : alignment.alignment === "campuran"
              ? `${candidate.summary} ${alignment.note}`
              : `Flow harian terlihat menarik, tetapi ${alignment.note}`;

        return {
          ...candidate,
          convictionScore: nextConviction,
          convictionLabel:
            nextConviction >= 92
              ? "Sangat Kuat"
              : nextConviction >= 80
                ? "Kuat"
                : nextConviction >= 66
                  ? "Menarik"
                  : "Awal",
          phase: nextPhase,
          reasons: mergedReasons,
          summary: nextSummary,
          bandarmologyPhase: analysis.summary.phase,
          bandarmologyTone: analysis.summary.tone,
          bandarmologyAlignment: alignment.alignment,
          bandarmologyNote: alignment.note,
        } satisfies StockAccumulationCandidate;
      } catch {
        return candidate;
      }
    })
  );

  const minRR = args.minRiskReward ?? 0;
  const filteredCandidates = alignedCandidates
    .filter((candidate) => candidate.bandarmologyAlignment !== "bertabrakan")
    .filter((candidate) => {
      if (minRR <= 0) return true;
      // If no trade plan available, fail-safe include only when minRR is loose
      if (!candidate.tradePlan) return minRR <= 1;
      return candidate.tradePlan.riskRewardRatio >= minRR;
    })
    .sort((a, b) => {
      const alignmentRank = { selaras: 0, campuran: 1, tidak_tersedia: 2, bertabrakan: 3 } as const;
      const alignmentDiff = alignmentRank[a.bandarmologyAlignment] - alignmentRank[b.bandarmologyAlignment];
      if (alignmentDiff !== 0) return alignmentDiff;
      const scoreDiff = b.convictionScore - a.convictionScore;
      if (scoreDiff !== 0) return scoreDiff;
      return (b.netForeign || 0) - (a.netForeign || 0);
    })
    .slice(0, limit);

  return {
    date: args.tradeDate,
    count: filteredCandidates.length,
    lookbackDays: recentDates.length,
    data: filteredCandidates,
  };
}

export async function getAccumulationSeries(args: { ticker: string; days?: number }) {
  await connectDB();
  const normalizedTicker = args.ticker.toUpperCase().replace(/\.JK$/i, "").trim();
  const limit = Math.min(args.days ?? 120, 240);

  const rows = await StockSummaryRow.find({ stockCode: normalizedTicker })
    .sort({ tradeDate: -1 })
    .limit(limit)
    .lean<IStockSummaryRow[]>();

  const orderedRows = rows.reverse();
  let localIndex = 100;
  let foreignIndex = 100;

  const data = orderedRows.map((row) => {
    const netForeign = safeNumber(row.foreignBuy) - safeNumber(row.foreignSell);
    const foreignFlowRatio = safeNumber(row.volume) > 0 ? (netForeign / safeNumber(row.volume)) * 100 : 0;
    const localPressure = buildLocalPressure(row);

    localIndex += localPressure / 20;
    foreignIndex += foreignFlowRatio * 2.2;

    return {
      time: row.tradeDate.toISOString().slice(0, 10),
      localAccumulation: round(localIndex) ?? 100,
      foreignAccumulation: round(foreignIndex) ?? 100,
      close: row.close ?? null,
      netForeign,
      localPressure: round(localPressure) ?? 0,
    };
  });

  return {
    ticker: normalizedTicker,
    count: data.length,
    data,
  };
}
