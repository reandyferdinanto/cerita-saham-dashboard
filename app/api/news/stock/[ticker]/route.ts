import { NextRequest, NextResponse } from "next/server";

export interface NewsItemWithSentiment {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  image?: string;
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number; // -1.0 to 1.0
  sentimentReason: string;
  mentionedTicker: string;
}

// ── RSS helpers (duplicated from parent route to keep this route self-contained) ──

function parseRSS(xml: string, source: string) {
  const items: {
    title: string; link: string; pubDate: string;
    description: string; source: string; image?: string;
  }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const getTag = (tag: string): string => {
      const re = new RegExp(
        `<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:]]>)?\\s*<\\/${tag}>`, "i"
      );
      const m = block.match(re);
      return m ? m[1].trim() : "";
    };
    const linkMatch = block.match(/<link>\s*(https?:\/\/[^\s<]+)\s*<\/link>/i);
    const guidMatch = block.match(/<guid[^>]*>\s*(https?:\/\/[^\s<]+)\s*<\/guid>/i);
    const enclosureMatch = block.match(/<enclosure[^>]+url="([^"]+)"/i);
    const descRaw = getTag("description");
    const imgInDesc = descRaw.match(/<img[^>]+src="([^"]+)"/i);
    const image = enclosureMatch?.[1] || imgInDesc?.[1] || undefined;
    const description = descRaw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().substring(0, 220);
    const title = getTag("title");
    const link = linkMatch?.[1] || guidMatch?.[1] || "";
    const pubDate = getTag("pubDate");
    if (title && link) items.push({ title, link, pubDate, description, source, image });
  }
  return items;
}

// ── Sentiment engine (regex word-boundary, negation-aware) ───────────────────

/**
 * Each rule: { pattern, weight, label }
 * weight: +2 strong positive, +1 positive, -1 negative, -2 strong negative
 *
 * All patterns use \b or explicit non-word anchors so substring false-matches
 * like "isu" inside "issue", "gain" inside "again", "rise" inside "enterprise"
 * are impossible.
 */
