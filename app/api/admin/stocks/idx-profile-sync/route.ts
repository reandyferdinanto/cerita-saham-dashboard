import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { syncIndonesiaStockProfilesFromBEI } from "@/lib/indonesiaStockMaster";

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncIndonesiaStockProfilesFromBEI();
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({
      ok: true,
      message: `Berhasil sinkronisasi ${result.count} profil saham dari BEI`,
      ...result
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal sinkronisasi profil BEI" },
      { status: 500 }
    );
  }
}
