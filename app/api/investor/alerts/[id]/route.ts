import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import StockAlert from "@/lib/models/StockAlert";
import { requireUserSession } from "@/lib/userSession";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  await connectDB();

  const updated = await StockAlert.findOneAndUpdate(
    { _id: id, userId: session.userId },
    {
      ticker: String(body.ticker || "").toUpperCase(),
      label: body.label || "Alert harga",
      condition: body.condition || "above_price",
      price: Number(body.price || 0),
      isActive: body.isActive !== false,
      notes: body.notes || "",
    },
    { new: true }
  ).lean();

  if (!updated) return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  return NextResponse.json({ ...updated, _id: String(updated._id) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  await StockAlert.deleteOne({ _id: id, userId: session.userId });
  return NextResponse.json({ ok: true });
}