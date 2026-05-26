import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { queryPostgres } from "@/lib/postgres";
import {
  ensureIndonesiaStocksTable,
  IDX_UNIVERSE_SOURCE_NAME,
  IDX_UNIVERSE_SOURCE_URL,
  syncIndonesiaStockMaster,
} from "@/lib/indonesiaStockMaster";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureIndonesiaStocksTable();
    const status = await queryPostgres<{ active_count: string; last_synced_at: Date | null }>(
      `
        select
          count(*) filter (where is_active = true) as active_count,
          max(updated_at) filter (where is_active = true) as last_synced_at
        from indonesia_stocks
      `
    );
    const row = status.rows[0];

    return NextResponse.json({
      activeCount: Number(row?.active_count || 0),
      source: IDX_UNIVERSE_SOURCE_NAME,
      sourceUrl: IDX_UNIVERSE_SOURCE_URL,
      lastSyncedAt: row?.last_synced_at || null,
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
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal sinkronisasi stock master" },
      { status: 500 }
    );
  }
}
