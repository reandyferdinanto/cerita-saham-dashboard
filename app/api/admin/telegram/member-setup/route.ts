import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { getTelegramSettings, updateTelegramSettings } from "@/lib/data/telegramSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      memberBotToken?: string;
      memberBotEnabled?: boolean;
      memberBotRateLimitPerDay?: number;
      memberBotCacheMinutes?: number;
      publicBaseUrl?: string; // Optional: HTTPS base URL override (e.g. ngrok, production domain)
    };

    const { memberBotToken, memberBotEnabled, memberBotRateLimitPerDay, memberBotCacheMinutes, publicBaseUrl } = body;

    // Resolve webhook base URL:
    // 1. publicBaseUrl from request body (UI override)
    // 2. TELEGRAM_PUBLIC_URL env var
    // 3. Auto-detect from request host headers
    let baseUrl = (publicBaseUrl || "").trim().replace(/\/+$/, "");
    if (!baseUrl) {
      baseUrl = (process.env.TELEGRAM_PUBLIC_URL || "").trim().replace(/\/+$/, "");
    }
    if (!baseUrl) {
      const forwardedHost = req.headers.get("x-forwarded-host");
      const host = forwardedHost || req.headers.get("host");
      const protocol = host?.includes("localhost") ? "http" : "https";
      baseUrl = `${protocol}://${host}`;
    }
    const webhookUrl = `${baseUrl}/api/telegram/member/webhook`;

    // Validate: Telegram requires HTTPS
    if (memberBotToken && !webhookUrl.startsWith("https://")) {
      return NextResponse.json(
        {
          error:
            "Telegram membutuhkan webhook HTTPS. Untuk development di localhost, masukkan public URL (contoh: ngrok https) di field Public Base URL atau set env TELEGRAM_PUBLIC_URL.",
        },
        { status: 400 }
      );
    }

    // Set webhook on Telegram side if token provided
    if (memberBotToken) {
      console.log(`[MEMBER BOT] Setting webhook to: ${webhookUrl}`);
      const tgRes = await fetch(`https://api.telegram.org/bot${memberBotToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const tgData = await tgRes.json().catch(() => null);
      if (!tgRes.ok || tgData?.ok === false) {
        return NextResponse.json(
          { error: `Gagal set webhook ke Telegram: ${tgData?.description || tgRes.statusText}` },
          { status: 400 }
        );
      }
    }

    const patch: Parameters<typeof updateTelegramSettings>[0] = {};
    if (memberBotToken !== undefined) {
      patch.memberBotToken = memberBotToken;
      patch.memberBotWebhookUrl = memberBotToken ? webhookUrl : "";
    }
    if (memberBotEnabled !== undefined) patch.memberBotEnabled = Boolean(memberBotEnabled);
    if (memberBotRateLimitPerDay !== undefined) {
      patch.memberBotRateLimitPerDay = Math.max(1, Math.min(500, Number(memberBotRateLimitPerDay) || 25));
    }
    if (memberBotCacheMinutes !== undefined) {
      patch.memberBotCacheMinutes = Math.max(1, Math.min(720, Number(memberBotCacheMinutes) || 30));
    }

    await updateTelegramSettings(patch);

    return NextResponse.json({
      success: true,
      message: "Konfigurasi member bot berhasil disimpan",
      webhookUrl: memberBotToken ? webhookUrl : undefined,
    });
  } catch (error) {
    console.error("Member bot setup error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan konfigurasi member bot" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getTelegramSettings();
    if (settings.memberBotToken) {
      await fetch(`https://api.telegram.org/bot${settings.memberBotToken}/deleteWebhook`).catch(() => null);
    }
    await updateTelegramSettings({
      memberBotEnabled: false,
      memberBotToken: "",
      memberBotWebhookUrl: "",
    });
    return NextResponse.json({ success: true, message: "Konfigurasi member bot dihapus" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus konfigurasi" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getTelegramSettings();
    return NextResponse.json({
      memberBotEnabled: settings.memberBotEnabled,
      memberBotToken: settings.memberBotToken,
      memberBotWebhookUrl: settings.memberBotWebhookUrl,
      memberBotRateLimitPerDay: settings.memberBotRateLimitPerDay,
      memberBotCacheMinutes: settings.memberBotCacheMinutes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat konfigurasi" },
      { status: 500 }
    );
  }
}
