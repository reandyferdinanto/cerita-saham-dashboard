import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/userSession";
import {
  createStockAlert,
  listStockAlerts,
} from "@/lib/data/investorWorkspace";

export async function GET(req: NextRequest) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await listStockAlerts(session.userId));
}

export async function POST(req: NextRequest) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const created = await createStockAlert({
    userId: session.userId,
    ticker: String(body.ticker || "").toUpperCase(),
    label: body.label || "Alert harga",
    condition: body.condition || "above_price",
    price: Number(body.price || 0),
    isActive: body.isActive !== false,
    notes: body.notes || "",
  });

  return NextResponse.json(created, { status: 201 });
}