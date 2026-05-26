import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getQuote, getHistory } from "@/lib/yahooFinance";
import { takeChartScreenshot } from "@/lib/chartScreenshot";
import mongoose from "mongoose";
import { getTelegramSettings } from "@/lib/data/telegramSettings";
import { getDatabaseMode } from "@/lib/data/provider";
import { queryPostgres } from "@/lib/postgres";
import { buildPreVolumeAccumulation, PreVolumeAccumulation } from "@/lib/preVolumeAccumulation";
import fs from "fs/promises";
import path from "path";

// Schema sederhana untuk deduplikasi Telegram
const TelegramUpdateSchema = new mongoose.Schema({
  updateId: { type: Number, unique: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Hapus otomatis setelah 24 jam
});
const TelegramUpdate = mongoose.models.TelegramUpdate || mongoose.model("TelegramUpdate", TelegramUpdateSchema);

// In-memory deduplication (Cepat & Anti Race-Condition untuk Single Instance)
const recentUpdates = new Set<number>();
const recentMessages = new Set<string>();

type TelegramBar = {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type TelegramQuote = NonNullable<Awaited<ReturnType<typeof getQuote>>>;

type SpikeConclusion = {
  bias: string;
  score: number;
  maxScore: number;
  outlook: {
    label: string;
    note: string;
    goodWithUpside: boolean;
  };
  reasons: string[];
  risks: string[];
  levels: string[];
  stats: {
    prevDayHigh: number | null;
    prevDayLow: number | null;
    rangeRatio: number | null;
    volumeRatio: number | null;
    closePosition: number | null;
  };
};

const MAX_TELEGRAM_CODE_BODY = 3900;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fmtPrice(value: number | null | undefined) {
  if (!isFiniteNumber(value)) return "-";
  return Math.round(value).toLocaleString("id-ID");
}

function fmtRatio(value: number | null | undefined) {
  if (!isFiniteNumber(value)) return "-";
  return `${value.toFixed(1)}x`;
}

function avg(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getJakartaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : date.toISOString().split("T")[0];
}

function getBarDateJakarta(time: TelegramBar["time"]) {
  const date = typeof time === "number" ? new Date(time * 1000) : new Date(time);
  return Number.isNaN(date.getTime()) ? "" : getJakartaDate(date);
}

function formatBarTimeWIB(time: TelegramBar["time"]) {
  const date = typeof time === "number" ? new Date(time * 1000) : new Date(time);
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).replace(/\./g, ":");
}

function cleanBars(history: TelegramBar[]) {
  return history.filter((bar) =>
    isFiniteNumber(bar.high) &&
    isFiniteNumber(bar.low) &&
    isFiniteNumber(bar.close) &&
    bar.high > 0 &&
    bar.low > 0
  );
}

function buildSpikeConclusion(
  quote: TelegramQuote,
  intradayHistory: TelegramBar[],
  dailyHistory: TelegramBar[],
): SpikeConclusion {
  const today = getJakartaDate();
  const intraday = cleanBars(intradayHistory).filter((bar) => getBarDateJakarta(bar.time) === today);
  const daily = cleanBars(dailyHistory);
  const previousDaily = daily.filter((bar) => String(bar.time).slice(0, 10) < today).slice(-20);
  const lastDaily = previousDaily[previousDaily.length - 1] ?? null;
  const lastIntraday = intraday[intraday.length - 1] ?? null;

  const price = quote.price || lastIntraday?.close || 0;
  const sessionHigh = Math.max(
    quote.high || 0,
    ...intraday.map((bar) => bar.high),
  );
  const sessionLowCandidates = [
    quote.low || 0,
    ...intraday.map((bar) => bar.low),
  ].filter((value) => value > 0);
  const sessionLow = sessionLowCandidates.length > 0 ? Math.min(...sessionLowCandidates) : 0;
  const currentRange = sessionHigh > sessionLow ? sessionHigh - sessionLow : 0;

  const prevDayHigh = lastDaily?.high ?? null;
  const prevDayLow = lastDaily?.low ?? null;
  const rollingHigh20 = previousDaily.length > 0 ? Math.max(...previousDaily.map((bar) => bar.high)) : null;
  const avgDailyRange = avg(previousDaily.map((bar) => bar.high - bar.low).filter((value) => value > 0));
  const avgDailyVolume = avg(
    previousDaily
      .map((bar) => bar.volume ?? 0)
      .filter((value) => value > 0)
  );

  const rangeRatio = avgDailyRange && currentRange > 0 ? currentRange / avgDailyRange : null;
  const volumeRatio = avgDailyVolume && quote.volume > 0 ? quote.volume / avgDailyVolume : null;
  const closePosition = currentRange > 0 ? ((price - sessionLow) / currentRange) * 100 : null;
  const upperWickPct = currentRange > 0 ? ((sessionHigh - price) / currentRange) * 100 : 0;

  const brokePrevHigh = prevDayHigh !== null && price > prevDayHigh;
  const touchedPrevHigh = prevDayHigh !== null && sessionHigh > prevDayHigh;
  const rejectedPrevHigh = touchedPrevHigh && !brokePrevHigh && upperWickPct >= 30;
  const brokeRollingHigh = rollingHigh20 !== null && price > rollingHigh20;
  const volumeStrong = volumeRatio !== null && volumeRatio >= 1.5;
  const volumeSoft = volumeRatio !== null && volumeRatio < 0.8;
  const rangeExpanded = rangeRatio !== null && rangeRatio >= 1.4;
  const closeNearHigh = closePosition !== null && closePosition >= 70;
  const lowHeld = prevDayLow !== null && sessionLow > prevDayLow;

  let score = 0;
  const reasons: string[] = [];
  const risks: string[] = [];

  if (brokePrevHigh) {
    score += 2;
    reasons.push(`Harga bertahan di atas prev high ${fmtPrice(prevDayHigh)}`);
  } else if (touchedPrevHigh) {
    score += 1;
    reasons.push(`High sempat menembus prev high ${fmtPrice(prevDayHigh)}`);
  }

  if (brokeRollingHigh) {
    score += 2;
    reasons.push(`Menembus high 20 hari ${fmtPrice(rollingHigh20)}`);
  }

  if (volumeStrong) {
    score += 2;
    reasons.push(`Volume ${fmtRatio(volumeRatio)} rata-rata 20D`);
  } else if (volumeRatio !== null && volumeRatio >= 1.1) {
    score += 1;
    reasons.push(`Volume mulai aktif ${fmtRatio(volumeRatio)} 20D`);
  } else if (volumeSoft) {
    score -= 1;
    risks.push(`Volume masih ringan ${fmtRatio(volumeRatio)} 20D`);
  }

  if (closeNearHigh) {
    score += 1;
    reasons.push(`Harga dekat high intraday (${Math.round(closePosition)}% range)`);
  } else if (closePosition !== null && closePosition < 45) {
    score -= 1;
    risks.push(`Harga turun ke ${Math.round(closePosition)}% range`);
  }

  if (rangeExpanded) {
    score += 1;
    reasons.push(`Range melebar ${fmtRatio(rangeRatio)} normal`);
  }

  if (lowHeld) {
    score += 1;
    reasons.push(`Low masih di atas low sebelumnya ${fmtPrice(prevDayLow)}`);
  }

  if (rejectedPrevHigh) {
    score -= 2;
    risks.push(`Break prev high belum bertahan`);
  }

  if (upperWickPct >= 35) {
    score -= 1;
    risks.push(`Ada rejection dari high (${Math.round(upperWickPct)}% range)`);
  }

  if (quote.previousClose > 0 && price < quote.previousClose) {
    score -= 1;
    risks.push(`Harga masih di bawah prev close ${fmtPrice(quote.previousClose)}`);
  }

  const bias =
    score >= 5
      ? "Markup menguat"
      : score >= 3
        ? "Markup awal, tunggu konfirmasi"
        : score >= 1
          ? "Netral / rawan sideways"
          : "Spike lemah / sideways";

  const goodWithUpside =
    score >= 4 &&
    (volumeStrong || brokePrevHigh || brokeRollingHigh) &&
    (closeNearHigh || brokePrevHigh || brokeRollingHigh) &&
    !rejectedPrevHigh &&
    upperWickPct < 35 &&
    !(quote.previousClose > 0 && price < quote.previousClose);

  const outlook = goodWithUpside
    ? {
        label: "Bagus, ada potensi naik lanjutan",
        note: prevDayHigh !== null
          ? `valid selama harga bertahan di atas ${fmtPrice(prevDayHigh)} dan volume tidak mengering`
          : "valid selama close tetap dekat high dan volume tidak mengering",
        goodWithUpside: true,
      }
    : score >= 3
      ? {
          label: "Cukup bagus, tunggu konfirmasi",
          note: "potensi ada, tapi perlu close kuat dan volume lanjutan",
          goodWithUpside: false,
        }
      : {
          label: "Belum cukup kuat",
          note: "lebih aman tunggu breakout/volume yang lebih jelas",
          goodWithUpside: false,
        };

  const levels = [
    prevDayHigh !== null ? `Valid jika tahan > ${fmtPrice(prevDayHigh)}` : "",
    prevDayLow !== null ? `Waspada jika turun < ${fmtPrice(prevDayLow)}` : "",
  ].filter(Boolean);

  return {
    bias,
    score,
    maxScore: 9,
    outlook,
    reasons: reasons.slice(0, 3),
    risks: risks.slice(0, 2),
    levels,
    stats: {
      prevDayHigh,
      prevDayLow,
      rangeRatio,
      volumeRatio,
      closePosition,
    },
  };
}

function appendSpikeConclusion(msg: string, conclusion: SpikeConclusion) {
  msg += `# Kesimpulan:\n`;
  msg += `Bias : ${conclusion.bias}\n`;
  msg += `Score: ${conclusion.score}/${conclusion.maxScore}\n`;
  msg += `Potensi: ${conclusion.outlook.label}\n`;
  msg += `Catatan: ${conclusion.outlook.note}\n`;
  msg += `PDH  : ${fmtPrice(conclusion.stats.prevDayHigh)}\n`;
  msg += `PDL  : ${fmtPrice(conclusion.stats.prevDayLow)}\n`;
  msg += `Range: ${fmtRatio(conclusion.stats.rangeRatio)} 20D\n`;
  msg += `Vol  : ${fmtRatio(conclusion.stats.volumeRatio)} 20D\n`;
  msg += `Pos  : ${isFiniteNumber(conclusion.stats.closePosition) ? `${Math.round(conclusion.stats.closePosition)}% range` : "-"}\n`;

  if (conclusion.reasons.length > 0) {
    msg += `Alasan:\n`;
    conclusion.reasons.forEach((reason) => { msg += `• ${reason}\n`; });
  }

  if (conclusion.risks.length > 0) {
    msg += `Risiko:\n`;
    conclusion.risks.forEach((risk) => { msg += `• ${risk}\n`; });
  }

  if (conclusion.levels.length > 0) {
    msg += `Level:\n`;
    conclusion.levels.forEach((level) => { msg += `• ${level}\n`; });
  }

  msg += `──────────────────────\n`;
  return msg;
}

function fmtPercent(value: number | null | undefined) {
  if (!isFiniteNumber(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatPreVolumeSetup(setupType: PreVolumeAccumulation["setupType"]) {
  if (setupType === "reversal") return "Reversal awal";
  if (setupType === "healthy-pullback") return "Pullback sehat";
  if (setupType === "continue-to-fly") return "Continue to fly";
  if (setupType === "base-breakout") return "Base breakout";
  return "Belum jelas";
}

function appendPreVolumeConclusion(msg: string, preVolume: PreVolumeAccumulation) {
  msg += `# Pra-Volume:\n`;
  msg += `Status: ${preVolume.status}\n`;
  msg += `Score : ${preVolume.score}/100\n`;
  msg += `Setup : ${formatPreVolumeSetup(preVolume.setupType)}\n`;
  msg += `Potensi: ${preVolume.label}\n`;
  msg += `Vol20: ${fmtRatio(preVolume.metrics.volumeRatio)} | Range20: ${fmtPercent(preVolume.metrics.rangeCompressionPct)}\n`;

  if (preVolume.reasons.length > 0) {
    msg += `Akumulasi:\n`;
    preVolume.reasons.slice(0, 3).forEach((reason) => { msg += `• ${reason}\n`; });
  }

  if (preVolume.risks.length > 0) {
    msg += `Risiko:\n`;
    preVolume.risks.slice(0, 2).forEach((risk) => { msg += `• ${risk}\n`; });
  }

  if (preVolume.triggers.length > 0) {
    msg += `Trigger:\n`;
    preVolume.triggers.slice(0, 3).forEach((trigger) => { msg += `• ${trigger}\n`; });
  }

  msg += `──────────────────────\n`;
  return msg;
}

function getEarlyValidTrigger(preVolume: PreVolumeAccumulation) {
  return preVolume.triggers.find((trigger) => trigger.startsWith("Valid awal")) || preVolume.triggers[1] || "-";
}

function getInvalidationTrigger(preVolume: PreVolumeAccumulation) {
  return preVolume.triggers.find((trigger) => trigger.startsWith("Batal")) || preVolume.triggers[preVolume.triggers.length - 1] || "-";
}

function summarizeConclusion(conclusion: SpikeConclusion) {
  if (conclusion.score >= 5) return "Bagus. Buyer sedang dominan dan peluang lanjut masih terbuka.";
  if (conclusion.score >= 3) return "Mulai menarik, tapi masih perlu konfirmasi.";
  if (conclusion.score >= 1) return "Netral. Belum ada dorongan yang benar-benar kuat.";
  return "Lemah. Lebih baik tunggu tanda buyer masuk lagi.";
}

function summarizeAction(conclusion: SpikeConclusion) {
  if (conclusion.outlook.goodWithUpside) return "Boleh pantau untuk continuation, tapi tetap tunggu harga bertahan di area valid.";
  if (conclusion.score >= 3) return "Masuk watchlist dulu. Jangan kejar kalau candle sudah terlalu jauh.";
  return "Tunggu setup baru. Fokus ke level validasi dan risiko bawah.";
}

function summarizePreVolume(preVolume: PreVolumeAccumulation) {
  if (preVolume.mode === "early") return "Ada tanda akumulasi sebelum volume ramai.";
  if (preVolume.mode === "watch") return "Mulai ada tanda dikumpulkan, tapi belum cukup kuat.";
  if (preVolume.mode === "active-volume") return "Volume sudah mulai ramai, jadi ini bukan fase paling awal.";
  return "Belum ada tanda akumulasi yang jelas.";
}

function explainPreVolumeSetup(preVolume: PreVolumeAccumulation) {
  if (preVolume.setupType === "reversal") return "Harga mencoba bangkit dari area bawah.";
  if (preVolume.setupType === "healthy-pullback") return "Koreksi masih terlihat sehat selama support tidak jebol.";
  if (preVolume.setupType === "continue-to-fly") return "Harga sudah dekat area lanjut naik; jangan kejar kalau muncul rejection.";
  if (preVolume.setupType === "base-breakout") return "Harga sedang bangun base dan butuh tembus range kecil dulu.";
  return "Arah belum bersih.";
}

function buildSimpleStockReport(
  ticker: string,
  quote: TelegramQuote,
  conclusion: SpikeConclusion,
  preVolume: PreVolumeAccumulation,
) {
  let msg = `Stock: ${ticker}\n`;
  msg += `Name : ${quote.name}\n`;
  msg += `Harga: ${fmtPrice(quote.price)} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)\n`;
  msg += `──────────────────────\n`;
  msg += `# Kesimpulan Singkat\n`;
  msg += `Kondisi: ${summarizeConclusion(conclusion)}\n`;
  msg += `Aksi   : ${summarizeAction(conclusion)}\n`;
  if (conclusion.reasons.length > 0) msg += `Alasan : ${conclusion.reasons[0]}\n`;
  if (conclusion.risks.length > 0) msg += `Waspada: ${conclusion.risks[0]}\n`;
  msg += `──────────────────────\n`;
  msg += `# Pra-Volume\n`;
  msg += `Status : ${summarizePreVolume(preVolume)}\n`;
  msg += `Tipe   : ${formatPreVolumeSetup(preVolume.setupType)}\n`;
  msg += `Makna  : ${explainPreVolumeSetup(preVolume)}\n`;
  msg += `Valid  : ${getEarlyValidTrigger(preVolume).replace("Valid awal jika ", "")}\n`;
  msg += `Batal  : ${getInvalidationTrigger(preVolume).replace("Batal jika ", "")}\n`;
  msg += `──────────────────────\n`;
  msg += `Detail lengkap: /analisa ${ticker}\n`;
  return buildTelegramCodeBlock(msg);
}

function buildDetailedStockReport(args: {
  ticker: string;
  quote: TelegramQuote;
  datePart: string;
  timePart: string;
  highRecs: string[];
  lowRecs: string[];
  conclusion: SpikeConclusion;
  preVolume: PreVolumeAccumulation;
}) {
  const { ticker, quote, datePart, timePart, highRecs, lowRecs, conclusion, preVolume } = args;
  let msg = `Stock: ${ticker}\n`;
  msg += `Name: ${quote.name}\n`;
  msg += `Time: ${datePart} ${timePart}\n`;
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
    highRecs.slice(-3).forEach(r => msg += `• ${r}\n`);
    msg += `──────────────────────\n`;
  }
  if (lowRecs.length > 0) {
    msg += `# Low Records (WIB):\n`;
    lowRecs.slice(-3).forEach(r => msg += `• ${r}\n`);
    msg += `──────────────────────\n`;
  }
  msg = appendSpikeConclusion(msg, conclusion);
  msg = appendPreVolumeConclusion(msg, preVolume);
  return buildTelegramCodeBlock(msg);
}

function buildTelegramCodeBlock(content: string) {
  const safeContent = content.replace(/```/g, "'''").trimEnd();
  const body = safeContent.length > MAX_TELEGRAM_CODE_BODY
    ? `${safeContent.slice(0, MAX_TELEGRAM_CODE_BODY - 20).trimEnd()}\n[terpotong]`
    : safeContent;
  return `\`\`\`md\n${body}\n\`\`\``;
}

function buildPreVolumeTextReport(ticker: string, quote: TelegramQuote, preVolume: PreVolumeAccumulation) {
  let msg = `Pra-Volume: ${ticker}\n`;
  msg += `Name: ${quote.name}\n`;
  msg += `Status: ${preVolume.status}\n`;
  msg += `Score : ${preVolume.score}/100\n`;
  msg += `Setup : ${formatPreVolumeSetup(preVolume.setupType)}\n`;
  msg += `Potensi: ${preVolume.label}\n`;
  msg += `Now   : ${fmtPrice(quote.price)} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)\n`;
  msg += `Vol20 : ${fmtRatio(preVolume.metrics.volumeRatio)}\n`;
  msg += `Range : ${fmtPercent(preVolume.metrics.rangeCompressionPct)} 20D\n`;
  msg += `Break : ${fmtPercent(preVolume.metrics.breakoutDistancePct)} ke high 20D\n`;
  msg += `Close : ${preVolume.metrics.closeNearHighDays}/10 hari dekat high\n`;
  msg += `──────────────────────\n`;

  if (preVolume.reasons.length > 0) {
    msg += `Akumulasi:\n`;
    preVolume.reasons.forEach((reason) => { msg += `• ${reason}\n`; });
  }

  if (preVolume.risks.length > 0) {
    msg += `Risiko:\n`;
    preVolume.risks.forEach((risk) => { msg += `• ${risk}\n`; });
  }

  if (preVolume.triggers.length > 0) {
    msg += `Trigger:\n`;
    preVolume.triggers.forEach((trigger) => { msg += `• ${trigger}\n`; });
  }

  return buildTelegramCodeBlock(msg);
}

async function rememberUpdate(updateId: number) {
  if (getDatabaseMode() === "postgres") {
    await queryPostgres(`
      create table if not exists telegram_updates (
        update_id bigint primary key,
        created_at timestamptz not null default now()
      )
    `);
    await queryPostgres(`delete from telegram_updates where created_at < now() - interval '1 day'`);
    const result = await queryPostgres(
      `insert into telegram_updates (update_id) values ($1) on conflict do nothing returning update_id`,
      [updateId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  await connectDB();
  const dup = await TelegramUpdate.findOneAndUpdate(
    { updateId },
    { $setOnInsert: { updateId } },
    { upsert: true, new: false }
  );
  return !dup;
}

async function sendTelegramMessage(chatId: number, text: string, token: string, threadId?: number, parseMode: "Markdown" | undefined = "Markdown") {
  console.log(`[BOT] Message to ${chatId} (thread ${threadId}): ${text.substring(0, 30)}...`);
  return await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_thread_id: threadId,
      text: text,
      ...(parseMode ? { parse_mode: parseMode } : {}),
    }),
  });
}

async function sendTelegramPhoto(chatId: number, photo: string, caption: string, token: string, threadId?: number, parseMode: "Markdown" | undefined = "Markdown") {
  let body: BodyInit;
  let headers: HeadersInit | undefined;

  if (/^https?:\/\//i.test(photo)) {
    headers = { "Content-Type": "application/json" };
    body = JSON.stringify({
      chat_id: chatId,
      message_thread_id: threadId,
      photo,
      caption,
      ...(parseMode ? { parse_mode: parseMode } : {}),
    });
  } else {
    const buffer = await fs.readFile(photo);
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (threadId) form.append("message_thread_id", String(threadId));
    form.append("caption", caption);
    if (parseMode) form.append("parse_mode", parseMode);
    form.append("photo", new Blob([new Uint8Array(buffer)], { type: "image/png" }), path.basename(photo));
    body = form;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers,
    body,
  });
  if (!res.ok) await sendTelegramMessage(chatId, caption, token, threadId, parseMode);
  return res;
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
    try {
      const inserted = await rememberUpdate(updateId);
      if (!inserted) {
        console.log(`[BOT] Duplicate Update ID di DB: ${updateId}. Ignoring.`);
        return NextResponse.json({ ok: true });
      }
    } catch (e: unknown) {
       const message = e instanceof Error ? e.message : String(e);
       console.error(`[BOT] DB Deduplication Error:`, message);
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
        const settings = await getTelegramSettings();
        const token = settings.telegramBotToken;
        if (!token) return;

        if (text.startsWith("/START") || text.startsWith("/HELP")) {
          const welcome = `Selamat datang di *Cerita Saham Bot*!\n\nPerintah tersedia:\n• Tulis kode saham, contoh: \`COAL\` atau \`BUMI 1H\` - ringkasan mudah dibaca\n• /analisa TICKER, contoh: \`/analisa BUMI\` - data lengkap teknikal\n• /chart TICKER, contoh: \`/chart BUMI\`\n• /prevol TICKER, contoh: \`/prevol BUMI\`\n• /akumulasi TICKER, contoh: \`/akumulasi COAL\`\n• /my_id - Cek Chat ID\n\nCatatan: Pra-Volume membaca indikasi akumulasi sebelum volume besar. Ini bukan prediksi pasti, tetap tunggu trigger dan invalidasi.`;
          await sendTelegramMessage(chatId, welcome, token, threadId);
        } 
        else if (text === "/MY_ID") {
          await sendTelegramMessage(chatId, `ID Chat: \`${chatId}\`${threadId ? ` (Thread: \`${threadId}\`)` : ""}`, token, threadId);
        }
        else if (text.startsWith("/PREVOL ") || text.startsWith("/PREVOLUME ") || text.startsWith("/AKUMULASI ")) {
          const rawTicker = text
            .replace("/PREVOLUME ", "")
            .replace("/PREVOL ", "")
            .replace("/AKUMULASI ", "")
            .trim()
            .split(/\s+/)[0];

          if (!rawTicker) return;

          await sendTelegramMessage(chatId, `⏳ Membaca akumulasi pra-volume *${rawTicker}*...`, token, threadId);
          const tickerJK = rawTicker.endsWith(".JK") ? rawTicker : `${rawTicker}.JK`;
          const quote = await getQuote(tickerJK);
          if (!quote) {
            await sendTelegramMessage(chatId, `❌ Saham *${rawTicker}* tidak ditemukan.`, token, threadId);
            return;
          }

          const dailyStart = new Date();
          dailyStart.setDate(dailyStart.getDate() - 110);
          const dailyHistory = await getHistory(tickerJK, dailyStart.toISOString().split("T")[0], undefined, "1d");
          const preVolume = buildPreVolumeAccumulation(quote, dailyHistory);
          await sendTelegramMessage(chatId, buildPreVolumeTextReport(rawTicker, quote, preVolume), token, threadId);
        }
        else if (text.startsWith("/ANALISA ") || text.startsWith("/CHART ") || /^[A-Z]{4,5}(\s+(1M|5M|15M|1H|4H|1D|1WK|1MO))?$/.test(text)) {
          const isDetailedReport = text.startsWith("/ANALISA ");
          const rawTicker = isDetailedReport
            ? text.replace("/ANALISA ", "").trim()
            : text.startsWith("/CHART ")
              ? text.replace("/CHART ", "").trim()
              : text;
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

          const today = getJakartaDate();
          const dailyStart = new Date();
          dailyStart.setDate(dailyStart.getDate() - 110);
          const dailyHistoryPromise = getHistory(tickerJK, dailyStart.toISOString().split("T")[0], undefined, "1d");
          let history = await getHistory(tickerJK, today, undefined, "1m");
          if (!history || history.length === 0) {
            console.log(`[BOT] No 1m history for ${ticker}, falling back to 5m...`);
            history = await getHistory(tickerJK, today, undefined, "5m");
          }
          const dailyHistory = await dailyHistoryPromise;
          const conclusion = buildSpikeConclusion(
            quote,
            history as TelegramBar[],
            dailyHistory as TelegramBar[],
          );
          const preVolume = buildPreVolumeAccumulation(quote, dailyHistory);

          const highRecs: string[] = [], lowRecs: string[] = [];
          const sessionHistory = cleanBars(history as TelegramBar[]).filter((bar) => getBarDateJakarta(bar.time) === today);
          if (sessionHistory.length > 0) {
            let curH = -Infinity, curL = Infinity;
            sessionHistory.forEach((h: TelegramBar) => {
              const t = formatBarTimeWIB(h.time);
              if (h.high > curH) { curH = h.high; highRecs.push(`${h.high} at ${t}`); }
              if (h.low < curL) { curL = h.low; lowRecs.push(`${h.low} at ${t}`); }
            });
          }

          const datePart = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short" });
          const timePart = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(/\./g, ".");
          
          const report = isDetailedReport
            ? buildDetailedStockReport({
                ticker,
                quote,
                datePart,
                timePart,
                highRecs,
                lowRecs,
                conclusion,
                preVolume,
              })
            : buildSimpleStockReport(ticker, quote, conclusion, preVolume);

          const photoUrl = await takeChartScreenshot(ticker, interval);
          if (photoUrl) {
            const photoRes = await sendTelegramPhoto(chatId, photoUrl, `Chart ${ticker} ${interval.toUpperCase()}`, token, threadId, undefined);
            if (!photoRes.ok) {
              const detail = await photoRes.text().catch(() => "");
              console.error(`[BOT] sendPhoto failed for ${ticker}: ${photoRes.status} ${detail}`);
            }
          } else {
            await sendTelegramMessage(chatId, "Gagal membuat screenshot chart. Data teks tetap dikirim setelah pesan ini.", token, threadId, undefined);
          }
          await sendTelegramMessage(chatId, report, token, threadId);
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
