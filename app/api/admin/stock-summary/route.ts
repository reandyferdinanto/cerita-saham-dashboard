import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { connectDB } from "@/lib/db";
import StockSummaryRow from "@/lib/models/StockSummaryRow";
import {
  ingestStockSummaryRows,
  parseStockSummaryText,
  parseStockSummaryWorkbook,
  resolveStockSummaryTradeDate,
} from "@/lib/stockSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const view = req.nextUrl.searchParams.get("view") || "rows";
    const date = req.nextUrl.searchParams.get("date");
    const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase().replace(/\.JK$/i, "").trim();
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 100), 300);

    await connectDB();

    if (view === "dates") {
      const dateLimit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 35), 120);
      const rawDates = await StockSummaryRow.distinct("tradeDate");
      const dates = rawDates
        .map((value) => new Date(value))
        .filter((value) => !Number.isNaN(value.getTime()))
        .sort((left, right) => right.getTime() - left.getTime())
        .slice(0, dateLimit)
        .map((value) => value.toISOString().slice(0, 10));

      return NextResponse.json({
        dates,
        latestDate: dates[0] || null,
      });
    }

    if (!date) {
      return NextResponse.json({ error: "Query param date wajib diisi (YYYY-MM-DD)" }, { status: 400 });
    }

    const tradeDate = new Date(`${date}T00:00:00.000Z`);
    const query: Record<string, unknown> = { tradeDate };
    if (symbol) query.stockCode = symbol;

    const rows = await StockSummaryRow.find(query)
      .sort({ value: -1, volume: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      date,
      count: rows.length,
      data: rows.map((row) => ({
        id: String(row._id),
        tradeDate: row.tradeDate,
        stockCode: row.stockCode,
        companyName: row.companyName || null,
        remarks: row.remarks || null,
        previous: row.previous ?? null,
        openPrice: row.openPrice ?? null,
        firstTrade: row.firstTrade ?? null,
        high: row.high ?? null,
        low: row.low ?? null,
        close: row.close ?? null,
        change: row.change ?? null,
        volume: row.volume ?? null,
        value: row.value ?? null,
        frequency: row.frequency ?? null,
        foreignSell: row.foreignSell ?? null,
        foreignBuy: row.foreignBuy ?? null,
        source: row.source,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat stock summary" },
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
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Import manual sudah dihapus. Gunakan upload file IDX." }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file XLSX wajib dipilih" }, { status: 400 });
    }

    const fileName = file.name || "stock-summary.xlsx";
    const tradeDate = resolveStockSummaryTradeDate(String(formData.get("tradeDate") || ""), fileName);
    if (!tradeDate) {
      return NextResponse.json({ error: "tradeDate wajib diisi atau harus bisa dibaca dari nama file XLSX" }, { status: 400 });
    }

    const lowerFileName = fileName.toLowerCase();
    let rows = [] as Awaited<ReturnType<typeof parseStockSummaryWorkbook>>;
    let source = "upload_stock_summary_xlsx";

    if (lowerFileName.endsWith(".xlsx") || lowerFileName.endsWith(".xlsm")) {
      rows = await parseStockSummaryWorkbook(await file.arrayBuffer());
      source = "upload_stock_summary_xlsx";
    } else if (lowerFileName.endsWith(".csv") || lowerFileName.endsWith(".txt")) {
      rows = parseStockSummaryText(await file.text());
      source = "upload_stock_summary_text";
    } else {
      return NextResponse.json({ error: "Format file belum didukung. Gunakan .xlsx, .xlsm, .csv, atau .txt" }, { status: 400 });
    }

    const result = await ingestStockSummaryRows({
      tradeDate,
      rows,
      source,
    });

    return NextResponse.json({
      ok: true,
      parsedRows: rows.length,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal import stock summary" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const scope = req.nextUrl.searchParams.get("scope") || "date";
    await connectDB();

    if (scope === "all") {
      const result = await StockSummaryRow.deleteMany({});
      return NextResponse.json({
        ok: true,
        scope: "all",
        deletedCount: result.deletedCount ?? 0,
      });
    }

    const date = req.nextUrl.searchParams.get("date");
    if (!date) {
      return NextResponse.json({ error: "Query param date wajib diisi untuk hapus per tanggal" }, { status: 400 });
    }

    const tradeDate = new Date(`${date}T00:00:00.000Z`);
    const result = await StockSummaryRow.deleteMany({ tradeDate });

    return NextResponse.json({
      ok: true,
      scope: "date",
      date,
      deletedCount: result.deletedCount ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus stock summary" },
      { status: 500 }
    );
  }
}
