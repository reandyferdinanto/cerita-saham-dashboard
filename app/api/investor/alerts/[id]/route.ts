import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/userSession";
import {
  deleteStockAlert,
  updateStockAlert,
} from "@/lib/data/investorWorkspace";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updated = await updateStockAlert(id, session.userId, {
    userId: session.userId,
    ticker: String(body.ticker || "").toUpperCase(),
    label: body.label || "Alert harga",
    condition: body.condition || "above_price",
    price: Number(body.price || 0),
    isActive: body.isActive !== false,
    notes: body.notes || "",
  });

  if (!updated) return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteStockAlert(id, session.userId);
  return NextResponse.json({ ok: true });
}