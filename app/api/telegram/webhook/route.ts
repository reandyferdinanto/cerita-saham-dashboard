import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SiteSettings from "@/lib/models/SiteSettings";
import { getQuote, getQuotes, getHistory } from "@/lib/yahooFinance";
import IndonesiaStock from "@/lib/models/IndonesiaStock";
import { generateStockChartImageUrl } from "@/lib/chartGenerator";

import { generateMorningIntel, generateDailySummary } from "@/lib/intelligence";

async function sendTelegramMessage(chatId: number, text: string, token: string) {
  console.log(`Sending message to ${chatId}: ${text.substring(0, 50).replace(/\n/g, " ")}...`);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown", // Switched to Markdown for simpler formatting compatibility
    }),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    console.error("Telegram API Error:", JSON.stringify(errorData));
  } else {
    console.log("Telegram Message sent successfully");
  }
  return res;
}

async function sendTelegramPhoto(chatId: number, photoUrl: string, caption: string, token: string) {
  console.log(`Sending photo to ${chatId} with caption: ${caption.substring(0, 50)}...`);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption: caption,
      parse_mode: "MarkdownV2",
    }),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    console.error("Telegram Photo API Error:", JSON.stringify(errorData));
    // Fallback: if photo fails, send message
    await sendTelegramMessage(chatId, caption, token);
  } else {
    console.log("Telegram Photo sent successfully");
  }
  return res;
}

// Function to escape markdown characters for Telegram MarkdownV2
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

function formatStockTable(stocks: any[]): string {
  // ASCII Table formatting
  let table = "```\n";
  table += "Ticker | Price | % Chg\n";
  table += "-------|-------|-------\n";
  
  stocks.forEach(s => {
    const ticker = (s.ticker || "").padEnd(6);
    const price = s.price.toString().padStart(5);
    const change = (s.changePercent > 0 ? "+" : "") + s.changePercent.toFixed(2) + "%";
    table += `${ticker} | ${price} | ${change.padStart(6)}\n`;
  });
  
  table += "```";
  return table;
}

