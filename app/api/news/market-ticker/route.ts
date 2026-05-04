import { NextResponse } from "next/server";

type MarketTickerNews = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
};

const MARKET_KEYWORDS = /saham|ihsg|bursa|market|emiten|investor|asing|rupiah|valas|wall street|the fed|obligasi|reksa dana|harga emas|dividen/i;
const IPOT_AJAX_URL = "https://www.indopremier.com/module/newsresearch/ajax/ajax_generalNewsPagesMore.php";
const IPOT_LEVELS = ["topnews", "stocks", "jci", "marketoverview", "industries", "komoditi", "currencies"];
const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[|]]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRSS(xml: string, source: string, marketOnly = false): MarketTickerNews[] {
  const items: MarketTickerNews[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const getTag = (tag: string) => {
      const tagMatch = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return tagMatch ? decodeXml(tagMatch[1]) : "";
    };

    const title = getTag("title");
    const description = getTag("description");
    const link = getTag("link") || getTag("guid");
    const pubDate = getTag("pubDate");

    if (!title || !link) continue;
    if (marketOnly && !link.includes("/bursa-dan-valas/") && !MARKET_KEYWORDS.test(`${title} ${description}`)) continue;

    items.push({ title, link, pubDate, source });
  }

  return items;
}

async function fetchRSS(url: string, source: string, marketOnly = false) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return parseRSS(await res.text(), source, marketOnly);
}

function parseIpotDate(value: string) {
  const match = value.match(/^[A-Za-z]+,\s+([A-Za-z]{3})\s+(\d{2}),\s+(\d{4})\s+-\s+(\d{2}):(\d{2})\s+WIB/i);
  if (!match) return value;

  const [, monthName, day, year, hour, minute] = match;
  const month = MONTHS[monthName] || "01";
  return `${year}-${month}-${day}T${hour}:${minute}:00+07:00`;
}

function parseIpotAjaxHtml(html: string, source: string): MarketTickerNews[] {
  return Array.from(html.matchAll(/<small>(.*?)<\/small>\s*<dt><a href=\"([^\"]+)\">([\s\S]*?)<\/a><\/dt>/gi))
    .map((match) => {
      const link = decodeXml(match[2]);
      return {
        title: decodeXml(match[3]),
        link: link.startsWith("http") ? link : `https://www.indopremier.com/ipotnews/${link}`,
        pubDate: parseIpotDate(decodeXml(match[1])),
        source,
      };
    })
    .filter((item) => item.title && item.link);
}

async function fetchIpotLevel(level: string) {
  const res = await fetch(`${IPOT_AJAX_URL}?halaman=0&level4=${encodeURIComponent(level)}`, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json, text/html, */*",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: new URLSearchParams({ modulType: "ipotnews", newsType: "headnone" }),
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} from IPOT ${level}`);

  const pages = JSON.parse((await res.text()).trim()) as Record<string, string>;
  return Object.values(pages).flatMap((html) => parseIpotAjaxHtml(html, `IPOT ${level}`));
}

function dedupe(items: MarketTickerNews[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.link || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortNewest(items: MarketTickerNews[]) {
  return [...items].sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });
}

export async function GET() {
  const detikFeeds = [
    "https://finance.detik.com/bursa-valas/rss",
    "https://finance.detik.com/rss",
  ];

  const [detikResults, ipotResults] = await Promise.all([
    Promise.allSettled(detikFeeds.map((url) => fetchRSS(url, "Detik Market", true))),
    Promise.allSettled(IPOT_LEVELS.map((level) => fetchIpotLevel(level))),
  ]);

  const detikNews = sortNewest(dedupe(detikResults
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
  ));
  const ipotNews = sortNewest(dedupe(ipotResults
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
  ));

  const news = dedupe([
    ...detikNews.slice(0, 8),
    ...ipotNews.slice(0, 6),
  ]).slice(0, 14);

  return NextResponse.json(news);
}
