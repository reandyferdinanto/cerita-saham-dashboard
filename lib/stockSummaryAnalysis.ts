import { connectDB } from "@/lib/db";
import StockSummaryRow, { IStockSummaryRow } from "@/lib/models/StockSummaryRow";
import { analyzeBandarmologyTicker, BandarmologyAnalysisResult } from "@/lib/bandarmologyAnalysis";

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

function buildBandarmologyAlignment(analysis: BandarmologyAnalysisResult) {
  const phase = analysis.summary.phase;
  const tone = analysis.summary.tone;

  if (tone === "bearish" || phase === "Markdown / distribusi lanjut") {
    return {
      score: -36,
      alignment: "bertabrakan" as const,
      note: "Bandarmology masih membaca distribusi, jadi sinyal flow harian belum cukup aman untuk disebut siap jalan.",
    };
  }

  if (phase === "False breakout risk" || tone === "warning") {
    return {
      score: -16,
      alignment: "bertabrakan" as const,
      note: "Bandarmology melihat struktur masih rawan false move, jadi kandidat ini belum cukup sinkron.",
    };
  }

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
      note: `Bandarmology ikut mendukung lewat fase "${phase}", jadi flow harian dan struktur harga saling menguatkan.`,
    };
  }

  if (phase === "Trend pullback sehat" || phase === "Base building" || phase === "Reclaim awal" || phase === "Akumulasi dalam range") {
    return {
      score: 8,
      alignment: "campuran" as const,
      note: `Bandarmology belum seagresif stock summary, tetapi fase "${phase}" masih cukup layak untuk pantauan lanjutan.`,
    };
  }

  if (tone === "bullish" || tone === "neutral") {
    return {
      score: 4,
      alignment: "campuran" as const,
      note: "Bandarmology belum sekuat flow harian, tetapi juga belum memberi sinyal konflik yang berat.",
    };
  }

  return {
    score: 0,
    alignment: "tidak_tersedia" as const,
    note: "Bandarmology belum memberi sinyal yang cukup kuat untuk memperjelas kandidat ini.",
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

  const summary =
    phase === "Akumulasi Siap Jalan"
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
  };
}

export async function getAccumulationAnalysis(args: { tradeDate: string; limit?: number }) {
  await connectDB();
  const tradeDate = new Date(`${args.tradeDate}T00:00:00.000Z`);
  const limit = Math.min(args.limit ?? 12, 30);

  const rawDates = await StockSummaryRow.distinct("tradeDate", { tradeDate: { $lte: tradeDate } });
  const recentDates = rawDates
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())
    .slice(0, 5);

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

  const filteredCandidates = alignedCandidates
    .filter((candidate) => candidate.bandarmologyAlignment !== "bertabrakan")
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
