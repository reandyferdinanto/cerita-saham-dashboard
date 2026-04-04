import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { fetchRemoteBrokerSummaryCsv, ingestBrokerSummaryRows, parseBrokerSummaryText } from "@/lib/brokerSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as { tradeDate?: string };
    if (!body.tradeDate) {
      return NextResponse.json({ error: "tradeDate wajib diisi" }, { status: 400 });
    }

    const remote = await fetchRemoteBrokerSummaryCsv();
    const rows = parseBrokerSummaryText(remote.text);
    const result = await ingestBrokerSummaryRows({
      tradeDate: body.tradeDate,
      rows,
      source: remote.sourceUrl,
      mode: "remote",
    });

    return NextResponse.json({
      ok: true,
      parsedRows: rows.length,
      sourceUrl: remote.sourceUrl,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal ingest broker summary dari source remote" },
      { status: 500 }
    );
  }
}
