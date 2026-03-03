import { NextResponse } from "next/server";

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  image?: string;
}

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

export async function GET() {
  try {
    const feeds = [
      { url: "https://finance.detik.com/rss", source: "Detik Finance" },
      { url: "https://finance.detik.com/bursa-valas/rss", source: "Detik Bursa" },
    ];

    const results = await Promise.allSettled(
      feeds.map(async ({ url, source }) => {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/rss+xml, application/xml, text/xml, */*",
          },
          next: { revalidate: 300 }, // cache 5 min
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
        const xml = await res.text();
        return parseRSS(xml, source);
      })
    );

    const allNews: NewsItem[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        allNews.push(...result.value);
      } else {
        console.error("Feed error:", result.reason);
      }
    }

    // Deduplicate by link, sort newest first, take top 12
    const seen = new Set<string>();
    const sorted = allNews
      .filter((n) => {
        if (!n.title || !n.link || seen.has(n.link)) return false;
        seen.add(n.link);
        return true;
      })
      .sort((a, b) => {
        const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return db - da;
      })
      .slice(0, 12);

    return NextResponse.json(sorted);
  } catch (error) {
    console.error("News fetch error:", error);
    return NextResponse.json([], { status: 200 });
  }
}
