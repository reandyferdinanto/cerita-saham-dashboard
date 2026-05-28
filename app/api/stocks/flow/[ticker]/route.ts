import { NextRequest, NextResponse } from "next/server";
import { queryPostgres } from "@/lib/postgres";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const code = ticker.toUpperCase().replace(/\.JK$/i, "").trim();
  const days = Number(request.nextUrl.searchParams.get("days") || "60");

  try {
    const { rows } = await queryPostgres(
      `SELECT trade_date, foreign_buy, foreign_sell, bid_volume, offer_volume
       FROM stock_summary_rows
       WHERE stock_code = $1
       ORDER BY trade_date DESC
       LIMIT $2`,
      [code, days]
    );

    const data = rows.reverse().map((r) => {
      const fb = Number(r.foreign_buy || 0);
      const fs = Number(r.foreign_sell || 0);
      const bid = Number(r.bid_volume || 0);
      const offer = Number(r.offer_volume || 0);
      return {
        date: (r.trade_date as Date).toISOString().slice(0, 10),
        netForeign: fb - fs,
        netDomestic: bid - offer,
      };
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
