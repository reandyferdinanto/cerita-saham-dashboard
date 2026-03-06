import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import WatchlistModel from "@/lib/models/Watchlist";
import { verifyToken } from "@/lib/auth";

// POST /api/admin/migrate-watchlist
// One-time migration: seeds MongoDB with the data array sent in the body.
// Only superadmin can call this.
export async function POST(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await verifyToken(token);
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries: {
    ticker: string;
    name?: string;
    tp?: number | null;
    sl?: number | null;
    bandarmology?: string;
    addedAt?: string;
  }[] = await req.json();

  if (!Array.isArray(entries)) {
    return NextResponse.json({ error: "Body must be an array" }, { status: 400 });
  }

  await connectDB();

  let inserted = 0;
  let skipped = 0;

  for (const entry of entries) {
    const ticker = entry.ticker?.toUpperCase();
    if (!ticker) continue;
    const exists = await WatchlistModel.findOne({ ticker });
    if (exists) { skipped++; continue; }
    await WatchlistModel.create({
      ticker,
      name: entry.name || ticker,
      tp: entry.tp ?? null,
      sl: entry.sl ?? null,
      bandarmology: entry.bandarmology || "",
      addedAt: entry.addedAt || new Date().toISOString(),
    });
    inserted++;
  }

  return NextResponse.json({ success: true, inserted, skipped });
}

