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
    const { botToken, adminChatId, mlScreenerBotToken, mlScreenerChatId } = await req.json();

    if (!botToken && !mlScreenerBotToken) {
      return NextResponse.json({ error: "At least one bot token is required" }, { status: 400 });
    }

    await connectDB();

    // Use x-forwarded-host if behind proxy, fallback to host
    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = forwardedHost || req.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

    if (botToken) {
      console.log(`Setting Telegram Webhook to: ${webhookUrl}`);

      // 1. Update Telegram Webhook for Main Bot
      const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`);
      const tgData = await tgResponse.json();

      if (!tgData.ok) {
        console.error("Telegram setWebhook error:", tgData);
        return NextResponse.json({
          error: "Failed to set Telegram webhook for Main Bot",
          details: tgData.description
        }, { status: 400 });
      }
    }

    // 2. Save to database
    await SiteSettings.findOneAndUpdate(
      {},
      {
        ...(botToken && { telegramBotToken: botToken }),
        ...(botToken && { telegramWebhookUrl: webhookUrl }),
        ...(adminChatId !== undefined && { telegramAdminChatId: adminChatId }),
        ...(mlScreenerBotToken !== undefined && { mlScreenerBotToken: mlScreenerBotToken }),
        ...(mlScreenerChatId !== undefined && { mlScreenerChatId: mlScreenerChatId })
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
          mlScreenerBotToken: "",
          mlScreenerChatId: ""
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
      mlScreenerBotToken: settings?.mlScreenerBotToken || "",
      mlScreenerChatId: settings?.mlScreenerChatId || ""
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
