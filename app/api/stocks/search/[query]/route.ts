import { NextRequest, NextResponse } from "next/server";
import { searchStocks } from "@/lib/yahooFinance";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ query: string }> }
) {
  try {
    const { query } = await params;
    if (!query || query.trim().length < 1) {
      return NextResponse.json([]);
    }
    const results = await searchStocks(decodeURIComponent(query));
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

