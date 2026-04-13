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
    const { botToken } = await req.json();

    if (!botToken) {
      return NextResponse.json({ error: "Bot token is required" }, { status: 400 });
    }

    await connectDB();

    // Use x-forwarded-host if behind proxy, fallback to host
    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = forwardedHost || req.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

    console.log(`Setting Telegram Webhook to: ${webhookUrl}`);

    // 1. Update Telegram Webhook
    const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`);
    const tgData = await tgResponse.json();

    if (!tgData.ok) {
      console.error("Telegram setWebhook error:", tgData);
      return NextResponse.json({
        error: "Failed to set Telegram webhook",
        details: tgData.description
      }, { status: 400 });
    }

    // 2. Save to database
    await SiteSettings.findOneAndUpdate(
      {},
      {
        telegramBotToken: botToken,
        telegramWebhookUrl: webhookUrl
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      message: "Telegram bot configured and webhook updated successfully",
      webhookUrl
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
          telegramWebhookUrl: ""
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
      webhookUrl: settings?.telegramWebhookUrl || ""
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
