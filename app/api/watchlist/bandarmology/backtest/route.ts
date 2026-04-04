import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { getBandarmologyBacktest } from "@/lib/bandarmologyBacktest";
import { PriceBucket, ScreenerPreset } from "@/lib/bandarmologyScreener";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const preset = (req.nextUrl.searchParams.get("preset") as ScreenerPreset) || "ideal";
    const priceBucket = (req.nextUrl.searchParams.get("priceBucket") as PriceBucket) || "all";
    const lookbackDays = Math.min(Number(req.nextUrl.searchParams.get("lookbackDays") || 20), 90);
    const holdingDays = Math.min(Number(req.nextUrl.searchParams.get("holdingDays") || 5), 20);
    const takeProfitPct = Math.min(Number(req.nextUrl.searchParams.get("takeProfitPct") || 5), 20);

    const result = await getBandarmologyBacktest({
      preset,
      priceBucket,
      lookbackDays,
      holdingDays,
      takeProfitPct,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat backtest bandarmology" },
      { status: 400 }
    );
  }
}
