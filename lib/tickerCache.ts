/**
 * Caching layer for ticker-article associations
 * Uses in-memory cache with TTL for frequently accessed data
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class TickerCache {
  private cache: Map<string, CacheEntry<any>>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;

  constructor() {
    this.cache = new Map();
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Set cached value with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Enforce max cache size (LRU-like behavior)
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
    });
  }

  /**
   * Delete cached value
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }
}

// Singleton instance
const tickerCache = new TickerCache();

/**
 * Cache key generators
 */
export const CacheKeys = {
  tickerArticles: (ticker: string, days: number) => `ticker:${ticker}:articles:${days}d`,
  tickerStats: (ticker: string) => `ticker:${ticker}:stats`,
  trendingTickers: (hours: number) => `trending:${hours}h`,
  allTickers: (days: number) => `tickers:all:${days}d`,
  sectorArticles: (sector: string, days: number) => `sector:${sector}:articles:${days}d`,
  articleTickers: (articleId: string) => `article:${articleId}:tickers`,
  searchResults: (query: string, filters: string) => `search:${query}:${filters}`,
};

/**
 * Cached getter with fallback
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache
  const cached = tickerCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();
  
  // Store in cache
  tickerCache.set(key, data, ttl);
  
  return data;
}

/**
 * Invalidate cache entries by pattern
 */
export function invalidateCache(pattern: string): void {
  const stats = tickerCache.getStats();
  const keysToDelete = stats.keys.filter((key) => key.includes(pattern));
  keysToDelete.forEach((key) => tickerCache.delete(key));
}

/**
 * Invalidate all ticker-related cache
 */
export function invalidateTickerCache(ticker?: string): void {
  if (ticker) {
    invalidateCache(`ticker:${ticker}`);
  } else {
    invalidateCache("ticker:");
    invalidateCache("trending:");
    invalidateCache("tickers:");
  }
}

/**
 * Invalidate all article-related cache
 */
export function invalidateArticleCache(articleId?: string): void {
  if (articleId) {
    invalidateCache(`article:${articleId}`);
  } else {
    invalidateCache("article:");
    invalidateCache("search:");
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return tickerCache.getStats();
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  tickerCache.clear();
}

export default tickerCache;

// Made with Bob