const SENTIMENT_RULES: { pattern: RegExp; weight: number; label: string }[] = [
  // ── Strong Positive (+2) ────────────────────────────────────────────────────
  { pattern: /\b(melesat|melejit|melonjak\s+tajam|terbang|meroket)\b/i,            weight: +2, label: "melesat/melonjak tajam" },
  { pattern: /\ball[\s-]time[\s-]high\b|\bATH\b|\brekor\s+tertinggi\b/i,           weight: +2, label: "all time high / ATH" },
  { pattern: /\bbreakout\b/i,                                                        weight: +2, label: "breakout" },
  { pattern: /\b(laba\s+(bersih\s+)?(melonjak|melesat|naik\s+signifikan))\b/i,     weight: +2, label: "laba melonjak" },
  { pattern: /\b(dividen\s+(besar|tinggi|rekor|spesial))\b/i,                       weight: +2, label: "dividen besar/rekor" },
  { pattern: /\bsurge[sd]?\b/i,                                                     weight: +2, label: "surge" },
  { pattern: /\bsoar(ed|ing)?\b/i,                                                  weight: +2, label: "soar" },
  { pattern: /\b(rally\s+kuat|strong\s+rally)\b/i,                                  weight: +2, label: "strong rally" },
  { pattern: /\brekor\s+(laba|pendapatan|penjualan)\b/i,                            weight: +2, label: "rekor laba/pendapatan" },

  // ── Positive (+1) ───────────────────────────────────────────────────────────
  { pattern: /\b(naik|kenaikan|menguat|penguatan)\b/i,                              weight: +1, label: "naik/menguat" },
  { pattern: /\b(tumbuh|pertumbuhan)\b/i,                                           weight: +1, label: "tumbuh" },
  { pattern: /\b(laba|profit)\b/i,                                                  weight: +1, label: "laba/profit" },
  { pattern: /\b(dividen|dividend)\b/i,                                             weight: +1, label: "dividen" },
  { pattern: /\b(rally)\b/i,                                                        weight: +1, label: "rally" },
  { pattern: /\b(bullish)\b/i,                                                      weight: +1, label: "bullish" },
  { pattern: /\b(upgrade|outperform)\b/i,                                           weight: +1, label: "upgrade/outperform" },
  { pattern: /\b(kontrak\s+baru|proyek\s+baru|order\s+baru)\b/i,                   weight: +1, label: "kontrak/proyek baru" },
  { pattern: /\b(ekspansi|berkembang)\b/i,                                          weight: +1, label: "ekspansi" },
  { pattern: /\b(buyback|buy\s+back)\b/i,                                           weight: +1, label: "buyback" },
  { pattern: /\b(rights?\s+issue|right\s+issue|penawaran\s+umum\s+terbatas)\b/i,   weight: +1, label: "rights issue (ekspansi modal)" },
  { pattern: /\b(IPO|initial\s+public\s+offering)\b/i,                             weight: +1, label: "IPO" },
  { pattern: /\b(optimis|solid|positif)\b/i,                                       weight: +1, label: "optimis/positif" },
  { pattern: /\b(rebound|recovery|pulih)\b/i,                                      weight: +1, label: "rebound/pulih" },
  { pattern: /\b(akuisisi)\b/i,                                                    weight: +1, label: "akuisisi" },
  // "gain" — only as standalone word, not "again", "regain", etc.
  { pattern: /(?<![a-z])gain(?:ed|s)?\b/i,                                         weight: +1, label: "gain" },

  // ── Strong Negative (-2) ────────────────────────────────────────────────────
  { pattern: /\b(anjlok|ambruk|rontok|terjun\s+bebas|jeblok|kolaps)\b/i,          weight: -2, label: "anjlok/ambruk" },
  { pattern: /\b(bangkrut|pailit|kepailitan)\b/i,                                  weight: -2, label: "bangkrut/pailit" },
  { pattern: /\b(default|gagal\s+bayar|gagal\s+lunasi)\b/i,                        weight: -2, label: "gagal bayar/default" },
  { pattern: /\b(fraud|korupsi|manipulasi\s+saham|penipuan\s+saham)\b/i,          weight: -2, label: "fraud/korupsi" },
  { pattern: /\b(delisting|pencabutan\s+pencatatan)\b/i,                           weight: -2, label: "delisting" },
  { pattern: /\b(suspend|suspensi|penghentian\s+perdagangan)\b/i,                  weight: -2, label: "suspend/suspensi" },
  { pattern: /\bcrash\b/i,                                                          weight: -2, label: "crash" },
  { pattern: /\bplunge[sd]?\b/i,                                                   weight: -2, label: "plunge" },
  { pattern: /\b(skandal|kasus\s+(hukum|pidana|korupsi))\b/i,                     weight: -2, label: "skandal/kasus hukum" },
  { pattern: /\b(kerugian\s+besar|rugi\s+besar|rugi\s+masif)\b/i,                 weight: -2, label: "kerugian besar" },

  // ── Negative (-1) ───────────────────────────────────────────────────────────
  { pattern: /\b(turun|penurunan|melemah|terkoreksi|koreksi)\b/i,                  weight: -1, label: "turun/melemah" },
  // "rugi" standalone — NOT "kerugian" (covered above) — but NOT "tidak rugi"
  { pattern: /\b(rugi|merugi)\b/i,                                                 weight: -1, label: "rugi" },
  { pattern: /\b(bearish)\b/i,                                                     weight: -1, label: "bearish" },
  { pattern: /\b(downgrade|underperform)\b/i,                                      weight: -1, label: "downgrade/underperform" },
  { pattern: /\b(denda|sanksi\s+otoritas|penalti\s+regulasi)\b/i,                 weight: -1, label: "denda/sanksi" },
  // "tekanan" — hanya jika konteks pasar/keuangan
  { pattern: /\btekanan\s+(jual|pasar|keuangan|likuiditas)\b/i,                   weight: -1, label: "tekanan jual/pasar" },
  { pattern: /\b(kerugian|menderita\s+rugi)\b/i,                                  weight: -1, label: "kerugian" },
  { pattern: /\b(masalah\s+(keuangan|likuiditas|utang))\b/i,                      weight: -1, label: "masalah keuangan" },
  { pattern: /\b(gugatan|tuntutan\s+hukum|digugat)\b/i,                           weight: -1, label: "gugatan/tuntutan" },
  { pattern: /\b(divestasi\s+besar|menjual\s+aset\s+utama)\b/i,                  weight: -1, label: "divestasi besar" },
];

// Negation words — if these appear within 4 words BEFORE a match, flip the weight
const NEGATION_RE = /\b(tidak|bukan|belum|tanpa|non|gagal|hampir\s+tidak)\s+\S+(\s+\S+){0,3}$/i;

function analyzeSentiment(title: string, description: string): {
  sentiment: "positive" | "negative" | "neutral";
  score: number;
  reason: string;
} {
  const text = (title + " " + description).toLowerCase();

  let score = 0;
  const matchedLabels: string[] = [];

  for (const rule of SENTIMENT_RULES) {
    const match = rule.pattern.exec(text);
    if (!match) continue;

    // Check negation in the 60 chars before the match
    const before = text.slice(Math.max(0, match.index - 60), match.index);
    const negated = NEGATION_RE.test(before);

    const effectiveWeight = negated ? -rule.weight : rule.weight;
    score += effectiveWeight;

    const label = negated ? `tidak ${rule.label}` : rule.label;
    if (!matchedLabels.includes(label)) matchedLabels.push(label);
  }

  // Normalize — max realistic score ±6
  const normalized = parseFloat(Math.max(-1, Math.min(1, score / 6)).toFixed(2));

  // Threshold ±0.20 to avoid hair-trigger classification
  let sentiment: "positive" | "negative" | "neutral";
  if (normalized >= 0.20) sentiment = "positive";
  else if (normalized <= -0.20) sentiment = "negative";
  else sentiment = "neutral";

  const reason = matchedLabels.slice(0, 3).join(", ") || "tidak ada sinyal kuat";
  return { sentiment, score: normalized, reason };
}