function formatDetailTable(q: any, highRecords: any[] = [], lowRecords: any[] = []): string {
  let table = "```\n";
  table += `Stock: ${q.ticker.replace(".JK", "")}\n`;
  table += `Name : ${q.name.substring(0, 15)}\n`;
  if (q.updatedAt) {
    const d = new Date(q.updatedAt);
    const timeStr = d.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ".");
    const dateStr = d.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short" });
    table += `Time : ${dateStr} ${timeStr}\n`;
  }
  table += "----------------------\n";
  table += `Open : ${q.open.toString().padEnd(10)}\n`;
  table += `High : ${q.high.toString().padEnd(10)}\n`;
  table += `Low  : ${q.low.toString().padEnd(10)}\n`;
  table += `Prev : ${q.previousClose.toString().padEnd(10)}\n`;
  table += `Now  : ${q.price.toString().padEnd(10)}\n`;
  table += `Chg% : ${(q.changePercent > 0 ? "+" : "") + q.changePercent.toFixed(2)}%\n`;
  table += "----------------------\n";
  
  if (highRecords.length > 0) {
    table += "High Records (WIB):\n";
    highRecords.forEach(r => {
      table += `- ${r.price} at ${r.time}\n`;
    });
    table += "----------------------\n";
  }
  
  if (lowRecords.length > 0) {
    table += "Low Records (WIB):\n";
    lowRecords.forEach(r => {
      table += `- ${r.price} at ${r.time}\n`;
    });
    table += "----------------------\n";
  }
  
  table += "```";
  return table;
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    console.log("Telegram Update Received:", JSON.stringify(update));
    const message = update.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim().toUpperCase();
    console.log(`Processing command: ${text} from chatId: ${chatId}`);

    await connectDB();
    const settings = await SiteSettings.findOne({});
    const token = settings?.telegramBotToken;

    if (!token) {
      console.error("No telegram bot token found in settings");
      return NextResponse.json({ ok: true });
    }

    if (text === "/START" || text === "/HELP") {
      const welcome = `Selamat datang di *Cerita Saham Bot*!
      
Perintah tersedia:
• /intel - Laporan Morning Intel (3 Saham Pilihan)
• /summary - Ringkasan Penutupan IHSG
• /gainers - Top 10 Gainer Hari Ini
• /losers - Top 10 Loser Hari Ini
• Kode Saham (misal: BBCA) - Detail & Chart Daily
• Kode Saham + Timeframe (misal: BBCA 1h) - Chart timeframe tertentu (5m, 15m, 1h, 4h).`;
      await sendTelegramMessage(chatId, welcome, token);
    } 
    else if (text === "/INTEL") {
      await sendTelegramMessage(chatId, "⏳ Sedang meracik *Morning Intel* untuk Anda...", token);
      try {
        await generateMorningIntel(chatId.toString());
      } catch (e) {
        await sendTelegramMessage(chatId, "❌ Gagal mengaktifkan Morning Intel. Pastikan data sudah tersedia.", token);
      }
    }
    else if (text === "/SUMMARY") {
      await sendTelegramMessage(chatId, "⏳ Sedang menyiapkan *Daily Summary*...", token);
      try {
        await generateDailySummary(chatId.toString());
      } catch (e) {
        await sendTelegramMessage(chatId, "❌ Gagal mengambil ringkasan pasar.", token);
      }
    }
    else if (text === "/GAINERS") {
      await sendTelegramMessage(chatId, "Sedang mengambil data Top Gainers \\(Seluruh IDX\\)...", token);
      
      const allStocks = await IndonesiaStock.find({ active: true }).select("ticker").lean();
      const tickers = allStocks.map(s => s.ticker);
      console.log(`Fetching quotes for ${tickers.length} stocks...`);
      const quotes = await getQuotes(tickers);
      console.log(`Fetched ${quotes.length} quotes.`);
      
      const gainers = quotes
        .filter((q) => Boolean(q && q.changePercent !== undefined && q.price > 0))
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 10)
        .map(q => ({
          ticker: q.ticker.replace(".JK", ""),
          price: q.price,
          changePercent: q.changePercent
        }));

      const response = "*Top 10 Gainers IDX \\(Realtime\\):*\n" + formatStockTable(gainers);
      await sendTelegramMessage(chatId, response, token);
    }
    else if (text === "/LOSERS") {
      await sendTelegramMessage(chatId, "Sedang mengambil data Top Losers \\(Seluruh IDX\\)...", token);
      
      const allStocks = await IndonesiaStock.find({ active: true }).select("ticker").lean();
      const tickers = allStocks.map(s => s.ticker);
      console.log(`Fetching quotes for ${tickers.length} stocks...`);
      const quotes = await getQuotes(tickers);
      console.log(`Fetched ${quotes.length} quotes.`);
      
      const losers = quotes
        .filter((q) => Boolean(q && q.changePercent !== undefined && q.price > 0))
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, 10)
        .map(q => ({
          ticker: q.ticker.replace(".JK", ""),
          price: q.price,
          changePercent: q.changePercent
        }));

      const response = "*Top 10 Losers IDX \\(Realtime\\):*\n" + formatStockTable(losers);
      await sendTelegramMessage(chatId, response, token);
    }
    else {
      // Assume it's a ticker or ticker + interval, handle if user typed "/BBCA 1h" or "BBCA 15m"
      const parts = text.split(" ");
      const rawTicker = parts[0].startsWith("/") ? parts[0].substring(1) : parts[0];
      const ticker = rawTicker.endsWith(".JK") ? rawTicker : rawTicker + ".JK";
      
      // Parse interval: 5M, 15M, 30M, 1H, 4H, 1D
      let interval: any = (parts[1] || "1D").toLowerCase();
      // Map common human inputs to Yahoo-compatible intervals
      if (interval === "30m") interval = "15m"; // Yahoo doesn't support 30m natively, use 15m
      
      const validIntervals = ["5m", "15m", "1h", "4h", "1d", "1wk", "1mo"];
      if (!validIntervals.includes(interval)) {
        interval = "1d";
      }

      console.log(`Searching for ticker: ${ticker} with interval: ${interval}`);
      const quote = await getQuote(ticker);
      
      if (quote && quote.price > 0) {
        // Fetch history for chart
        const now = new Date();
        const start = new Date();
        
        // Adjust start date based on interval to keep chart readable and within Yahoo's intraday limits
        if (interval === "5m") {
          start.setDate(now.getDate() - 2); // 2 days of 5m bars
        } else if (interval === "15m") {
          start.setDate(now.getDate() - 5); // 5 days of 15m bars
        } else if (interval === "1h" || interval === "4h") {
          start.setDate(now.getDate() - 30); // 30 days of 1h/4h bars for better TA warm-up
        } else {
          start.setDate(now.getDate() - 120); // 4 months for daily
        }

        let history = await getHistory(ticker, start.toISOString().split("T")[0], undefined, interval);
        
        let highRecords: any[] = [];
        let lowRecords: any[] = [];

        // NEW: Fetch intraday 1m to find high/low records for Daily timeframe
        if (interval === "1d") {
          // Get today's date in Jakarta timezone for query
          const todayJakarta = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
          const todayStr = todayJakarta;
          
          console.log(`Fetching intraday 1m for ${ticker} on ${todayStr}`);
          const intraday = await getHistory(ticker, todayStr, undefined, "1m");
          console.log(`Intraday bars fetched: ${intraday.length}`);
          if (intraday.length > 0) {
            let sessionHigh = -1;
            let sessionLow = Infinity;
            
            intraday.forEach((bar: any, idx: number) => {
              const d = new Date(typeof bar.time === "number" ? bar.time * 1000 : bar.time);
              
              // Ensure we only process bars from TODAY in Jakarta time
              const barDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);
              if (barDateStr !== todayStr) return;

              // Get hour/min in Jakarta time
              const hourStr = d.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false });
              const hour = parseInt(hourStr);
              const timeStr = d.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ".");
              
              // Only record between 09:00 and 16:00 WIB
              if (hour >= 9 && hour < 16) {
                if (bar.high > sessionHigh) {
                  sessionHigh = bar.high;
                  highRecords.push({ price: bar.high, time: timeStr });
                }
                if (bar.low < sessionLow) {
                  sessionLow = bar.low;
                  lowRecords.push({ price: bar.low, time: timeStr });
                }
              }
            });
            console.log(`High Records: ${highRecords.length}, Low Records: ${lowRecords.length}`);
          }

          const lastHistoryBar = history[history.length - 1];
          if (!lastHistoryBar || lastHistoryBar.time !== todayStr) {
            history.push({
              time: todayStr,
              open: quote.open || quote.price,
              high: Math.max(quote.high || quote.price, quote.price),
              low: Math.min(quote.low || quote.price, quote.price),
              close: quote.price,
              volume: quote.volume || 0
            });
          } else {
            lastHistoryBar.close = quote.price;
            lastHistoryBar.high = Math.max(lastHistoryBar.high, quote.price);
            lastHistoryBar.low = Math.min(lastHistoryBar.low, quote.price);
          }
        }

        let chartUrl = "";
        if (history && history.length > 5) {
          chartUrl = await generateStockChartImageUrl(quote.ticker.replace(".JK", ""), history, interval);
        }

        const intervalLabel = interval === "1d" ? "Daily" : interval.toUpperCase();
        const caption = `*Detail Saham ${escapeMarkdown(quote.ticker.replace(".JK", ""))} \\(${intervalLabel}\\):*\n` + formatDetailTable(quote, highRecords, lowRecords);
        
        if (chartUrl) {
          await sendTelegramPhoto(chatId, chartUrl, caption, token);
        } else {
          await sendTelegramMessage(chatId, caption, token);
        }
      } else {
        // If not found, ignore or send error (better ignore unless it was a command)
        if (text.startsWith("/")) {
          await sendTelegramMessage(chatId, "Perintah tidak dikenal\\.", token);
        } else if (text.length >= 4 && text.length <= 5) {
            // Probably a failed ticker search
            await sendTelegramMessage(chatId, `Data saham ${escapeMarkdown(rawTicker)} tidak ditemukan\\.`, token);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}
