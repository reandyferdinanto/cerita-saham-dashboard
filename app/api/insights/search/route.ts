import { NextResponse } from "next/server";
import { queryPostgres } from "@/lib/postgres";

interface SearchFilters {
  tickers?: string[];
  sectors?: string[];
  sentiment?: "positive" | "negative" | "neutral";
  articleType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minRelevance?: number;
  primaryOnly?: boolean;
  query?: string;
}

interface SearchResult {
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
  }>;
  metadata: {
    sentiment?: string;
    sentimentScore?: number;
    impactLevel?: string;
    articleType?: string;
    sectors?: string[];
    viewCount?: number;
  };
}

/**
 * GET /api/insights/search
 * Advanced search with multiple filters
 * Query params:
 * - tickers: comma-separated ticker codes (e.g., "BBCA,GOTO")
 * - sectors: comma-separated sectors
 * - sentiment: positive|negative|neutral
 * - articleType: earnings|ma|regulatory|market_analysis|general
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 * - minRelevance: minimum relevance score (0-100)
 * - primaryOnly: true|false (only articles where ticker is primary subject)
 * - query: text search in title/content
 * - page: page number (default: 1)
 * - limit: results per page (default: 20)
 * - sortBy: createdAt|relevance|viewCount (default: createdAt)
 * - sortOrder: asc|desc (default: desc)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const filters: SearchFilters = {
      tickers: searchParams.get("tickers")?.split(",").filter(Boolean),
      sectors: searchParams.get("sectors")?.split(",").filter(Boolean),
      sentiment: searchParams.get("sentiment") as any,
      articleType: searchParams.get("articleType") || undefined,
      dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined,
      dateTo: searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined,
      minRelevance: searchParams.get("minRelevance") ? parseInt(searchParams.get("minRelevance")!) : undefined,
      primaryOnly: searchParams.get("primaryOnly") === "true",
      query: searchParams.get("query") || undefined,
    };

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const skip = (page - 1) * limit;

    // Sorting
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

    // PostgreSQL implementation
    let whereConditions: string[] = ["a.is_public = true"];
    const params: any[] = [];
    let paramIndex = 1;

    // Ticker filter
    if (filters.tickers && filters.tickers.length > 0) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM jsonb_to_recordset(a.extracted_tickers) 
        AS t(ticker text, is_primary boolean, relevance_score numeric)
        WHERE t.ticker = ANY($${paramIndex})
        ${filters.primaryOnly ? "AND t.is_primary = true" : ""}
        ${filters.minRelevance ? `AND t.relevance_score >= $${paramIndex + 1}` : ""}
      )`);
      params.push(filters.tickers);
      paramIndex++;
      if (filters.minRelevance) {
        params.push(filters.minRelevance);
        paramIndex++;
      }
    }

    // Sector filter
    if (filters.sectors && filters.sectors.length > 0) {
      whereConditions.push(`a.metadata->'sectors' ?| $${paramIndex}`);
      params.push(filters.sectors);
      paramIndex++;
    }

    // Sentiment filter
    if (filters.sentiment) {
      whereConditions.push(`a.metadata->>'sentiment' = $${paramIndex}`);
      params.push(filters.sentiment);
      paramIndex++;
    }

    // Article type filter
    if (filters.articleType) {
      whereConditions.push(`a.metadata->>'articleType' = $${paramIndex}`);
      params.push(filters.articleType);
      paramIndex++;
    }

    // Date range filter
    if (filters.dateFrom) {
      whereConditions.push(`a.created_at >= $${paramIndex}`);
      params.push(filters.dateFrom);
      paramIndex++;
    }
    if (filters.dateTo) {
      whereConditions.push(`a.created_at <= $${paramIndex}`);
      params.push(filters.dateTo);
      paramIndex++;
    }

    // Text search
    if (filters.query) {
      whereConditions.push(`(
        a.title ILIKE $${paramIndex} OR 
        a.content ILIKE $${paramIndex}
      )`);
      params.push(`%${filters.query}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(" AND ")}`
      : "";

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM articles a
      ${whereClause}
    `;
    const countResult = await queryPostgres<{ total: string }>(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || "0");

    // Main query
    const sortColumn = sortBy === "viewCount" 
      ? "(a.metadata->>'viewCount')::int"
      : sortBy === "relevance"
      ? "(SELECT AVG((t.relevance_score)::numeric) FROM jsonb_to_recordset(a.extracted_tickers) AS t(relevance_score text))"
      : "a.created_at";

    const query = `
      SELECT 
        a.id as "_id",
        a.title,
        a.content,
        a.image_url as "imageUrl",
        a.created_at as "createdAt",
        a.extracted_tickers as "extractedTickers",
        a.metadata
      FROM articles a
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder === 1 ? "ASC" : "DESC"}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, skip);

    const result = await queryPostgres<SearchResult>(query, params);

    return NextResponse.json({
      results: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      filters,
      sortBy,
      sortOrder: sortOrder === 1 ? "asc" : "desc",
    });
  } catch (error) {
    console.error("Error searching articles:", error);
    return NextResponse.json(
      { error: "Failed to search articles" },
      { status: 500 }
    );
  }
}

// Made with Bob
