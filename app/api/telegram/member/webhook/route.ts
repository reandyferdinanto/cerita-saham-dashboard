import { NextRequest, NextResponse } from "next/server";
import { getQuote, getHistory, searchStocks } from "@/lib/yahooFinance";
import { takeChartScreenshot } from "@/lib/chartScreenshot";
import { calcTechnicalSignals } from "@/lib/technicalSignals";
import { getNewsWithCache, type CachedNewsItem } from "@/lib/data/newsCache";
import { getFundamentalSnapshot, formatMarketCap, formatPercent } from "@/lib/data/fundamentalSnapshot";
import { getAccumulationSnapshot } from "@/lib/data/accumulationSnapshot";
import { fetchSectorNews } from "@/lib/data/sectorNews";
import { getTelegramSettings } from "@/lib/data/telegramSettings";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── In-memory caches (per server instance) ─────────────────────────────────────
type BriefCacheEntry = { at: number; text: string; ticker: string; chartPath: string | null };
const briefCache = new Map<string, BriefCacheEntry>(); // key: ticker uppercase

type RateLimitEntry = { count: number; resetAt: number };
const rateLimits = new Map<number, RateLimitEntry>(); // key: chat_id

const recentUpdates = new Set<number>();
const recentMessages = new Set<string>();

function pruneCache(maxEntries = 200) {
  if (briefCache.size > maxEntries) {
    const oldest = briefCache.keys().next().value;
    if (oldest !== undefined) briefCache.delete(oldest);
  }
}

function checkRateLimit(chatId: number, dailyLimit: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimits.get(chatId);
  if (!entry || entry.resetAt < now) {
    // Reset at next midnight UTC+7 (Jakarta)
    const jktOffsetMs = 7 * 60 * 60 * 1000;
    const tomorrowUTC = new Date(now + 24 * 60 * 60 * 1000);
    tomorrowUTC.setUTCHours(-7, 0, 0, 0); // 00:00 WIB next day in UTC
    const resetAt = tomorrowUTC.getTime() + jktOffsetMs;
    rateLimits.set(chatId, { count: 1, resetAt });
    return { allowed: true, remaining: dailyLimit - 1, resetAt };
  }
  if (entry.count >= dailyLimit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, remaining: dailyLimit - entry.count, resetAt: entry.resetAt };
}

// ── Telegram helpers ──────────────────────────────────────────────────────────
async function sendTelegramMessage(chatId: number, text: string, token: string, parseMode: "Markdown" | undefined = "Markdown") {
  return await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...(parseMode ? { parse_mode: parseMode } : {}) }),
  });
}

async function sendTelegramPhoto(chatId: number, photoPath: string, caption: string, token: string) {
  try {
    const buffer = await fs.readFile(photoPath);
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", caption);
    form.append("parse_mode", "Markdown");
    form.append("photo", new Blob([new Uint8Array(buffer)], { type: "image/png" }), path.basename(photoPath));

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
    if (!res.ok) {
      // Fallback to plain text caption if photo fails (e.g. caption too long)
      await sendTelegramMessage(chatId, caption, token);
    }
    return res;
  } catch (error) {
    console.error("[MEMBER BOT] sendPhoto failed:", error);
    await sendTelegramMessage(chatId, caption, token);
  }
}

