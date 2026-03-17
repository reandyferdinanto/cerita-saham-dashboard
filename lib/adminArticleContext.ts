import { getHistory, getQuote, searchStocks } from "@/lib/yahooFinance";
import { calcTechnicalSignals } from "@/lib/technicalSignals";

export type TopicNewsItem = {
  title: string;
  link?: string;
  pubDate?: string;
  description?: string;
  source?: string;
  sentiment?: "positive" | "negative" | "neutral";
  sentimentScore?: number;
  sentimentReason?: string;
};

export type ArticleExternalContext = {
  topic: string;
  stockSymbol?: string;
  stockName?: string;
  quoteSummary?: string;
  technicalSummary?: string;
  newsSummary?: string;
  relevantNews: TopicNewsItem[];
};

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function extractTopicKeywords(topic: string) {
  return normalizeText(topic)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 4)
    .slice(0, 6);
}

function scoreNewsRelevance(topic: string, news: TopicNewsItem) {
  const haystack = `${news.title || ""} ${news.description || ""}`.toLowerCase();
  const keywords = extractTopicKeywords(topic);

  return keywords.reduce((score, keyword) => {
    return haystack.includes(keyword) ? score + 1 : score;
  }, 0);
}

export async function fetchTopicNews(origin: string, topic: string) {
  const response = await fetch(`${origin}/api/news`, { cache: "no-store" });

  if (!response.ok) {
    return [];
  }

  const items = (await response.json()) as TopicNewsItem[];

  return items
    .map((item) => ({ item, score: scoreNewsRelevance(topic, item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((entry) => entry.item);
}

export async function fetchStockNews(origin: string, symbol: string, name?: string) {
  const qs = name ? `?name=${encodeURIComponent(name)}` : "";
  const response = await fetch(`${origin}/api/news/stock/${encodeURIComponent(symbol)}${qs}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const items = (await response.json()) as TopicNewsItem[];
  return Array.isArray(items) ? items.slice(0, 5) : [];
}

function extractLikelyTicker(query: string) {
  const tickerMatch = query.match(/\b([A-Z]{4,6})(?:\.JK)?\b/);
  return tickerMatch?.[1] || "";
}

export async function buildArticleExternalContext(origin: string, topic: string): Promise<ArticleExternalContext> {
  const normalizedTopic = normalizeText(topic);
  const likelyTicker = extractLikelyTicker(normalizedTopic.toUpperCase());

  const searchQuery = likelyTicker || normalizedTopic;
  const searchResults = searchQuery ? await searchStocks(searchQuery) : [];
  const matchedStock =
    searchResults.find((item) => item.symbol.replace(".JK", "").toUpperCase() === likelyTicker) ||
    searchResults.find((item) => normalizedTopic.toLowerCase().includes(item.symbol.replace(".JK", "").toLowerCase())) ||
    searchResults.find((item) => item.name.toLowerCase().includes(normalizedTopic.toLowerCase())) ||
    searchResults[0];

  const stockSymbol = matchedStock?.symbol;
  const stockName = matchedStock?.name;

  let quoteSummary = "";
  let technicalSummary = "";
  let relevantNews: TopicNewsItem[] = [];

  if (stockSymbol) {
    const quote = await getQuote(stockSymbol);
    const history = await getHistory(
      stockSymbol,
      new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split("T")[0],
      new Date().toISOString().split("T")[0],
      "1d"
    );
    const stockNews = await fetchStockNews(origin, stockSymbol, stockName);
    relevantNews = stockNews;

    if (quote) {
      const changeSign = quote.change >= 0 ? "+" : "";
      quoteSummary = `Harga saat ini ${stockSymbol.replace(".JK", "")} berada di Rp ${quote.price.toLocaleString(
        "id-ID"
      )}, perubahan ${changeSign}${quote.change.toFixed(0)} (${changeSign}${quote.changePercent.toFixed(2)}%).`;
    }

    if (history.length >= 20) {
      const technical = calcTechnicalSignals(history);
      const srPreview = technical.srLevels
        .slice(0, 3)
        .map((level) => `${level.type}${level.price}`)
        .join(", ");

      technicalSummary = [
        `Analisa teknikal mendukung dengan sinyal ${technical.label} (score ${technical.score}).`,
        technical.rsi !== null ? `RSI ${technical.rsi.toFixed(1)}.` : "",
        technical.ma20 !== null && technical.ma50 !== null
          ? `MA20 ${technical.ma20.toFixed(0)} vs MA50 ${technical.ma50.toFixed(0)}.`
          : "",
        srPreview ? `Level support/resistance terdekat: ${srPreview}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
  } else {
    relevantNews = await fetchTopicNews(origin, normalizedTopic);
  }

  const newsSummary =
    relevantNews.length > 0
      ? relevantNews
          .slice(0, 4)
          .map((item) => {
            const sentimentPart =
              item.sentiment && item.sentimentReason
                ? ` [${item.sentiment}; ${item.sentimentReason}]`
                : "";
            return `- ${item.title}${sentimentPart}`;
          })
          .join("\n")
      : "";

  return {
    topic: normalizedTopic,
    stockSymbol,
    stockName,
    quoteSummary,
    technicalSummary,
    newsSummary,
    relevantNews,
  };
}
