/**
 * Enhanced Ticker Matching System
 * Provides fuzzy matching, context-aware detection, and relevance scoring
 * for Indonesian stock tickers in news articles and content.
 */

import idxStocksData from "@/public/idx_stocks_with_sectors_20260501.json";

export interface StockMetadata {
  code: string;
  fullTicker: string; // e.g., "BBCA.JK"
  companyName: string;
  sector: string;
  aliases: string[];
  commonVariations: string[];
}

export interface TickerMatch {
  ticker: string;
  fullTicker: string;
  confidence: number; // 0-1
  matchType: "exact" | "alias" | "fuzzy" | "sector";
  position: number;
  context: string;
  companyName: string;
  sector: string;
}

export interface TickerRelevance {
  ticker: string;
  fullTicker: string;
  relevanceScore: number; // 0-100
  mentionCount: number;
  isPrimary: boolean; // main subject of article
  sentiment?: "positive" | "negative" | "neutral";
  sentimentScore?: number;
}

// Build enhanced ticker database from IDX stocks JSON
const TICKER_DATABASE = new Map<string, StockMetadata>();
const COMPANY_NAME_INDEX = new Map<string, string>(); // normalized name -> ticker
const SECTOR_INDEX = new Map<string, string[]>(); // sector -> tickers[]

// Common Indonesian company name patterns and abbreviations
const COMPANY_PATTERNS: Record<string, string[]> = {
  "Bank": ["BK", "BANK"],
  "Tbk": ["TBK", "PT"],
  "Indonesia": ["INDO", "INA"],
  "International": ["INTL", "INT"],
  "Industri": ["IND"],
  "Telekomunikasi": ["TELCO", "TELKOM"],
  "Astra": ["ASTRA"],
  "Semen": ["CEMENT"],
  "Tambang": ["MINING"],
};

// Initialize ticker database
function initializeTickerDatabase() {
  const stocks = idxStocksData.stocks as Array<{
    code: string;
    company_name: string;
    sector: string;
  }>;

  stocks.forEach((stock) => {
    const fullTicker = `${stock.code}.JK`;
    const aliases = generateAliases(stock.company_name, stock.code);
    const variations = generateCommonVariations(stock.company_name);

    const metadata: StockMetadata = {
      code: stock.code,
      fullTicker,
      companyName: stock.company_name,
      sector: stock.sector,
      aliases,
      commonVariations: variations,
    };

    TICKER_DATABASE.set(stock.code, metadata);
    
    // Index by normalized company name
    const normalized = normalizeText(stock.company_name);
    COMPANY_NAME_INDEX.set(normalized, stock.code);
    
    // Index by sector
    if (!SECTOR_INDEX.has(stock.sector)) {
      SECTOR_INDEX.set(stock.sector, []);
    }
    SECTOR_INDEX.get(stock.sector)!.push(stock.code);
  });
}

// Generate aliases from company name
function generateAliases(companyName: string, code: string): string[] {
  const aliases = new Set<string>([code]);
  
  // Add code with .JK suffix
  aliases.add(`${code}.JK`);
  
  // Extract acronym from company name
  const words = companyName
    .replace(/Tbk\.?/gi, "")
    .replace(/PT\.?/gi, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(dan|the|of|and)$/i.test(w));
  
  if (words.length >= 2) {
    const acronym = words.map((w) => w[0].toUpperCase()).join("");
    if (acronym.length >= 3 && acronym.length <= 5) {
      aliases.add(acronym);
    }
  }
  
  // Add common short forms
  const shortForm = companyName
    .replace(/\s+Tbk\.?/gi, "")
    .replace(/^PT\.?\s+/gi, "")
    .split(/\s+/)[0];
  
  if (shortForm.length >= 3) {
    aliases.add(shortForm.toUpperCase());
  }
  
  return Array.from(aliases);
}

// Generate common variations of company name
function generateCommonVariations(companyName: string): string[] {
  const variations = new Set<string>([companyName]);
  
  // Without Tbk
  variations.add(companyName.replace(/\s+Tbk\.?/gi, ""));
  
  // Without PT
  variations.add(companyName.replace(/^PT\.?\s+/gi, ""));
  
  // Without both
  variations.add(companyName.replace(/^PT\.?\s+/gi, "").replace(/\s+Tbk\.?/gi, ""));
  
  // Common abbreviations
  Object.entries(COMPANY_PATTERNS).forEach(([full, abbrevs]) => {
    abbrevs.forEach((abbrev) => {
      if (companyName.includes(full)) {
        variations.add(companyName.replace(full, abbrev));
      }
    });
  });
  
  return Array.from(variations);
}

// Normalize text for matching
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Calculate Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Check if context suggests this is a valid ticker mention
function isValidContext(text: string, position: number, matchLength: number): boolean {
  const before = text.slice(Math.max(0, position - 20), position).toLowerCase();
  const after = text.slice(position + matchLength, position + matchLength + 20).toLowerCase();
  const context = before + after;
  
  // Positive indicators
  const positivePatterns = [
    /saham/i, /emiten/i, /harga/i, /naik/i, /turun/i, /volume/i,
    /trading/i, /bursa/i, /idx/i, /bei/i, /rp\s*\d/i, /%/i,
    /kapitalisasi/i, /market cap/i, /dividen/i, /laba/i, /rugi/i,
  ];
  
  // Negative indicators (false positives)
  const negativePatterns = [
    /goto\s+(statement|function|label)/i,
    /\b(if|then|else|while|for)\b/i,
  ];
  
  const hasPositive = positivePatterns.some((p) => p.test(context));
  const hasNegative = negativePatterns.some((p) => p.test(context));
  
  return hasPositive || !hasNegative;
}

