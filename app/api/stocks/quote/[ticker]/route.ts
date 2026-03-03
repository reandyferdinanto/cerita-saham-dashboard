import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/yahooFinance";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const quote = await getQuote(ticker);
    if (!quote) {
      return NextResponse.json(
        { error: "Failed to fetch quote" },
        { status: 404 }
      );
    }
    return NextResponse.json(quote);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