// ── AI Brief generator using NVIDIA NIM ───────────────────────────────────────
async function generateMemberBrief(ticker: string, name: string, origin: string): Promise<string> {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const yahooSymbol = ticker.toUpperCase().endsWith(".JK") ? ticker.toUpperCase() : `${ticker.toUpperCase()}.JK`;

  // Gather all context (parallel)
  const newsFetcher = async (): Promise<CachedNewsItem[]> => {
    try {
      const res = await fetch(`${origin}/api/news/stock/${encodeURIComponent(yahooSymbol)}?name=${encodeURIComponent(name)}`, { cache: "no-store" });
      if (!res.ok) return [];
      const items = (await res.json()) as Array<{
        title: string; link: string; pubDate: string; description?: string; source?: string;
        sentiment: "positive" | "negative" | "neutral"; sentimentScore: number; sentimentReason: string;
      }>;
      return items.map((item) => ({
        title: item.title, link: item.link, source: item.source || "", pubDate: item.pubDate,
        description: item.description || "", sentiment: item.sentiment,
        sentimentScore: item.sentimentScore, sentimentReason: item.sentimentReason,
      }));
    } catch {
      return [];
    }
  };

  const [quote, history, newsResult, fundamental, accumulation] = await Promise.all([
    getQuote(yahooSymbol),
    getHistory(yahooSymbol, new Date(Date.now() - 220 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], undefined, "1d"),
    getNewsWithCache(yahooSymbol, newsFetcher, { limit: 25 }),
    getFundamentalSnapshot(yahooSymbol).catch(() => null),
    getAccumulationSnapshot(yahooSymbol, 10).catch(() => null),
  ]);

  if (!quote || !history || history.length < 30) {
    return `Data ${ticker.toUpperCase()} belum cukup untuk brief.`;
  }

  const technical = calcTechnicalSignals(history);
  let sectorNews: CachedNewsItem[] = [];
  if (newsResult.items.length < 3 && fundamental && (fundamental.sector || fundamental.industry)) {
    sectorNews = await fetchSectorNews(origin, fundamental.sector, fundamental.industry, 5).catch(() => []);
  }

  const supports = technical.srLevels.filter((l) => l.type === "S").map((l) => l.price).sort((a, b) => b - a).slice(0, 2);
  const resistances = technical.srLevels.filter((l) => l.type === "R").map((l) => l.price).sort((a, b) => a - b).slice(0, 2);

  // Build prompt (compact for member bot — token-efficient)
  const promptParts: string[] = [
    `Buat brief saham ${ticker.toUpperCase()} (${name}) untuk member ritel via Telegram. RINGKAS, DIBAWAH 1500 KARAKTER.`,
    ``,
    `Harga: Rp ${quote.price.toLocaleString("id-ID")} (${quote.changePercent.toFixed(2)}%)`,
    `Teknikal: ${technical.conclusionTitle} (skor ${technical.score}/100, action ${technical.actionBias})`,
    `RSI: ${technical.rsi?.toFixed(1) || "-"} | Support: ${supports.join(", ") || "-"} | Resistance: ${resistances.join(", ") || "-"}`,
  ];

  if (fundamental) {
    const fundLine: string[] = [];
    if (fundamental.sector) fundLine.push(`sektor ${fundamental.sector}`);
    if (fundamental.marketCap) fundLine.push(`mcap ${formatMarketCap(fundamental.marketCap)}`);
    if (fundamental.trailingPE != null) fundLine.push(`PE ${fundamental.trailingPE.toFixed(1)}x`);
    if (fundamental.priceToBook != null) fundLine.push(`PBV ${fundamental.priceToBook.toFixed(1)}x`);
    if (fundamental.revenueGrowth != null) fundLine.push(`rev growth ${formatPercent(fundamental.revenueGrowth, 1)}`);
    if (fundamental.roe != null) fundLine.push(`ROE ${formatPercent(fundamental.roe, 1)}`);
    if (fundLine.length > 0) promptParts.push(`Fundamental: ${fundLine.join(", ")}`);
  }

  if (accumulation && accumulation.available) {
    promptParts.push(
      `Akumulasi 10H: foreign ${accumulation.foreignAccumulationLabel} (net ${
        accumulation.totalNetForeign >= 0 ? "+" : ""
      }${accumulation.totalNetForeign.toLocaleString("id-ID")}), domestic ${accumulation.domesticPressureLabel}.`
    );
  }

  if (newsResult.items.length > 0) {
    const top = newsResult.items.slice(0, 3).map((n) => `- ${n.title} (${n.sentiment})`).join("\n");
    promptParts.push(`Berita ticker:\n${top}`);
  } else if (sectorNews.length > 0) {
    promptParts.push(`Berita sektor: ${sectorNews.slice(0, 2).map((n) => n.title).join("; ")}`);
  } else {
    promptParts.push(`Belum ada berita ticker spesifik dalam 30 hari.`);
  }

  promptParts.push(
    ``,
    `FORMAT (markdown Telegram):`,
    `*${ticker.toUpperCase()} Brief*`,
    ``,
    `📊 Ringkasan singkat (2 kalimat).`,
    ``,
    `✅ *Yang Menarik:*`,
    `• poin 1`,
    `• poin 2`,
    ``,
    `⚠️ *Yang Diwaspadai:*`,
    `• poin 1`,
    `• poin 2`,
    ``,
    `🎯 *Plan:* entry, SL, TP konkret berdasarkan support/resistance.`,
    ``,
    `Catatan: Maks 1500 karakter. Bahasa Indonesia. Tanpa emoji selain yang dicontohkan. Berbasis data di atas saja.`
  );

  if (!nvidiaKey) {
    // Fallback brief tanpa AI
    return [
      `*${ticker.toUpperCase()} Brief (auto)*`,
      ``,
      `📊 Harga Rp ${quote.price.toLocaleString("id-ID")} (${quote.changePercent.toFixed(2)}%). ${technical.conclusionTitle}.`,
      ``,
      `Support: ${supports.join(", ") || "-"} | Resistance: ${resistances.join(", ") || "-"}`,
      accumulation?.available ? `Akumulasi: ${accumulation.foreignAccumulationLabel} (foreign), ${accumulation.domesticPressureLabel} (domestic).` : "",
      ``,
      `_NVIDIA API key belum dikonfigurasi — brief AI tidak tersedia._`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  try {
    const nvidia = new OpenAI({ apiKey: nvidiaKey, baseURL: "https://integrate.api.nvidia.com/v1" });
    const completion = await nvidia.chat.completions.create({
      model: process.env.NVIDIA_MODEL || "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: "Kamu analis saham IDX untuk anomalisaham. Jawab ringkas, jujur, fokus risk/reward. Output: markdown Telegram-compatible.",
        },
        { role: "user", content: promptParts.join("\n") },
      ],
      temperature: 0.5,
      top_p: 1,
      max_tokens: 800,
    });

    const text = completion.choices[0]?.message?.content?.trim() || "";
    return text || `Brief ${ticker.toUpperCase()} tidak tersedia saat ini.`;
  } catch (error) {
    console.error("[MEMBER BOT] NVIDIA error:", error);
    return `Brief ${ticker.toUpperCase()} gagal di-generate. Coba beberapa saat lagi.`;
  }
}

