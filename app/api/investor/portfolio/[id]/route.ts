import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/userSession";
import {
  deletePortfolioHolding,
  updatePortfolioHolding,
} from "@/lib/data/investorWorkspace";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updated = await updatePortfolioHolding(id, session.userId, {
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

  if (!updated) return NextResponse.json({ error: "Holding not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deletePortfolioHolding(id, session.userId);
  return NextResponse.json({ ok: true });
}