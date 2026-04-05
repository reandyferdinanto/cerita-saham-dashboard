import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/userSession";
import {
  deleteTradeJournalEntry,
  updateTradeJournalEntry,
} from "@/lib/data/investorWorkspace";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updated = await updateTradeJournalEntry(id, session.userId, {
    userId: session.userId,
    ticker: String(body.ticker || "").toUpperCase(),
    setupName: body.setupName || "Trading setup",
    side: body.side || "buy",
    status: body.status || "planned",
    entryPrice: Number(body.entryPrice || 0),
    exitPrice: body.exitPrice ? Number(body.exitPrice) : null,
    stopLoss: body.stopLoss ? Number(body.stopLoss) : null,
    targetPrice: body.targetPrice ? Number(body.targetPrice) : null,
    lots: Number(body.lots || 0),
    conviction: body.conviction || "",
    lessons: body.lessons || "",
    strategyNotes: body.strategyNotes || "",
    entryDate: body.entryDate || null,
    exitDate: body.exitDate || null,
  });

  if (!updated) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteTradeJournalEntry(id, session.userId);
  return NextResponse.json({ ok: true });
}