/**
 * Extract tickers from text with enhanced matching
 */
export function extractTickersEnhanced(text: string): TickerMatch[] {
  if (TICKER_DATABASE.size === 0) {
    initializeTickerDatabase();
  }
  
  const matches: TickerMatch[] = [];
  const seen = new Set<string>();
  const normalizedText = text.toLowerCase();
  
  // 1. Exact ticker code matches (e.g., "BBCA", "BBCA.JK")
  const tickerRegex = /\b([A-Z]{3,5})(?:\.JK)?\b/g;
  let match;
  
  while ((match = tickerRegex.exec(text)) !== null) {
    const code = match[1];
    const metadata = TICKER_DATABASE.get(code);
    
    if (metadata && !seen.has(code)) {
      const position = match.index;
      const context = text.slice(Math.max(0, position - 30), position + 30);
      
      if (isValidContext(text, position, match[0].length)) {
        seen.add(code);
        matches.push({
          ticker: code,
          fullTicker: metadata.fullTicker,
          confidence: 0.95,
          matchType: "exact",
          position,
          context,
          companyName: metadata.companyName,
          sector: metadata.sector,
        });
      }
    }
  }
  
  // 2. Company name matches (exact and fuzzy)
  TICKER_DATABASE.forEach((metadata, code) => {
    if (seen.has(code)) return;
    
    // Check exact company name variations
    for (const variation of metadata.commonVariations) {
      const normalized = normalizeText(variation);
      const index = normalizedText.indexOf(normalized);
      
      if (index !== -1) {
        const position = index;
        const context = text.slice(Math.max(0, position - 30), position + 30);
        
        seen.add(code);
        matches.push({
          ticker: code,
          fullTicker: metadata.fullTicker,
          confidence: 0.85,
          matchType: "alias",
          position,
          context,
          companyName: metadata.companyName,
          sector: metadata.sector,
        });
        return;
      }
    }
    
    // Fuzzy matching for partial names (min 10 chars)
    const mainName = normalizeText(
      metadata.companyName.replace(/^PT\.?\s+/gi, "").replace(/\s+Tbk\.?/gi, "")
    );
    
    if (mainName.length >= 10) {
      const words = mainName.split(/\s+/);
      const significantWords = words.filter((w) => w.length >= 4);
      
      for (const word of significantWords) {
        if (normalizedText.includes(word)) {
          const distance = levenshteinDistance(word, word);
          const similarity = 1 - distance / Math.max(word.length, word.length);
          
          if (similarity >= 0.8) {
            const position = normalizedText.indexOf(word);
            const context = text.slice(Math.max(0, position - 30), position + 30);
            
            seen.add(code);
            matches.push({
              ticker: code,
              fullTicker: metadata.fullTicker,
              confidence: similarity * 0.7,
              matchType: "fuzzy",
              position,
              context,
              companyName: metadata.companyName,
              sector: metadata.sector,
            });
            return;
          }
        }
      }
    }
  });
  
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Calculate relevance score for ticker in article
 */
export function calculateTickerRelevance(
  ticker: string,
  title: string,
  content: string,
  description?: string
): TickerRelevance {
  const fullText = `${title} ${description || ""} ${content}`;
  const matches = extractTickersEnhanced(fullText);
  const tickerMatches = matches.filter((m) => m.ticker === ticker);
  
  if (tickerMatches.length === 0) {
    return {
      ticker,
      fullTicker: `${ticker}.JK`,
      relevanceScore: 0,
      mentionCount: 0,
      isPrimary: false,
    };
  }
  
  let score = 0;
  const mentionCount = tickerMatches.length;
  
  // Title mentions are most important
  const titleMatches = extractTickersEnhanced(title).filter((m) => m.ticker === ticker);
  score += titleMatches.length * 40;
  
  // Description mentions
  if (description) {
    const descMatches = extractTickersEnhanced(description).filter((m) => m.ticker === ticker);
    score += descMatches.length * 20;
  }
  
  // Content mentions
  score += Math.min(mentionCount * 5, 30);
  
  // Confidence boost
  const avgConfidence = tickerMatches.reduce((sum, m) => sum + m.confidence, 0) / tickerMatches.length;
  score *= avgConfidence;
  
  // Position boost (earlier mentions are more relevant)
  const firstPosition = Math.min(...tickerMatches.map((m) => m.position));
  const positionBoost = 1 + (1 - firstPosition / fullText.length) * 0.2;
  score *= positionBoost;
  
  const isPrimary = titleMatches.length > 0 || score >= 50;
  
  return {
    ticker,
    fullTicker: `${ticker}.JK`,
    relevanceScore: Math.min(Math.round(score), 100),
    mentionCount,
    isPrimary,
  };
}

/**
 * Get all tickers from a sector
 */
export function getTickersBySector(sector: string): string[] {
  if (TICKER_DATABASE.size === 0) {
    initializeTickerDatabase();
  }
  return SECTOR_INDEX.get(sector) || [];
}

/**
 * Get ticker metadata
 */
export function getTickerMetadata(ticker: string): StockMetadata | null {
  if (TICKER_DATABASE.size === 0) {
    initializeTickerDatabase();
  }
  return TICKER_DATABASE.get(ticker) || null;
}

/**
 * Get all available sectors
 */
export function getAllSectors(): string[] {
  if (TICKER_DATABASE.size === 0) {
    initializeTickerDatabase();
  }
  return Array.from(SECTOR_INDEX.keys());
}

// Initialize on module load
initializeTickerDatabase();

// Made with Bob
