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

export async function getBandarmologyBacktest(args: BacktestArgs) {
  await connectDB();

  const lookbackDays = Math.min(args.lookbackDays ?? 20, 90);
  const holdingDays = Math.min(args.holdingDays ?? 5, 20);
  const takeProfitPct = args.takeProfitPct ?? 5;
  const earliestDate = addDays(toDateOnly(new Date()), -lookbackDays);

  const snapshots = await BandarmologyScreenerSnapshot.find({
    preset: args.preset,
    priceBucket: args.priceBucket,
    snapshotDate: { $gte: earliestDate },
  })
    .sort({ snapshotDate: -1 })
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
    };
  }

  const tickerSet = new Set<string>();
  for (const snapshot of snapshots) {
    for (const row of snapshot.rows) {
      tickerSet.add(row.ticker);
    }
  }

  const historyByTicker = new Map<string, Awaited<ReturnType<typeof getHistory>>>();
  await Promise.all(
    Array.from(tickerSet).map(async (ticker) => {
      const period1 = addDays(earliestDate, -3);
      const history = await getHistory(ticker, period1, undefined, "1d");
      historyByTicker.set(ticker, history);
    })
  );

  const samples: Array<{
    snapshotDate: string;
    ticker: string;
    entryPrice: number;
    maxGainPct: number | null;
    maxDrawdownPct: number | null;
    hitTp: boolean;
  }> = [];

  for (const snapshot of snapshots) {
    for (const row of snapshot.rows) {
      const history = historyByTicker.get(row.ticker) || [];
      const startIndex = history.findIndex((point: HistoryPoint) => String(point.time).slice(0, 10) >= snapshot.snapshotDate);
      if (startIndex === -1) continue;

      const window = history.slice(startIndex, startIndex + holdingDays);
      if (window.length === 0) continue;

      const entryPrice = row.price;
      const maxHigh = Math.max(...window.map((point: HistoryPoint) => point.high ?? point.close));
      const minLow = Math.min(...window.map((point: HistoryPoint) => point.low ?? point.close));
      const maxGainPct = entryPrice > 0 ? ((maxHigh - entryPrice) / entryPrice) * 100 : null;
      const maxDrawdownPct = entryPrice > 0 ? ((minLow - entryPrice) / entryPrice) * 100 : null;

      samples.push({
        snapshotDate: snapshot.snapshotDate,
        ticker: row.ticker,
        entryPrice,
        maxGainPct,
        maxDrawdownPct,
        hitTp: (maxGainPct ?? -999) >= takeProfitPct,
      });
    }
  }

  const tradeCount = samples.length;
  const hitCount = samples.filter((sample) => sample.hitTp).length;
  const avgMaxGainPct =
    tradeCount > 0
      ? samples.reduce((sum, sample) => sum + (sample.maxGainPct ?? 0), 0) / tradeCount
      : null;
  const avgMaxDrawdownPct =
    tradeCount > 0
      ? samples.reduce((sum, sample) => sum + (sample.maxDrawdownPct ?? 0), 0) / tradeCount
      : null;

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
    samples: samples.slice(0, 20),
  };
}
