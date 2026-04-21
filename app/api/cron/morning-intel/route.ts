import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SiteSettings from "@/lib/models/SiteSettings";
import { getBandarmologyScreener } from "@/lib/bandarmologyScreener";
import { analyzeSmartMoney } from "@/lib/smartMoneyEngine";
import { sendTelegramMessage } from "@/lib/telegram";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === "production" && req.nextUrl.hostname !== "localhost") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    await connectDB();
    const settings = await SiteSettings.findOne({});
    const token = settings?.telegramBotToken;
    const adminChatId = settings?.telegramAdminChatId;

    if (!token || !adminChatId) {
      return NextResponse.json({ error: "Telegram bot not configured or adminChatId missing" }, { status: 400 });
    }

    // 1. Get candidates from high volatility swing screener
    console.log("Fetching screener candidates...");
    const screener = await getBandarmologyScreener({
      preset: "high_volatility_swing",
      priceBucket: "under300",
      limit: 15,
      preferSnapshot: false // Want fresh data for morning intel
    });

    const candidates = screener.rows;
    if (candidates.length === 0) {
      return NextResponse.json({ success: true, message: "No candidates found today" });
    }

    // 2. Perform deep intraday (4h) analysis on candidates
    console.log(`Analyzing ${candidates.length} candidates with 4h interval...`);
    const analyzed = await Promise.all(
      candidates.map(async (c: any) => {
        try {
          const result = await analyzeSmartMoney(c.ticker, "4h");
          return result;
        } catch (e) {
          return null;
        }
      })
    );

    const validAnalyzed = analyzed
      .filter((a): a is NonNullable<typeof a> => a !== null)
      .sort((a, b) => b.readinessScore - a.readinessScore);

    const top3 = validAnalyzed.slice(0, 3);

    // 3. Format message
    const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    let message = `🚀 *MORNING INTEL REPORT* 🚀\n_${today} 08:30 WIB_\n\n`;
    message += `Berdasarkan deteksi Smart Money (4H) & High-Volatility Swing, berikut 3 menu utama untuk hari ini:\n\n`;

    top3.forEach((stock, idx) => {
      const ticker = stock.ticker.replace(".JK", "");
      message += `${idx + 1}. *${ticker}* — Rp ${stock.price.toLocaleString("id-ID")}\n`;
      message += `   🎯 Readiness: *${stock.readinessScore}%*\n`;
      message += `   📜 Thesis: ${stock.currentPhaseSummary.substring(0, 80)}...\n`;
      message += `   📉 Hot Zone: Dekat Rp ${stock.price.toLocaleString("id-ID")}\n\n`;
    });

    message += `\n_Gunakan porsi kecil (<5%) & ketat Stop Loss. Disclaimer On._`;

    // 4. Send to Telegram
    await sendTelegramMessage(adminChatId, message, token);

    return NextResponse.json({ success: true, top3: top3.map(s => s.ticker) });

  } catch (error) {
    console.error("Morning Intel Cron Error:", error);
    return NextResponse.json({ error: "Failed to generate morning intel" }, { status: 500 });
  }
}
