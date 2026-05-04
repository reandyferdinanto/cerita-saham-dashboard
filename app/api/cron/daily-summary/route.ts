import { NextRequest, NextResponse } from "next/server";
import { createArticleRecord } from "@/lib/data/articles";
import { createMarketArticleIllustration, MARKET_ILLUSTRATION_PRESETS } from "@/lib/articleIllustration";
import { getQuote } from "@/lib/yahooFinance";

type SummaryNewsItem = {
  title: string;
  desc: string;
  link?: string;
  pubDate?: string;
  source?: string;
  score?: number;
  impact?: "positive" | "negative" | "neutral";
  impactReason?: string;
};

type YahooQuote = NonNullable<Awaited<ReturnType<typeof getQuote>>>;

const MARKET_RELEVANCE_KEYWORDS = [
  "ihsg", "bursa", "saham", "emiten", "bei", "investor", "asing", "rupiah", "dolar", "wall street", "the fed",
  "suku bunga", "inflasi", "obligasi", "yield", "minyak", "emas", "komoditas", "batu bara", "cpo", "nikel",
  "dividen", "laba", "rugi", "right issue", "buyback", "ipo", "suspensi", "perang", "tarif",
];

const POSITIVE_NEWS_KEYWORDS = /menguat|naik|rebound|optimis|rekor|laba|beat|surplus|buyback|dividen|akumulasi|net buy|inflow|pemangkasan suku bunga|stimulus|damai/i;
const NEGATIVE_NEWS_KEYWORDS = /melemah|turun|tertekan|anjlok|koreksi|rugi|miss|defisit|net sell|outflow|kenaikan suku bunga|inflasi|perang|tarif|sanksi|gagal bayar/i;

