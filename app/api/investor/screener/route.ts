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

  const rawPreset = req.nextUrl.searchParams.get("preset") || "under300";
  const rawPriceBucket = req.nextUrl.searchParams.get("priceBucket") || "under300";
  const presetMap: Record<string, ScreenerPreset> = {
    under300: "under300_focus",
    support: "support_lock",
    sideways: "sideways_accumulation",
    markup: "early_markup",
    scout: "markup_scout",
    demand: "demand_surge",
    reclaim: "washout_reclaim",
    rotation: "stealth_rotation",
  };

  const preset = presetMap[rawPreset] || "under300_focus";
  const priceBucket = (["all", "under200", "under300", "200to500", "above500"].includes(rawPriceBucket) ? rawPriceBucket : "under300") as PriceBucket;

  const result = await getBandarmologyScreener({
    preset,
    priceBucket,
    limit: Math.min(Number(req.nextUrl.searchParams.get("limit") || 12), 12),
    candidateLimit: Math.min(Number(req.nextUrl.searchParams.get("candidateLimit") || (priceBucket === "under200" || priceBucket === "under300" ? 180 : 120)), 220),
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