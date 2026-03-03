import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/watchlistStore";

export async function GET() {
  try {
    const entries = await store.getAll();
    return NextResponse.json(entries);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entry = {
      ticker: body.ticker.toUpperCase(),
      name: body.name || body.ticker,
      tp: body.tp ?? null,
      sl: body.sl ?? null,
      bandarmology: body.bandarmology || "",
      addedAt: new Date().toISOString(),
    };
    const entries = await store.add(entry);
    return NextResponse.json(entries, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}

