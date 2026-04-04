import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { connectDB } from "@/lib/db";
import IndonesiaStock from "@/lib/models/IndonesiaStock";
import { syncIndonesiaStockMaster } from "@/lib/indonesiaStockMaster";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const [activeCount, latest] = await Promise.all([
      IndonesiaStock.countDocuments({ active: true }),
      IndonesiaStock.findOne({ active: true }).sort({ lastSyncedAt: -1 }).lean(),
    ]);

    return NextResponse.json({
      activeCount,
      source: "stockanalysis",
      sourceUrl: "https://stockanalysis.com/list/indonesia-stock-exchange/",
      lastSyncedAt: latest?.lastSyncedAt || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membaca stock master" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncIndonesiaStockMaster(true);
    return NextResponse.json({
      ok: true,
      source: "stockanalysis",
      sourceUrl: "https://stockanalysis.com/list/indonesia-stock-exchange/",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal sinkronisasi stock master" },
      { status: 500 }
    );
  }
}
