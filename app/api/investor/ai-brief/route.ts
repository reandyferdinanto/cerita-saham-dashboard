import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/userSession";
import { getHistory, getQuote, searchStocks } from "@/lib/yahooFinance";
import { calcTechnicalSignals } from "@/lib/technicalSignals";
import { getNewsWithCache, type CachedNewsItem } from "@/lib/data/newsCache";
import { getFundamentalSnapshot, formatMarketCap, formatPercent, formatRecommendation, type FundamentalSnapshot } from "@/lib/data/fundamentalSnapshot";
import { getAccumulationSnapshot, type AccumulationSnapshot } from "@/lib/data/accumulationSnapshot";
import { fetchSectorNews } from "@/lib/data/sectorNews";

type AiContext = {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  dayRangePercent: number;
  ninetyDayHigh: number;
  ninetyDayLow: number;
  technicalLabel: string;
  technicalScore: number;
  technicalAction: string;
  technicalConclusionTitle: string;
  technicalConclusionBody: string;
  rsi: number | null;
  supportLevels: number[];
  resistanceLevels: number[];
  positiveNewsCount: number;
  negativeNewsCount: number;
};

const GROQ_API_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_BRIEF_MODEL || process.env.GROQ_ARTICLE_MODEL || "llama-3.3-70b-versatile";

function getGroqKey() {
  return process.env.GROQ_API_KEY || "";
}

async function requestGroq(prompt: string) {
  if (!getGroqKey()) {
    return null;
  }

  const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getGroqKey()}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            "Anda adalah analis anomalisaham untuk investor ritel Indonesia. Filosofi Anda bukan mengejar saham blue-chip yang sudah terlalu jelas dilihat banyak orang, tetapi membaca apakah ada anomali gerak, akumulasi, support yang dijaga, ruang markup, atau justru harga sudah terlalu tinggi untuk dikejar. Tulis ringkasan singkat, jujur, mudah dicerna, dan fokus pada kualitas setup serta risk/reward entry. Jangan terdengar seperti promosi. Jika setup belum menarik, katakan dengan jelas.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq request failed: ${errorText}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}

function buildAiContext(args: {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  technical: ReturnType<typeof calcTechnicalSignals>;
  history: Awaited<ReturnType<typeof getHistory>>;
  news: CachedNewsItem[];
}): AiContext {
  const highs = args.history.slice(-90).map((item: { high: number }) => item.high);
  const lows = args.history.slice(-90).map((item: { low: number }) => item.low);
  const recentHigh = highs.length > 0 ? Math.max(...highs) : args.price;
  const recentLow = lows.length > 0 ? Math.min(...lows) : args.price;
  const lastBar = args.history[args.history.length - 1];
  const dayHigh = lastBar?.high ?? args.price;
  const dayLow = lastBar?.low ?? args.price;
  const positiveNewsCount = args.news.filter((item) => item.sentiment === "positive").length;
  const negativeNewsCount = args.news.filter((item) => item.sentiment === "negative").length;

  return {
    ticker: args.ticker,
    name: args.name,
    price: args.price,
    changePercent: args.changePercent,
    dayRangePercent: dayLow > 0 ? ((dayHigh - dayLow) / dayLow) * 100 : 0,
    ninetyDayHigh: recentHigh,
    ninetyDayLow: recentLow,
    technicalLabel: args.technical.label,
    technicalScore: args.technical.score,
    technicalAction: args.technical.actionBias,
    technicalConclusionTitle: args.technical.conclusionTitle,
    technicalConclusionBody: args.technical.conclusionBody,
    rsi: args.technical.rsi,
    supportLevels: args.technical.srLevels.filter((level) => level.type === "S").map((level) => level.price).sort((a, b) => b - a).slice(0, 3),
    resistanceLevels: args.technical.srLevels.filter((level) => level.type === "R").map((level) => level.price).sort((a, b) => a - b).slice(0, 3),
    positiveNewsCount,
    negativeNewsCount,
  };
}

