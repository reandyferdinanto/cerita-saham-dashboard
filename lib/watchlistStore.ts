import { promises as fs } from "fs";
import path from "path";
import { WatchlistEntry } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const WATCHLIST_FILE = path.join(DATA_DIR, "watchlist.json");

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function readWatchlist(): Promise<WatchlistEntry[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(WATCHLIST_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    // Return default watchlist with some popular Indonesian stocks
    const defaults: WatchlistEntry[] = [
      {
        ticker: "BBCA.JK",
        name: "Bank Central Asia",
        tp: 10500,
        sl: 9200,
        bandarmology: "Akumulasi oleh foreign. Volume meningkat konsisten.",
        addedAt: new Date().toISOString(),
      },
      {
        ticker: "BBRI.JK",
        name: "Bank Rakyat Indonesia",
        tp: 5800,
        sl: 4900,
        bandarmology: "Big player distribusi ringan. Perhatikan support area.",
        addedAt: new Date().toISOString(),
      },
      {
        ticker: "TLKM.JK",
        name: "Telkom Indonesia",
        tp: 4200,
        sl: 3600,
        bandarmology: "Akumulasi kembali setelah koreksi. Bandar mulai entry.",
        addedAt: new Date().toISOString(),
      },
      {
        ticker: "ASII.JK",
        name: "Astra International",
        tp: 6000,
        sl: 4800,
        bandarmology: "Sideways. Tunggu konfirmasi breakout.",
        addedAt: new Date().toISOString(),
      },
    ];
    await writeWatchlist(defaults);
    return defaults;
  }
}

async function writeWatchlist(entries: WatchlistEntry[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(WATCHLIST_FILE, JSON.stringify(entries, null, 2));
}

export async function getAll(): Promise<WatchlistEntry[]> {
  return readWatchlist();
}

export async function getByTicker(ticker: string): Promise<WatchlistEntry | undefined> {
  const entries = await readWatchlist();
  return entries.find((e) => e.ticker.toUpperCase() === ticker.toUpperCase());
}

export async function add(entry: WatchlistEntry): Promise<WatchlistEntry[]> {
  const entries = await readWatchlist();
  const exists = entries.find(
    (e) => e.ticker.toUpperCase() === entry.ticker.toUpperCase()
  );
  if (exists) {
    throw new Error(`Ticker ${entry.ticker} already exists in watchlist`);
  }
  entries.push(entry);
  await writeWatchlist(entries);
  return entries;
}

export async function update(
  ticker: string,
  updates: Partial<Omit<WatchlistEntry, "ticker">>
): Promise<WatchlistEntry[]> {
  const entries = await readWatchlist();
  const index = entries.findIndex(
    (e) => e.ticker.toUpperCase() === ticker.toUpperCase()
  );
  if (index === -1) {
    throw new Error(`Ticker ${ticker} not found in watchlist`);
  }
  entries[index] = { ...entries[index], ...updates };
  await writeWatchlist(entries);
  return entries;
}

export async function remove(ticker: string): Promise<WatchlistEntry[]> {
  const entries = await readWatchlist();
  const filtered = entries.filter(
    (e) => e.ticker.toUpperCase() !== ticker.toUpperCase()
  );
  if (filtered.length === entries.length) {
    throw new Error(`Ticker ${ticker} not found in watchlist`);
  }
  await writeWatchlist(filtered);
  return filtered;
}

