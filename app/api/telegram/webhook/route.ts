import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SiteSettings from "@/lib/models/SiteSettings";
import { getQuote, getQuotes, getHistory } from "@/lib/yahooFinance";
import IndonesiaStock from "@/lib/models/IndonesiaStock";
import { takeChartScreenshot } from "@/lib/chartScreenshot";
import { generateMorningIntel, generateDailySummary } from "@/lib/intelligence";
import mongoose from "mongoose";

// Schema sederhana untuk deduplikasi Telegram
const TelegramUpdateSchema = new mongoose.Schema({
  updateId: { type: Number, unique: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Hapus otomatis setelah 24 jam
});
const TelegramUpdate = mongoose.models.TelegramUpdate || mongoose.model("TelegramUpdate", TelegramUpdateSchema);

// In-memory deduplication (Cepat & Anti Race-Condition untuk Single Instance)
const recentUpdates = new Set<number>();
const recentMessages = new Set<string>();

async function sendTelegramMessage(chatId: number, text: string, token: string, threadId?: number) {
  console.log(`[BOT] Message to ${chatId} (thread ${threadId}): ${text.substring(0, 30)}...`);
  return await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_thread_id: threadId,
      text: text,
      parse_mode: "Markdown", 
    }),
  });
}

async function sendTelegramPhoto(chatId: number, photoUrl: string, caption: string, token: string, threadId?: number) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_thread_id: threadId,
      photo: photoUrl,
      caption: caption,
      parse_mode: "Markdown",
    }),
  });
  if (!res.ok) await sendTelegramMessage(chatId, caption, token, threadId);
  return res;
}

