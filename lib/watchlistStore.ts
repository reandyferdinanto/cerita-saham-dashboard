import { WatchlistEntry } from "./types";
import {
  addWatchlistEntry,
  listWatchlistEntries,
  removeWatchlistEntry,
  updateWatchlistEntry,
} from "./data/watchlist";

export async function getAll(): Promise<WatchlistEntry[]> {
  return listWatchlistEntries();
}

export async function add(entry: WatchlistEntry): Promise<WatchlistEntry[]> {
  return addWatchlistEntry(entry);
}

export async function update(
  ticker: string,
  patch: Partial<Pick<WatchlistEntry, "name" | "tp" | "sl" | "bandarmology">>
): Promise<WatchlistEntry[]> {
  return updateWatchlistEntry(ticker, patch);
}

export async function remove(ticker: string): Promise<WatchlistEntry[]> {
  return removeWatchlistEntry(ticker);
}
