import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/userSession";
import { getHistory, getQuote, searchStocks } from "@/lib/yahooFinance";
import { calcTechnicalSignals } from "@/lib/technicalSignals";

type NewsItem = {
  title: string;
  sentiment: "positive" | "negative" | "neutral";
  sentimentReason: string;
  pubDate: string;
};

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
  news: NewsItem[];
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

function buildFallbackBrief(args: { context: AiContext; news: NewsItem[] }) {
  const pos = args.context.positiveNewsCount;
  const neg = args.context.negativeNewsCount;
  const tone = pos > neg ? "sentimen cenderung positif" : neg > pos ? "sentimen cenderung negatif" : "sentimen cenderung berimbang";
  const supportText = args.context.supportLevels.length > 0 ? args.context.supportLevels.map((level) => `Rp ${level.toLocaleString("id-ID")}`).join(", ") : "belum terbaca jelas";
  const resistanceText = args.context.resistanceLevels.length > 0 ? args.context.resistanceLevels.map((level) => `Rp ${level.toLocaleString("id-ID")}`).join(", ") : "belum terbaca jelas";

  return [
    `${args.context.ticker.replace(".JK", "")} (${args.context.name}) diperdagangkan di sekitar Rp ${args.context.price.toLocaleString("id-ID")} dengan perubahan ${args.context.changePercent.toFixed(2)}% pada sesi terakhir.`,
    `Kesimpulan teknikal saat ini: ${args.context.technicalConclusionTitle}. Skor teknikal berada di ${args.context.technicalScore}/100${args.context.rsi !== null ? ` dengan RSI ${args.context.rsi.toFixed(1)}` : ""}.`,
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

  const [quote, history, newsRes] = await Promise.all([
    getQuote(matched.symbol),
    getHistory(matched.symbol, new Date(Date.now() - 220 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], undefined, "1d"),
    fetch(`${req.nextUrl.origin}/api/news/stock/${encodeURIComponent(matched.symbol)}?name=${encodeURIComponent(matched.name)}`, { cache: "no-store" }),
  ]);

  if (!quote || history.length < 30) {
    return NextResponse.json({ error: "Data saham belum cukup untuk membuat brief" }, { status: 400 });
  }

  const technical = calcTechnicalSignals(history);
  const news = newsRes.ok ? (((await newsRes.json()) as NewsItem[]).slice(0, 5)) : [];
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
    `Harga saat ini Rp ${context.price.toLocaleString("id-ID")} dengan perubahan ${context.changePercent.toFixed(2)}%. Range hari terakhir sekitar ${context.dayRangePercent.toFixed(2)}%.`,
    `Posisi 90 hari: high Rp ${context.ninetyDayHigh.toLocaleString("id-ID")}, low Rp ${context.ninetyDayLow.toLocaleString("id-ID")}.`,
    `Sinyal teknikal inti: ${context.technicalLabel}, skor ${context.technicalScore}/100, action bias ${context.technicalAction}, kesimpulan ${context.technicalConclusionTitle}.`,
    `Penjelasan teknikal: ${context.technicalConclusionBody}`,
    `RSI: ${context.rsi?.toFixed(1) || "-"}. Support: ${context.supportLevels.length > 0 ? context.supportLevels.join(", ") : "tidak jelas"}. Resistance: ${context.resistanceLevels.length > 0 ? context.resistanceLevels.join(", ") : "tidak jelas"}.`,
    news.length > 0 ? `Ringkasan news:\n${news.map((item) => `- ${item.title} (${item.sentiment}; ${item.sentimentReason})`).join("\n")}` : "Belum ada news ticker spesifik yang kuat.",
    "Format output wajib:",
    "1. Ringkasan singkat 2-3 kalimat yang menjawab: menarik sekarang atau belum.",
    "2. Bullet 'Yang Menarik' maksimal 3 poin.",
    "3. Bullet 'Yang Perlu Diwaspadai' maksimal 3 poin.",
    "4. Bullet 'Rencana Eksekusi' yang spesifik dan realistis untuk investor ritel.",
    "Jika harga sudah terlalu tinggi, jangan beri kesan buy hanya karena momentum kuat. Sebutkan bahwa lebih sehat menunggu pullback/konsolidasi.",
  ].join("\n\n");

  const aiBrief = await requestGroq(prompt);
  const fallbackBrief = buildFallbackBrief({ context, news });

  return NextResponse.json({
    ticker: matched.symbol,
    name: matched.name,
    quote,
    technical,
    news,
    brief: aiBrief || fallbackBrief,
    usedAI: Boolean(aiBrief),
  });
}

