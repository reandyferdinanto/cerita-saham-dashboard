import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { buildTechnicalSnapshot } from "@/lib/technicalIndicators";

// Load IDX stock universe
const IDX_STOCKS_PATH = "public/idx_stocks_with_sectors_20260501.json";

interface StockUniverse {
  ticker: string;
  name: string;
  sector?: string;
  subsector?: string;
}

interface DivergenceScreenerResult {
  ticker: string;
  name: string;
  sector: string;
  rsiDivergence: {
    type: "bullish" | "bearish";
    strength: number;
    pricePoints: { index: number; value: number }[];
    rsiPoints: { index: number; value: number }[];
  } | null;
  macdDivergence: {
    type: "bullish" | "bearish";
    strength: number;
    pricePoints: { index: number; value: number }[];
  } | null;
  currentPrice: number;
  changePercent: number;
  volume: number;
  lastUpdated: string;
  hasDoubleDivergence: boolean;
  combinedStrength: number;
}

// In-memory cache for screener results
let cachedResults: DivergenceScreenerResult[] = [];
let lastScanTime: Date | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

async function fetchStockHistory(ticker: string): Promise<any[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/stocks/history/${encodeURIComponent(ticker)}?range=3mo&interval=1d`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Failed to fetch history for ${ticker}:`, error);
    return [];
  }
}

async function scanSingleStock(stock: StockUniverse): Promise<DivergenceScreenerResult | null> {
  try {
    const history = await fetchStockHistory(`${stock.ticker}.JK`);
    if (history.length < 60) return null;

    // Convert to newest-first format
    const reversedHistory = [...history].reverse();
    const snapshot = buildTechnicalSnapshot(reversedHistory);

    // Check for divergences
    const hasRsiDiv = snapshot.rsiDivergence?.type === "bullish" || snapshot.rsiDivergence?.type === "bearish";
    const hasMacdDiv = snapshot.macdDivergence?.type === "bullish" || snapshot.macdDivergence?.type === "bearish";

    if (!hasRsiDiv && !hasMacdDiv) return null;

    const currentPrice = history[history.length - 1].close;
    const prevPrice = history[history.length - 2]?.close || currentPrice;
    const changePercent = ((currentPrice - prevPrice) / prevPrice) * 100;

    const rsiStrength = snapshot.rsiDivergence?.strength || 0;
    const macdStrength = snapshot.macdDivergence?.strength || 0;
    const combinedStrength = Math.round((rsiStrength + macdStrength) / (hasRsiDiv && hasMacdDiv ? 2 : 1));

    return {
      ticker: stock.ticker,
      name: stock.name,
      sector: stock.sector || "Unknown",
      rsiDivergence: hasRsiDiv ? {
        type: snapshot.rsiDivergence!.type as "bullish" | "bearish",
        strength: snapshot.rsiDivergence!.strength,
        pricePoints: snapshot.rsiDivergence!.pricePoints,
        rsiPoints: snapshot.rsiDivergence!.rsiPoints,
      } : null,
      macdDivergence: hasMacdDiv ? {
        type: snapshot.macdDivergence!.type as "bullish" | "bearish",
        strength: snapshot.macdDivergence!.strength,
        pricePoints: snapshot.macdDivergence!.pricePoints,
      } : null,
      currentPrice,
      changePercent,
      volume: history[history.length - 1].volume || 0,
      lastUpdated: new Date().toISOString(),
      hasDoubleDivergence: hasRsiDiv && hasMacdDiv,
      combinedStrength,
    };
  } catch (error) {
    console.error(`Error scanning ${stock.ticker}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  // Check admin session
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "true";
  const divergenceType = searchParams.get("type") as "bullish" | "bearish" | "all" | null;
  const minStrength = parseInt(searchParams.get("minStrength") || "0");
  const sector = searchParams.get("sector");
  const doubleDivOnly = searchParams.get("doubleDivOnly") === "true";

  // Return cached results if available and not forcing refresh
  if (!forceRefresh && cachedResults.length > 0 && lastScanTime) {
    const cacheAge = Date.now() - lastScanTime.getTime();
    if (cacheAge < CACHE_DURATION_MS) {
      let filtered = cachedResults;

      // Apply filters
      if (divergenceType && divergenceType !== "all") {
        filtered = filtered.filter(r => 
          (r.rsiDivergence?.type === divergenceType) || 
          (r.macdDivergence?.type === divergenceType)
        );
      }

      if (minStrength > 0) {
        filtered = filtered.filter(r => r.combinedStrength >= minStrength);
      }

      if (sector) {
        filtered = filtered.filter(r => r.sector === sector);
      }

      if (doubleDivOnly) {
        filtered = filtered.filter(r => r.hasDoubleDivergence);
      }

      return NextResponse.json({
        results: filtered,
        totalScanned: cachedResults.length,
        lastScanTime: lastScanTime.toISOString(),
        cacheAge: Math.round(cacheAge / 1000),
        fromCache: true,
      });
    }
  }

  // Perform new scan
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const stocksPath = path.join(process.cwd(), IDX_STOCKS_PATH);
    const stocksData = await fs.readFile(stocksPath, "utf-8");
    const stocks: StockUniverse[] = JSON.parse(stocksData);

    // Limit to top 100 stocks for performance (can be adjusted)
    const stocksToScan = stocks.slice(0, 100);

    // Scan stocks in batches of 10 to avoid overwhelming the API
    const batchSize = 10;
    const results: DivergenceScreenerResult[] = [];

    for (let i = 0; i < stocksToScan.length; i += batchSize) {
      const batch = stocksToScan.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(stock => scanSingleStock(stock))
      );
      results.push(...batchResults.filter((r): r is DivergenceScreenerResult => r !== null));
    }

    // Sort by combined strength descending
    results.sort((a, b) => b.combinedStrength - a.combinedStrength);

    // Update cache
    cachedResults = results;
    lastScanTime = new Date();

    // Apply filters
    let filtered = results;

    if (divergenceType && divergenceType !== "all") {
      filtered = filtered.filter(r => 
        (r.rsiDivergence?.type === divergenceType) || 
        (r.macdDivergence?.type === divergenceType)
      );
    }

    if (minStrength > 0) {
      filtered = filtered.filter(r => r.combinedStrength >= minStrength);
    }

    if (sector) {
      filtered = filtered.filter(r => r.sector === sector);
    }

    if (doubleDivOnly) {
      filtered = filtered.filter(r => r.hasDoubleDivergence);
    }

    return NextResponse.json({
      results: filtered,
      totalScanned: stocksToScan.length,
      lastScanTime: lastScanTime.toISOString(),
      cacheAge: 0,
      fromCache: false,
    });
  } catch (error) {
    console.error("Divergence screener error:", error);
    return NextResponse.json(
      { error: "Failed to scan stocks for divergences" },
      { status: 500 }
    );
  }
}

// Made with Bob
