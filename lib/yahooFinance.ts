// yahoo-finance2 v3: default export is the YahooFinance class itself
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default ?? require("yahoo-finance2");
const yahooFinance = new YahooFinance({
  suppressNotices: ["ripHistorical", "yahooSurvey"],
});

export async function getQuote(ticker: string) {
  const quotes = await getQuotes([ticker]);
  return quotes[0] || null;
}

export async function getQuotes(tickers: string[]) {
  if (tickers.length === 0) return [];
  
  try {
    // Split tickers into chunks of 100 to avoid long query strings
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < tickers.length; i += chunkSize) {
      chunks.push(tickers.slice(i, i + chunkSize));
    }

    const allResults = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          // yahooFinance.quote doesn't support validateResult in the options object like search does.
          // It's a global or per-module setting if needed, but usually not necessary for quote.
          const results: any[] = await yahooFinance.quote(chunk);
          return results.map(result => {
            const price: number = result.regularMarketPrice || 0;
            const previousClose: number = result.regularMarketPreviousClose || 0;
            const change: number = result.regularMarketChange || (price - previousClose);
            const changePercent: number = previousClose > 0
              ? ((price - previousClose) / previousClose) * 100
              : 0;

            return {
              ticker: result.symbol,
              name: result.shortName || result.longName || result.symbol,
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
              updatedAt: result.regularMarketTime || null,
            };
          });
        } catch (e) {
          console.error(`Error in chunk fetch:`, e);
          return [];
        }
      })
    );

    return allResults.flat();
  } catch (error) {
    console.error(`Error fetching bulk quotes:`, error);
    return [];
  }
}

export type HistoryInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1wk" | "1mo";

export async function getHistory(
  ticker: string,
  period1: string,
  period2?: string,
  interval: HistoryInterval = "1d"
) {
  try {
    let effectivePeriod1 = period1;
    let effectivePeriod2 = period2 || new Date().toISOString().split("T")[0];

    // If fetching for today, make period2 tomorrow to be inclusive of today's session
    if (!period2) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      effectivePeriod2 = tomorrow.toISOString().split("T")[0];
    }

    // Map 4h to 1h since Yahoo Finance doesn't support 4h natively
    const yfInterval = interval === "4h" ? "1h" : interval;

    // Yahoo Finance chart options period1 and period2 cannot share the same value for some intervals
    if (effectivePeriod1 === effectivePeriod2) {
      const d = new Date(effectivePeriod1);
      d.setDate(d.getDate() - 1);
      effectivePeriod1 = d.toISOString().split("T")[0];
    }

    console.log(`Calling chart for ${ticker} with period1: ${effectivePeriod1}, period2: ${effectivePeriod2}, interval: ${yfInterval}`);
    let result: any = await yahooFinance.chart(ticker, {
      period1: effectivePeriod1,
      period2: effectivePeriod2,
      interval: yfInterval,
    });

    // Fallback logic for empty intraday results (common on weekends/holidays)
    if ((!result.quotes || result.quotes.length === 0) && interval !== "1d" && interval !== "1wk" && interval !== "1mo") {
      console.log(`No ${interval} data for ${ticker} in provided range. Retrying with wider window...`);
      const fallbackStart = new Date();
      fallbackStart.setDate(fallbackStart.getDate() - 7);
      
      result = await yahooFinance.chart(ticker, {
        period1: fallbackStart.toISOString().split("T")[0],
        period2: effectivePeriod2,
        interval: yfInterval,
      });
    }

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
    console.error(`Error fetching history for ${ticker} (${interval}):`, error);
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