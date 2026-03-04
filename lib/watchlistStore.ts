import { WatchlistEntry } from "./types";
import { promises as fs } from "fs";
import path from "path";

// ── Storage backend ────────────────────────────────────────────────────────────
// Production : @upstash/redis — set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// Development: local JSON file  data/watchlist.json
// ──────────────────────────────────────────────────────────────────────────────

const IS_PROD = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);
const KV_KEY = "watchlist";

// ── Redis helpers ─────────────────────────────────────────────────────────────

async function kvRead(): Promise<WatchlistEntry[]> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  const data = await redis.get<WatchlistEntry[]>(KV_KEY);
  return data ?? [];
}

async function kvWrite(entries: WatchlistEntry[]): Promise<void> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  await redis.set(KV_KEY, entries);
}

// ── Local file helpers (dev) ──────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");
const WATCHLIST_FILE = path.join(DATA_DIR, "watchlist.json");

async function localRead(): Promise<WatchlistEntry[]> {
  try {
    const raw = await fs.readFile(WATCHLIST_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function localWrite(entries: WatchlistEntry[]): Promise<void> {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch { /* exists */ }
  await fs.writeFile(WATCHLIST_FILE, JSON.stringify(entries, null, 2));
}

// ── Public API ────────────────────────────────────────────────────────────────

async function readWatchlist(): Promise<WatchlistEntry[]> {
  return IS_PROD ? kvRead() : localRead();
}

async function writeWatchlist(entries: WatchlistEntry[]): Promise<void> {
  IS_PROD ? await kvWrite(entries) : await localWrite(entries);
}

export async function getAll(): Promise<WatchlistEntry[]> {
  return readWatchlist();
}


export async function add(entry: WatchlistEntry): Promise<WatchlistEntry[]> {
  const entries = await readWatchlist();
  const exists = entries.find((e) => e.ticker.toUpperCase() === entry.ticker.toUpperCase());
  if (exists) throw new Error(`${entry.ticker} sudah ada di watchlist`);
  const updated = [...entries, entry];
  await writeWatchlist(updated);
  return updated;
}

export async function update(
  ticker: string,
  patch: Partial<Pick<WatchlistEntry, "name" | "tp" | "sl" | "bandarmology">>
): Promise<WatchlistEntry[]> {
  const entries = await readWatchlist();
  const idx = entries.findIndex((e) => e.ticker.toUpperCase() === ticker.toUpperCase());
  if (idx === -1) throw new Error(`${ticker} tidak ditemukan`);
  entries[idx] = { ...entries[idx], ...patch };
  await writeWatchlist(entries);
  return entries;
}

export async function remove(ticker: string): Promise<WatchlistEntry[]> {
  const entries = await readWatchlist();
  const updated = entries.filter((e) => e.ticker.toUpperCase() !== ticker.toUpperCase());
  await writeWatchlist(updated);
  return updated;
}
