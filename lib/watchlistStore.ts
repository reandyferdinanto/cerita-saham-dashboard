import { WatchlistEntry } from "./types";
import { connectDB } from "./db";
import WatchlistModel from "./models/Watchlist";

// ── helpers ───────────────────────────────────────────────────────────────────

function toPlain(doc: unknown): WatchlistEntry {
  const d = doc as Record<string, unknown>;
  return {
    ticker: d.ticker as string,
    name: d.name as string,
    tp: (d.tp ?? null) as number | null,
    sl: (d.sl ?? null) as number | null,
    bandarmology: (d.bandarmology ?? "") as string,
    addedAt: d.addedAt as string,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getAll(): Promise<WatchlistEntry[]> {
  await connectDB();
  const docs = await WatchlistModel.find({}).sort({ addedAt: 1 }).lean();
  return docs.map(toPlain);
}

export async function add(entry: WatchlistEntry): Promise<WatchlistEntry[]> {
  await connectDB();
  const exists = await WatchlistModel.findOne({
    ticker: entry.ticker.toUpperCase(),
  });
  if (exists) throw new Error(`${entry.ticker} sudah ada di watchlist`);
  await WatchlistModel.create({ ...entry, ticker: entry.ticker.toUpperCase() });
  return getAll();
}

export async function update(
  ticker: string,
  patch: Partial<Pick<WatchlistEntry, "name" | "tp" | "sl" | "bandarmology">>
): Promise<WatchlistEntry[]> {
  await connectDB();
  const result = await WatchlistModel.findOneAndUpdate(
    { ticker: ticker.toUpperCase() },
    { $set: patch },
    { new: true }
  );
  if (!result) throw new Error(`${ticker} tidak ditemukan`);
  return getAll();
}

export async function remove(ticker: string): Promise<WatchlistEntry[]> {
  await connectDB();
  await WatchlistModel.deleteOne({ ticker: ticker.toUpperCase() });
  return getAll();
}
