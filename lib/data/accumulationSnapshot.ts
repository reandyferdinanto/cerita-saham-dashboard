import { connectDB } from "@/lib/db";
import StockSummaryRow, { IStockSummaryRow } from "@/lib/models/StockSummaryRow";

export type AccumulationSnapshot = {
  available: boolean;
  ticker: string;
  daysAnalyzed: number;
  latestTradeDate: string | null;
  totalNetForeign: number; // sum of (foreignBuy - foreignSell) over window
  positiveForeignDays: number;
  negativeForeignDays: number;
  largestForeignBuyDay: { date: string; netForeign: number } | null;
  largestForeignSellDay: { date: string; netForeign: number } | null;
  averageDailyValue: number;
  averageDailyVolume: number;
  averageBidOfferRatio: number | null; // bidVolume / offerVolume average
  closeNearHighDays: number; // days where close is within 2% of high
  // Composite assessment
  foreignAccumulationLabel: "Akumulasi Kuat" | "Akumulasi Moderat" | "Netral" | "Distribusi Moderat" | "Distribusi Kuat";
  domesticPressureLabel: "Tekanan Beli Kuat" | "Tekanan Beli Moderat" | "Netral" | "Tekanan Jual Moderat" | "Tekanan Jual Kuat";
  summary: string; // Human-readable plain-text summary in Indonesian
};