function formatFundamentalForPrompt(fund: FundamentalSnapshot | null): string {
  if (!fund) return "Data fundamental belum tersedia.";
  const lines: string[] = [];
  if (fund.sector || fund.industry) lines.push(`Sektor/industri: ${fund.sector || "-"} / ${fund.industry || "-"}`);
  if (fund.marketCap != null) lines.push(`Market cap: ${formatMarketCap(fund.marketCap)}`);
  if (fund.trailingPE != null) lines.push(`PE (trailing): ${fund.trailingPE.toFixed(2)}x`);
  if (fund.priceToBook != null) lines.push(`PBV: ${fund.priceToBook.toFixed(2)}x`);
  if (fund.beta != null) lines.push(`Beta: ${fund.beta.toFixed(2)}`);
  if (fund.dividendYield != null) lines.push(`Dividend yield: ${formatPercent(fund.dividendYield)}`);
  if (fund.revenueGrowth != null) lines.push(`Revenue growth YoY: ${formatPercent(fund.revenueGrowth)}`);
  if (fund.earningsGrowth != null) lines.push(`Earnings growth YoY: ${formatPercent(fund.earningsGrowth)}`);
  if (fund.profitMargin != null) lines.push(`Profit margin: ${formatPercent(fund.profitMargin)}`);
  if (fund.roe != null) lines.push(`ROE: ${formatPercent(fund.roe)}`);
  if (fund.debtToEquity != null) lines.push(`D/E ratio: ${fund.debtToEquity.toFixed(2)}`);
  if (fund.recommendationMean != null) lines.push(`Rekomendasi analis: ${formatRecommendation(fund.recommendationMean)} (n=${fund.numberOfAnalysts || "?"})`);
  if (fund.insidersPercentHeld != null) lines.push(`Insider ownership: ${formatPercent(fund.insidersPercentHeld)}`);
  if (fund.institutionsPercentHeld != null) lines.push(`Institutional ownership: ${formatPercent(fund.institutionsPercentHeld)}`);
  if (lines.length === 0) return "Data fundamental belum tersedia.";
  return lines.join("\n");
}

function formatNewsForPrompt(news: CachedNewsItem[]): string {
  if (news.length === 0) return "Belum ada berita ticker spesifik dalam 30 hari terakhir.";
  const counts = {
    pos: news.filter((n) => n.sentiment === "positive").length,
    neg: news.filter((n) => n.sentiment === "negative").length,
    neu: news.filter((n) => n.sentiment === "neutral").length,
  };
  const lines = [`Ringkasan sentimen 30 hari: ${counts.pos} positif, ${counts.neg} negatif, ${counts.neu} netral.`];
  // Sort by recency, take top 8 highlights
  const sorted = [...news].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()).slice(0, 8);
  for (const item of sorted) {
    const datePart = new Date(item.pubDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
    lines.push(`- [${datePart}] ${item.title} (${item.sentiment}; ${item.sentimentReason || "-"})`);
  }
  return lines.join("\n");
}

function buildFallbackBrief(args: {
  context: AiContext;
  news: CachedNewsItem[];
  fundamental: FundamentalSnapshot | null;
  accumulation: AccumulationSnapshot;
}) {
  const pos = args.context.positiveNewsCount;
  const neg = args.context.negativeNewsCount;
  const tone = pos > neg ? "sentimen cenderung positif" : neg > pos ? "sentimen cenderung negatif" : "sentimen cenderung berimbang";
  const supportText = args.context.supportLevels.length > 0 ? args.context.supportLevels.map((level) => `Rp ${level.toLocaleString("id-ID")}`).join(", ") : "belum terbaca jelas";
  const resistanceText = args.context.resistanceLevels.length > 0 ? args.context.resistanceLevels.map((level) => `Rp ${level.toLocaleString("id-ID")}`).join(", ") : "belum terbaca jelas";

  const fundLine = args.fundamental?.trailingPE != null
    ? `Valuasi: PE ${args.fundamental.trailingPE.toFixed(2)}x, PBV ${args.fundamental.priceToBook?.toFixed(2) ?? "-"}, market cap ${formatMarketCap(args.fundamental.marketCap)}.`
    : "Data fundamental belum tersedia secara lengkap.";

  return [
    `${args.context.ticker.replace(".JK", "")} (${args.context.name}) diperdagangkan di sekitar Rp ${args.context.price.toLocaleString("id-ID")} dengan perubahan ${args.context.changePercent.toFixed(2)}% pada sesi terakhir.`,
    `Kesimpulan teknikal saat ini: ${args.context.technicalConclusionTitle}. Skor teknikal berada di ${args.context.technicalScore}/100${args.context.rsi !== null ? ` dengan RSI ${args.context.rsi.toFixed(1)}` : ""}.`,
    fundLine,
    args.accumulation.available ? `Akumulasi (${args.accumulation.daysAnalyzed} hari): ${args.accumulation.summary}` : "Data akumulasi IDX belum tersedia.",
    `Dalam kacamata anomalisaham, fokusnya bukan sekadar apakah tren sedang hijau, tetapi apakah entry masih enak. Support terdekat: ${supportText}. Resistance terdekat: ${resistanceText}.`,
    `Dari sisi berita, ${tone}. ${args.context.technicalConclusionBody}`,
    args.news.length > 0 ? ["Poin yang layak dipantau:", ...args.news.slice(0, 3).map((item) => `- ${item.title}`)].join("\n") : "Belum ada berita spesifik yang cukup kuat untuk mengubah narasi utama saham ini.",
  ].join("\n\n");
}

