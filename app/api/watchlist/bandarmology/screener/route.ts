import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { getBandarmologyScreener, PriceBucket, ScreenerPreset } from "@/lib/bandarmologyScreener";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const preset = (req.nextUrl.searchParams.get("preset") as ScreenerPreset) || "ideal";
    const priceBucket = (req.nextUrl.searchParams.get("priceBucket") as PriceBucket) || "all";
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 8), 12);
    const candidateLimit = Math.min(Number(req.nextUrl.searchParams.get("candidateLimit") || (priceBucket === "under200" ? 180 : 140)), 220);
    const filtered = await getBandarmologyScreener({ preset, priceBucket, limit, candidateLimit });

    return NextResponse.json(
      filtered,
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat screener bandarmology" },
      { status: 400 }
    );
  }
}