function decodeText(value: string) {
  return value
    .replace(/<!\[CDATA\[|]]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getWibDateKey(date: Date) {
  return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function toWibDateLabel(date: Date) {
  const wibArr = getWibDateKey(date).split("-");
  return `${wibArr[2]}/${wibArr[1]}/${wibArr[0]}`;
}

function parseNewsDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function scoreNewsRelevance(item: SummaryNewsItem, todayKey: string) {
  const haystack = `${item.title} ${item.desc}`.toLowerCase();
  const keywordScore = MARKET_RELEVANCE_KEYWORDS.reduce((score, keyword) => score + (haystack.includes(keyword) ? 2 : 0), 0);
  const date = parseNewsDate(item.pubDate);
  const recencyScore = date && getWibDateKey(date) === todayKey ? 10 : date ? 2 : 0;
  const sourceScore = /ipot|detik|cnbc/i.test(item.source || "") ? 2 : 0;
  return keywordScore + recencyScore + sourceScore;
}

function classifyNewsImpact(item: SummaryNewsItem): Pick<SummaryNewsItem, "impact" | "impactReason"> {
  const haystack = `${item.title} ${item.desc}`;
  if (POSITIVE_NEWS_KEYWORDS.test(haystack) && !NEGATIVE_NEWS_KEYWORDS.test(haystack)) {
    return { impact: "positive", impactReason: "cenderung mendukung risk appetite" };
  }
  if (NEGATIVE_NEWS_KEYWORDS.test(haystack) && !POSITIVE_NEWS_KEYWORDS.test(haystack)) {
    return { impact: "negative", impactReason: "berpotensi menahan minat beli" };
  }
  return { impact: "neutral", impactReason: "lebih bersifat campuran atau perlu dikonfirmasi pasar" };
}

function dedupeNews(items: SummaryNewsItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = (item.link || item.title).toLowerCase();
    if (!item.title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickRelevantNews(items: SummaryNewsItem[], todayKey: string) {
  const enriched = dedupeNews(items).map((item) => {
    const impact = classifyNewsImpact(item);
    return { ...item, ...impact, score: scoreNewsRelevance(item, todayKey) };
  });

  const todayNews = enriched.filter((item) => {
    const date = parseNewsDate(item.pubDate);
    return date && getWibDateKey(date) === todayKey;
  });

  const pool = todayNews.length >= 3 ? todayNews : enriched;
  return pool
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5);
}

function buildDominantSentiment(news: SummaryNewsItem[]) {
  const positive = news.filter((item) => item.impact === "positive").length;
  const negative = news.filter((item) => item.impact === "negative").length;

  if (positive > negative) return "positif";
  if (negative > positive) return "defensif";
  return "campuran";
}

function buildIhsgImpactNarrative(args: { isUp: boolean; changePercent: number; news: SummaryNewsItem[] }) {
  const dominant = buildDominantSentiment(args.news);
  const direction = args.isUp ? "menguat" : "melemah";
  const magnitude = Math.abs(args.changePercent) >= 1 ? "besar" : Math.abs(args.changePercent) >= 0.4 ? "moderat" : "terbatas";

  if (args.news.length === 0) {
    return `Tanpa headline yang sangat dominan, IHSG ${direction} secara ${magnitude} lebih mencerminkan kombinasi teknikal penutupan, rotasi sektoral, dan arus transaksi harian.`;
  }

  if ((dominant === "positif" && args.isUp) || (dominant === "defensif" && !args.isUp)) {
    return `Arah IHSG yang ${direction} terlihat sejalan dengan sentimen berita yang cenderung ${dominant}. Dampaknya, pelaku pasar kemungkinan lebih fokus pada validasi lanjutan dari headline tersebut sebelum menambah posisi besar.`;
  }

  if (dominant === "campuran") {
    return `Walau headline hari ini cenderung campuran, IHSG tetap ${direction} secara ${magnitude}. Ini menandakan harga lebih banyak digerakkan oleh seleksi saham, bobot big cap, dan respon cepat investor terhadap katalis yang paling dekat.`;
  }

  return `Pergerakan IHSG yang ${direction} tidak sepenuhnya searah dengan sentimen berita yang cenderung ${dominant}. Kondisi seperti ini biasanya menunjukkan adanya faktor penyeimbang seperti aksi bargain hunting, profit taking, atau rotasi ke sektor tertentu.`;
}

// Simple RSS parser helper
function parseRSSNews(xml: string): SummaryNewsItem[] {
  const items: SummaryNewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    
    let titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i);
    if (!titleMatch) titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
    
    let descMatch = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i);
    if (!descMatch) descMatch = block.match(/<description>([\s\S]*?)<\/description>/i);
    const linkMatch = block.match(/<link>\s*([^<]+)\s*<\/link>/i);
    const dateMatch = block.match(/<pubDate>\s*([^<]+)\s*<\/pubDate>/i);

    if (titleMatch && descMatch) {
      const title = decodeText(titleMatch[1]);
      const descText = decodeText(descMatch[1]);

      items.push({
        title,
        desc: descText.substring(0, 180),
        link: linkMatch ? decodeText(linkMatch[1]) : undefined,
        pubDate: dateMatch ? decodeText(dateMatch[1]) : undefined,
        source: "CNBC Market",
      });
    }
  }
  return items;
}

async function fetchCombinedMarketNews(origin: string, todayKey: string) {
  const newsItems: SummaryNewsItem[] = [];

  try {
    const response = await fetch(`${origin}/api/news`, { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as Array<{
        title?: string;
        description?: string;
        link?: string;
        pubDate?: string;
        source?: string;
      }>;
      newsItems.push(
        ...data.map((item) => ({
          title: decodeText(item.title || ""),
          desc: decodeText(item.description || ""),
          link: item.link,
          pubDate: item.pubDate,
          source: item.source || "Market News",
        }))
      );
    }
  } catch (error) {
    console.error("Combined news fetch error:", error);
  }

  try {
    const cnbc = await fetch("https://www.cnbcindonesia.com/market/rss", {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (cnbc.ok) newsItems.push(...parseRSSNews(await cnbc.text()));
  } catch (error) {
    console.error("CNBC RSS fetch error:", error);
  }

  return pickRelevantNews(newsItems, todayKey);
}

export async function GET(req: NextRequest) {
  // Check authorization in Production
  // Vercel Cron sends Authorization: Bearer process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === "production" && req.nextUrl.hostname !== "localhost") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const today = new Date();
    // In Vercel, Cron UTC time is evaluated safely, but for the text output we want local WIB
    const todayKey = getWibDateKey(today);
    const dateStr = toWibDateLabel(today);

    // Array of top Indonesian caps for Gainers/Losers representation
    const idxStocks = [
      "BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "TLKM.JK", 
      "ASII.JK", "AMMN.JK", "BREN.JK", "BYAN.JK", "GOTO.JK", 
      "UNVR.JK", "ICBP.JK", "PGAS.JK", "BRPT.JK", "MEDC.JK", 
      "ADRO.JK", "PTBA.JK", "ITMG.JK", "UNTR.JK", "AKRA.JK"
    ];

    const [ihsg, ...quotes] = await Promise.all([
      getQuote("^JKSE").catch(() => null),
      ...idxStocks.map(t => getQuote(t).catch(() => null))
    ]);

    if (!ihsg) {
      return NextResponse.json({ error: "Gagal memuat IHSG" }, { status: 500 });
    }

    // Prepare Gainers and Losers
    const validStocks = quotes.filter((stock): stock is YahooQuote => Boolean(stock));
    validStocks.sort((a, b) => b.changePercent - a.changePercent);
    
    const topGainers = validStocks.slice(0, 3);
    const topLosers = validStocks.slice(-3).reverse();

    const isUp = ihsg.change >= 0;
    const newsList = await fetchCombinedMarketNews(req.nextUrl.origin, todayKey);
    const dominantSentiment = buildDominantSentiment(newsList);
    const ihsgImpact = buildIhsgImpactNarrative({ isUp, changePercent: ihsg.changePercent, news: newsList });
    const closingTone = isUp ? "ditutup menguat" : "ditutup melemah";
    const gainersText = topGainers.map((s) => `**${s.ticker.replace(".JK", "")}** +${s.changePercent.toFixed(2)}%`).join(", ");
    const losersText = topLosers.map((s) => `**${s.ticker.replace(".JK", "")}** ${s.changePercent.toFixed(2)}%`).join(", ");

    let content = `## Ringkasan Penutupan\n\n`;
    content += `IHSG pada ${dateStr} ${closingTone} di area ${Math.round(ihsg.price).toLocaleString("id-ID")} dengan perubahan ${isUp ? "+" : ""}${ihsg.change.toFixed(2)} poin atau ${isUp ? "+" : ""}${ihsg.changePercent.toFixed(2)}%. Pergerakan ini menunjukkan pasar berada dalam mode sentimen **${dominantSentiment}**, dengan perhatian investor tertuju pada kombinasi headline global, arus dana, dan rotasi saham berkapitalisasi besar.\n\n`;

    content += `## Sentimen Berita Hari Ini\n\n`;
    if (newsList.length > 0) {
      content += `Headline yang paling relevan hari ini:\n\n`;
      newsList.slice(0, 4).forEach((n) => {
        const source = n.source ? ` (${n.source})` : "";
        content += `- **${n.title}**${source}. Dampak: ${n.impactReason || "perlu dipantau"}.\n`;
      });
      content += `\n${ihsgImpact}\n\n`;
    } else {
      content += `Tidak ada headline harian yang cukup kuat dari feed utama. Fokus pasar lebih banyak bergeser ke pergerakan teknikal, bobot saham besar, dan aktivitas transaksi menjelang penutupan. ${ihsgImpact}\n\n`;
    }

    content += `## Penggerak Indeks\n\n`;
    content += `Dari sampel saham kapitalisasi besar yang dipantau sistem, penguatan relatif terlihat pada ${gainersText || "beberapa saham utama"}. Sementara itu, tekanan paling dalam datang dari ${losersText || "beberapa konstituen besar"}. Kombinasi dua sisi ini membantu membaca apakah gerak IHSG ditopang secara luas atau hanya oleh rotasi terbatas.\n\n`;

    content += `## Yang Perlu Dipantau Besok\n\n`;
    content += `- Konfirmasi apakah saham penggerak hari ini masih lanjut atau mulai terkena profit taking.\n`;
    content += `- Respons pasar terhadap headline global setelah sesi Wall Street berikutnya.\n`;
    content += `- Arus asing dan pergerakan rupiah, karena dua faktor ini sering memengaruhi risk appetite di saham big cap.\n\n`;

    content += `Catatan: Laporan harian ini dibuat otomatis oleh sistem AnomaliSaham pada sekitar jam 16:15 WIB. Data harga dapat mengikuti keterlambatan sumber pasar yang tersedia.`;

    const title = `Ringkasan Penutupan Pasar IHSG Hari Ini - ${dateStr}`;
    const illustrationVariant = Math.floor(Math.random() * MARKET_ILLUSTRATION_PRESETS.length);
    const imageUrl = createMarketArticleIllustration({
      title,
      dateLabel: `Tutup Bursa ${dateStr} | 16:15 WIB`,
      marketStatus: isUp ? "up" : "down",
      ihsgLevel: `IHSG ${Math.round(ihsg.price).toLocaleString("id-ID")}`,
      changePercent: `${isUp ? "+" : ""}${ihsg.changePercent.toFixed(2)}%`,
      gainers: topGainers.map((stock) => stock.ticker.replace(".JK", "")),
      losers: topLosers.map((stock) => stock.ticker.replace(".JK", "")),
      variant: illustrationVariant,
    });

    const article = await createArticleRecord({
      title,
      content: content.trim(),
      imageUrl,
      isPublic: true,
    });

    return NextResponse.json({ success: true, message: "Summary generated", articleId: article._id, illustrationVariant });

  } catch (error) {
    console.error("Cron Error", error);
    return NextResponse.json({ error: "Failed to generate daily summary" }, { status: 500 });
  }
}