function normalize(ticker: string) {
  return ticker.toUpperCase().replace(/\.JK$/i, "").trim();
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function safe(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Analyze stock summary rows from the last `windowDays` trading days for accumulation patterns.
 * Returns null-safe snapshot — `available=false` if no data found.
 */
export async function getAccumulationSnapshot(
  ticker: string,
  windowDays = 10
): Promise<AccumulationSnapshot> {
  const code = normalize(ticker);
  const empty: AccumulationSnapshot = {
    available: false,
    ticker: code,
    daysAnalyzed: 0,
    latestTradeDate: null,
    totalNetForeign: 0,
    positiveForeignDays: 0,
    negativeForeignDays: 0,
    largestForeignBuyDay: null,
    largestForeignSellDay: null,
    averageDailyValue: 0,
    averageDailyVolume: 0,
    averageBidOfferRatio: null,
    closeNearHighDays: 0,
    foreignAccumulationLabel: "Netral",
    domesticPressureLabel: "Netral",
    summary: "Data stock summary IDX belum tersedia untuk saham ini.",
  };

  try {
    await connectDB();
    const rows = await StockSummaryRow.find({ stockCode: code })
      .sort({ tradeDate: -1 })
      .limit(windowDays)
      .lean<IStockSummaryRow[]>();

    if (rows.length === 0) return empty;

    let totalNetForeign = 0;
    let positiveForeignDays = 0;
    let negativeForeignDays = 0;
    let totalValue = 0;
    let totalVolume = 0;
    let bidOfferSum = 0;
    let bidOfferCount = 0;
    let closeNearHighDays = 0;
    let largestBuy: { date: string; netForeign: number } | null = null;
    let largestSell: { date: string; netForeign: number } | null = null;

    for (const row of rows) {
      const netForeign = safe(row.foreignBuy) - safe(row.foreignSell);
      totalNetForeign += netForeign;
      if (netForeign > 0) positiveForeignDays += 1;
      if (netForeign < 0) negativeForeignDays += 1;

      const dateStr = toIsoDate(row.tradeDate);
      if (!largestBuy || netForeign > largestBuy.netForeign) {
        largestBuy = { date: dateStr, netForeign };
      }
      if (!largestSell || netForeign < largestSell.netForeign) {
        largestSell = { date: dateStr, netForeign };
      }

      totalValue += safe(row.value);
      totalVolume += safe(row.volume);

      const bidVol = safe(row.bidVolume);
      const offerVol = safe(row.offerVolume);
      if (offerVol > 0) {
        bidOfferSum += bidVol / offerVol;
        bidOfferCount += 1;
      }

      const high = safe(row.high);
      const close = safe(row.close);
      if (high > 0 && close > 0 && (high - close) / high <= 0.02) {
        closeNearHighDays += 1;
      }
    }

    const days = rows.length;
    const averageDailyValue = totalValue / days;
    const averageDailyVolume = totalVolume / days;
    const averageBidOfferRatio = bidOfferCount > 0 ? bidOfferSum / bidOfferCount : null;
    const netForeignRatio = averageDailyValue > 0 ? (totalNetForeign / (averageDailyValue * days)) * 100 : 0;

    // Foreign accumulation classification
    let foreignAccumulationLabel: AccumulationSnapshot["foreignAccumulationLabel"] = "Netral";
    if (totalNetForeign > 0 && positiveForeignDays >= Math.ceil(days * 0.6) && netForeignRatio >= 4) {
      foreignAccumulationLabel = "Akumulasi Kuat";
    } else if (totalNetForeign > 0 && positiveForeignDays >= Math.ceil(days * 0.5)) {
      foreignAccumulationLabel = "Akumulasi Moderat";
    } else if (totalNetForeign < 0 && negativeForeignDays >= Math.ceil(days * 0.6) && netForeignRatio <= -4) {
      foreignAccumulationLabel = "Distribusi Kuat";
    } else if (totalNetForeign < 0 && negativeForeignDays >= Math.ceil(days * 0.5)) {
      foreignAccumulationLabel = "Distribusi Moderat";
    }

    // Domestic pressure classification (bid/offer + close near high)
    let domesticPressureLabel: AccumulationSnapshot["domesticPressureLabel"] = "Netral";
    if (averageBidOfferRatio != null) {
      const closeStrengthRatio = closeNearHighDays / days;
      if (averageBidOfferRatio >= 1.5 && closeStrengthRatio >= 0.5) {
        domesticPressureLabel = "Tekanan Beli Kuat";
      } else if (averageBidOfferRatio >= 1.15 || closeStrengthRatio >= 0.4) {
        domesticPressureLabel = "Tekanan Beli Moderat";
      } else if (averageBidOfferRatio <= 0.7 && closeStrengthRatio < 0.2) {
        domesticPressureLabel = "Tekanan Jual Kuat";
      } else if (averageBidOfferRatio <= 0.85) {
        domesticPressureLabel = "Tekanan Jual Moderat";
      }
    }

    const summaryParts: string[] = [];
    summaryParts.push(
      `Foreign flow ${days} hari: ${
        totalNetForeign >= 0 ? "+" : ""
      }${totalNetForeign.toLocaleString("id-ID")} (${positiveForeignDays} hari net buy, ${negativeForeignDays} hari net sell). Status: ${foreignAccumulationLabel}.`
    );
    summaryParts.push(
      `Domestic flow: bid/offer rata-rata ${
        averageBidOfferRatio != null ? `${averageBidOfferRatio.toFixed(2)}x` : "-"
      }, close menempel high ${closeNearHighDays}/${days} hari. Status: ${domesticPressureLabel}.`
    );
    if (largestBuy && largestBuy.netForeign > 0) {
      summaryParts.push(
        `Hari foreign buy terbesar: ${largestBuy.date} (+${largestBuy.netForeign.toLocaleString("id-ID")}).`
      );
    }
    if (largestSell && largestSell.netForeign < 0) {
      summaryParts.push(
        `Hari foreign sell terbesar: ${largestSell.date} (${largestSell.netForeign.toLocaleString("id-ID")}).`
      );
    }
    summaryParts.push(
      `Likuiditas: rata-rata value Rp ${(averageDailyValue / 1_000_000_000).toFixed(2)} M/hari, volume ${(averageDailyVolume / 1_000_000).toFixed(1)} jt lot/hari.`
    );

    return {
      available: true,
      ticker: code,
      daysAnalyzed: days,
      latestTradeDate: toIsoDate(rows[0].tradeDate),
      totalNetForeign,
      positiveForeignDays,
      negativeForeignDays,
      largestForeignBuyDay: largestBuy,
      largestForeignSellDay: largestSell,
      averageDailyValue,
      averageDailyVolume,
      averageBidOfferRatio,
      closeNearHighDays,
      foreignAccumulationLabel,
      domesticPressureLabel,
      summary: summaryParts.join(" "),
    };
  } catch {
    return empty;
  }
}
