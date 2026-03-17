import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import TradeJournalEntry from "@/lib/models/TradeJournalEntry";
import { requireUserSession } from "@/lib/userSession";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  await connectDB();

  const updated = await TradeJournalEntry.findOneAndUpdate(
    { _id: id, userId: session.userId },
    {
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
    },
    { new: true }
  ).lean();

  if (!updated) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  return NextResponse.json({ ...updated, _id: String(updated._id) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  await TradeJournalEntry.deleteOne({ _id: id, userId: session.userId });
  return NextResponse.json({ ok: true });
}