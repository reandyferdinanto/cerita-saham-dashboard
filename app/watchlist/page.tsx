"use client";

import { useEffect, useState, useCallback } from "react";
import GlassCard from "@/components/ui/GlassCard";
import StockCard from "@/components/watchlist/StockCard";
import { WatchlistWithQuote } from "@/lib/types";

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistWithQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "change" | "price">("name");

  const fetchData = useCallback(async () => {
    try {
      const wlRes = await fetch("/api/watchlist");
      const wlData = await wlRes.json();

      const stocksWithQuotes: WatchlistWithQuote[] = await Promise.all(
        (Array.isArray(wlData) ? wlData : []).map(async (stock: WatchlistWithQuote) => {
          try {
            const quoteRes = await fetch(
              `/api/stocks/quote/${encodeURIComponent(stock.ticker)}`
            );
            const quote = await quoteRes.json();
            return { ...stock, quote };
          } catch {
            return stock;
          }
        })
      );
      setWatchlist(stocksWithQuotes);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const sortedWatchlist = [...watchlist].sort((a, b) => {
    switch (sortBy) {
      case "change":
        return (b.quote?.changePercent || 0) - (a.quote?.changePercent || 0);
      case "price":
        return (b.quote?.price || 0) - (a.quote?.price || 0);
      case "name":
      default:
        return a.ticker.localeCompare(b.ticker);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-silver-100">
            Stock <span className="text-orange-400">Watchlist</span>
          </h1>
          <p className="text-silver-500 text-sm mt-1">
            {watchlist.length} stocks tracked with TP/SL and bandarmology
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-silver-500">Sort by:</span>
          {(["name", "change", "price"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                sortBy === s
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : "text-silver-500 hover:text-silver-300 hover:bg-green-800/30"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="h-4 bg-silver-500/10 rounded w-20 mb-3"></div>
              <div className="h-8 bg-silver-500/10 rounded w-32 mb-4"></div>
              <div className="h-3 bg-silver-500/10 rounded w-full mb-2"></div>
              <div className="h-3 bg-silver-500/10 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : sortedWatchlist.length === 0 ? (
        <GlassCard>
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-silver-400 mb-2">Your watchlist is empty</p>
            <p className="text-silver-500 text-sm mb-4">
              Head to the admin page to add stocks
            </p>
            <a
              href="/admin"
              className="glass-button px-6 py-3 text-sm inline-block"
            >
              + Add Stocks
            </a>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedWatchlist.map((stock) => (
            <StockCard key={stock.ticker} stock={stock} />
          ))}
        </div>
      )}
    </div>
  );
}

