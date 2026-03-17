import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import PortfolioHolding from "@/lib/models/PortfolioHolding";
import { requireUserSession } from "@/lib/userSession";

export async function GET(req: NextRequest) {
  const session = await requireUserSession(req);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const holdings = await PortfolioHolding.find({ userId: session.userId }).sort({ updatedAt: -1 }).lean();

  return NextResponse.json(
    holdings.map((holding) => ({
      ...holding,
      _id: String(holding._id),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await requireUserSession(req);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  await connectDB();

  const created = await PortfolioHolding.create({
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

  return NextResponse.json({ ...created.toObject(), _id: String(created._id) }, { status: 201 });
}