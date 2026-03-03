import { WatchlistEntry } from "./types";

// ── Storage backend ────────────────────────────────────────────────────────────
// Production (Vercel): uses @vercel/kv (Redis) — requires KV_REST_API_URL env var
// Development         : falls back to local JSON file in /data/watchlist.json
// ──────────────────────────────────────────────────────────────────────────────

const IS_PROD = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const KV_KEY = "watchlist";

// ── KV helpers ────────────────────────────────────────────────────────────────

async function kvRead(): Promise<WatchlistEntry[]> {
  const { kv } = await import("@vercel/kv");
  const data = await kv.get<WatchlistEntry[]>(KV_KEY);
  return data ?? [];
}

async function kvWrite(entries: WatchlistEntry[]): Promise<void> {
  const { kv } = await import("@vercel/kv");
  await kv.set(KV_KEY, entries);
}

// ── Local file helpers (dev) ──────────────────────────────────────────────────

async function localRead(): Promise<WatchlistEntry[]> {
  const { promises: fs } = await import("fs");
  const path = await import("path");
  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, "watchlist.json");
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function localWrite(entries: WatchlistEntry[]): Promise<void> {
  const { promises: fs } = await import("fs");
  const path = await import("path");
  const dir = path.join(process.cwd(), "data");
  try { await fs.mkdir(dir, { recursive: true }); } catch { /* exists */ }
  await fs.writeFile(path.join(dir, "watchlist.json"), JSON.stringify(entries, null, 2));
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

export async function getByTicker(ticker: string): Promise<WatchlistEntry | undefined> {
  const entries = await readWatchlist();
  return entries.find((e) => e.ticker.toUpperCase() === ticker.toUpperCase());
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
