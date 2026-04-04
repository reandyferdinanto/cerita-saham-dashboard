import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { getAccumulationAnalysis } from "@/lib/stockSummaryAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const date = req.nextUrl.searchParams.get("date");
    const limit = Number(req.nextUrl.searchParams.get("limit") || 12);

    if (!date) {
      return NextResponse.json({ error: "Query param date wajib diisi (YYYY-MM-DD)" }, { status: 400 });
    }

    const result = await getAccumulationAnalysis({ tradeDate: date, limit });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat analisa akumulasi" },
      { status: 500 }
    );
  }
}
