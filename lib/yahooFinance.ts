import YahooFinanceModule from "yahoo-finance2";

// yahoo-finance2 v3 requires instantiation
const yahooFinance = new (YahooFinanceModule as any)({ suppressNotices: ["ripHistorical"] });

export async function getQuote(ticker: string) {
  try {
    const result: any = await yahooFinance.quote(ticker);
    const price: number = result.regularMarketPrice || 0;
    const previousClose: number = result.regularMarketPreviousClose || 0;
    const change: number = result.regularMarketChange || (price - previousClose);

    // Always compute % from prevClose manually — don't trust regularMarketChangePercent
    // which can be returned as a fraction (0.0741) or percentage (7.41) depending on the feed
    const changePercent: number = previousClose > 0
      ? ((price - previousClose) / previousClose) * 100
      : 0;

    return {
      ticker: result.symbol,
      name: result.shortName || result.longName || ticker,
      price,
      change,
      changePercent,
      volume: result.regularMarketVolume || 0,
      high: result.regularMarketDayHigh || 0,
      low: result.regularMarketDayLow || 0,
      open: result.regularMarketOpen || 0,
      previousClose,
      marketCap: result.marketCap || undefined,
      delayMinutes: result.exchangeDataDelayedBy ?? null,
    };
  } catch (error) {
    console.error(`Error fetching quote for ${ticker}:`, error);
    return null;
  }
}

export type HistoryInterval = "5m" | "15m" | "1h" | "4h" | "1d" | "1wk" | "1mo";

export async function getHistory(
  ticker: string,
  period1: string,
  period2?: string,
  interval: HistoryInterval = "1d"
) {
  try {
    const endDate = period2 || new Date().toISOString().split("T")[0];

    // Map 4h to 1h since Yahoo Finance doesn't support 4h natively
    // We'll return 1h data for 4h timeframe and let client aggregate
    const yfInterval = interval === "4h" ? "1h" : interval;

    const result: any = await yahooFinance.chart(ticker, {
      period1,
      period2: endDate,
      interval: yfInterval,
    });

    return (result.quotes || [])
      .filter((item: any) => item.open != null && item.close != null)
      .map((item: any) => ({
        time: interval === "1d" || interval === "1wk" || interval === "1mo"
          ? new Date(item.date).toISOString().split("T")[0]
          : Math.floor(new Date(item.date).getTime() / 1000), // unix timestamp for intraday
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }));
  } catch (error) {
    console.error(`Error fetching history for ${ticker}:`, error);
    return [];
  }
}

export async function searchStocks(query: string) {
  try {
    // Auto-append .JK if not already there
    const jkQuery = query.toUpperCase().endsWith(".JK") ? query : query + ".JK";

    // Search with both the .JK ticker and the plain name for better results
    // validateResult: false — Yahoo changed typeDisp casing ("equity" vs "Equity"),
    // which breaks the built-in schema check even though the data is valid.
    const searchOpts = { validateResult: false } as any;
    const [resultJK, resultPlain] = await Promise.all([
      yahooFinance.search(jkQuery, {}, searchOpts).catch(() => ({ quotes: [] })),
      yahooFinance.search(query, {}, searchOpts).catch(() => ({ quotes: [] })),
    ]);

    const allQuotes = [
      ...((resultJK as any).quotes || []),
      ...((resultPlain as any).quotes || []),
    ];

    // Deduplicate by symbol
    const seen = new Set<string>();
    const quotes = allQuotes
      .filter((q: any) => {
        // Only include Indonesian stocks (.JK suffix) and EQUITY/INDEX
        const isJK = (q.symbol || "").toUpperCase().endsWith(".JK");
        const qt = (q.quoteType || "").toUpperCase();
        const isValidType = qt === "EQUITY" || qt === "INDEX";
        if (!isJK || !isValidType) return false;
        if (seen.has(q.symbol)) return false;
        seen.add(q.symbol);
        return true;
      })
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange || "IDX",
        quoteType: q.quoteType || "",
      }));

    return quotes;
  } catch (error) {
    console.error(`Error searching for ${query}:`, error);
    return [];
  }
}
