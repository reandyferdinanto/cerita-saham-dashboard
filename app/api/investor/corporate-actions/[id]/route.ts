import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CorporateAction from "@/lib/models/CorporateAction";
import { requireUserSession } from "@/lib/userSession";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  await connectDB();

  const updated = await CorporateAction.findOneAndUpdate(
    { _id: id, userId: session.userId },
    {
      ticker: String(body.ticker || "").toUpperCase(),
      title: body.title || "Aksi korporasi",
      actionType: body.actionType || "other",
      actionDate: body.actionDate,
      status: body.status || "upcoming",
      notes: body.notes || "",
    },
    { new: true }
  ).lean();

  if (!updated) return NextResponse.json({ error: "Corporate action not found" }, { status: 404 });
  return NextResponse.json({ ...updated, _id: String(updated._id) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  await CorporateAction.deleteOne({ _id: id, userId: session.userId });
  return NextResponse.json({ ok: true });
}