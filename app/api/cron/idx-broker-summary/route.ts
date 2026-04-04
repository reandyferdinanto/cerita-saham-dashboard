import { NextRequest, NextResponse } from "next/server";
import { fetchRemoteBrokerSummaryCsv, ingestBrokerSummaryRows, parseBrokerSummaryText } from "@/lib/brokerSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;

  if (!expected || authHeader !== expected) {
    return unauthorized();
  }

  try {
    const tradeDate = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const remote = await fetchRemoteBrokerSummaryCsv();
    const rows = parseBrokerSummaryText(remote.text);
    const result = await ingestBrokerSummaryRows({
      tradeDate,
      rows,
      source: remote.sourceUrl,
      mode: "cron",
    });

    return NextResponse.json({
      ok: true,
      tradeDate,
      parsedRows: rows.length,
      sourceUrl: remote.sourceUrl,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menjalankan cron broker summary" },
      { status: 500 }
    );
  }
}
