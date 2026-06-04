import { NextResponse } from "next/server";
import { queryPostgres } from "@/lib/postgres";
import { getCached, CacheKeys } from "@/lib/tickerCache";

interface TickerStats {
  ticker: string;
  fullTicker: string;
  articleCount: number;
  totalRelevance: number;
  avgRelevance: number;
  primaryMentions: number;
  sectors: string[];
  latestMention: string;
}

/**
 * GET /api/insights/tickers
 * Returns all unique tickers mentioned in articles with statistics
 * Query params:
 * - minArticles: minimum number of articles (default: 1)
 * - days: look back period in days (default: 30)
 * - sector: filter by sector
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minArticles = parseInt(searchParams.get("minArticles") || "1");
    const days = parseInt(searchParams.get("days") || "30");
    const sector = searchParams.get("sector");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Use cache for frequently accessed data
    const cacheKey = CacheKeys.allTickers(days) + (sector ? `:${sector}` : "");
    
    const tickerStats = await getCached<TickerStats[]>(
      cacheKey,
      async () => {
        // PostgreSQL implementation
        let query = `
          SELECT 
            t.ticker,
            t.full_ticker as "fullTicker",
            COUNT(DISTINCT a.id) as "articleCount",
            SUM(t.relevance_score) as "totalRelevance",
            AVG(t.relevance_score) as "avgRelevance",
            SUM(CASE WHEN t.is_primary THEN 1 ELSE 0 END) as "primaryMentions",
            ARRAY_AGG(DISTINCT m.sectors) FILTER (WHERE m.sectors IS NOT NULL) as sectors,
            MAX(a.created_at) as "latestMention"
          FROM articles a
          CROSS JOIN LATERAL jsonb_to_recordset(a.extracted_tickers) 
            AS t(ticker text, full_ticker text, relevance_score numeric, is_primary boolean)
          LEFT JOIN LATERAL (
            SELECT jsonb_array_elements_text(a.metadata->'sectors') as sectors
          ) m ON true
          WHERE a.created_at >= $1
            AND a.is_public = true
        `;

        const params: unknown[] = [cutoffDate];

        if (sector) {
          query += ` AND $${params.length + 1} = ANY(
            SELECT jsonb_array_elements_text(a.metadata->'sectors')
          )`;
          params.push(sector);
        }

        query += `
          GROUP BY t.ticker, t.full_ticker
          HAVING COUNT(DISTINCT a.id) >= $${params.length + 1}
          ORDER BY "articleCount" DESC, "avgRelevance" DESC
          LIMIT 100
        `;
        params.push(minArticles);

        const result = await queryPostgres<TickerStats>(query, params);
        return result.rows;
      },
      5 * 60 * 1000 // 5 minutes cache
    );

    return NextResponse.json({
      tickers: tickerStats,
      count: tickerStats.length,
      period: { days, from: cutoffDate.toISOString() },
    });
  } catch (error) {
    console.error("Error fetching ticker stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticker statistics" },
      { status: 500 }
    );
  }
}

// Made with Bob
