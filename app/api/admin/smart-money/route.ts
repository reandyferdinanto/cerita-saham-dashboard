import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { analyzeSmartMoney } from "@/lib/smartMoneyEngine";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ticker = req.nextUrl.searchParams.get("ticker") || "";
  if (!ticker.trim()) {
    return NextResponse.json({ error: "Ticker wajib diisi" }, { status: 400 });
  }

  try {
    const result = await analyzeSmartMoney(ticker.trim());
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analisa Smart Money gagal" },
      { status: 400 }
    );
  }
}