// ── Check if a news item mentions the ticker ──
// Strict matching: ticker code as word, or $TICKER, or 2+ specific company name parts
const GENERIC_NAME_WORDS = new Set([
  "PT", "TBK", "INDONESIA", "INDONESIAN", "INTERNATIONAL", "INTERNASIONAL",
  "GLOBAL", "GROUP", "GRUP", "MEDIA", "DIGITAL", "ENERGY", "ENERGI", "RESOURCES",
  "PERSADA", "PRATAMA", "NUSANTARA", "SARANA", "SEJAHTERA", "PERKASA", "JAYA",
  "MITRA", "MAKMUR", "INVESTAMA", "INVESTINDO", "ABADI", "MULIA", "AGUNG",
  "BANK", "BANKING", "ASIA", "MEDICAL", "MEDIKAL", "HEALTH", "HEALTHCARE",
  "FARMA", "FARMASI", "PHARMA", "PHARMACEUTICAL", "RAYA", "INTI", "PRIMA",
  "MANDIRI", "BAKRIE", "INDAH", "TECHNOLOGY", "TEKNOLOGI", "TELEKOMUNIKASI",
  "TELECOM", "RESOURCE", "MINERAL", "MINING", "TAMBANG", "PETROL", "PETROLEUM",
  "OIL", "GAS", "PROPERTY", "PROPERTI", "INDUSTRI", "INDUSTRIES", "INDUSTRY",
  "FINANSIAL", "FINANCE", "FINANCIAL", "MULTI", "USAHA", "BUMI", "ANEKA",
  "KORPORA", "PERSERO", "PERSERO)", "(PERSERO)",
]);

function mentionsTicker(
  title: string,
  description: string,
  ticker: string, // e.g. "BBCA" or "BBCA.JK"
  companyName?: string
): boolean {
  const clean = ticker.replace(".JK", "").toUpperCase();
  const haystack = (title + " " + description).toUpperCase();

  // 1. Ticker as proper word (BBCA surrounded by non-letters) — highest confidence
  const tickerRe = new RegExp(`(?<![A-Z])${clean}(?![A-Z])`, "i");
  if (tickerRe.test(haystack)) return true;

  // 2. $TICKER style (Stockbit/social style)
  if (haystack.includes(`$${clean}`)) return true;

  // 3. Company name match — STRICT: require either
  //    a) 2+ specific (non-generic) name parts present, OR
  //    b) 1 very specific (≥9 char, non-generic) name part
  if (companyName && companyName.length > 4) {
    const allParts = companyName
      .toUpperCase()
      .replace(/[().,]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length > 3);
    const specificParts = allParts.filter((p) => !GENERIC_NAME_WORDS.has(p));

    let matchCount = 0;
    let veryLongMatch = false;
    for (const part of specificParts) {
      if (haystack.includes(part)) {
        matchCount += 1;
        if (part.length >= 9) veryLongMatch = true;
      }
    }
    if (matchCount >= 2 || veryLongMatch) return true;
  }

  return false;
}

// ── Route handler ──

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const decodedTicker = decodeURIComponent(ticker); // e.g. "BBCA.JK" or "BBCA"
  const cleanTicker = decodedTicker.replace(".JK", "").toUpperCase();

  // Optionally accept company name via query param for better matching
  const url = new URL(_req.url);
  const companyName = url.searchParams.get("name") || undefined;

  try {
    const feeds = [
      { url: "https://finance.detik.com/rss", source: "Detik Finance" },
      { url: "https://finance.detik.com/bursa-valas/rss", source: "Detik Bursa" },
    ];

    const results = await Promise.allSettled(
      feeds.map(async ({ url: feedUrl, source }) => {
        const res = await fetch(feedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/rss+xml, application/xml, text/xml, */*",
          },
          next: { revalidate: 300 },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        return parseRSS(xml, source);
      })
    );

    const allNews = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);

    // Deduplicate
    const seen = new Set<string>();
    const unique = allNews.filter((n) => {
      if (seen.has(n.link)) return false;
      seen.add(n.link);
      return true;
    });

    // Filter: only news that mentions this ticker
    const relevant = unique.filter((n) =>
      mentionsTicker(n.title, n.description, cleanTicker, companyName)
    );

    // Sort newest first
    relevant.sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    });

    // Attach sentiment
    const withSentiment: NewsItemWithSentiment[] = relevant.map((n) => {
      const { sentiment, score, reason } = analyzeSentiment(n.title, n.description);
      return {
        ...n,
        sentiment,
        sentimentScore: score,
        sentimentReason: reason,
        mentionedTicker: cleanTicker,
      };
    });

    return NextResponse.json(withSentiment);
  } catch (error) {
    console.error("Stock news error:", error);
    return NextResponse.json([], { status: 200 });
  }
}

