import { NextResponse } from "next/server";
import { queryPostgres } from "@/lib/postgres";
import { getCached, CacheKeys } from "@/lib/tickerCache";

interface TrendingTicker {
  ticker: string;
  fullTicker: string;
  articleCount: number;
  recentMentions: number; // last 24h
  trendScore: number;
  sentiment: "positive" | "negative" | "neutral";
  avgSentimentScore: number;
  latestArticle: {
    id: string;
    title: string;
    createdAt: string;
  };
}

/**
 * GET /api/insights/trending
 * Returns trending tickers based on recent article mentions and sentiment
 * Query params:
 * - limit: number of results (default: 10)
 * - hours: look back period in hours (default: 24)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const hours = parseInt(searchParams.get("hours") || "24");

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    // Use cache for trending data
    const cacheKey = CacheKeys.trendingTickers(hours);
    
    const trending = await getCached<TrendingTicker[]>(
      cacheKey,
      async () => {
        // PostgreSQL implementation with MODE() for sentiment
        const query = `
          WITH recent_articles AS (
            SELECT 
              a.id,
              a.title,
              a.created_at,
              t.ticker,
              t.full_ticker,
              t.relevance_score,
              t.is_primary,
              COALESCE((a.metadata->>'sentiment')::text, 'neutral') as sentiment,
              COALESCE((a.metadata->>'sentimentScore')::numeric, 0) as sentiment_score
            FROM articles a
            CROSS JOIN LATERAL jsonb_to_recordset(a.extracted_tickers) 
              AS t(ticker text, full_ticker text, relevance_score numeric, is_primary boolean)
            WHERE a.created_at >= $1
              AND a.is_public = true
          ),
          ticker_stats AS (
            SELECT 
              ticker,
              full_ticker,
              COUNT(*) as article_count,
              SUM(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END) as recent_mentions,
              AVG(relevance_score) * COUNT(*) as trend_score,
              MODE() WITHIN GROUP (ORDER BY sentiment) as sentiment,
              AVG(sentiment_score) as avg_sentiment_score,
              MAX(created_at) as latest_mention
            FROM recent_articles
            GROUP BY ticker, full_ticker
          )
          SELECT 
            ts.ticker,
            ts.full_ticker as "fullTicker",
            ts.article_count as "articleCount",
            ts.recent_mentions as "recentMentions",
            ROUND(ts.trend_score::numeric, 2) as "trendScore",
            ts.sentiment,
            ROUND(ts.avg_sentiment_score::numeric, 2) as "avgSentimentScore",
            jsonb_build_object(
              'id', ra.id,
              'title', ra.title,
              'createdAt', ra.created_at
            ) as "latestArticle"
          FROM ticker_stats ts
          JOIN recent_articles ra ON ra.ticker = ts.ticker 
            AND ra.created_at = ts.latest_mention
          ORDER BY ts.trend_score DESC, ts.recent_mentions DESC
          LIMIT $2
        `;

        const result = await queryPostgres<TrendingTicker>(query, [cutoffDate, limit]);
        return result.rows;
      },
      2 * 60 * 1000 // 2 minutes cache for trending data
    );

    return NextResponse.json({
      trending,
      count: trending.length,
      period: { hours, from: cutoffDate.toISOString() },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching trending tickers:", error);
    return NextResponse.json(
      { error: "Failed to fetch trending tickers" },
      { status: 500 }
    );
  }
}

// Made with Bob
