import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { connectDB } from "@/lib/db";
import BrokerSummaryRow from "@/lib/models/BrokerSummaryRow";
import {
  ingestBrokerSummaryRows,
  parseBrokerSummaryText,
  parseBrokerSummaryWorkbook,
  resolveBrokerSummaryTradeDate,
} from "@/lib/brokerSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const date = req.nextUrl.searchParams.get("date");
    const broker = req.nextUrl.searchParams.get("broker")?.toUpperCase().trim();
    const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase().replace(/\.JK$/i, "").trim();
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 50), 200);

    if (!date) {
      return NextResponse.json({ error: "Query param date wajib diisi (YYYY-MM-DD)" }, { status: 400 });
    }

    await connectDB();
    const tradeDate = new Date(`${date}T00:00:00.000Z`);
    const query: Record<string, unknown> = { tradeDate };
    if (broker) query.brokerCode = broker;
    if (symbol) query.symbol = symbol;

    const rows = await BrokerSummaryRow.find(query)
      .sort({ netValue: -1, buyValue: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      date,
      count: rows.length,
      data: rows.map((row) => ({
        id: String(row._id),
        tradeDate: row.tradeDate,
        brokerCode: row.brokerCode,
        brokerName: row.brokerName || null,
        symbol: row.symbol || null,
        buyFreq: row.buyFreq ?? null,
        buyVolume: row.buyVolume ?? null,
        buyValue: row.buyValue ?? null,
        sellFreq: row.sellFreq ?? null,
        sellVolume: row.sellVolume ?? null,
        sellValue: row.sellValue ?? null,
        netVolume: row.netVolume ?? null,
        netValue: row.netValue ?? null,
        source: row.source,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat broker summary" },
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
    const contentType = req.headers.get("content-type") || "";
    let tradeDate: string | null = null;
    let rows = [] as Awaited<ReturnType<typeof parseBrokerSummaryWorkbook>>;
    let source = "manual_csv";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file broker summary wajib dipilih" }, { status: 400 });
      }

      const fileName = file.name || "broker-summary.xlsx";
      tradeDate = resolveBrokerSummaryTradeDate(String(formData.get("tradeDate") || ""), fileName);
      if (!tradeDate) {
        return NextResponse.json({ error: "tradeDate wajib diisi atau harus bisa dibaca dari nama file upload" }, { status: 400 });
      }

      const lowerFileName = fileName.toLowerCase();
      if (lowerFileName.endsWith(".xlsx") || lowerFileName.endsWith(".xlsm")) {
        rows = await parseBrokerSummaryWorkbook(await file.arrayBuffer());
        source = "upload_broker_summary_xlsx";
      } else if (lowerFileName.endsWith(".csv") || lowerFileName.endsWith(".txt")) {
        rows = parseBrokerSummaryText(await file.text());
        source = "upload_broker_summary_text";
      } else {
        return NextResponse.json({ error: "Format file belum didukung. Gunakan .xlsx, .xlsm, .csv, atau .txt" }, { status: 400 });
      }
    } else {
      const body = await req.json() as { tradeDate?: string; rawText?: string };
      tradeDate = resolveBrokerSummaryTradeDate(body.tradeDate);
      if (!tradeDate) {
        return NextResponse.json({ error: "tradeDate wajib diisi" }, { status: 400 });
      }
      if (!body.rawText?.trim()) {
        return NextResponse.json({ error: "rawText CSV/TSV wajib diisi" }, { status: 400 });
      }
      rows = parseBrokerSummaryText(body.rawText);
      source = "manual_csv";
    }

    const result = await ingestBrokerSummaryRows({
      tradeDate,
      rows,
      source,
      mode: "manual",
    });

    return NextResponse.json({
      ok: true,
      parsedRows: rows.length,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal import broker summary" },
      { status: 500 }
    );
  }
}
