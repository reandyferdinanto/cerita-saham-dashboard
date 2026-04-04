import { NextRequest, NextResponse } from "next/server";
import { analyzeBandarmology } from "@/lib/bandarmologyAnalysis";

export async function GET(req: NextRequest) {
  try {
    const ticker = req.nextUrl.searchParams.get("ticker") || "";
    const result = await analyzeBandarmology(ticker);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat analisa bandarmology" },
      { status: 400 }
    );
  }
}
