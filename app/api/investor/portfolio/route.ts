import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/userSession";
import {
  createPortfolioHolding,
  listPortfolioHoldings,
} from "@/lib/data/investorWorkspace";

export async function GET(req: NextRequest) {
  const session = await requireUserSession(req);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await listPortfolioHoldings(session.userId));
}

export async function POST(req: NextRequest) {
  const session = await requireUserSession(req);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const created = await createPortfolioHolding({
    userId: session.userId,
    ticker: String(body.ticker || "").toUpperCase(),
    name: body.name || body.ticker,
    lots: Number(body.lots || 0),
    averageBuyPrice: Number(body.averageBuyPrice || 0),
    thesis: body.thesis || "",
    sector: body.sector || "",
    targetPrice: body.targetPrice ? Number(body.targetPrice) : null,
    stopLoss: body.stopLoss ? Number(body.stopLoss) : null,
  });

  return NextResponse.json(created, { status: 201 });
}