// ── Webhook handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const settings = await getTelegramSettings();
    if (!settings.memberBotEnabled || !settings.memberBotToken) {
      return NextResponse.json({ ok: true, skipped: "member_bot_disabled" });
    }

    const update = await req.json();
    const updateId = update.update_id;
    const message = update.message || update.channel_post;
    if (!message || !message.text) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const messageId = message.message_id;
    const messageKey = `${chatId}_${messageId}`;

    if (recentUpdates.has(updateId) || recentMessages.has(messageKey)) {
      return NextResponse.json({ ok: true });
    }
    recentUpdates.add(updateId);
    recentMessages.add(messageKey);
    if (recentUpdates.size > 1000) {
      const first = recentUpdates.values().next().value;
      if (first !== undefined) recentUpdates.delete(first);
    }
    if (recentMessages.size > 1000) {
      const first = recentMessages.values().next().value;
      if (first !== undefined) recentMessages.delete(first);
    }

    const text: string = message.text.trim();
    const token = settings.memberBotToken;

    // Commands
    if (text === "/start" || text === "/help") {
      const helpText = [
        "*🤖 Bot Anomalisaham Member*",
        "",
        "Cara pakai:",
        "• Ketik kode saham → dapat chart + brief AI",
        "• Contoh: `BBCA`, `GOTO`, `INET`",
        "",
        `Limit: ${settings.memberBotRateLimitPerDay} brief/hari`,
        `Cache: ${settings.memberBotCacheMinutes} menit per ticker`,
        "",
        "_Hanya untuk pembaca AnomaliSaham. Tidak boleh disebar._",
      ].join("\n");
      await sendTelegramMessage(chatId, helpText, token);
      return NextResponse.json({ ok: true });
    }

    // Parse ticker (1-6 letters)
    const tickerMatch = text.match(/^[A-Za-z]{1,6}$/);
    if (!tickerMatch) {
      await sendTelegramMessage(chatId, "Ketik kode saham 4 huruf saja (misal: `BBCA`, `GOTO`).", token);
      return NextResponse.json({ ok: true });
    }
    const ticker = tickerMatch[0].toUpperCase();

    // Rate limit
    const limit = checkRateLimit(chatId, settings.memberBotRateLimitPerDay);
    if (!limit.allowed) {
      const resetTime = new Date(limit.resetAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
      await sendTelegramMessage(
        chatId,
        `Anda sudah pakai ${settings.memberBotRateLimitPerDay} brief hari ini. Reset jam ${resetTime} WIB.`,
        token
      );
      return NextResponse.json({ ok: true });
    }

    // Check brief cache
    const cacheKey = ticker;
    const cached = briefCache.get(cacheKey);
    const cacheTtlMs = settings.memberBotCacheMinutes * 60 * 1000;
    if (cached && Date.now() - cached.at < cacheTtlMs) {
      // Serve from cache (chart still fresh enough)
      if (cached.chartPath) {
        await sendTelegramPhoto(chatId, cached.chartPath, cached.text, token);
      } else {
        await sendTelegramMessage(chatId, cached.text, token);
      }
      return NextResponse.json({ ok: true, cached: true });
    }

    // Resolve ticker → company name via search
    const searchResults = await searchStocks(ticker);
    const matched = searchResults.find((item) => item.symbol.replace(".JK", "").toUpperCase() === ticker) || searchResults[0];
    if (!matched) {
      await sendTelegramMessage(chatId, `Saham *${ticker}* tidak ditemukan.`, token);
      return NextResponse.json({ ok: true });
    }

    const yahooSymbol = matched.symbol;
    const companyName = matched.name;

    // Inform user
    await sendTelegramMessage(chatId, `⏳ Menyiapkan brief ${ticker} (${companyName})...`, token);

    // Parallel: chart + brief
    const origin = req.nextUrl.origin;
    const [chartPath, briefText] = await Promise.all([
      takeChartScreenshot(yahooSymbol, "1d").catch(() => null),
      generateMemberBrief(ticker, companyName, origin),
    ]);

    // Cache for next requesters
    briefCache.set(cacheKey, { at: Date.now(), text: briefText, ticker, chartPath });
    pruneCache();

    // Send chart with brief as caption (or text-only fallback)
    if (chartPath) {
      // Telegram caption limit ~1024 chars; if brief is longer, send text separately
      if (briefText.length <= 1000) {
        await sendTelegramPhoto(chatId, chartPath, briefText, token);
      } else {
        await sendTelegramPhoto(chatId, chartPath, `*${ticker} Chart*`, token);
        await sendTelegramMessage(chatId, briefText, token);
      }
    } else {
      await sendTelegramMessage(chatId, briefText, token);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[MEMBER BOT] webhook error:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "unknown" });
  }
}
