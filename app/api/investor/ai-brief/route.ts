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
            "Anda adalah analis saham untuk investor ritel Indonesia. Tulis ringkasan singkat, jelas, dan seimbang. Gunakan paragraf pendek dan bullet list bila perlu.",
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

function buildFallbackBrief(args: {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  technicalLabel: string;
  score: number;
  rsi: number | null;
  news: NewsItem[];
}) {
  const pos = args.news.filter((item) => item.sentiment === "positive").length;
  const neg = args.news.filter((item) => item.sentiment === "negative").length;
  const tone = pos > neg ? "sentimen cenderung positif" : neg > pos ? "sentimen cenderung negatif" : "sentimen cenderung berimbang";

  return [
    `${args.ticker.replace(".JK", "")} (${args.name}) diperdagangkan di sekitar Rp ${args.price.toLocaleString("id-ID")} dengan perubahan ${args.changePercent.toFixed(2)}% pada sesi terakhir.`,
    `Secara teknikal, sinyal utama saat ini adalah ${args.technicalLabel} dengan skor ${args.score}/100${args.rsi !== null ? ` dan RSI ${args.rsi.toFixed(1)}` : ""}.`,
    `Dari sisi berita, ${tone}. Investor ritel sebaiknya tetap mencocokkan momentum harga dengan risk management pribadi sebelum mengambil posisi.`,
    args.news.length > 0
      ? ["Poin penting terbaru:", ...args.news.slice(0, 3).map((item) => `- ${item.title}`)].join("\n")
      : "Belum ada berita spesifik yang cukup kuat untuk mengubah narasi utama saham ini.",
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
  const matched =
    searchResults.find((item) => item.symbol.replace(".JK", "").toLowerCase() === topic.toLowerCase()) || searchResults[0];

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

  const prompt = [
    `Buat stock brief untuk investor ritel Indonesia tentang ${matched.symbol.replace(".JK", "")} (${matched.name}).`,
    `Harga saat ini Rp ${quote.price.toLocaleString("id-ID")}, perubahan ${quote.changePercent.toFixed(2)}%.`,
    `Sinyal teknikal: ${technical.label}, skor ${technical.score}, RSI ${technical.rsi?.toFixed(1) || "-"}.`,
    news.length > 0
      ? `Ringkasan news:\n${news.map((item) => `- ${item.title} (${item.sentiment}; ${item.sentimentReason})`).join("\n")}`
      : "Belum ada news ticker spesifik yang kuat.",
    "Format output: paragraf pembuka singkat, lalu bullet untuk katalis positif, risiko, dan rencana pantau investor ritel.",
  ].join("\n\n");

  const aiBrief = await requestGroq(prompt);
  const fallbackBrief = buildFallbackBrief({
    ticker: matched.symbol,
    name: matched.name,
    price: quote.price,
    changePercent: quote.changePercent,
    technicalLabel: technical.label,
    score: technical.score,
    rsi: technical.rsi,
    news,
  });

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