function formatStockTable(stocks: any[]): string {
  let table = "```\nTicker | Price | % Chg\n-------|-------|-------\n";
  stocks.forEach(s => {
    const ticker = (s.ticker || "").padEnd(6);
    const price = s.price.toString().padStart(5);
    const change = (s.changePercent > 0 ? "+" : "") + s.changePercent.toFixed(2) + "%";
    table += `${ticker} | ${price} | ${change.padStart(6)}\n`;
  });
  return table + "```";
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const updateId = update.update_id;
    const message = update.message || update.channel_post;

    if (!message || !message.text) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const messageId = message.message_id;
    const messageKey = `${chatId}_${messageId}`;

    // 1. MEMORY DEDUPLICATION (Sangat Cepat & Anti Race-Condition untuk Single Instance Server)
    // Jika 2 bot di grup yg sama forward pesan yg sama, updateId beda tapi messageKey (chatId_messageId) sama.
    if (recentUpdates.has(updateId) || recentMessages.has(messageKey)) {
      console.log(`[BOT] Duplicate Update/Message in memory: ${updateId} / ${messageKey}. Ignoring.`);
      return NextResponse.json({ ok: true });
    }
    
    // Simpan ke memory
    recentUpdates.add(updateId);
    recentMessages.add(messageKey);

    // Cleanup LRU cache manual agar memori tidak bocor (Simpan maks 1000 ID)
    if (recentUpdates.size > 1000) recentUpdates.delete(recentUpdates.keys().next().value!);
    if (recentMessages.size > 1000) recentMessages.delete(recentMessages.keys().next().value!);

    // 2. MONGODB DEDUPLICATION (Sebagai backup & konsistensi data)
    await connectDB();
    try {
      // Gunakan findOneAndUpdate untuk pengecekan lebih ketat
      const dup = await TelegramUpdate.findOneAndUpdate(
        { updateId },
        { $setOnInsert: { updateId } },
        { upsert: true, new: false }
      );
      if (dup) {
        console.log(`[BOT] Duplicate Update ID di DB: ${updateId}. Ignoring.`);
        return NextResponse.json({ ok: true });
      }
    } catch (e: any) {
       console.error(`[BOT] DB Deduplication Error:`, e.message);
       // Jika DB gagal, kita tetap proses (krn memory deduplication sudah berhasil)
    }

    const threadId = message.message_thread_id;
    let text = message.text.trim().toUpperCase();
    if (text.includes("@")) text = text.split("@")[0];

    // 2. RESPON SECEPATNYA (STOP TELEGRAM RETRY)
    const response = NextResponse.json({ ok: true });

    // 3. BACKGROUND PROCESS (Dibuat lebih bersih)
    (async () => {
      try {
        const settings = await SiteSettings.findOne({});
        const token = settings?.telegramBotToken || settings?.watchlistAlertBotToken;
        if (!token) return;

        if (text.startsWith("/START") || text.startsWith("/HELP")) {
          const welcome = `Selamat datang di *Cerita Saham Bot*!\n\nPerintah tersedia:\n• Tulis Kode Saham (misal: \`COAL\` atau \`BUMI 1H\`) - Info detail & intraday\n• /intel - Laporan Morning Intel\n• /chart TICKER - Screenshot Chart\n• /watchlist - Status Watchlist\n• /summary - Ringkasan IHSG\n• /my_id - Cek Chat ID`;
          await sendTelegramMessage(chatId, welcome, token, threadId);
        } 
        else if (text === "/MY_ID") {
          await sendTelegramMessage(chatId, `ID Chat: \`${chatId}\`${threadId ? ` (Thread: \`${threadId}\`)` : ""}`, token, threadId);
        }
        else if (text === "/WATCHLIST") {
          await sendTelegramMessage(chatId, "⏳ Memeriksa watchlist...", token, threadId);
          const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
          const protocol = forwardedHost?.includes("localhost") ? "http" : "https";
          const res = await fetch(`${protocol}://${forwardedHost}/api/cron/watchlist-alert?test=true`, {
            headers: { "Authorization": `Bearer ${process.env.CRON_SECRET}` }
          });
          const data = await res.json();
          if (data.success && data.alertedCount > 0) {
            let msg = `🔔 *HASIL SCAN WATCHLIST* 🔔\n\n`;
            data.data.forEach((res: any) => { msg += `${res.change >= 0 ? "📈" : "📉"} *${res.ticker}* (${res.price})\nSinyal: _${res.detail}_\n\n`; });
            await sendTelegramMessage(chatId, msg, token, threadId);
          } else {
            await sendTelegramMessage(chatId, `ℹ️ ${data.message || "Belum ada data."}`, token, threadId);
          }
        }
        else if (text === "/INTEL") {
          await generateMorningIntel(chatId.toString(), threadId);
        }
        else if (text.startsWith("/INTEL ") || text.startsWith("/CHART ") || /^[A-Z]{4,5}(\s+(1M|5M|15M|1H|4H|1D|1WK|1MO))?$/.test(text)) {
          let rawTicker = text.startsWith("/INTEL ") ? text.replace("/INTEL ", "").trim() : (text.startsWith("/CHART ") ? text.replace("/CHART ", "").trim() : text);
          let ticker = rawTicker;
          let interval = "1d";

          const parts = rawTicker.split(/\s+/);
          if (parts.length > 1) {
            ticker = parts[0];
            const possibleInterval = parts[1].toLowerCase();
            if (["1m", "5m", "15m", "1h", "4h", "1d", "1wk", "1mo"].includes(possibleInterval)) {
              interval = possibleInterval;
            }
          }

          if (!ticker) return;

          await sendTelegramMessage(chatId, `⏳ Menyiapkan data *${ticker}*...`, token, threadId);
          const tickerJK = ticker.endsWith(".JK") ? ticker : `${ticker}.JK`;
          const quote = await getQuote(tickerJK);
          if (!quote) {
            await sendTelegramMessage(chatId, `❌ Saham *${ticker}* tidak ditemukan.`, token, threadId);
            return;
          }

          const today = new Date().toISOString().split("T")[0];
          let history = await getHistory(tickerJK, today, undefined, "1m");
          if (!history || history.length === 0) {
            console.log(`[BOT] No 1m history for ${ticker}, falling back to 5m...`);
            history = await getHistory(tickerJK, today, undefined, "5m");
          }

          const highRecs: string[] = [], lowRecs: string[] = [];
          if (history.length > 0) {
            let curH = -Infinity, curL = Infinity;
            history.forEach((h: any) => {
              const t = new Date(h.time * 1000).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(/\./g, ":");
              if (h.high > curH) { curH = h.high; highRecs.push(`${h.high} at ${t}`); }
              if (h.low < curL) { curL = h.low; lowRecs.push(`${h.low} at ${t}`); }
            });
          }

          const datePart = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short" });
          const timePart = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(/\./g, ".");
          
          let msg = `*Stock: ${ticker}*\n`;
          msg += `Name: ${quote.name}\n`;
          msg += `Time: ${datePart} ${timePart}\n`;
          msg += `\`\`\`md\n`;
          msg += `──────────────────────\n`;
          msg += `Open : ${quote.open}\n`;
          msg += `High : ${quote.high}\n`;
          msg += `Low  : ${quote.low}\n`;
          msg += `Prev : ${quote.previousClose}\n`;
          msg += `Now  : ${quote.price}\n`;
          msg += `Chg% : ${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%\n`;
          msg += `──────────────────────\n`;
          
          if (highRecs.length > 0) {
            msg += `# High Records (WIB):\n`;
            highRecs.slice(-5).forEach(r => msg += `• ${r}\n`);
            msg += `──────────────────────\n`;
          }
          if (lowRecs.length > 0) {
            msg += `# Low Records (WIB):\n`;
            lowRecs.slice(-5).forEach(r => msg += `• ${r}\n`);
            msg += `──────────────────────\n`;
          }
          msg += `\`\`\``;

          const photoUrl = await takeChartScreenshot(ticker, interval);
          if (photoUrl) await sendTelegramPhoto(chatId, photoUrl, msg, token, threadId);
          else await sendTelegramMessage(chatId, msg, token, threadId);
        }
        else if (text === "/SUMMARY") {
          await generateDailySummary(chatId.toString(), threadId);
        }
      } catch (err) {
        console.error("[BOT] BG Error:", err);
      }
    })();

    return response;
  } catch (error) {
    console.error("[BOT] Webhook Root Error:", error);
    return NextResponse.json({ ok: true }); 
  }
}
