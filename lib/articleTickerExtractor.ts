/**
 * Article Ticker Extractor
 * Automatically extracts tickers from article content and populates metadata
 */

import {
  extractTickersEnhanced,
  calculateTickerRelevance,
  getTickerMetadata,
  type TickerMatch,
  type TickerRelevance,
} from "@/lib/tickerMatcher";

export interface ExtractedTickerData {
  ticker: string;
  fullTicker: string;
  relevanceScore: number;
  mentionCount: number;
  isPrimary: boolean;
  confidence: number;
}

export interface ArticleMetadata {
  viewCount: number;
  bookmarkCount: number;
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number;
  impactLevel: "high" | "medium" | "low";
  articleType: "earnings" | "ma" | "regulatory" | "market_analysis" | "general";
  sectors: string[];
  processedAt: string;
  tickerExtractionVersion: string;
}

const POSITIVE_KEYWORDS = /naik|menguat|rebound|optimis|laba|beat|surplus|buyback|dividen|akumulasi|net buy|inflow|bullish|rally|breakout/i;
const NEGATIVE_KEYWORDS = /turun|melemah|tertekan|anjlok|koreksi|rugi|miss|defisit|net sell|outflow|bearish|crash|breakdown/i;

/**
 * Analyze sentiment from article content
 */
function analyzeSentiment(title: string, content: string): {
  sentiment: "positive" | "negative" | "neutral";
  score: number;
} {
  const text = `${title} ${content}`;
  const positiveMatches = (text.match(POSITIVE_KEYWORDS) || []).length;
  const negativeMatches = (text.match(NEGATIVE_KEYWORDS) || []).length;

  if (positiveMatches > negativeMatches) {
    const score = Math.min(positiveMatches / (positiveMatches + negativeMatches), 1);
    return { sentiment: "positive", score: Math.round(score * 100) / 100 };
  }

  if (negativeMatches > positiveMatches) {
    const score = -Math.min(negativeMatches / (positiveMatches + negativeMatches), 1);
    return { sentiment: "negative", score: Math.round(score * 100) / 100 };
  }

  return { sentiment: "neutral", score: 0 };
}

/**
 * Determine article type from content
 */
function determineArticleType(title: string, content: string): ArticleMetadata["articleType"] {
  const text = `${title} ${content}`.toLowerCase();

  if (/\b(laba|rugi|earnings|quarterly|q[1-4]|revenue|profit)\b/i.test(text)) {
    return "earnings";
  }

  if (/\b(akuisisi|merger|acquisition|buyout|takeover|divestasi)\b/i.test(text)) {
    return "ma";
  }

  if (/\b(ojk|bei|regulasi|regulation|suspensi|sanksi|compliance)\b/i.test(text)) {
    return "regulatory";
  }

  if (/\b(analisis|outlook|forecast|prediksi|proyeksi|target price)\b/i.test(text)) {
    return "market_analysis";
  }

  return "general";
}

/**
 * Calculate impact level based on ticker relevance and sentiment
 */
function calculateImpactLevel(
  tickers: ExtractedTickerData[],
  sentiment: "positive" | "negative" | "neutral"
): "high" | "medium" | "low" {
  if (tickers.length === 0) return "low";

  const maxRelevance = Math.max(...tickers.map((t) => t.relevanceScore));
  const primaryCount = tickers.filter((t) => t.isPrimary).length;

  // High impact: high relevance + primary mentions + strong sentiment
  if (maxRelevance >= 70 && primaryCount >= 1 && sentiment !== "neutral") {
    return "high";
  }

  // Medium impact: moderate relevance or multiple tickers
  if (maxRelevance >= 40 || tickers.length >= 3) {
    return "medium";
  }

  return "low";
}

/**
 * Extract tickers and generate metadata from article
 */
export function extractArticleData(
  title: string,
  content: string,
  description?: string
): {
  extractedTickers: ExtractedTickerData[];
  metadata: ArticleMetadata;
} {
  const fullText = `${title} ${description || ""} ${content}`;

  // Extract all ticker matches
  const matches = extractTickersEnhanced(fullText);

  // Calculate relevance for each unique ticker
  const tickerMap = new Map<string, TickerRelevance>();
  matches.forEach((match) => {
    if (!tickerMap.has(match.ticker)) {
      const relevance = calculateTickerRelevance(match.ticker, title, content, description);
      tickerMap.set(match.ticker, relevance);
    }
  });

  // Build extracted tickers array with metadata
  const extractedTickers: ExtractedTickerData[] = Array.from(tickerMap.values())
    .map((relevance) => {
      const tickerMatches = matches.filter((m) => m.ticker === relevance.ticker);
      const avgConfidence =
        tickerMatches.reduce((sum, m) => sum + m.confidence, 0) / tickerMatches.length;

      return {
        ticker: relevance.ticker,
        fullTicker: relevance.fullTicker,
        relevanceScore: relevance.relevanceScore,
        mentionCount: relevance.mentionCount,
        isPrimary: relevance.isPrimary,
        confidence: Math.round(avgConfidence * 100) / 100,
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Collect unique sectors from tickers
  const sectors = new Set<string>();
  extractedTickers.forEach((ticker) => {
    const metadata = getTickerMetadata(ticker.ticker);
    if (metadata?.sector) {
      sectors.add(metadata.sector);
    }
  });

  // Analyze sentiment
  const sentimentAnalysis = analyzeSentiment(title, content);

  // Determine article type
  const articleType = determineArticleType(title, content);

  // Calculate impact level
  const impactLevel = calculateImpactLevel(extractedTickers, sentimentAnalysis.sentiment);

  // Build metadata
  const metadata: ArticleMetadata = {
    viewCount: 0,
    bookmarkCount: 0,
    sentiment: sentimentAnalysis.sentiment,
    sentimentScore: sentimentAnalysis.score,
    impactLevel,
    articleType,
    sectors: Array.from(sectors),
    processedAt: new Date().toISOString(),
    tickerExtractionVersion: "2.0",
  };

  return {
    extractedTickers,
    metadata,
  };
}

/**
 * Format extracted data for PostgreSQL JSONB storage
 */
export function formatForPostgres(data: {
  extractedTickers: ExtractedTickerData[];
  metadata: ArticleMetadata;
}): {
  extracted_tickers: string;
  metadata: string;
} {
  return {
    extracted_tickers: JSON.stringify(data.extractedTickers),
    metadata: JSON.stringify(data.metadata),
  };
}

/**
 * Parse PostgreSQL JSONB data back to typed objects
 */
export function parseFromPostgres(row: {
  extracted_tickers?: string | object;
  metadata?: string | object;
}): {
  extractedTickers: ExtractedTickerData[];
  metadata: Partial<ArticleMetadata>;
} {
  let extractedTickers: ExtractedTickerData[] = [];
  let metadata: Partial<ArticleMetadata> = {};

  if (row.extracted_tickers) {
    if (typeof row.extracted_tickers === "string") {
      extractedTickers = JSON.parse(row.extracted_tickers);
    } else {
      extractedTickers = row.extracted_tickers as ExtractedTickerData[];
    }
  }

  if (row.metadata) {
    if (typeof row.metadata === "string") {
      metadata = JSON.parse(row.metadata);
    } else {
      metadata = row.metadata as Partial<ArticleMetadata>;
    }
  }

  return { extractedTickers, metadata };
}

// Made with Bob
