import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/userSession";
import {
  createTradeJournalEntry,
  listTradeJournalEntries,
} from "@/lib/data/investorWorkspace";

export async function GET(req: NextRequest) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await listTradeJournalEntries(session.userId));
}

export async function POST(req: NextRequest) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const created = await createTradeJournalEntry({
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

  return NextResponse.json(created, { status: 201 });
}