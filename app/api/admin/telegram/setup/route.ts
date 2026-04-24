import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SiteSettings from "@/lib/models/SiteSettings";
import { requireAdminSession } from "@/lib/adminSession";

export async function POST(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { 
      botToken, 
      adminChatId, 
      adminThreadId,
      mlScreenerBotToken, 
      mlScreenerChatId,
      watchlistAlertEnabled,
      watchlistAlertBotToken,
      watchlistAlertChatId,
      watchlistAlertThreadId,
      watchlistAlertMinEmaOffset,
      watchlistAlertMaxEmaOffset,
      watchlistAlertOpenOffset,
      watchlistAlertEma20Enabled,
      watchlistAlertEma20Min,
      watchlistAlertEma20Max,
      watchlistAlertEma50Enabled,
      watchlistAlertEma50Min,
      watchlistAlertEma50Max,
      watchlistAlertOpenGapEnabled,
      watchlistAlertOpenGapMin,
      watchlistAlertUniverse,
      watchlistAlertMinGain
    } = await req.json();

    if (!botToken && !mlScreenerBotToken && !watchlistAlertBotToken && watchlistAlertEnabled === undefined) {
      return NextResponse.json({ error: "No configuration data provided" }, { status: 400 });
    }

    await connectDB();

    // Use x-forwarded-host if behind proxy, fallback to host
    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = forwardedHost || req.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

    if (botToken) {
      console.log(`Setting Telegram Webhook to: ${webhookUrl}`);
      await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`);
    }

    if (watchlistAlertBotToken && watchlistAlertBotToken !== botToken) {
      console.log(`Setting Telegram Webhook for Watchlist Bot to: ${webhookUrl}`);
      await fetch(`https://api.telegram.org/bot${watchlistAlertBotToken}/setWebhook?url=${webhookUrl}`);
    }

    // 2. Save to database
    await SiteSettings.findOneAndUpdate(
      {},
      {
        ...(botToken && { telegramBotToken: botToken }),
        ...(botToken && { telegramWebhookUrl: webhookUrl }),
        ...(adminChatId !== undefined && { telegramAdminChatId: adminChatId }),
        ...(adminThreadId !== undefined && { telegramAdminThreadId: adminThreadId }),
        ...(mlScreenerBotToken !== undefined && { mlScreenerBotToken: mlScreenerBotToken }),
        ...(mlScreenerChatId !== undefined && { mlScreenerChatId: mlScreenerChatId }),
        ...(watchlistAlertEnabled !== undefined && { watchlistAlertEnabled }),
        ...(watchlistAlertBotToken !== undefined && { watchlistAlertBotToken }),
        ...(watchlistAlertChatId !== undefined && { watchlistAlertChatId }),
        ...(watchlistAlertThreadId !== undefined && { watchlistAlertThreadId }),
        ...(watchlistAlertMinEmaOffset !== undefined && { watchlistAlertMinEmaOffset }),
        ...(watchlistAlertMaxEmaOffset !== undefined && { watchlistAlertMaxEmaOffset }),
        ...(watchlistAlertOpenOffset !== undefined && { watchlistAlertOpenOffset }),
        ...(watchlistAlertEma20Enabled !== undefined && { watchlistAlertEma20Enabled }),
        ...(watchlistAlertEma20Min !== undefined && { watchlistAlertEma20Min }),
        ...(watchlistAlertEma20Max !== undefined && { watchlistAlertEma20Max }),
        ...(watchlistAlertEma50Enabled !== undefined && { watchlistAlertEma50Enabled }),
        ...(watchlistAlertEma50Min !== undefined && { watchlistAlertEma50Min }),
        ...(watchlistAlertEma50Max !== undefined && { watchlistAlertEma50Max }),
        ...(watchlistAlertOpenGapEnabled !== undefined && { watchlistAlertOpenGapEnabled }),
        ...(watchlistAlertOpenGapMin !== undefined && { watchlistAlertOpenGapMin }),
        ...(watchlistAlertUniverse !== undefined && { watchlistAlertUniverse }),
        ...(watchlistAlertMinGain !== undefined && { watchlistAlertMinGain })
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      message: "Konfigurasi Telegram berhasil disimpan",
      webhookUrl: botToken ? webhookUrl : undefined
    });
  } catch (error: any) {
    console.error("Telegram setup error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const settings = await SiteSettings.findOne({});
    
    if (settings?.telegramBotToken) {
      // Optional: Try to delete webhook from Telegram before clearing
      await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/deleteWebhook`).catch(() => null);
    }

    await SiteSettings.findOneAndUpdate(
      {},
      {
        $unset: {
          telegramBotToken: "",
          telegramWebhookUrl: "",
          telegramAdminChatId: "",
          telegramAdminThreadId: "",
          mlScreenerBotToken: "",
          mlScreenerChatId: "",
          watchlistAlertEnabled: "",
          watchlistAlertBotToken: "",
          watchlistAlertChatId: "",
          watchlistAlertThreadId: "",
          watchlistAlertMinEmaOffset: "",
          watchlistAlertMaxEmaOffset: "",
          watchlistAlertOpenOffset: "",
          watchlistAlertEma20Enabled: "",
          watchlistAlertEma20Min: "",
          watchlistAlertEma20Max: "",
          watchlistAlertEma50Enabled: "",
          watchlistAlertEma50Min: "",
          watchlistAlertEma50Max: "",
          watchlistAlertOpenGapEnabled: "",
          watchlistAlertOpenGapMin: ""
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: "Konfigurasi Telegram berhasil dihapus"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const settings = await SiteSettings.findOne({});
    return NextResponse.json({
      botToken: settings?.telegramBotToken || "",
      webhookUrl: settings?.telegramWebhookUrl || "",
      adminChatId: settings?.telegramAdminChatId || "",
      adminThreadId: settings?.telegramAdminThreadId || "",
      mlScreenerBotToken: settings?.mlScreenerBotToken || "",
      mlScreenerChatId: settings?.mlScreenerChatId || "",
      watchlistAlertEnabled: settings?.watchlistAlertEnabled || false,
      watchlistAlertBotToken: settings?.watchlistAlertBotToken || "",
      watchlistAlertChatId: settings?.watchlistAlertChatId || "",
      watchlistAlertThreadId: settings?.watchlistAlertThreadId || "",
      watchlistAlertMinEmaOffset: settings?.watchlistAlertMinEmaOffset || 1,
      watchlistAlertMaxEmaOffset: settings?.watchlistAlertMaxEmaOffset || 2,
      watchlistAlertOpenOffset: settings?.watchlistAlertOpenOffset || 2,
      watchlistAlertEma20Enabled: settings?.watchlistAlertEma20Enabled ?? true,
      watchlistAlertEma20Min: settings?.watchlistAlertEma20Min ?? 1,
      watchlistAlertEma20Max: settings?.watchlistAlertEma20Max ?? 2,
      watchlistAlertEma50Enabled: settings?.watchlistAlertEma50Enabled ?? false,
      watchlistAlertEma50Min: settings?.watchlistAlertEma50Min ?? 1,
      watchlistAlertEma50Max: settings?.watchlistAlertEma50Max ?? 2,
      watchlistAlertOpenGapEnabled: settings?.watchlistAlertOpenGapEnabled ?? true,
      watchlistAlertOpenGapMin: settings?.watchlistAlertOpenGapMin ?? 2,
      watchlistAlertUniverse: settings?.watchlistAlertUniverse || "watchlist",
      watchlistAlertMinGain: settings?.watchlistAlertMinGain || 5,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
