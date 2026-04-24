import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SiteSettings from "@/lib/models/SiteSettings";
import Watchlist from "@/lib/models/Watchlist";
import IndonesiaStock from "@/lib/models/IndonesiaStock";
import { getQuotes, getHistory } from "@/lib/yahooFinance";

// Simplified EMA calculation for a single value
function calculateLastEMA(prices: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = prices[0]; // Start with first price or SMA of first 'period' prices
  
  // For better accuracy, we should start with SMA
  if (prices.length >= period) {
    const initialSma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema = initialSma;
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
  } else {
    // Fallback if not enough data
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
  }
  return ema;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isTest = searchParams.get("test") === "true";

  // Authorization check (similar to ML screener)
  const authHeader = req.headers.get("authorization");
  if (
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    req.headers.get("x-vercel-cron") !== "1"
  ) {
    console.warn("Watchlist Alert triggered without proper authorization");
  }

  try {
    await connectDB();
    const settings = await SiteSettings.findOne({});
    
    if (!settings?.watchlistAlertEnabled || !settings?.watchlistAlertBotToken || !settings?.watchlistAlertChatId) {
      return NextResponse.json({ message: "Watchlist Alert is disabled or not configured" });
    }

    // 1. Time Safety Check (WIB: UTC+7) - BYPASS IF TEST
    const now = new Date();
    const wibHour = (now.getUTCHours() + 7) % 24;
    const day = now.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    if (!isTest) {
      if (day === 0 || day === 6) {
        return NextResponse.json({ message: "Weekend, cron skipped" });
      }
      if (wibHour < 9 || wibHour >= 16) {
        return NextResponse.json({ message: "Outside market hours (09:00-16:00 WIB), cron skipped" });
      }
    }

    // 2. Determine Universe
    let tickersToScan: string[] = [];
    const universe = settings.watchlistAlertUniverse || "watchlist";

    if (universe === "all") {
      const allStocks = await IndonesiaStock.find({ active: true }).select("ticker").lean();
      tickersToScan = allStocks.map((s: any) => s.ticker.endsWith(".JK") ? s.ticker : `${s.ticker}.JK`);
    } else {
      const watchlist = await Watchlist.find({});
      if (watchlist.length === 0) return NextResponse.json({ message: "Watchlist is empty" });
      tickersToScan = watchlist.map((w: any) => w.ticker.endsWith(".JK") ? w.ticker : `${w.ticker}.JK`);
    }

    // 3. Fetch Quotes for real-time price and open
    const quotes = await getQuotes(tickersToScan);
    
    const results = [];

    for (const quote of quotes) {
      if (!quote || quote.price === 0) continue;
      const tickerJK = quote.ticker;
      const tickerRaw = tickerJK.replace(".JK", "");

      // Selalu masukkan semua saham di watchlist/universe tanpa filter
      results.push({
        ticker: tickerRaw,
        price: quote.price,
        change: quote.changePercent,
        matchType: "MONITORING",
        detail: "Real-time"
      });

      // Stop if we found too many results to prevent Telegram flood (limit 40)
      if (results.length >= 40) break;
    }

    if (results.length === 0) {
      return NextResponse.json({ message: "No stocks found to monitor" });
    }

    // 4. Format Telegram Message (Markdown Code Block)
    let message = `🔔 *ALERT SCREENER* 🔔\n`;
    message += `Mode: *${escapeMarkdown(universe.toUpperCase())}*\n`;
    message += `Waktu: *${escapeMarkdown(now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" }))} WIB*\n\n`;

    message += "```\n";
    message += "Ticker | Price | % Chg | Vol  \n";
    message += "-------|-------|-------|------\n";

    results.forEach(res => {
      const ticker = res.ticker.padEnd(6);
      const price = res.price.toString().padStart(5);
      const change = (res.change >= 0 ? "+" : "") + res.change.toFixed(1) + "%";
      
      // Simplify volume (e.g. 1.2M, 500K)
      const q = quotes.find((q: any) => q.ticker.replace(".JK", "") === res.ticker);
      const volRaw = q?.volume || 0;
      const volStr = volRaw > 1000000 
        ? (volRaw / 1000000).toFixed(1) + "M"
        : volRaw > 1000 
          ? (volRaw / 1000).toFixed(0) + "K"
          : volRaw.toString();

      message += `${ticker} | ${price} | ${change.padStart(5)} | ${volStr.padStart(4)}\n`;
    });
    message += "```\n\n";

    // Add interactive commands for each ticker
    message += "*Interactive Chart:*\n";
    results.forEach(res => {
      message += `/chart\\_${escapeMarkdown(res.ticker)} `;
    });

    message += `\n\n_Bypass: ${isTest}_`;

    // Internal escape function for this route
    function escapeMarkdown(text: string): string {
      return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
    }

    await fetch(`https://api.telegram.org/bot${settings.watchlistAlertBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: settings.watchlistAlertChatId,
        message_thread_id: settings.watchlistAlertThreadId,
        text: message,
        parse_mode: "MarkdownV2", // Using V2 for better underscore support
      }),
    });


    return NextResponse.json({
      success: true,
      alertedCount: results.length,
      data: results
    });

  } catch (error: any) {
    console.error("Watchlist Alert Cron Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
