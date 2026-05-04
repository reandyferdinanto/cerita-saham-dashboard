import { NextResponse } from "next/server";

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  image?: string;
}

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

// Parse RSS XML — handles CDATA, enclosure images
function parseRSS(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    // Extract CDATA or plain tag content
    const getTag = (tag: string): string => {
      const re = new RegExp(
        `<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:]]>)?\\s*<\\/${tag}>`,
        "i"
      );
      const m = block.match(re);
      return m ? m[1].trim() : "";
    };

    // <link> in Detik RSS is a plain text node (not wrapped), grab it directly
    const linkMatch = block.match(/<link>\s*(https?:\/\/[^\s<]+)\s*<\/link>/i);
    const guidMatch = block.match(/<guid[^>]*>\s*(https?:\/\/[^\s<]+)\s*<\/guid>/i);

    // Image from <enclosure url="...">
    const enclosureMatch = block.match(/<enclosure[^>]+url="([^"]+)"/i);
    // Fallback: first <img src="..."> inside description
    const descRaw = getTag("description");
    const imgInDesc = descRaw.match(/<img[^>]+src="([^"]+)"/i);
    const image = enclosureMatch?.[1] || imgInDesc?.[1] || undefined;

    // Strip HTML from description
    const description = descRaw
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 180);

    const title = getTag("title");
    const link = linkMatch?.[1] || guidMatch?.[1] || "";
    const pubDate = getTag("pubDate");

    if (title && link) {
      items.push({ title, link, pubDate, description, source, image });
    }
  }
  return items;
}

async function fetchRSS(url: string, source: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const xml = await res.text();
  return parseRSS(xml, source);
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIpotDate(value: string) {
  const match = value.match(/^[A-Za-z]+,\s+([A-Za-z]{3})\s+(\d{2}),\s+(\d{4})\s+-\s+(\d{2}):(\d{2})\s+WIB/i);
  if (!match) return value;

  const [, monthName, day, year, hour, minute] = match;
  const month = MONTHS[monthName] || "01";
  return `${year}-${month}-${day}T${hour}:${minute}:00+07:00`;
}

function parseIpotAjaxHtml(html: string, source: string): NewsItem[] {
  return Array.from(html.matchAll(/<small>(.*?)<\/small>\s*<dt><a href=\"([^\"]+)\">([\s\S]*?)<\/a><\/dt>/gi))
    .map((match) => {
      const link = decodeHtml(match[2]);
      return {
        title: decodeHtml(match[3].replace(/<[^>]+>/g, "")),
        link: link.startsWith("http") ? link : `https://www.indopremier.com/ipotnews/${link}`,
        pubDate: parseIpotDate(decodeHtml(match[1])),
        description: "",
        source,
      };
    })
    .filter((item) => item.title && item.link);
}

async function fetchIpotLevel(level: string) {
  const url = `${IPOT_AJAX_URL}?halaman=0&level4=${encodeURIComponent(level)}`;
  const res = await fetch(url, {
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

  const text = (await res.text()).trim();
  const pages = JSON.parse(text) as Record<string, string>;
  return Object.values(pages).flatMap((html) => parseIpotAjaxHtml(html, `IPOT ${level}`));
}

export async function GET() {
  try {
    const feeds = [
      { url: "https://finance.detik.com/rss", source: "Detik Finance" },
      { url: "https://finance.detik.com/bursa-valas/rss", source: "Detik Bursa" },
    ];

    const [results, ipotResults] = await Promise.all([
      Promise.allSettled(feeds.map(({ url, source }) => fetchRSS(url, source))),
      Promise.allSettled(IPOT_LEVELS.map((level) => fetchIpotLevel(level))),
    ]);

    const detikNews: NewsItem[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        detikNews.push(...result.value);
      } else {
        console.error("Feed error:", result.reason);
      }
    }

    const ipotNews: NewsItem[] = [];
    for (const result of ipotResults) {
      if (result.status === "fulfilled") {
        ipotNews.push(...result.value.slice(0, 4));
      } else {
        console.error("IPOT AJAX error:", result.reason);
      }
    }

    // Keep IPOT visible even when its industry feeds are older than Detik.
    const sortedDetik = detikNews
      .sort((a, b) => (b.pubDate ? new Date(b.pubDate).getTime() : 0) - (a.pubDate ? new Date(a.pubDate).getTime() : 0))
      .slice(0, 12);
    const sortedIpot = ipotNews
      .sort((a, b) => (b.pubDate ? new Date(b.pubDate).getTime() : 0) - (a.pubDate ? new Date(a.pubDate).getTime() : 0))
      .slice(0, 6);
    const balancedNews: NewsItem[] = [];
    for (let i = 0; i < Math.max(sortedDetik.length, sortedIpot.length); i += 1) {
      if (sortedDetik[i]) balancedNews.push(sortedDetik[i]);
      if (sortedDetik[i + 6]) balancedNews.push(sortedDetik[i + 6]);
      if (sortedIpot[i]) balancedNews.push(sortedIpot[i]);
    }

    // Deduplicate by link while preserving the Detik/IPOT mix order.
    const seen = new Set<string>();
    const sorted = balancedNews
      .filter((n) => {
        if (!n.title || !n.link || seen.has(n.link)) return false;
        seen.add(n.link);
        return true;
      })
      .slice(0, 18);

    return NextResponse.json(sorted);
  } catch (error) {
    console.error("News fetch error:", error);
    return NextResponse.json([], { status: 200 });
  }
}
