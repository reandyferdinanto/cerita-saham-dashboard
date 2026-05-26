// Compact fundamental snapshot for AI Stock Brief.
// Wraps yahoo-finance2 quoteSummary, extracting only the fields useful for narrative generation.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default ?? require("yahoo-finance2");
const yahooFinance = new YahooFinance({
  suppressNotices: ["ripHistorical", "yahooSurvey"],
});

export type FundamentalSnapshot = {
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  trailingPE: number | null;
  priceToBook: number | null;
  beta: number | null;
  dividendYield: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  revenueGrowth: number | null; // YoY
  earningsGrowth: number | null; // YoY
  profitMargin: number | null;
  roe: number | null;
  debtToEquity: number | null;
  recommendationMean: number | null; // 1=StrongBuy, 5=StrongSell
  numberOfAnalysts: number | null;
  insidersPercentHeld: number | null;
  institutionsPercentHeld: number | null;
  longBusinessSummary: string | null;
};

export async function getFundamentalSnapshot(ticker: string): Promise<FundamentalSnapshot | null> {
  try {
    const summary = (await yahooFinance.quoteSummary(ticker, {
      modules: ["summaryDetail", "defaultKeyStatistics", "financialData", "assetProfile", "majorHoldersBreakdown"],
    })) as Record<string, unknown>;

    const sd = (summary.summaryDetail || {}) as Record<string, number | null | undefined>;
    const ks = (summary.defaultKeyStatistics || {}) as Record<string, number | null | undefined>;
    const fd = (summary.financialData || {}) as Record<string, number | null | undefined>;
    const ap = (summary.assetProfile || {}) as Record<string, string | null | undefined>;
    const mh = (summary.majorHoldersBreakdown || {}) as Record<string, number | null | undefined>;

    return {
      sector: ap.sector ?? null,
      industry: ap.industry ?? null,
      marketCap: sd.marketCap ?? ks.marketCap ?? null,
      trailingPE: sd.trailingPE ?? ks.trailingPE ?? null,
      priceToBook: ks.priceToBook ?? null,
      beta: sd.beta ?? ks.beta ?? null,
      dividendYield: sd.dividendYield ?? null,
      fiftyTwoWeekHigh: sd.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: sd.fiftyTwoWeekLow ?? null,
      revenueGrowth: fd.revenueGrowth ?? null,
      earningsGrowth: fd.earningsGrowth ?? null,
      profitMargin: fd.profitMargins ?? null,
      roe: fd.returnOnEquity ?? null,
      debtToEquity: fd.debtToEquity ?? null,
      recommendationMean: fd.recommendationMean ?? null,
      numberOfAnalysts: fd.numberOfAnalystOpinions ?? null,
      insidersPercentHeld: mh.insidersPercentHeld ?? null,
      institutionsPercentHeld: mh.institutionsPercentHeld ?? null,
      longBusinessSummary: ap.longBusinessSummary ?? null,
    };
  } catch {
    return null;
  }
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatMarketCap(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  if (value >= 1e12) return `Rp ${(value / 1e12).toFixed(2)} T`;
  if (value >= 1e9) return `Rp ${(value / 1e9).toFixed(2)} M`;
  if (value >= 1e6) return `Rp ${(value / 1e6).toFixed(2)} jt`;
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export function formatRecommendation(mean: number | null | undefined): string {
  if (mean == null || !Number.isFinite(mean)) return "-";
  if (mean <= 1.5) return `Strong Buy (${mean.toFixed(2)})`;
  if (mean <= 2.5) return `Buy (${mean.toFixed(2)})`;
  if (mean <= 3.5) return `Hold (${mean.toFixed(2)})`;
  if (mean <= 4.5) return `Sell (${mean.toFixed(2)})`;
  return `Strong Sell (${mean.toFixed(2)})`;
}
