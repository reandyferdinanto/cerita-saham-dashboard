import { NextRequest, NextResponse } from "next/server";
import { getHistory, HistoryInterval } from "@/lib/yahooFinance";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get("range") || "3mo";
    const interval = (searchParams.get("interval") || "1d") as HistoryInterval;

    const now = new Date();
    let period1: Date;

    switch (range) {
      // Intraday ranges
      case "1d":
        period1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        break;
      case "5d":
        period1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
        break;
      case "1mo":
        period1 = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case "3mo":
        period1 = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case "6mo":
        period1 = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case "1y":
        period1 = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case "5y":
        period1 = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
        break;
      default:
        period1 = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    }

    const history = await getHistory(
      ticker,
      period1.toISOString().split("T")[0],
      now.toISOString().split("T")[0],
      interval
    );

    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
