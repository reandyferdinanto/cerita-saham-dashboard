import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/watchlistStore";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const body = await request.json();
    const entries = await store.update(ticker, {
      name: body.name,
      tp: body.tp,
      sl: body.sl,
      bandarmology: body.bandarmology,
    });
    return NextResponse.json(entries);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const entries = await store.remove(ticker);
    return NextResponse.json(entries);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}

