import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/userSession";
import {
  BandarmologyScreenerRow,
  getBandarmologyScreener,
  PriceBucket,
  ScreenerPreset,
} from "@/lib/bandarmologyScreener";

export async function GET(req: NextRequest) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawPreset = req.nextUrl.searchParams.get("preset") || "ideal";
  const rawPriceBucket = req.nextUrl.searchParams.get("priceBucket") || "all";
  const presetMap: Record<string, ScreenerPreset> = {
    momentum: "ideal",
    ideal: "ideal",
    breakout: "research_breakout",
    pullback: "research_pullback",
    defensive: "defensive",
    accumulation: "accumulation",
    demand: "demand",
    position: "research_position",
  };

  const preset = presetMap[rawPreset] || "ideal";
  const priceBucket = (["all", "under200", "200to500", "above500"].includes(rawPriceBucket) ? rawPriceBucket : "all") as PriceBucket;

  const result = await getBandarmologyScreener({
    preset,
    priceBucket,
    limit: Math.min(Number(req.nextUrl.searchParams.get("limit") || 12), 12),
    candidateLimit: Math.min(Number(req.nextUrl.searchParams.get("candidateLimit") || (priceBucket === "under200" ? 140 : 110)), 180),
  });

  return NextResponse.json({
    preset,
    priceBucket,
    rows: result.rows.map((row: BandarmologyScreenerRow) => ({
      ticker: row.ticker,
      name: row.name,
      price: row.price,
      changePercent: row.changePercent,
      score: row.fitScore,
      conviction: row.conviction,
      technicalScore: row.technicalScore,
      accumulationBias: row.accumulationBias,
      breakoutReadiness: row.breakoutReadiness,
      phase: row.phase,
      operatorBias: row.operatorBias,
      actionBias: row.actionBias,
      reasons: row.reasons,
      support: row.support,
      resistance: row.resistance,
    })),
  });
}