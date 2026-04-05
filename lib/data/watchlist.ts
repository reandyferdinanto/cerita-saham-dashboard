import { connectDB } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";
import type { WatchlistEntry } from "@/lib/types";
import WatchlistModel from "@/lib/models/Watchlist";
import { runWithDatabasePreference } from "@/lib/data/provider";

export async function listWatchlistEntries() {
  return runWithDatabasePreference(
    "listWatchlistEntries",
    async () => {
      const result = await queryPostgres<{
        ticker: string;
        name: string;
        tp: number | null;
        sl: number | null;
        bandarmology: string;
        added_at: string;
      }>(`select ticker, name, tp, sl, bandarmology, added_at from watchlist order by added_at asc`);
      return result.rows.map(
        (row) =>
          ({
            ticker: row.ticker,
            name: row.name,
            tp: row.tp,
            sl: row.sl,
            bandarmology: row.bandarmology,
            addedAt: row.added_at,
          }) satisfies WatchlistEntry
      );
    },
    async () => {
      await connectDB();
      const docs = await WatchlistModel.find({}).sort({ addedAt: 1 }).lean();
      return docs.map(
        (doc) =>
          ({
            ticker: doc.ticker,
            name: doc.name,
            tp: doc.tp ?? null,
            sl: doc.sl ?? null,
            bandarmology: doc.bandarmology ?? "",
            addedAt: doc.addedAt,
          }) satisfies WatchlistEntry
      );
    }
  );
}

export async function addWatchlistEntry(entry: WatchlistEntry) {
  return runWithDatabasePreference(
    "addWatchlistEntry",
    async () => {
      const existing = await queryPostgres<{ ticker: string }>(
        `select ticker from watchlist where ticker = $1 limit 1`,
        [entry.ticker.toUpperCase()]
      );
      if (existing.rows[0]) {
        throw new Error(`${entry.ticker} sudah ada di watchlist`);
      }
      await queryPostgres(
        `insert into watchlist (ticker, name, tp, sl, bandarmology, added_at)
         values ($1,$2,$3,$4,$5,$6)`,
        [entry.ticker.toUpperCase(), entry.name, entry.tp, entry.sl, entry.bandarmology, entry.addedAt]
      );
      return listWatchlistEntries();
    },
    async () => {
      await connectDB();
      const exists = await WatchlistModel.findOne({ ticker: entry.ticker.toUpperCase() });
      if (exists) throw new Error(`${entry.ticker} sudah ada di watchlist`);
      await WatchlistModel.create({ ...entry, ticker: entry.ticker.toUpperCase() });
      return listWatchlistEntries();
    }
  );
}

export async function updateWatchlistEntry(
  ticker: string,
  patch: Partial<Pick<WatchlistEntry, "name" | "tp" | "sl" | "bandarmology">>
) {
  return runWithDatabasePreference(
    "updateWatchlistEntry",
    async () => {
      const existing = await queryPostgres<{
        ticker: string;
        name: string;
        tp: number | null;
        sl: number | null;
        bandarmology: string;
      }>(`select ticker, name, tp, sl, bandarmology from watchlist where ticker = $1 limit 1`, [ticker.toUpperCase()]);
      const row = existing.rows[0];
      if (!row) throw new Error(`${ticker} tidak ditemukan`);
      await queryPostgres(
        `update watchlist set name = $2, tp = $3, sl = $4, bandarmology = $5 where ticker = $1`,
        [
          ticker.toUpperCase(),
          patch.name ?? row.name,
          patch.tp ?? row.tp,
          patch.sl ?? row.sl,
          patch.bandarmology ?? row.bandarmology,
        ]
      );
      return listWatchlistEntries();
    },
    async () => {
      await connectDB();
      const result = await WatchlistModel.findOneAndUpdate({ ticker: ticker.toUpperCase() }, { $set: patch }, { new: true });
      if (!result) throw new Error(`${ticker} tidak ditemukan`);
      return listWatchlistEntries();
    }
  );
}

export async function removeWatchlistEntry(ticker: string) {
  return runWithDatabasePreference(
    "removeWatchlistEntry",
    async () => {
      await queryPostgres(`delete from watchlist where ticker = $1`, [ticker.toUpperCase()]);
      return listWatchlistEntries();
    },
    async () => {
      await connectDB();
      await WatchlistModel.deleteOne({ ticker: ticker.toUpperCase() });
      return listWatchlistEntries();
    }
  );
}
