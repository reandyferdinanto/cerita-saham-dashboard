import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import PortfolioHolding from "@/lib/models/PortfolioHolding";
import { requireUserSession } from "@/lib/userSession";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  await connectDB();

  const updated = await PortfolioHolding.findOneAndUpdate(
    { _id: id, userId: session.userId },
    {
      ticker: String(body.ticker || "").toUpperCase(),
      name: body.name || body.ticker,
      lots: Number(body.lots || 0),
      averageBuyPrice: Number(body.averageBuyPrice || 0),
      thesis: body.thesis || "",
      sector: body.sector || "",
      targetPrice: body.targetPrice ? Number(body.targetPrice) : null,
      stopLoss: body.stopLoss ? Number(body.stopLoss) : null,
    },
    { new: true }
  ).lean();

  if (!updated) return NextResponse.json({ error: "Holding not found" }, { status: 404 });
  return NextResponse.json({ ...updated, _id: String(updated._id) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  await PortfolioHolding.deleteOne({ _id: id, userId: session.userId });
  return NextResponse.json({ ok: true });
}