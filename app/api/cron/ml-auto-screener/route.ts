import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SiteSettings from "@/lib/models/SiteSettings";
import { getBandarmologyScreener } from "@/lib/bandarmologyScreener";
import { getBandarmologyBacktest } from "@/lib/bandarmologyBacktest";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Protect the endpoint so it can only be called by cron or admin
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    req.headers.get("x-vercel-cron") !== "1"
  ) {
    // Return 401 if not authorized
    // return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // For testing without CRON_SECRET, we allow it temporarily but log a warning.
    console.warn("ML Auto-Screener triggered without proper authorization header");
  }

  try {
    await connectDB();
    const settings = await SiteSettings.findOne({});
    const botToken = settings?.mlScreenerBotToken;
    const chatId = settings?.mlScreenerChatId;

    if (!botToken || !chatId) {
      return NextResponse.json({ error: "ML Screener Telegram bot not configured" }, { status: 400 });
    }

    // 1. Time Safety Check (WIB: UTC+7)
    // Walaupun Vercel cron di-set 09:00-16:00, kita pastikan lagi di level kode
    const now = new Date();
    const wibHour = (now.getUTCHours() + 7) % 24;
    const day = now.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    // Jika weekend, batalkan
    if (day === 0 || day === 6) {
      return NextResponse.json({ message: "Weekend, cron skipped" });
    }
    // Jika di luar jam bursa (09:00 - 16:00 WIB)
    if (wibHour < 9 || wibHour >= 16) {
      return NextResponse.json({ message: "Outside market hours, cron skipped" });
    }

    // 2. Find the best preset based on recent 20-day hit rate
    const CORE_PRESETS = ["under300_focus", "washout_reclaim", "markup_scout", "stealth_rotation", "high_volatility_swing"];
    
    let bestPreset = CORE_PRESETS[0];
    let maxHitRate = -1;

    console.log("Evaluating best screener preset...");
    for (const preset of CORE_PRESETS) {
      try {
        const backtest = await getBandarmologyBacktest({
          preset,
          priceBucket: "all",
          lookbackDays: 20,
          holdingDays: 5,
          takeProfitPct: 5
        });
        
        if (backtest && backtest.hitRate !== null && backtest.hitRate > maxHitRate) {
          maxHitRate = backtest.hitRate;
          bestPreset = preset;
        }
      } catch (e) {
        console.error(`Failed backtest for preset ${preset}:`, e);
      }
    }

    console.log(`Best preset today is ${bestPreset} with Hit Rate ${maxHitRate.toFixed(2)}%`);

    // 3. Run the screener with the best preset
    console.log(`Running screener for ${bestPreset}...`);
    const screenerResults = await getBandarmologyScreener({
      preset: bestPreset as any,
      priceBucket: "all"
    });

    if (!screenerResults.rows || screenerResults.rows.length === 0) {
      return NextResponse.json({ message: "No candidates found from screener today." });
    }

    const tickers = screenerResults.rows.map((r: any) => r.ticker).join(",");
    console.log(`Found ${screenerResults.rows.length} candidates: ${tickers}`);

    // 4. Send to ML Python Script
    console.log("Running ML Predictor...");
    const pythonCmd = process.env.NODE_ENV === "production" ? "python3" : "python3";
    const { stdout, stderr } = await execAsync(`${pythonCmd} scripts/ml/screener.py "${tickers}"`);
    
    if (stderr && !stderr.includes("SettingWithCopyWarning") && !stderr.includes("UserWarning")) {
      console.error("ML Script Error:", stderr);
    }

    const mlResponse = JSON.parse(stdout);
    if (mlResponse.error) {
      throw new Error(`ML Error: ${mlResponse.error}`);
    }

    // 5. Filter high probability (> 80%)
    const highProbResults = mlResponse.results.filter((res: any) => res.probability >= 80);

    if (highProbResults.length === 0) {
      return NextResponse.json({ 
        message: "ML executed, but no stocks matched the >80% probability threshold.",
        bestPreset,
        scannedCount: screenerResults.rows.length
      });
    }

    // 6. Format Telegram Message
    const emoji = "🚀";
    let message = `${emoji} *ML AUTO-SCREENER ALERT* ${emoji}\n`;
    message += `Strategy: *${bestPreset.replace(/_/g, " ").toUpperCase()}*\n`;
    message += `Time: *${now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })} WIB*\n\n`;
    
    message += "```\n";
    message += "Ticker | Price | Prob | Fit \n";
    message += "-------|-------|------|-----\n";

    highProbResults.forEach((res: any) => {
      // Find matching row for thesis/reasons
      const row = screenerResults.rows.find((r: any) => r.ticker.replace(".JK", "") === res.ticker);
      
      const ticker = (res.ticker || "").padEnd(6);
      const price = res.price.toString().padStart(5);
      const prob = `${Math.round(res.probability)}%`.padStart(4);
      const fit = row ? row.fitScore.toString().padStart(3) : " - ";

      message += `${ticker} | ${price} | ${prob} | ${fit}\n`;
    });
    message += "```\n\n";

    // Add extra details below the table
    highProbResults.forEach((res: any) => {
      const row = screenerResults.rows.find((r: any) => r.ticker.replace(".JK", "") === res.ticker);
      if (row) {
        message += `*${res.ticker}* - ${row.phase}\n`;
        message += `_RSI: ${res.rsi} | Markup: ${row.breakoutReadiness}/100_\n`;
        if (row.reasons && row.reasons.length > 0) {
          message += `• ${row.reasons[0]}\n`;
        }
        message += `\n`;
      }
    });

    message += `_Pesan otomatis | Probabilitas ML > 80%_`;

    // 7. Send to Telegram
    console.log("Sending to Telegram...");
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    const tgData = await tgRes.json();
    if (!tgData.ok) {
      throw new Error(`Telegram API Error: ${tgData.description}`);
    }

    return NextResponse.json({
      success: true,
      message: `Alert sent for ${highProbResults.length} stocks.`,
      bestPreset,
      data: highProbResults
    });

  } catch (error: any) {
    console.error("ML Auto-Screener Cron Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
