import { connectDB } from "@/lib/db";
import NewsArticle from "@/lib/models/NewsArticle";

export type CachedNewsItem = {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  description: string;
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number;
  sentimentReason: string;
};

const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours — re-fetch if cache is older

function normalizeTicker(ticker: string): string {
  return ticker.toUpperCase().replace(/\.JK$/i, "").trim();
}

/**
 * Fetch cached news for a ticker, sorted by pubDate desc.
 * Returns up to `limit` items from the last 30 days (TTL boundary).
 */
export async function getCachedNews(ticker: string, limit = 25): Promise<CachedNewsItem[]> {
  await connectDB();
  const code = normalizeTicker(ticker);
  const docs = await NewsArticle.find({ ticker: code })
    .sort({ pubDate: -1 })
    .limit(limit)
    .lean<
      Array<{
        title: string;
        link: string;
        source: string;
        pubDate: Date;
        description: string;
        sentiment: "positive" | "negative" | "neutral";
        sentimentScore: number;
        sentimentReason: string;
      }>
    >();

  return docs.map((doc) => ({
    title: doc.title,
    link: doc.link,
    source: doc.source || "",
    pubDate: doc.pubDate.toISOString(),
    description: doc.description || "",
    sentiment: doc.sentiment,
    sentimentScore: doc.sentimentScore || 0,
    sentimentReason: doc.sentimentReason || "",
  }));
}

/**
 * Returns true if cache for this ticker is fresh (newest item fetched within STALE_AFTER_MS).
 */
export async function isCacheFresh(ticker: string): Promise<boolean> {
  await connectDB();
  const code = normalizeTicker(ticker);
  const newest = await NewsArticle.findOne({ ticker: code })
    .sort({ fetchedAt: -1 })
    .select({ fetchedAt: 1 })
    .lean<{ fetchedAt: Date } | null>();
  if (!newest) return false;
  return Date.now() - new Date(newest.fetchedAt).getTime() < STALE_AFTER_MS;
}

/**
 * Upsert news items into cache. Items with duplicate (ticker, link) are updated.
 */
export async function cacheNewsItems(ticker: string, items: CachedNewsItem[]): Promise<number> {
  if (items.length === 0) return 0;
  await connectDB();
  const code = normalizeTicker(ticker);
  let saved = 0;

  for (const item of items) {
    if (!item.title || !item.link) continue;
    try {
      const pubDate = new Date(item.pubDate);
      if (Number.isNaN(pubDate.getTime())) continue;

      await NewsArticle.updateOne(
        { ticker: code, link: item.link },
        {
          $set: {
            ticker: code,
            title: item.title,
            link: item.link,
            source: item.source || "",
            pubDate,
            description: item.description || "",
            sentiment: item.sentiment,
            sentimentScore: item.sentimentScore || 0,
            sentimentReason: item.sentimentReason || "",
            fetchedAt: new Date(),
          },
        },
        { upsert: true }
      );
      saved += 1;
    } catch {
      // ignore duplicate or write errors
    }
  }
  return saved;
}

/**
 * Convenience: try cache first, only fetch via fetcher() if cache is stale or empty.
 */
export async function getNewsWithCache(
  ticker: string,
  fetcher: () => Promise<CachedNewsItem[]>,
  options: { limit?: number; forceRefresh?: boolean } = {}
): Promise<{ items: CachedNewsItem[]; fromCache: boolean }> {
  const limit = options.limit ?? 25;
  if (!options.forceRefresh) {
    const fresh = await isCacheFresh(ticker);
    if (fresh) {
      const cached = await getCachedNews(ticker, limit);
      if (cached.length > 0) return { items: cached, fromCache: true };
    }
  }

  let fetched: CachedNewsItem[] = [];
  try {
    fetched = await fetcher();
  } catch {
    // fall through to cached fallback
  }

  if (fetched.length > 0) {
    await cacheNewsItems(ticker, fetched);
  }

  // Always serve from DB after upsert (mixes fresh + older cached)
  const merged = await getCachedNews(ticker, limit);
  return { items: merged.length > 0 ? merged : fetched, fromCache: merged.length > 0 && fetched.length === 0 };
}
