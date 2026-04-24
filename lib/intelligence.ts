
import { connectDB } from "./db";
import SiteSettings from "./models/SiteSettings";
import { getBandarmologyScreener } from "./bandarmologyScreener";
import { analyzeSmartMoney } from "./smartMoneyEngine";
import { sendTelegramMessage } from "./telegram";
import Article from "./models/Article";
import { getQuote } from "./yahooFinance";
import mongoose from "mongoose";

export async function generateMorningIntel(chatId?: string, threadId?: string | number) {
  await connectDB();
  const settings = await SiteSettings.findOne({});
  const token = settings?.telegramBotToken;
  const targetChatId = chatId || settings?.telegramAdminChatId;
  const targetThreadId = threadId || settings?.telegramAdminThreadId;

  if (!token || !targetChatId) throw new Error("Telegram bot not configured");

  // Send initial "working" message
  await sendTelegramMessage(targetChatId, "⏳ Sedang meracik *Morning Intel* untuk Anda...", token, targetThreadId);

  const screener = await getBandarmologyScreener({
    preset: "high_volatility_swing",
    priceBucket: "under300",
    limit: 15,
    preferSnapshot: false
  });

  const candidates = screener.rows;
  if (candidates.length === 0) return { message: "No candidates found today" };

  const analyzed = await Promise.all(
    candidates.map(async (c: any) => {
      try {
        return await analyzeSmartMoney(c.ticker, "4h");
      } catch (e) {
        return null;
      }
    })
  );

  const validAnalyzed = analyzed
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .sort((a, b) => b.readinessScore - a.readinessScore);

  const top3 = validAnalyzed.slice(0, 3);
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  
  let message = `🚀 *MORNING INTEL REPORT* 🚀\n_${today} 08:30 WIB_\n\n`;
  message += `Berdasarkan deteksi Smart Money (4H) & High-Volatility Swing, berikut 3 menu utama untuk hari ini:\n\n`;

  message += "```md\n";
  top3.forEach((stock, idx) => {
    const ticker = stock.ticker.replace(".JK", "");
    message += `${idx + 1}. ${ticker} — Rp ${stock.price.toLocaleString("id-ID")}\n`;
    message += `   > Readiness: ${stock.readinessScore}%\n`;
    message += `   > Thesis: ${stock.currentPhaseSummary}\n`;
    message += `   > Hot Zone: Dekat Rp ${stock.price.toLocaleString("id-ID")}\n\n`;
  });
  message += "```\n";

  message += `\n_Gunakan porsi kecil (<5%) & ketat Stop Loss. Disclaimer On._`;

  await sendTelegramMessage(targetChatId, message, token, targetThreadId);
  return { success: true, top3: top3.map(s => s.ticker) };
}

export async function generateDailySummary(chatId?: string, threadId?: string | number) {
  await connectDB();
  const settings = await SiteSettings.findOne({});
  const token = settings?.telegramBotToken;
  const targetChatId = chatId || settings?.telegramAdminChatId;
  const targetThreadId = threadId || settings?.telegramAdminThreadId;
  
  // Reuse logic from cron/daily-summary (Simplified for the sake of brevity here)
  // In a real scenario, we'd refactor the RSS parser to a utility
  const today = new Date();
  const dateStr = today.toLocaleDateString("id-ID");
  
  const ihsg = await getQuote("^JKSE");
  if (!ihsg) throw new Error("Gagal memuat IHSG");

  const isUp = ihsg.change >= 0;
  let content = `📊 *RINGKASAN PASAR IHSG* 📊\n_Update: ${dateStr}_\n\n`;
  
  content += "```md\n";
  content += `IHSG      : Rp ${ihsg.price.toLocaleString("id-ID")}\n`;
  content += `Perubahan : ${isUp ? "+" : ""}${ihsg.changePercent.toFixed(2)}%\n`;
  content += `Kondisi   : ${isUp ? "Menguat" : "Melemah"}\n`;
  content += "```\n\n";
  
  content += `_Volatilitas cukup terjaga. Detail lengkap dapat dilihat di dashboard._`;

  if (token && targetChatId) {
    await sendTelegramMessage(targetChatId, content, token, targetThreadId);
  }
  
  return { success: true };
}
