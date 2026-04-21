import { connectDB } from "@/lib/db";
import BandarmologyScreenerSnapshot from "@/lib/models/BandarmologyScreenerSnapshot";
import { getHistory } from "@/lib/yahooFinance";

type BacktestArgs = {
  preset: string;
  priceBucket: string;
  lookbackDays?: number;
  holdingDays?: number;
  takeProfitPct?: number;
};

type HistoryPoint = Awaited<ReturnType<typeof getHistory>>[number];

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const next = new Date(`${value}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return toDateOnly(next);
}

// Simple concurrency limiter
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const batches = [];
  for (let i = 0; i < items.length; i += limit) {
    batches.push(items.slice(i, i + limit));
  }
  for (const batch of batches) {
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function getBandarmologyBacktest(args: BacktestArgs) {
  await connectDB();

  const lookbackDays = Math.min(args.lookbackDays ?? 30, 90);
  const holdingDays = Math.min(args.holdingDays ?? 5, 20);
  const takeProfitPct = args.takeProfitPct ?? 5;
  const todayStr = toDateOnly(new Date());
  const earliestDate = addDays(todayStr, -lookbackDays - 20); // more buffer

  const snapshots = await BandarmologyScreenerSnapshot.find({
    preset: args.preset,
    priceBucket: args.priceBucket,
    snapshotDate: { $gte: earliestDate },
  })
    .sort({ snapshotDate: -1 })
    .limit(lookbackDays)
    .lean();

  if (snapshots.length === 0) {
    return {
      preset: args.preset,
      priceBucket: args.priceBucket,
      lookbackDays,
      holdingDays,
      takeProfitPct,
      snapshotCount: 0,
      tradeCount: 0,
      hitRate: null,
      avgMaxGainPct: null,
      avgMaxDrawdownPct: null,
      samples: [],
      dailyStats: [],
    };
  }

  const tickerSet = new Set<string>();
  for (const snapshot of snapshots) {
    for (const row of snapshot.rows) {
      tickerSet.add(row.ticker);
    }
  }

  const historyByTicker = new Map<string, Awaited<ReturnType<typeof getHistory>>>();
  const tickers = Array.from(tickerSet);
  
  // Batch fetch history with concurrency limit (e.g., 5 at a time) to avoid timeouts/rate limits
  await mapWithLimit(tickers, 5, async (ticker) => {
    try {
      const period1 = addDays(earliestDate, -5);
      const history = await getHistory(ticker, period1, undefined, "1d");
      historyByTicker.set(ticker, history);
    } catch (err) {
      console.error(`Backtest failed to fetch history for ${ticker}:`, err);
      historyByTicker.set(ticker, []);
    }
  });

  const samples: Array<{
    snapshotDate: string;
    ticker: string;
    entryPrice: number;
    maxGainPct: number | null;
    maxDrawdownPct: number | null;
    hitTp: boolean;
    isCompleted: boolean;
  }> = [];

  const dailyMap = new Map<string, {
    snapshotDate: string;
    tradeCount: number;
    hitCount: number;
    isCompleted: boolean;
    avgMaxGainPct: number;
    pendingCount: number;
  }>();

  for (const snapshot of snapshots) {
    let dayTradeCount = 0;
    let dayHitCount = 0;
    let dayMaxGainSum = 0;
    let dayIsCompleted = true;
    let dayPendingCount = 0;

    for (const row of snapshot.rows) {
      const history = historyByTicker.get(row.ticker) || [];
      const entryPrice = row.price;
      
      // Find history starting from snapshot date
      const startIndex = history.findIndex((point: HistoryPoint) => String(point.time).slice(0, 10) >= snapshot.snapshotDate);
      
      if (startIndex === -1) {
        // No history found >= snapshot date (likely a very new snapshot or no data)
        dayTradeCount++;
        dayIsCompleted = false;
        dayPendingCount++;
        
        samples.push({
          snapshotDate: snapshot.snapshotDate,
          ticker: row.ticker,
          entryPrice,
          maxGainPct: null,
          maxDrawdownPct: null,
          hitTp: false,
          isCompleted: false,
        });
        continue;
      }

      const window = history.slice(startIndex, startIndex + holdingDays);
      if (window.length === 0) {
        // This case should be covered by startIndex === -1 but just in case
        dayTradeCount++;
        dayIsCompleted = false;
        dayPendingCount++;
        
        samples.push({
          snapshotDate: snapshot.snapshotDate,
          ticker: row.ticker,
          entryPrice,
          maxGainPct: null,
          maxDrawdownPct: null,
          hitTp: false,
          isCompleted: false,
        });
        continue;
      }

      const isCompleted = window.length >= holdingDays;
      if (!isCompleted) {
        dayIsCompleted = false;
        dayPendingCount++;
      }

      const maxHigh = Math.max(...window.map((point: HistoryPoint) => point.high ?? point.close));
      const minLow = Math.min(...window.map((point: HistoryPoint) => point.low ?? point.close));
      const maxGainPct = entryPrice > 0 ? ((maxHigh - entryPrice) / entryPrice) * 100 : null;
      const maxDrawdownPct = entryPrice > 0 ? ((minLow - entryPrice) / entryPrice) * 100 : null;
      const hitTp = (maxGainPct ?? -999) >= takeProfitPct;

      dayTradeCount++;
      if (hitTp) dayHitCount++;
      dayMaxGainSum += (maxGainPct ?? 0);

      samples.push({
        snapshotDate: snapshot.snapshotDate,
        ticker: row.ticker,
        entryPrice,
        maxGainPct,
        maxDrawdownPct,
        hitTp,
        isCompleted,
      });
    }

    if (dayTradeCount > 0) {
      dailyMap.set(snapshot.snapshotDate, {
        snapshotDate: snapshot.snapshotDate,
        tradeCount: dayTradeCount,
        hitCount: dayHitCount,
        isCompleted: dayIsCompleted,
        avgMaxGainPct: dayMaxGainSum / (dayTradeCount - dayPendingCount || 1),
        pendingCount: dayPendingCount,
      });
    }
  }

  const tradeCount = samples.length;
  const finishedSamples = samples.filter(s => s.maxGainPct !== null);
  const finishedTradeCount = finishedSamples.length;
  
  const hitCount = samples.filter((sample) => sample.hitTp).length;
  const avgMaxGainPct =
    finishedTradeCount > 0
      ? finishedSamples.reduce((sum, sample) => sum + (sample.maxGainPct ?? 0), 0) / finishedTradeCount
      : null;
  const avgMaxDrawdownPct =
    finishedTradeCount > 0
      ? finishedSamples.reduce((sum, sample) => sum + (sample.maxDrawdownPct ?? 0), 0) / finishedTradeCount
      : null;

  const dailyStats = Array.from(dailyMap.values()).sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));

  return {
    preset: args.preset,
    priceBucket: args.priceBucket,
    lookbackDays,
    holdingDays,
    takeProfitPct,
    snapshotCount: snapshots.length,
    tradeCount,
    hitRate: tradeCount > 0 ? (hitCount / tradeCount) * 100 : null,
    avgMaxGainPct,
    avgMaxDrawdownPct,
    samples: samples.slice(0, 50),
    dailyStats,
  };
}
