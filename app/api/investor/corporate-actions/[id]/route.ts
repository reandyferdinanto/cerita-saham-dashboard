import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/userSession";
import {
  deleteCorporateAction,
  updateCorporateAction,
} from "@/lib/data/investorWorkspace";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updated = await updateCorporateAction(id, session.userId, {
    userId: session.userId,
    ticker: String(body.ticker || "").toUpperCase(),
    title: body.title || "Aksi korporasi",
    actionType: body.actionType || "other",
    actionDate: body.actionDate,
    status: body.status || "upcoming",
    notes: body.notes || "",
  });

  if (!updated) return NextResponse.json({ error: "Corporate action not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteCorporateAction(id, session.userId);
  return NextResponse.json({ ok: true });
}