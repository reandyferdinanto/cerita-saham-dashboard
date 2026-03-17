import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import StockAlert from "@/lib/models/StockAlert";
import { requireUserSession } from "@/lib/userSession";

export async function GET(req: NextRequest) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const alerts = await StockAlert.find({ userId: session.userId }).sort({ updatedAt: -1 }).lean();
  return NextResponse.json(alerts.map((alert) => ({ ...alert, _id: String(alert._id) })));
}

export async function POST(req: NextRequest) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  await connectDB();
  const created = await StockAlert.create({
    userId: session.userId,
    ticker: String(body.ticker || "").toUpperCase(),
    label: body.label || "Alert harga",
    condition: body.condition || "above_price",
    price: Number(body.price || 0),
    isActive: body.isActive !== false,
    notes: body.notes || "",
  });

  return NextResponse.json({ ...created.toObject(), _id: String(created._id) }, { status: 201 });
}