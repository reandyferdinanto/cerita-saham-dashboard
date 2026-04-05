import { NextRequest, NextResponse } from "next/server";
import { getHistory, HistoryInterval } from "@/lib/yahooFinance";

function getPeriodStart(now: Date, range: string) {
  switch (range) {
    case "1d":
      return new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    case "5d":
      return new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    case "1mo":
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case "3mo":
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case "6mo":
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case "1y":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case "5y":
      return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    default:
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  }
}

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
    const endDate = now.toISOString().split("T")[0];
    const primaryPeriod = getPeriodStart(now, range);

    let history = await getHistory(
      ticker,
      primaryPeriod.toISOString().split("T")[0],
      endDate,
      interval
    );

    if (history.length === 0 && interval === "5m" && range === "1d") {
      const fallbackPeriod = getPeriodStart(now, "5d");
      history = await getHistory(
        ticker,
        fallbackPeriod.toISOString().split("T")[0],
        endDate,
        interval
      );
    }

    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