export async function POST(req: NextRequest) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { ticker?: string; topic?: string };
  const topic = (body.ticker || body.topic || "").trim();

  if (!topic) {
    return NextResponse.json({ error: "Ticker atau topik wajib diisi" }, { status: 400 });
  }

  const searchResults = await searchStocks(topic);
  const matched = searchResults.find((item) => item.symbol.replace(".JK", "").toLowerCase() === topic.toLowerCase()) || searchResults[0];

  if (!matched) {
    return NextResponse.json({ error: "Ticker tidak ditemukan" }, { status: 404 });
  }

  // News fetcher delegates to existing /api/news/stock route
  const newsFetcher = async (): Promise<CachedNewsItem[]> => {
    try {
      const res = await fetch(
        `${req.nextUrl.origin}/api/news/stock/${encodeURIComponent(matched.symbol)}?name=${encodeURIComponent(matched.name)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return [];
      const items = (await res.json()) as Array<{
        title: string;
        link: string;
        pubDate: string;
        description?: string;
        source?: string;
        sentiment: "positive" | "negative" | "neutral";
        sentimentScore: number;
        sentimentReason: string;
      }>;
      return items.map((item) => ({
        title: item.title,
        link: item.link,
        source: item.source || "",
        pubDate: item.pubDate,
        description: item.description || "",
        sentiment: item.sentiment,
        sentimentScore: item.sentimentScore,
        sentimentReason: item.sentimentReason,
      }));
    } catch {
      return [];
    }
  };

  // Fetch all enhancements in parallel
  const [quote, history, newsResult, fundamental, accumulation] = await Promise.all([
    getQuote(matched.symbol),
    getHistory(matched.symbol, new Date(Date.now() - 220 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], undefined, "1d"),
    getNewsWithCache(matched.symbol, newsFetcher, { limit: 25 }),
    getFundamentalSnapshot(matched.symbol).catch(() => null),
    getAccumulationSnapshot(matched.symbol, 10).catch(() => ({
      available: false,
      ticker: matched.symbol,
      daysAnalyzed: 0,
      latestTradeDate: null,
      totalNetForeign: 0,
      positiveForeignDays: 0,
      negativeForeignDays: 0,
      largestForeignBuyDay: null,
      largestForeignSellDay: null,
      averageDailyValue: 0,
      averageDailyVolume: 0,
      averageBidOfferRatio: null,
      closeNearHighDays: 0,
      foreignAccumulationLabel: "Netral" as const,
      domesticPressureLabel: "Netral" as const,
      summary: "Data akumulasi tidak tersedia.",
    })),
  ]);

  if (!quote || history.length < 30) {
    return NextResponse.json({ error: "Data saham belum cukup untuk membuat brief" }, { status: 400 });
  }

  // Step 2: If ticker-specific news is sparse (< 3 items), fetch sector-relevant news
  // using fundamental.sector and fundamental.industry as keyword source.
  let sectorNews: CachedNewsItem[] = [];
  if (newsResult.items.length < 3 && fundamental && (fundamental.sector || fundamental.industry)) {
    sectorNews = await fetchSectorNews(req.nextUrl.origin, fundamental.sector, fundamental.industry, 8).catch(() => []);
  }

  const technical = calcTechnicalSignals(history);
  const news = newsResult.items;
  const context = buildAiContext({
    ticker: matched.symbol,
    name: matched.name,
    price: quote.price,
    changePercent: quote.changePercent,
    technical,
    history,
    news,
  });

  const prompt = [
    `Buat stock brief untuk investor ritel Indonesia tentang ${context.ticker.replace(".JK", "")} (${context.name}).`,
    "Pakai filosofi anomalisaham: utamakan pembacaan kualitas setup, posisi harga, area entry, support yang dijaga, ruang ke resistance, potensi markup, atau tanda bahwa harga sudah terlalu panas untuk dikejar.",
    "",
    "=== HARGA & TEKNIKAL ===",
    `Harga saat ini Rp ${context.price.toLocaleString("id-ID")} dengan perubahan ${context.changePercent.toFixed(2)}%. Range hari terakhir sekitar ${context.dayRangePercent.toFixed(2)}%.`,
    `Posisi 90 hari: high Rp ${context.ninetyDayHigh.toLocaleString("id-ID")}, low Rp ${context.ninetyDayLow.toLocaleString("id-ID")}.`,
    `Sinyal teknikal: ${context.technicalLabel}, skor ${context.technicalScore}/100, action bias ${context.technicalAction}, kesimpulan ${context.technicalConclusionTitle}.`,
    `Penjelasan teknikal: ${context.technicalConclusionBody}`,
    `RSI: ${context.rsi?.toFixed(1) || "-"}. Support: ${context.supportLevels.length > 0 ? context.supportLevels.join(", ") : "tidak jelas"}. Resistance: ${context.resistanceLevels.length > 0 ? context.resistanceLevels.join(", ") : "tidak jelas"}.`,
    "",
    "=== FUNDAMENTAL ===",
    formatFundamentalForPrompt(fundamental),
    "",
    "=== AKUMULASI / FOREIGN-DOMESTIC FLOW (DARI STOCK SUMMARY IDX) ===",
    accumulation.available
      ? `${accumulation.summary}\nLabel foreign: ${accumulation.foreignAccumulationLabel}. Label domestic: ${accumulation.domesticPressureLabel}.`
      : "Data akumulasi belum tersedia di stock summary IDX untuk saham ini.",
    "",
    `=== BERITA TICKER 30 HARI TERAKHIR (${news.length} item) ===`,
    formatNewsForPrompt(news),
    "",
    sectorNews.length > 0
      ? `=== BERITA SEKTOR ${(fundamental?.sector || fundamental?.industry || "TERKAIT").toUpperCase()} (${sectorNews.length} item, sebagai konteks tambahan kalau berita ticker minim) ===\n${sectorNews
          .slice(0, 5)
          .map((n) => `- [${new Date(n.pubDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}] ${n.title}`)
          .join("\n")}`
      : "",
    "",
    "=== FORMAT OUTPUT WAJIB (MARKDOWN, IKUTI PERSIS) ===",
    "Gunakan markdown plain dengan baris kosong antar section. JANGAN gabungkan section dalam satu paragraf.",
    "Setiap bullet WAJIB di baris baru, diawali '* ' (bintang spasi).",
    "Struktur output:",
    "",
    "1. Ringkasan singkat: <2-3 kalimat satu paragraf yang menjawab menarik sekarang atau belum, sebut faktor paling dominan (teknikal/fundamental/akumulasi/sentimen).>",
    "",
    "2. Yang Menarik:",
    "* <poin 1 — gabungkan insight dari teknikal, fundamental, atau akumulasi>",
    "* <poin 2>",
    "* <poin 3, maksimal 3 poin>",
    "",
    "3. Yang Perlu Diwaspadai:",
    "* <poin 1 — risiko valuasi, distribusi, RSI overbought, atau berita negatif>",
    "* <poin 2>",
    "* <poin 3, maksimal 3 poin>",
    "",
    "4. Rencana Eksekusi: <1 paragraf yang spesifik dan realistis: area entry, SL, TP1, TP2 dengan angka konkret berdasarkan support/resistance.>",
    "",
    "Catatan untuk konten:",
    "- Gunakan data fundamental untuk menilai kualitas perusahaan (PE, PBV, growth, ROE).",
    "- Gunakan data akumulasi untuk menilai apakah ada smart money sedang serap (foreign + domestic) atau sedang distribusi.",
    "- Berita ticker (kalau ada) jadi katalis utama. Berita sektor hanya konteks ringan, jangan jadikan dasar utama keputusan.",
    "- Kalau berita ticker minim, jangan paksa narasi dari berita sektor — cukup sebutkan kondisi sektor secara umum.",
    "- Jika harga sudah terlalu tinggi, jangan beri kesan buy hanya karena momentum kuat. Sebutkan bahwa lebih sehat menunggu pullback/konsolidasi.",
    "- Kalau data tidak lengkap, akui dan beri saran berbasis data yang ada.",
    "- JANGAN pakai markdown bold (** **). Tulis biasa saja.",
    "- WAJIB ada baris kosong antar section 1, 2, 3, 4.",
  ].filter(Boolean).join("\n");

  const aiBrief = await requestGroq(prompt);
  const fallbackBrief = buildFallbackBrief({ context, news, fundamental, accumulation });

  return NextResponse.json({
    ticker: matched.symbol,
    name: matched.name,
    quote,
    technical,
    news,
    sectorNews,
    fundamental,
    accumulation,
    newsFromCache: newsResult.fromCache,
    brief: aiBrief || fallbackBrief,
    usedAI: Boolean(aiBrief),
  });
}
