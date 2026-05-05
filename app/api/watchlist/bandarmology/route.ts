import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { analyzeBandarmology } from "@/lib/bandarmologyAnalysis";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
