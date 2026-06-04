import { NextResponse } from "next/server";
import { queryPostgres } from "@/lib/postgres";
import { getCached, CacheKeys } from "@/lib/tickerCache";

interface ArticleNewsItem {
  _id: string;
  title: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  extractedTickers: Array<{
    ticker: string;
    fullTicker: string;
    relevanceScore: number;
    isPrimary: boolean;
    mentionCount: number;
  }>;
  metadata: {
    sentiment?: "positive" | "negative" | "neutral";
    sentimentScore?: number;
    impactLevel?: "high" | "medium" | "low";
    articleType?: string;
    sectors?: string[];
  };
}

/**
 * GET /api/news/articles/[ticker]
 * Returns articles that mention a specific ticker
 * Query params:
 * - limit: number of articles (default: 10, max: 50)
 * - days: look back period (default: 30)
 * - primaryOnly: only articles where ticker is primary subject (default: false)
 * - minRelevance: minimum relevance score (default: 0)
 */
export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = params.ticker.toUpperCase().replace(".JK", "");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const days = parseInt(searchParams.get("days") || "30");
    const primaryOnly = searchParams.get("primaryOnly") === "true";
    const minRelevance = parseInt(searchParams.get("minRelevance") || "0");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Use cache for frequently accessed tickers
    const cacheKey = CacheKeys.tickerArticles(ticker, days);
    
    const articles = await getCached<ArticleNewsItem[]>(
      cacheKey,
      async () => {
        let query = `
          SELECT 
            a.id as "_id",
            a.title,
            a.content,
            a.image_url as "imageUrl",
            a.created_at as "createdAt",
            a.extracted_tickers as "extractedTickers",
            a.metadata
          FROM articles a
          WHERE a.is_public = true
            AND a.created_at >= $1
            AND EXISTS (
              SELECT 1 FROM jsonb_to_recordset(a.extracted_tickers) 
              AS t(ticker text, is_primary boolean, relevance_score numeric)
              WHERE t.ticker = $2
              ${primaryOnly ? "AND t.is_primary = true" : ""}
              ${minRelevance > 0 ? `AND t.relevance_score >= ${minRelevance}` : ""}
            )
          ORDER BY a.created_at DESC
          LIMIT $3
        `;

        const result = await queryPostgres<ArticleNewsItem>(query, [
          cutoffDate,
          ticker,
          limit,
        ]);

        return result.rows;
      },
      3 * 60 * 1000 // 3 minutes cache
    );

    // Transform articles to news format
    const newsItems = articles.map((article) => {
      // Find the ticker mention in this article
      const tickerMention = article.extractedTickers?.find(
        (t) => t.ticker === ticker
      );

      // Extract excerpt from content (first 200 chars)
      const excerpt = article.content
        .replace(/!\[[^\]]*]\([^)]*\)/g, "")
        .replace(/\[[^\]]*]\([^)]*\)/g, "")
        .replace(/[#*_>`-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);

      return {
        title: article.title,
        description: excerpt + (article.content.length > 200 ? "..." : ""),
        link: `/articles/${article._id}`,
        pubDate: article.createdAt,
        source: "Anomali Saham",
        image: article.imageUrl || undefined,
        sentiment: article.metadata?.sentiment || "neutral",
        sentimentScore: article.metadata?.sentimentScore || 0,
        sentimentReason: `Relevansi: ${tickerMention?.relevanceScore || 0}% | ${
          tickerMention?.isPrimary ? "Topik Utama" : "Disebutkan"
        }`,
        relevanceScore: tickerMention?.relevanceScore || 0,
        isPrimary: tickerMention?.isPrimary || false,
        articleType: article.metadata?.articleType || "general",
        impactLevel: article.metadata?.impactLevel || "low",
      };
    });

    return NextResponse.json({
      ticker,
      articles: newsItems,
      count: newsItems.length,
      period: { days, from: cutoffDate.toISOString() },
      filters: { primaryOnly, minRelevance },
    });
  } catch (error) {
    console.error("Error fetching ticker articles:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles for ticker" },
      { status: 500 }
    );
  }
}

// Made with Bob