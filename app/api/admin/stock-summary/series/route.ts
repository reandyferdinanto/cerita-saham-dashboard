import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { getAccumulationSeries } from "@/lib/stockSummaryAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ticker = req.nextUrl.searchParams.get("ticker");
    const days = Number(req.nextUrl.searchParams.get("days") || 120);

    if (!ticker) {
      return NextResponse.json({ error: "Query param ticker wajib diisi" }, { status: 400 });
    }

    const result = await getAccumulationSeries({ ticker, days });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat series stock summary" },
      { status: 500 }
    );
  }
}
