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
    
    // Use Jakarta date for fetching to ensure we are aligned with IDX session
    const now = new Date();
    
    // Set endDate to tomorrow to be inclusive of today's session in Yahoo Finance
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowJakarta = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(tomorrow);

    const primaryPeriod = getPeriodStart(now, range);
    const startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(primaryPeriod);

    console.log(`API History Request: ${ticker}, Range: ${range}, Interval: ${interval}, Start: ${startDate}, End: ${tomorrowJakarta}`);

    let history = await getHistory(
      ticker,
      startDate,
      tomorrowJakarta,
      interval
    );

    // If fetching 1d range and got nothing, fallback to wider window
    if (history.length === 0 && range === "1d") {
      const fallbackPeriod = getPeriodStart(now, "5d");
      const fallbackStartDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(fallbackPeriod);
      history = await getHistory(
        ticker,
        fallbackStartDate,
        tomorrowJakarta,
        interval
      );
    }

    return NextResponse.json(history);
  } catch (error) {
    console.error("History API Error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
